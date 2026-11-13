// Studio engine: decodes the phone's H.264 with WebCodecs, composites the scene on a canvas,
// mixes audio with WebAudio, and feeds MediaRecorder chunks to ffmpeg in the main process.
const api = window.api

const WORKLET = `
class PCM extends AudioWorkletProcessor {
  constructor() {
    super(); this.q = []; this.off = 0; this.len = 0
    this.port.onmessage = e => {
      this.q.push(e.data); this.len += e.data.length
      while (this.len > 28800 && this.q.length > 1) { this.len -= this.q.shift().length - this.off; this.off = 0 } // cap latency ~300ms
    }
  }
  process(_, out) {
    const L = out[0][0], R = out[0][1] || L
    for (let i = 0; i < L.length; i++) {
      const c = this.q[0]
      if (!c) { L[i] = R[i] = 0; continue }
      L[i] = c[this.off] / 32768; R[i] = c[this.off + 1] / 32768
      this.off += 2; this.len -= 2
      if (this.off >= c.length) { this.q.shift(); this.off = 0 }
    }
    return true
  }
}
registerProcessor('pcm', PCM)`

const FONT = '-apple-system, "Segoe UI", system-ui, sans-serif'
const hex = n => n.toString(16).padStart(2, '0')
function avcCodec(d) { // codec string from the SPS inside an Annex B config packet
  for (let i = 0; i + 6 < d.length; i++)
    if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 1 && (d[i + 3] & 0x1f) === 7) return 'avc1.' + hex(d[i + 4]) + hex(d[i + 5]) + hex(d[i + 6])
  return 'avc1.640028'
}

export class Engine {
  s = { fps: 30 }
  recs = {}
  res = {} // per-layer media resources
  geo = {} // per-layer drawn geometry (canvas px), for hit-testing
  focus = ''
  ts = 0

  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    const ac = this.ac = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
    this.dest = ac.createMediaStreamDestination()
    this.ch = {}
    for (const k of ['phone', 'mic']) {
      const gain = ac.createGain(), an = ac.createAnalyser()
      an.fftSize = 512
      gain.connect(an); gain.connect(this.dest)
      this.ch[k] = { gain, an, buf: new Float32Array(512) }
    }
    this.monitor = ac.createGain()
    this.monitor.gain.value = 0
    this.ch.phone.gain.connect(this.monitor).connect(ac.destination)
    ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))).then(() => {
      this.pcm = new AudioWorkletNode(ac, 'pcm', { numberOfInputs: 0, outputChannelCount: [2] })
      this.pcm.connect(this.ch.phone.gain)
    })
    api.on('browser:frame', (id, w, h, buf) => { // offscreen web page frames arrive as BGRA
      const r = this.res[id]
      if (!r) return
      const d = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength)
      for (let i = 0; i < d.length; i += 4) { const t = d[i]; d[i] = d[i + 2]; d[i + 2] = t }
      createImageBitmap(new ImageData(d, w, h)).then(b => { r.el?.close?.(); r.el = b })
    })
    addEventListener('pointerdown', () => ac.state !== 'running' && ac.resume())
  }

  set(s) {
    if (this.s.sceneId && s.sceneId !== this.s.sceneId && +s.trans > 0 && s.canvas === this.s.canvas) { // snapshot for the fade transition
      const c = this.fade = document.createElement('canvas')
      c.width = this.canvas.width; c.height = this.canvas.height
      c.getContext('2d').drawImage(this.canvas, 0, 0)
      this.fadeT = performance.now(); this.fadeMs = +s.trans
    }
    if (s.fps !== this.s.fps || !this.timer) { clearInterval(this.timer); this.timer = setInterval(() => this.draw(), 1000 / s.fps) }
    const [w, h] = s.canvas.split('x').map(Number)
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h }
    this.ch.phone.gain.gain.value = s.phoneVol
    this.ch.mic.gain.gain.value = s.micVol
    this.monitor.gain.value = s.monitor ? 1 : 0
    this.s = s
    this.sync()
  }

  // ---- phone video ----
  pushVideo(p) {
    if (p.config) { this.cfg = p.data; this.needKey = true; this.dec?.state === 'configured' && this.dec.close(); this.dec = null; return }
    if (!this.cfg || (this.needKey && !p.key)) return
    let data = p.data
    if (p.key) {
      if (!this.dec || this.dec.state !== 'configured') {
        this.dec = new VideoDecoder({
          output: f => { this.frame?.close(); this.frame = f },
          error: e => { console.warn('decoder', e); this.needKey = true }
        })
        this.dec.configure({ codec: avcCodec(this.cfg), optimizeForLatency: true })
      }
      data = new Uint8Array(this.cfg.length + p.data.length)
      data.set(this.cfg); data.set(p.data, this.cfg.length)
      this.needKey = false
    }
    if (this.dec.decodeQueueSize > 20) { this.needKey = true; return } // fell behind: wait for the next key frame
    try { this.dec.decode(new EncodedVideoChunk({ type: p.key ? 'key' : 'delta', timestamp: (this.ts += 16666), data })) } catch { this.needKey = true }
  }

  pushAudio(d) { this.pcm?.port.postMessage(new Int16Array(d.buffer, d.byteOffset, d.byteLength >> 1)) }

  clear() { this.frame?.close(); this.frame = null; this.rect = null; this.cfg = null; this.focus = '' }

  get hidden() { return !!(this.s.guardPkg && this.focus && this.focus !== this.s.guardPkg) }

  // ---- scene ----
  get scene() { return this.s.scenes?.find(x => x.id === this.s.sceneId) || this.s.scenes?.[0] }

  media(l) { // → [drawable, width, height]
    if (l.type === 'phone') { const f = this.frame; return f && !this.hidden ? [f, f.displayWidth, f.displayHeight] : null }
    const r = this.res[l.id]?.el
    if (!r) return null
    const w = r.videoWidth || r.naturalWidth || r.width, h = r.videoHeight || r.naturalHeight || r.height
    return w && h ? [r, w, h] : null
  }

  draw() {
    const { ctx } = this, W = this.canvas.width, H = this.canvas.height, sc = this.scene, f = this.frame
    if (!sc) return
    ctx.fillStyle = sc.bg
    if (sc.bg2) { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, sc.bg); g.addColorStop(1, sc.bg2); ctx.fillStyle = g }
    ctx.fillRect(0, 0, W, H)
    if (sc.bgBlur && f && !this.hidden) {
      const fw = f.displayWidth, fh = f.displayHeight, c = Math.max(W / fw, H / fh) * 1.15
      ctx.filter = `blur(${Math.round(H * 0.04)}px) brightness(0.5)`
      ctx.drawImage(f, (W - fw * c) / 2, (H - fh * c) / 2, fw * c, fh * c)
      ctx.filter = 'none'
    }
    this.geo = {}
    for (const l of sc.layers) if (l.visible) this.layer(l, W, H)
    if (this.hidden) {
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `700 ${H * 0.06}px ${FONT}`
      ctx.fillText('Be right back', W / 2, H / 2)
    }
    if (this.fade) {
      const a = 1 - (performance.now() - this.fadeT) / this.fadeMs
      if (a > 0) { ctx.globalAlpha = a; ctx.drawImage(this.fade, 0, 0); ctx.globalAlpha = 1 } else this.fade = null
    }
  }

  layer(l, W, H) {
    const { ctx } = this, bw = l.w * W, bh = l.h * H
    let dw = bw, dh = bh, src = null, sx = 0, sy = 0, sw = 0, sh = 0, txt, fs
    if (l.type === 'text') {
      fs = bh * 0.52
      txt = (l.text || '').replace('{time}', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      ctx.font = `700 ${fs}px ${FONT}`
      dw = ctx.measureText(txt).width + bh * 0.9
    } else if (l.type !== 'color') {
      src = this.media(l)
      if (src) {
        const [, mw, mh] = src, c = l.crop
        sx = c[0] * mw; sy = c[1] * mh; sw = mw * (1 - c[0] - c[2]); sh = mh * (1 - c[1] - c[3])
        if (l.fit === 'contain') { const k = Math.min(bw / sw, bh / sh); dw = sw * k; dh = sh * k }
        else if (l.fit === 'cover') { const k = Math.max(bw / sw, bh / sh), cw = bw / k, ch = bh / k; sx += (sw - cw) / 2; sy += (sh - ch) / 2; sw = cw; sh = ch }
      }
    }
    const g = this.geo[l.id] = { cx: l.x * W, cy: l.y * H, w: dw, h: dh, rot: l.rot * Math.PI / 180, sx, sy, sw, sh, flip: l.flip, phone: l.type === 'phone' && !!src }
    if (!src && l.type !== 'text' && l.type !== 'color') return // nothing to draw yet, but still selectable
    const x = -dw / 2, y = -dh / 2, gr = l.grade, path = () => { ctx.beginPath(); ctx.roundRect(x, y, dw, dh, l.radius * Math.min(dw, dh)) }
    ctx.save()
    ctx.translate(g.cx, g.cy); ctx.rotate(g.rot); ctx.globalAlpha = l.opacity
    if (l.shadow && (l.type !== 'text' || l.bgOn)) {
      path(); ctx.shadowColor = `rgba(0,0,0,${l.shadow})`; ctx.shadowBlur = H * 0.04; ctx.shadowOffsetY = H * 0.01
      ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowColor = 'transparent'
    }
    ctx.save(); path(); ctx.clip()
    const fl = [gr.b !== 1 && `brightness(${gr.b})`, gr.c !== 1 && `contrast(${gr.c})`, gr.s !== 1 && `saturate(${gr.s})`, gr.hue && `hue-rotate(${gr.hue}deg)`,
      gr.sepia && `sepia(${gr.sepia})`, gr.blur && `blur(${gr.blur}px)`].filter(Boolean).join(' ')
    if (fl) ctx.filter = fl
    if (l.flip) ctx.scale(-1, 1)
    if (src) ctx.drawImage(src[0], sx, sy, sw, sh, x, y, dw, dh)
    else if (l.type === 'color') {
      const gd = ctx.createLinearGradient(x, y, x + dw, y + dh); gd.addColorStop(0, l.color); gd.addColorStop(1, l.color2 || l.color)
      ctx.fillStyle = gd; ctx.fillRect(x, y, dw, dh)
    } else {
      if (l.bgOn) { ctx.fillStyle = l.bg; ctx.fillRect(x, y, dw, dh) }
      ctx.fillStyle = l.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, fs * 0.05)
    }
    ctx.restore()
    if (l.border) { path(); ctx.lineWidth = l.border * H / 1080; ctx.strokeStyle = l.borderColor; ctx.stroke() }
    ctx.restore()
  }

  local(g, px, py) { // canvas point → layer-local coordinates (origin at the layer centre)
    const dx = px - g.cx, dy = py - g.cy, c = Math.cos(-g.rot), s = Math.sin(-g.rot)
    return [dx * c - dy * s, dx * s + dy * c]
  }
  hit(px, py) {
    const ls = this.scene?.layers || []
    for (let i = ls.length - 1; i >= 0; i--) {
      const g = this.geo[ls[i].id]
      if (!g) continue
      const [x, y] = this.local(g, px, py)
      if (Math.abs(x) <= g.w / 2 && Math.abs(y) <= g.h / 2) return ls[i].id
    }
    return ''
  }
  toPhone(px, py, clamp) { // canvas point → phone screen coordinates, through the top phone layer
    const g = Object.values(this.geo).reverse().find(g => g.phone), f = this.frame
    if (!g || !f || this.hidden) return null
    let [u, v] = this.local(g, px, py)
    u = u / g.w + 0.5; v = v / g.h + 0.5
    if (g.flip) u = 1 - u
    if (!clamp && (u < 0 || v < 0 || u > 1 || v > 1)) return null
    const cl = n => Math.max(0, Math.min(1, n))
    return { x: Math.round(g.sx + cl(u) * g.sw), y: Math.round(g.sy + cl(v) * g.sh), w: f.displayWidth, h: f.displayHeight }
  }

  // ---- layer media (webcam, screen, image, video, web page) ----
  sync() {
    const keep = new Set()
    for (const l of this.scene?.layers || []) {
      if (!['webcam', 'screen', 'image', 'video', 'browser'].includes(l.type)) continue
      keep.add(l.id)
      const key = l.type + '|' + (l.src || '')
      if (this.res[l.id]?.key === key) continue
      this.res[l.id]?.stop?.()
      const r = this.res[l.id] = { key }
      if (l.src) this.open(l, r).then(() => this.res[l.id] !== r && r.stop?.()).catch(e => this.onError?.(e))
    }
    for (const id in this.res) if (!keep.has(id)) { this.res[id].stop?.(); delete this.res[id] }
  }

  async open(l, r) {
    const md = navigator.mediaDevices
    const live = async stream => {
      const v = document.createElement('video')
      v.muted = true; v.srcObject = stream
      r.stop = () => stream.getTracks().forEach(t => t.stop())
      await v.play(); r.el = v
    }
    if (l.type === 'webcam') {
      await api.invoke('media:ask', 'camera')
      await live(await md.getUserMedia({ video: { deviceId: l.src === 'default' ? undefined : { exact: l.src }, width: 1280, height: 720 } }))
    } else if (l.type === 'screen') {
      await api.invoke('screen:pick', l.src)
      await live(await md.getDisplayMedia({ video: { frameRate: 30 } }))
    } else if (l.type === 'browser') {
      await api.invoke('browser:open', l.id, l.src)
      r.stop = () => api.send('browser:close', l.id)
    } else {
      const vid = l.type === 'video'
      const url = URL.createObjectURL(new Blob([await api.invoke('file:read', l.src)], vid ? { type: /\.webm$/i.test(l.src) ? 'video/webm' : 'video/mp4' } : {}))
      r.stop = () => URL.revokeObjectURL(url)
      if (vid) { const v = document.createElement('video'); v.muted = v.loop = true; v.src = url; await v.play(); r.el = v }
      else { const i = new Image(); i.src = url; await i.decode(); r.el = i }
    }
  }

  // ---- audio / webcam inputs ----
  async setMic(id) {
    this.micSrc?.disconnect(); this.micStream?.getTracks().forEach(t => t.stop()); this.micSrc = this.micStream = null
    if (!id) return
    await api.invoke('media:ask', 'microphone')
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id === 'default' ? undefined : { exact: id }, echoCancellation: false, autoGainControl: false } })
    this.micSrc = this.ac.createMediaStreamSource(this.micStream)
    this.micSrc.connect(this.ch.mic.gain)
  }

  level(k) { // peak mapped from -54dB..0dB to 0..1
    const { an, buf } = this.ch[k]
    an.getFloatTimeDomainData(buf)
    let p = 0
    for (const x of buf) p = Math.max(p, Math.abs(x))
    return p ? Math.max(0, Math.min(1, 1 + (20 * Math.log10(p)) / 54)) : 0
  }

  // ---- outputs ----
  async startOutput(id, o) {
    await api.invoke('out:start', id, o)
    if (!Object.keys(this.recs).length) this.vstream = this.canvas.captureStream(this.s.fps)
    const stream = new MediaStream([this.vstream.getVideoTracks()[0], this.dest.stream.getAudioTracks()[0]])
    const mimeType = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'].find(m => MediaRecorder.isTypeSupported(m))
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: id === 'rec' ? 12e6 : Math.max(8e6, o.bitrate * 2500), audioBitsPerSecond: 192000 })
    let chain = Promise.resolve()
    rec.ondataavailable = e => { if (e.data.size) chain = chain.then(async () => api.send('out:data', id, new Uint8Array(await e.data.arrayBuffer()))) }
    rec.onstop = () => chain.then(() => api.send('out:stop', id))
    rec.start(200)
    this.recs[id] = rec
  }

  stopOutput(id) {
    const r = this.recs[id]
    delete this.recs[id]
    if (r && r.state !== 'inactive') r.stop()
    else api.send('out:stop', id)
  }
}
