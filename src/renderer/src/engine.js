// Studio engine: decodes the phone's H.264 with WebCodecs, composites the scene on a canvas,
// mixes audio with WebAudio, and feeds MediaRecorder chunks to ffmpeg in the main process.
import { Captions } from './captions'
import { PITCH_WORKLET, VoiceChain, voiceOf } from './voice'
import { renderSfx } from './sfx'
import { drawPointer, drawTrail } from './pointerfx'
import { newAnn, drawAnn } from './ann'
import { drawCap } from './capfx'
import { gpuFx } from './gpu'
import { drawBanner, drawBg, drawText, drawAlertFx } from './fx'
import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor'
import rnWorklet from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
import rnWasm from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import rnSimd from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'
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
// A second H.264 feed (iPhone/iPad): same packet format as the Android one.
class Feed {
  frame = null; keep = []; cfg = null; needKey = true; ts = 0; dec = null
  push(p) {
    if (p.config) { this.cfg = p.data; this.needKey = true; if (this.dec?.state === 'configured') this.dec.close(); this.dec = null; return }
    if (!this.cfg || (this.needKey && !p.key)) return
    let data = p.data
    if (p.key) {
      if (!this.dec || this.dec.state !== 'configured') {
        this.dec = new VideoDecoder({ output: f => { this.keep.push(this.frame); this.frame = f; while (this.keep.length > 3) this.keep.shift()?.close() }, error: () => { this.needKey = true } })
        this.dec.configure({ codec: avcCodec(this.cfg), optimizeForLatency: true })
      }
      data = new Uint8Array(this.cfg.length + p.data.length); data.set(this.cfg); data.set(p.data, this.cfg.length); this.needKey = false
    }
    if (!this.dec || this.dec.decodeQueueSize > 20) { this.needKey = true; return }
    try { this.dec.decode(new EncodedVideoChunk({ type: p.key ? 'key' : 'delta', timestamp: (this.ts += 16666), data })) } catch { this.needKey = true }
  }
  clear() { this.frame?.close(); this.frame = null; this.keep.splice(0).forEach(f => f?.close()); this.cfg = null; try { this.dec?.close() } catch {} this.dec = null }
}

function avcCodec(d) { // codec string from the SPS inside an Annex B config packet
  for (let i = 0; i + 6 < d.length; i++)
    if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 1 && (d[i + 3] & 0x1f) === 7) return 'avc1.' + hex(d[i + 4]) + hex(d[i + 5]) + hex(d[i + 6])
  return 'avc1.640028'
}

export const MIX0 = { pan: 0, low: 0, mid: 0, high: 0, comp: 0, delay: 0, gate: 0, hp: false, mon: false }
export class Engine {
  s = { fps: 30 }
  recs = {}
  res = {} // per-layer media resources
  geo = {} // per-layer drawn geometry (canvas px), for hit-testing
  chat = [] // recent YouTube chat messages
  sounds = {}
  focus = ''
  ts = 0
  keep = [] // recently replaced phone frames, still possibly referenced by a pending canvas draw

  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.ann = newAnn()
    const ac = this.ac = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
    this.dest = ac.createMediaStreamDestination()
    // Mixer: each channel runs fader → delay → noise gate → 3-band EQ → compressor → pan → meter, into the master bus (the stream mix).
    this.master = ac.createGain(); this.master.connect(this.dest)
    const meter = node => { const an = ac.createAnalyser(); an.fftSize = 512; node.connect(an); return { an, buf: new Float32Array(512) } }
    this.ch = {}
    for (const k of ['phone', 'mic']) {
      const gain = ac.createGain(), delay = ac.createDelay(1), ng = ac.createGain(), low = ac.createBiquadFilter(), mid = ac.createBiquadFilter(), high = ac.createBiquadFilter(), hp = ac.createBiquadFilter()
      const comp = ac.createDynamicsCompressor(), pan = ac.createStereoPanner(), mon = ac.createGain()
      low.type = 'lowshelf'; low.frequency.value = 160; mid.type = 'peaking'; mid.frequency.value = 1500; mid.Q.value = 0.8; high.type = 'highshelf'; high.frequency.value = 6000
      hp.type = 'highpass'; hp.frequency.value = 10; comp.threshold.value = 0; comp.ratio.value = 1; comp.attack.value = 0.005; comp.release.value = 0.2; mon.gain.value = 0
      gain.connect(delay).connect(ng).connect(hp).connect(low).connect(mid).connect(high).connect(comp).connect(pan).connect(this.master)
      pan.connect(mon).connect(ac.destination)
      this.ch[k] = { gain, delay, ng, hp, low, mid, high, comp, pan, mon, ...meter(pan) }
    }
    this.gate = ac.createGain() // push-to-talk / push-to-mute
    this.vin = ac.createGain(); this.gate.connect(this.vin) // voice changer sits between the gate and the mic fader
    this.voiceReady = ac.audioWorklet.addModule(URL.createObjectURL(new Blob([PITCH_WORKLET], { type: 'text/javascript' })))
    this.voice = new VoiceChain(ac, this.vin, this.ch.mic.gain); this.mics = {}
    this.musicG = ac.createGain(); this.musicBus = ac.createGain(); this.musicG.connect(this.musicBus); this.musicBus.connect(this.master); this.musicBus.connect(ac.destination)
    this.ch.music = meter(this.musicBus)
    this.fx = ac.createGain() // alert sounds / soundboard: heard by you and by the stream
    this.fx.connect(this.master); this.fx.connect(ac.destination)
    this.ch.fx = meter(this.fx)
    this.ch.master = meter(this.master)
    this.monitor = this.ch.phone.mon
    ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))).then(() => {
      this.pcm = new AudioWorkletNode(ac, 'pcm', { numberOfInputs: 0, outputChannelCount: [2] })
      this.pcm.connect(this.ch.phone.gain)
      this.pcm2 = new AudioWorkletNode(ac, 'pcm', { numberOfInputs: 0, outputChannelCount: [2] }) // iPhone sound, on the same "Phone audio" fader
      this.pcm2.connect(this.ch.phone.gain)
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
      this.fadeT = performance.now(); this.fadeMs = +s.trans; this.fadeType = s.transType || 'fade'
      if (s.transType === 'stinger' && s.stinger) this.playStinger(s.stinger)
    }
    if (s.fps !== this.s.fps || !this.timer) { clearInterval(this.timer); this.timer = setInterval(() => this.draw(), 1000 / s.fps) }
    const [w, h] = s.canvas.split('x').map(Number)
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h }
    this.ch.phone.gain.gain.value = s.phoneMute ? 0 : s.phoneVol
    this.ch.mic.gain.gain.value = s.micMute ? 0 : s.micVol
    this.fx.gain.value = s.fxMute ? 0 : s.fxVol ?? 0.8
    this.musicBus.gain.value = s.musicMute ? 0 : 1
    this.master.gain.value = s.masterMute ? 0 : s.masterVol ?? 1
    const t = this.ac.currentTime
    for (const k of ['phone', 'mic']) { // per-channel processing from the mixer
      const c = this.ch[k], m = { ...MIX0, ...s.mix?.[k] }
      c.delay.delayTime.setTargetAtTime(m.delay, t, 0.02); c.pan.pan.setTargetAtTime(m.pan, t, 0.02)
      c.low.gain.setTargetAtTime(m.low, t, 0.02); c.mid.gain.setTargetAtTime(m.mid, t, 0.02); c.high.gain.setTargetAtTime(m.high, t, 0.02)
      c.hp.frequency.setTargetAtTime(m.hp ? 90 : 10, t, 0.02)
      c.comp.threshold.setTargetAtTime(-40 * m.comp, t, 0.02); c.comp.ratio.setTargetAtTime(1 + 11 * m.comp, t, 0.02); c.comp.knee.setTargetAtTime(m.comp ? 12 : 0, t, 0.02)
      c.mon.gain.value = (k === 'phone' ? s.monitor : m.mon) ? 1 : 0
    }
    if (!!s.noise !== !!this.s.noise) this.denoise(s.noise)
    const vk = JSON.stringify(voiceOf(s, 'main')); if (vk !== this.vk) { this.vk = vk; const v = voiceOf(s, 'main'); this.voice.set(v).catch(e => this.onError?.(e)) }
    this.syncMics(s)
    if (!!s.capOn !== !!this.s.capOn || s.capLang !== this.s.capLang) this.setCaptions(s.capOn, s.capLang)
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
          output: f => { this.nframes = (this.nframes || 0) + 1; this.keep.push(this.frame); this.frame = f; while (this.keep.length > 3) this.keep.shift()?.close() }, // the GPU canvas draws lazily: close old frames a few frames later, not at once
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

  ios = new Feed()
  pushIos(p) { this.ios.push(p) }
  pushIosAudio(d) { this.pcm2?.port.postMessage(new Int16Array(d.buffer, d.byteOffset, d.byteLength >> 1)) }
  pushAudio(d) { this.pcm?.port.postMessage(new Int16Array(d.buffer, d.byteOffset, d.byteLength >> 1)) }

  clear() { this.frame?.close(); this.frame = null; this.keep.splice(0).forEach(f => f?.close()); this.rect = null; this.cfg = null; this.focus = '' }

  get hidden() { return !!(this.s.cover || (this.s.guardPkg && this.focus && this.focus !== this.s.guardPkg)) }
  get alerting() { return !!this.alert && performance.now() < this.alert.until }

  // ---- chat, alerts, sounds ----
  pushChat(m) { m.at = performance.now(); this.chat.push(m); if (this.chat.length > 60) this.chat.shift() }
  showAlert(title, sub = '', ms = 7000, afx) { this.alert = { title, sub, afx, at: performance.now(), until: performance.now() + ms } }
  async playSound(path) {
    if (!this.sounds[path]) { const u = await api.invoke('file:read', path); this.sounds[path] = await this.ac.decodeAudioData(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)) }
    const n = this.ac.createBufferSource()
    n.buffer = this.sounds[path]; n.connect(this.fx); n.start()
    this.playing?.stop?.(); this.playing = n
  }
  stopSound() { try { this.playing?.stop() } catch {} this.playing = null }
  drawChat(x, y, w, h, l = {}) {
    const st = l.chatStyle || 'classic', fade = (l.chatFade || 0) * 1000, now = performance.now()
    const { ctx } = this, fs = Math.max(12, w * 0.042), lh = fs * (st === 'bubble' ? 2 : 1.6), ms = this.chat.filter(m => !fade || now - (m.at || now) < fade).slice(-Math.floor(h / lh))
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ms.forEach((m, i) => {
      const yy = y + h - (ms.length - i - 0.5) * lh, plain = m.type === 'chat'
      ctx.globalAlpha = fade ? Math.min(1, (fade - (now - (m.at || now))) / 600) : 1
      ctx.fillStyle = plain ? (st === 'game' ? 'rgba(20,20,30,.75)' : 'rgba(0,0,0,.5)') : m.type === 'superchat' ? 'rgba(250,204,21,.92)' : 'rgba(74,222,128,.9)'
      if (st === 'bubble') { ctx.beginPath(); ctx.roundRect(x, yy - lh / 2 + 3, Math.min(w, fs * 1.6 + ctx.measureText(m.author + m.text).width * 1.15), lh - 6, lh / 2); ctx.fill() }
      else if (st === 'game') { ctx.fillRect(x, yy - lh / 2, w, lh - 2); ctx.fillStyle = plain ? '#f97316' : '#000'; ctx.fillRect(x, yy - lh / 2, fs * 0.2, lh - 2) }
      else if (st !== 'minimal' || !plain) ctx.fillRect(x, yy - lh / 2, w, lh - 2)
      if (st === 'minimal') { ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = fs * 0.4 }
      const a = m.author + (m.amount ? ' · ' + m.amount : '')
      ctx.font = `700 ${fs}px ${FONT}`
      ctx.fillStyle = plain ? `hsl(${[...m.author].reduce((s, c) => s + c.charCodeAt(0), 0) % 360} 85% 72%)` : '#000'
      ctx.fillText(a, x + fs * 0.5, yy)
      const aw = ctx.measureText(a).width
      ctx.font = `500 ${fs}px ${FONT}`; ctx.fillStyle = plain ? '#fff' : '#000'
      ctx.fillText(m.text, x + fs * 0.9 + aw, yy)
      ctx.shadowColor = 'transparent'; ctx.globalAlpha = 1
    })
  }
  drawAlert(x, y, w, h, l) {
    const fxs = this.alert.afx || l?.afx
    if (fxs) return drawAlertFx(this.ctx, x, y, w, h, fxs, this.alert, (performance.now() - this.alert.at) / 1000)
    const { ctx } = this, a = this.alert, g = ctx.createLinearGradient(x, y, x + w, y + h)
    g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#ec4899')
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `800 ${h * 0.3}px ${FONT}`; ctx.fillText(a.title, x + w / 2, y + h * (a.sub ? 0.38 : 0.52), w * 0.94)
    if (a.sub) { ctx.font = `500 ${h * 0.19}px ${FONT}`; ctx.fillText(a.sub, x + w / 2, y + h * 0.72, w * 0.94) }
  }

  // ---- scene ----
  get scene() { return this.s.scenes?.find(x => x.id === this.s.sceneId) || this.s.scenes?.[0] }

  media(l) { // → [drawable, width, height]
    if (l.type === 'phone') { const f = this.frame; return f && !this.hidden ? [f, f.displayWidth, f.displayHeight] : null }
    if (l.type === 'ios') { const f = this.ios.frame; return f && !this.s.cover ? [f, f.displayWidth, f.displayHeight] : null }
    const r = this.res[l.id]?.el
    if (!r) return null
    const w = r.videoWidth || r.naturalWidth || r.width, h = r.videoHeight || r.naturalHeight || r.height
    return w && h ? [r, w, h] : null
  }

  draw() {
    const W = this.canvas.width, H = this.canvas.height, sc = this.scene
    if (!sc) return
    this.geo = this.paint(sc, this.ctx, W, H)
    this.transition(this.ctx, W, H)
    if (this.st?.v && !this.st.v.ended && this.st.v.readyState >= 2) this.ctx.drawImage(this.st.v, 0, 0, W, H) // stinger on top
    const an = this.ann
    if (an.items.length || an.live || an.laser.length || an.spot || an.board !== 'none') drawAnn(this.ctx, W, H, an) // teaching ink, on top of everything
    for (const x of Object.values(this.xc || {})) { // destinations with their own scene or size render to their own canvas
      const fid = x.frameId && this.s.frames?.find(f => f.id === x.frameId)?.sceneId, sx = x.frameId ? this.s.scenes.find(v => v.id === fid) : x.sceneId ? this.s.scenes.find(v => v.id === x.sceneId) : sc
      if (sx) this.paint(sx, x.ctx, x.c.width, x.c.height)
    }
    this.duck()
    this.noiseGate()
  }

  // Paints one scene onto any 2D context; returns the layer geometry (used for hit-testing on the main canvas).
  paint(sc, ctx, W, H, depth = 0) {
    const pc = this.ctx, pg = this.geo, f = this.frame
    this.ctx = ctx; this.geo = {}
    ctx.fillStyle = sc.bg
    if (sc.bg2) { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, sc.bg); g.addColorStop(1, sc.bg2); ctx.fillStyle = g }
    ctx.fillRect(0, 0, W, H)
    const bl = sc.bgSrc && sc.layers.find(l => l.id === sc.bgSrc), b = sc.bgBlur && (bl ? this.media(bl) : f && !this.hidden ? [f, f.displayWidth, f.displayHeight] : null)
    if (b) {
      const [img, fw, fh] = b, c = Math.max(W / fw, H / fh) * 1.15
      ctx.filter = `blur(${Math.round(H * 0.04)}px) brightness(0.5)`
      ctx.drawImage(img, (W - fw * c) / 2, (H - fh * c) / 2, fw * c, fh * c)
      ctx.filter = 'none'
    }
    this.depth = depth
    for (const l of sc.layers) if (l.visible && !l.bgOnly) this.layer(l, W, H)
    if (!depth && this.alerting && !sc.layers.some(l => l.visible && l.type === 'alert')) {
      const w = W * 0.5, h = Math.min(H * 0.14, w * 0.26), x = (W - w) / 2, y = H * 0.06
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, h * 0.3); ctx.clip(); this.drawAlert(x, y, w, h); ctx.restore()
    }
    if (!depth && this.hidden) {
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `700 ${H * 0.06}px ${FONT}`
      ctx.fillText('Be right back', W / 2, H / 2)
    }
    const geo = this.geo
    this.ctx = pc; this.geo = pg
    return geo
  }

  transition(ctx, W, H) { // old scene snapshot over the new one: fade · slide · swipe · zoom · stinger (cut at the midpoint)
    if (!this.fade) return
    const p = (performance.now() - this.fadeT) / this.fadeMs
    if (p >= 1) { this.fade = null; return }
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2, o = this.fade
    ctx.save()
    if (this.fadeType === 'slide') ctx.drawImage(o, -e * W, 0)
    else if (this.fadeType === 'swipe') { ctx.beginPath(); ctx.rect(e * W, 0, W, H); ctx.clip(); ctx.drawImage(o, 0, 0) }
    else if (this.fadeType === 'zoom') { const k = 1 + e * 0.35; ctx.globalAlpha = 1 - e; ctx.drawImage(o, (W - W * k) / 2, (H - H * k) / 2, W * k, H * k) }
    else if (this.fadeType === 'stinger') ctx.drawImage(o, 0, 0)
    else { ctx.globalAlpha = 1 - p; ctx.drawImage(o, 0, 0) }
    ctx.restore()
  }
  async playStinger(path) {
    this.st?.v.pause()
    if (this.st?.path !== path) { const u = URL.createObjectURL(new Blob([await api.invoke('file:read', path)], { type: /\.webm$/i.test(path) ? 'video/webm' : 'video/mp4' })); const v = document.createElement('video'); v.src = u; this.st = { path, v }; this.ac.createMediaElementSource(v).connect(this.fx) }
    const v = this.st.v; v.currentTime = 0
    await v.play().catch(() => {})
    if (v.duration) this.fadeMs = (v.duration * 1000) / 2 // scene cuts halfway through the stinger
  }
  setOut2(on) { // hidden canvas for the second output
    const [w, h] = (this.s.out2?.size || '1080x1920').split('x').map(Number)
    if (!on) { this.canvas2 = null; return }
    const c = this.canvas2 ??= document.createElement('canvas'); c.width = w; c.height = h; this.ctx2 = c.getContext('2d', { alpha: false })
  }

  // ---- webcam face tracking (Chromium FaceDetector: Vision on macOS, Windows.Media on Windows) ----
  talking() { // voice on the mic right now (held briefly so short pauses don't count as silence)
    try { if (!this.s.micMute && this.level('mic') > (this.s.talkLevel ?? 0.3)) this.talkUntil = performance.now() + 700 } catch {}
    return performance.now() < (this.talkUntil || 0)
  }
  faceCrop(l, src, sx, sy, sw, sh) {
    const f = l.face, [el, mw, mh] = src, now = performance.now(), fs = this.fs ??= {}
    const st = fs[l.id] ??= { cx: 0.5, cy: 0.5, z: 1, vx: 0, vy: 0, vz: 0, a: 1, t: 0, lt: now, seen: now, box: null, tx: 0.5, ty: 0.5 }
    this.fd ??= typeof FaceDetector !== 'undefined' ? new FaceDetector({ fastMode: true, maxDetectedFaces: 3 }) : false
    // detect on a small copy of the frame (fast, steady ~10 per second) instead of the full-size video
    if (this.fd && !st.busy && now - st.t > 95 && el.readyState !== 1) {
      st.busy = true; st.t = now
      const W = 320, H = Math.max(1, Math.round(W * mh / mw)), c = this.fdc ??= new OffscreenCanvas(W, H)
      if (c.height !== H) c.height = H
      c.getContext('2d').drawImage(el, 0, 0, W, H)
      this.fd.detect(c).then(r => {
        const b = r.sort((p, q) => q.boundingBox.width * q.boundingBox.height - p.boundingBox.width * p.boundingBox.height)[0]?.boundingBox
        if (!b) return
        const x = (b.x + b.width / 2) / W, y = (b.y + b.height / 2) / H, w = b.width / W, h = b.height / H, o = st.box
        // smooth out detector jitter: blend each new box with the last one (fast moves still get through)
        const k = o ? Math.min(0.6, Math.max(0.12, Math.hypot(x - o.x, y - o.y) / 0.08)) : 1 // small wobbles are mostly noise, big moves are real
        st.box = o ? { x: o.x + (x - o.x) * k, y: o.y + (y - o.y) * k, w: o.w + (w - o.w) * 0.25, h: o.h + (h - o.h) * 0.25 } : { x, y, w, h }
        st.seen = performance.now()
      }).catch(() => {}).finally(() => { st.busy = false })
    }
    const dt = Math.min(0.1, Math.max(0.001, (now - st.lt) / 1000)); st.lt = now
    const lost = now - st.seen > 1500, b = !lost && st.box
    // target: face centre with head room; a dead zone keeps small head movements from nudging the frame
    if (f.center !== false && b) {
      const gx = b.x, gy = b.y - b.h * (f.head ?? 0.12), dz = 0.055 / Math.max(1, st.z)
      if (Math.abs(gx - st.tx) > dz) st.tx = gx - Math.sign(gx - st.tx) * dz * 0.5
      if (Math.abs(gy - st.ty) > dz) st.ty = gy - Math.sign(gy - st.ty) * dz * 0.5
    } else if (lost || f.center === false) { st.tx = 0.5; st.ty = 0.5 }
    let z = f.zoom ?? 1
    if (f.auto && b) z = Math.max(z, Math.min(3, (f.size ?? 0.42) / Math.max(b.h * mh / sh, 0.01)))
    if (f.talk && this.talking()) z *= f.talk
    z = Math.min(4, Math.max(1, z))
    // critically damped spring: smooth start and stop, no overshoot, same feel at any frame rate
    const w = 2 * Math.PI * (0.5 + (f.smooth ?? 0.08) * 10), wz = w * 0.7
    const spring = (x, v, t, k) => { const a = k * k * (t - x) - 2 * k * v; v += a * dt; return [x + v * dt, v] }
    ;[st.cx, st.vx] = spring(st.cx, st.vx, st.tx, w); [st.cy, st.vy] = spring(st.cy, st.vy, st.ty, w); [st.z, st.vz] = spring(st.z, st.vz, z, wz)
    st.a += ((f.hide && now - st.seen > 3000 ? 0 : 1) - st.a) * Math.min(1, dt * 4)
    const cw = sw / st.z, ch = sh / st.z
    const x = Math.min(sx + sw - cw, Math.max(sx, st.cx * mw - cw / 2)), y = Math.min(sy + sh - ch, Math.max(sy, st.cy * mh - ch / 2))
    st.blur = f.blur && b ? { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h } : null
    return [x, y, cw, ch]
  }
  // Draws a media source; with edge fade or face blur it goes through an offscreen canvas so only this layer is masked.
  drawSrc(l, src, sx, sy, sw, sh, x, y, dw, dh) {
    const fd = l.fade, fb = l.face?.on && this.fs?.[l.id]?.blur
    if (!fb && !(fd && fd.some(v => v > 0))) return this.ctx.drawImage(src[0], sx, sy, sw, sh, x, y, dw, dh)
    const W = Math.max(1, Math.round(dw)), H = Math.max(1, Math.round(dh)), oc = this.fadeC ??= new OffscreenCanvas(W, H), o = oc.getContext('2d')
    if (oc.width !== W || oc.height !== H) { oc.width = W; oc.height = H }
    o.globalCompositeOperation = 'source-over'; o.filter = 'none'; o.clearRect(0, 0, W, H)
    o.drawImage(src[0], sx, sy, sw, sh, 0, 0, W, H)
    if (fb) { // privacy blur over the face
      const [, mw, mh] = src, k = W / sw, pad = 0.25, bx = (fb.x - fb.w * pad) * mw, by = (fb.y - fb.h * pad) * mh, bw = fb.w * (1 + 2 * pad) * mw, bh = fb.h * (1 + 2 * pad) * mh
      o.save(); o.beginPath(); o.ellipse((bx + bw / 2 - sx) * k, (by + bh / 2 - sy) * k, bw * k / 2, bh * k / 2, 0, 0, 7); o.clip()
      o.filter = `blur(${Math.round(W / 40)}px)`; o.drawImage(src[0], sx, sy, sw, sh, 0, 0, W, H); o.restore(); o.filter = 'none'
    }
    if (fd) { // [left, right, top, bottom] fractions; mirrored layers swap left/right so the fade stays on screen side
      const [L, R, T, B] = l.flip ? [fd[1], fd[0], fd[2], fd[3]] : fd
      o.globalCompositeOperation = 'destination-in'
      for (const [v, x0, y0, x1, y1] of [[L, 0, 0, W, 0], [R, W, 0, 0, 0], [T, 0, 0, 0, H], [B, 0, H, 0, 0]]) {
        if (!(v > 0)) continue
        const g = o.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(Math.min(1, v), 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,1)')
        o.fillStyle = g; o.fillRect(0, 0, W, H)
      }
    }
    this.ctx.drawImage(oc, x, y, dw, dh)
  }

  // ---- stream pointer: custom animated cursor on screen sources ----
  setPtr(src, x, y, down) {
    const p = this.ptr ??= { trail: [], clickT: -9e9 }, now = performance.now()
    if (down && !p.down) p.clickT = now
    Object.assign(p, { src, x, y, down })
    p.trail.push([x, y, now]); while (p.trail.length > 24 || (p.trail.length && now - p.trail[0][2] > 450)) p.trail.shift()
  }
  layerPtr(l, src, sx, sy, sw, sh, x, y, dw, dh, H) {
    const st = this.s.ptr, on = !!st?.on, r = this.res[l.id], p = this.ptr
    if (r && r.curOff !== on) { r.curOff = on; r.el?.srcObject?.getVideoTracks()[0]?.applyConstraints({ cursor: on ? 'never' : 'always' }).catch(() => {}) } // hide the system cursor in the capture
    if (!on || !p || p.src !== l.src) return
    const [, mw, mh] = src, map = (nx, ny) => [x + (nx * mw - sx) / sw * dw, y + (ny * mh - sy) / sh * dh], [px, py] = map(p.x, p.y), now = performance.now()
    if (px < x || px > x + dw || py < y || py > y + dh) return
    const u = H * 0.022 * (st.size || 1), c = this.ctx
    if (st.trail !== false) drawTrail(c, p.trail.map(q => [...map(q[0], q[1]), q[2]]), u, st.color || '#7dd3fc', now)
    c.save(); if (l.flip) { c.translate(px, py); c.scale(-1, 1); c.translate(-px, -py) }
    drawPointer(c, px, py, u, st, now / 1000, (now - p.clickT) / 1000); c.restore()
  }

  // ---- live captions ----
  setCaptions(on, lang) { this.cap ??= new Captions(this); on ? this.cap.start(lang || 'en-in') : this.cap.state !== 'off' && this.cap.stop() }
  drawCaption(x, y, w, h, l) {
    const c = this.cap, now = performance.now()
    const txt = c?.state === 'on' ? (now - c.t < (l.hold || 4) * 1000 ? c.text : '') : c?.state === 'loading' ? 'Getting captions ready…' : ''
    if (c?.state === 'on' && !txt && c.final) c.final = '' // start fresh after a pause
    drawCap(this.ctx, x, y, w, h, l, txt, c?.state === 'on' ? (now - c.wt) / 1000 : 9)
  }

  // ---- extra microphones: each its own fader, voice, meter and monitor, mixed into the master bus ----
  syncMics(s) {
    const want = new Map((s.mics || []).filter(m => m.device).map(m => [m.id, m]))
    for (const [id, m] of Object.entries(this.mics)) if (!want.has(id) || want.get(id).device !== m.device) { m.stream?.getTracks().forEach(t => t.stop()); m.voice.dispose(); m.gain.disconnect(); m.mon.disconnect(); delete this.mics[id]; delete this.ch['mic:' + id] }
    for (const [id, c] of want) {
      let m = this.mics[id]
      if (!m) {
        const ac = this.ac, vin = ac.createGain(), gain = ac.createGain(), mon = ac.createGain(), an = ac.createAnalyser(); an.fftSize = 512
        gain.connect(this.master); gain.connect(an); gain.connect(mon).connect(ac.destination)
        m = this.mics[id] = { device: c.device, vin, gain, mon, voice: new VoiceChain(ac, vin, gain) }; this.ch['mic:' + id] = { an, buf: new Float32Array(512) }
        this.openMic(c.device, c.label).then(r => { if (this.mics[id] !== m) return r.st.getTracks().forEach(t => t.stop()); m.stream = r.st; m.src = this.ac.createMediaStreamSource(r.st); m.src.connect(vin)
          if (r.id !== c.device || r.label !== c.label) this.onMicFix?.(id, r) }).catch(e => this.onError?.(e))
      }
      m.gain.gain.value = c.mute ? 0 : c.vol ?? 1; m.mon.gain.value = c.mon ? 1 : 0
      const vk = JSON.stringify(voiceOf(s, id)); if (vk !== m.vk) { m.vk = vk; const v = voiceOf(s, id); m.voice.set(v).catch(e => this.onError?.(e)) }
    }
  }
  // ---- voice preview: record a short take from a mic, then play it back through any voice ----
  async recordTake(key = 'main', sec = 4) {
    const from = key === 'main' ? this.gate : this.mics[key]?.vin
    if (!from) throw new Error('Choose a microphone first')
    const d = this.ac.createMediaStreamDestination(); from.connect(d)
    const rec = new MediaRecorder(d.stream), parts = []; rec.ondataavailable = e => parts.push(e.data)
    await new Promise(r => { rec.onstop = r; rec.start(); setTimeout(() => rec.stop(), sec * 1000) })
    from.disconnect(d)
    this.take = await this.ac.decodeAudioData(await new Blob(parts).arrayBuffer())
    return this.take
  }
  async previewVoice(v) {
    if (!this.take) throw new Error('Record a test first')
    await this.voiceReady; this.prev?.stop(); this.prevChain?.dispose()
    const src = this.ac.createBufferSource(), g = this.ac.createGain(); src.buffer = this.take; g.connect(this.ac.destination)
    const chain = new VoiceChain(this.ac, src, g); await chain.set(v); src.start(); this.prev = src; this.prevChain = chain
    src.onended = () => { chain.dispose(); g.disconnect() }
  }
  stopPreview() { try { this.prev?.stop() } catch {} }
  // ---- sound effects (synthesised) on the Effects channel ----
  async playSfx(name, vol = 1) {
    if (!name) return
    const sfx = this.sfx ??= {}, b = sfx[name] ??= await renderSfx(name, this.ac.sampleRate), src = this.ac.createBufferSource(), g = this.ac.createGain()
    src.buffer = b; g.gain.value = vol; src.connect(g).connect(this.fx); src.start()
  }

  layer(l, W, H) {
    if (l.type === 'sound' || l.type === 'mic') return // audio only
    const { ctx } = this, bw = l.w * W, bh = l.h * H
    let dw = bw, dh = bh, src = null, sx = 0, sy = 0, sw = 0, sh = 0, txt, fs
    if (l.type === 'text') {
      fs = bh * 0.52
      txt = (l.text || '').replace('{time}', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      ctx.font = `700 ${fs}px ${FONT}`
      dw = ctx.measureText(txt).width + bh * 0.9
    } else if (l.type === 'scene') {
      src = this.nested(l, W, H)
    } else if (!['color', 'mask', 'goal', 'lower', 'chat', 'alert', 'banner', 'fxbg', 'fxtext', 'caption'].includes(l.type)) {
      src = this.media(l)
      if (src && l.fx) src = gpuFx(l.id, src, l.fx)
      if (src) {
        const [, mw, mh] = src, c = l.crop
        sx = c[0] * mw; sy = c[1] * mh; sw = mw * (1 - c[0] - c[2]); sh = mh * (1 - c[1] - c[3])
        if (l.type === 'webcam' && l.face?.on) [sx, sy, sw, sh] = this.faceCrop(l, src, sx, sy, sw, sh)
        if (l.zoom > 1) { // zoom inside the source (the box keeps its size); zx/zy pick where to look
          const z = l.zoom, nw = sw / z, nh = sh / z
          sx += (sw - nw) * (l.zx ?? 0.5); sy += (sh - nh) * (l.zy ?? 0.5); sw = nw; sh = nh
        }
        const ax = sx, ay = sy, aw = sw, ah = sh // everything the source can show (after crop / zoom-in)
        if (l.fit === 'contain') { const k = Math.min(bw / sw, bh / sh); dw = sw * k; dh = sh * k }
        else if (l.fit === 'cover') { const k = Math.max(bw / sw, bh / sh), cw = bw / k, ch = bh / k; sx += (sw - cw) * (l.zoom > 1 ? 0.5 : l.zx ?? 0.5); sy += (sh - ch) * (l.zoom > 1 ? 0.5 : l.zy ?? 0.5); sw = cw; sh = ch }
        if (l.zoom < 1) { // zoom out inside the same box: Fill first shows more of the source, then the picture gets smaller
          const z = l.zoom
          if (l.fit === 'cover') {
            const cw = sw / z, ch = sh / z, vw = Math.min(cw, aw), vh = Math.min(ch, ah)
            dw = bw * vw / cw; dh = bh * vh / ch; sx = ax + (aw - vw) * (l.zx ?? 0.5); sy = ay + (ah - vh) * (l.zy ?? 0.5); sw = vw; sh = vh
          } else { dw *= z; dh *= z }
        }
      }
    }
    const box = l.type !== 'text' && l.type !== 'scene' // the source's box stays put; Fit/Fill/zoom only change the picture inside it
    // when the picture is smaller than its box, zx / zy slide it inside the box (0 = left/top, 1 = right/bottom)
    const ox = box ? (bw - dw) * ((l.zx ?? 0.5) - 0.5) : 0, oy = box ? (bh - dh) * ((l.zy ?? 0.5) - 0.5) : 0
    const g = this.geo[l.id] = { cx: l.x * W, cy: l.y * H, w: box ? bw : dw, h: box ? bh : dh, pw: dw, ph: dh, ox, oy, canX: box && (dw < bw - 1 || (src && sw < src[1] * (1 - l.crop[0] - l.crop[2]) - 1)), canY: box && (dh < bh - 1 || (src && sh < src[2] * (1 - l.crop[1] - l.crop[3]) - 1)), rot: l.rot * Math.PI / 180, sx, sy, sw, sh, flip: l.flip, phone: l.type === 'phone' && !!src }
    if ((!src && !['text', 'color', 'chat', 'alert', 'mask', 'goal', 'lower', 'banner', 'fxbg', 'fxtext', 'caption'].includes(l.type)) || (l.type === 'lower' && !this.lowerOn(l)) || (l.type === 'alert' && !this.alerting)) return // nothing to draw yet, but still selectable
    const x = -dw / 2 + ox, y = -dh / 2 + oy, gr = l.grade, path = () => { ctx.beginPath(); ctx.roundRect(x, y, dw, dh, l.radius * Math.min(dw, dh)) }
    ctx.save()
    ctx.translate(g.cx, g.cy); ctx.rotate(g.rot); ctx.globalAlpha = l.opacity * (l.face?.on ? this.fs?.[l.id]?.a ?? 1 : 1)
    if (l.shadow && (l.type !== 'text' || l.bgOn)) {
      path(); ctx.shadowColor = `rgba(0,0,0,${l.shadow})`; ctx.shadowBlur = H * 0.04; ctx.shadowOffsetY = H * 0.01
      ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowColor = 'transparent'
    }
    if (l.type === 'mask') { this.drawMask(l, path, H); ctx.restore(); return }
    ctx.save(); path(); ctx.clip()
    const fl = [gr.b !== 1 && `brightness(${gr.b})`, gr.c !== 1 && `contrast(${gr.c})`, gr.s !== 1 && `saturate(${gr.s})`, gr.hue && `hue-rotate(${gr.hue}deg)`,
      gr.sepia && `sepia(${gr.sepia})`, gr.blur && `blur(${gr.blur}px)`].filter(Boolean).join(' ')
    if (fl) ctx.filter = fl
    if (l.flip) ctx.scale(-1, 1)
    if (src) this.drawSrc(l, src, sx, sy, sw, sh, x, y, dw, dh)
    if (l.type === 'video') { const r = this.res[l.id]; if (r?.g) { r.g.gain.value = l.sound ? l.vol ?? 1 : 0; r.el.loop = l.loop !== false } }
    if (src && l.type === 'screen') this.layerPtr(l, src, sx, sy, sw, sh, x, y, dw, dh, H)
    else if (l.type === 'color') {
      const gd = ctx.createLinearGradient(x, y, x + dw, y + dh); gd.addColorStop(0, l.color); gd.addColorStop(1, l.color2 || l.color)
      ctx.fillStyle = gd; ctx.fillRect(x, y, dw, dh)
    } else if (l.type === 'chat') this.drawChat(x, y, dw, dh, l)
    else if (l.type === 'goal') this.drawGoal(x, y, dw, dh, l)
    else if (l.type === 'caption') this.drawCaption(x, y, dw, dh, l)
    else if (l.type === 'lower') this.drawLower(x, y, dw, dh, l)
    else if (l.type === 'alert') this.drawAlert(x, y, dw, dh, l)
    else if (l.type === 'banner') drawBanner(ctx, x, y, dw, dh, l.b, performance.now() / 1000, this.res[l.id]?.el)
    else if (l.type === 'fxbg') drawBg(ctx, x, y, dw, dh, l.b, performance.now() / 1000)
    else if (l.type === 'fxtext') drawText(ctx, x, y, dw, dh, l.b, performance.now() / 1000)
    else {
      if (l.bgOn) { ctx.fillStyle = l.bg; ctx.fillRect(x, y, dw, dh) }
      ctx.fillStyle = l.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, fs * 0.05)
    }
    ctx.restore()
    if (l.border) { path(); ctx.lineWidth = l.border * H / 1080; ctx.strokeStyle = l.borderColor; ctx.stroke() }
    ctx.restore()
  }

  nested(l, W, H) { // another scene drawn inside this box
    const sc = this.s.scenes.find(x => x.id === l.src)
    if (!sc || (this.depth || 0) >= 2 || sc.id === this.s.sceneId) return null
    const c = (this.nest ??= {})[l.id] ??= document.createElement('canvas')
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
    this.paint(sc, c.getContext('2d'), W, H, (this.depth || 0) + 1)
    return [c, W, H]
  }
  drawMask(l, path, H) { // blur / pixelate / solid box over what is already drawn (only on the stream)
    const { ctx } = this, cv = ctx.canvas
    ctx.save(); path(); ctx.clip()
    if (l.mode === 'solid') { ctx.fillStyle = l.color || '#000'; ctx.fill() }
    else {
      const m = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0)
      if (l.mode === 'pixel') {
        const k = Math.max(4, Math.round((l.amount ?? 0.5) * 40)), t = this.px ??= document.createElement('canvas'); t.width = Math.ceil(cv.width / k); t.height = Math.ceil(cv.height / k)
        t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height); ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = true
      } else { ctx.filter = `blur(${Math.round((l.amount ?? 0.5) * H * 0.04) + 2}px)`; ctx.drawImage(cv, 0, 0); ctx.filter = 'none' }
      ctx.setTransform(m)
    }
    ctx.restore()
  }
  drawGoal(x, y, w, h, l) {
    const { ctx } = this, p = Math.max(0, Math.min(1, (l.cur || 0) / (l.target || 1))), r = h * 0.5
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * p), h, r); ctx.clip()
    ctx.fillStyle = l.color || '#f97316'; ctx.fillRect(x, y, w, h)
    ctx.fillStyle = 'rgba(255,255,255,.16)'; const s = h * 0.7, o = (performance.now() / 25) % (s * 2)
    for (let i = -2; i < w / s + 2; i += 2) { ctx.beginPath(); ctx.moveTo(x + i * s + o, y + h); ctx.lineTo(x + (i + 1) * s + o, y + h); ctx.lineTo(x + (i + 2) * s + o, y); ctx.lineTo(x + (i + 1) * s + o, y); ctx.fill() }
    ctx.restore()
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.font = `700 ${h * 0.42}px ${FONT}`
    ctx.textAlign = 'left'; ctx.fillText(l.label || 'Goal', x + h * 0.5, y + h / 2, w * 0.6)
    ctx.textAlign = 'right'; ctx.fillText(`${l.prefix || ''}${Math.round(l.cur || 0)} / ${l.prefix || ''}${l.target || 0}`, x + w - h * 0.5, y + h / 2)
  }
  playLower(id) { (this.lowers ??= {})[id] = performance.now() }
  lowerOn(l) { const t0 = this.lowers?.[l.id]; if (t0 == null) return true; const hold = (l.hold ?? 6) * 1000; return !hold || performance.now() - t0 < hold + 1000 }
  drawLower(x, y, w, h, l) { // lower third: slides in, holds, slides out
    const { ctx } = this, t0 = this.lowers?.[l.id], now = performance.now(), hold = (l.hold ?? 6) * 1000
    let p = 1
    if (t0 != null) { const e = now - t0; p = Math.min(1, e / 500); if (hold && e > hold + 500) p = Math.max(0, 1 - (e - hold - 500) / 500) }
    const k = 1 - (1 - p) ** 3
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(-(1 - k) * w, 0)
    const c = l.color || '#f97316', st = l.style || 'bar'
    if (st === 'pill') { ctx.fillStyle = 'rgba(17,17,20,.88)'; ctx.beginPath(); ctx.roundRect(x, y + h * 0.1, w, h * 0.8, h * 0.4); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + h * 0.5, y + h / 2, h * 0.26, 0, 7); ctx.fill() }
    else if (st === 'clean') { ctx.fillStyle = c; ctx.fillRect(x, y + h * 0.15, h * 0.06, h * 0.7) }
    else { ctx.fillStyle = c; ctx.fillRect(x, y, w * 0.04, h); ctx.fillStyle = 'rgba(17,17,20,.9)'; ctx.fillRect(x + w * 0.04, y, w * 0.96, h * 0.62); ctx.fillStyle = c; ctx.fillRect(x + w * 0.04, y + h * 0.62, w * 0.6, h * 0.38) }
    const tx = x + (st === 'pill' ? h * 0.95 : st === 'clean' ? h * 0.22 : w * 0.07)
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
    ctx.font = `800 ${h * (st === 'bar' ? 0.34 : 0.3)}px ${FONT}`; ctx.fillText(l.title || 'Your Name', tx, y + h * (st === 'bar' ? 0.31 : 0.4), w * 0.85)
    ctx.font = `600 ${h * 0.2}px ${FONT}`; ctx.fillStyle = st === 'bar' ? '#111' : 'rgba(255,255,255,.75)'; ctx.fillText(l.sub || '', tx, y + h * (st === 'bar' ? 0.81 : 0.7), w * 0.85)
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
    u = (u - (g.ox || 0)) / g.pw + 0.5; v = (v - (g.oy || 0)) / g.ph + 0.5
    if (g.flip) u = 1 - u
    if (!clamp && (u < 0 || v < 0 || u > 1 || v > 1)) return null
    const cl = n => Math.max(0, Math.min(1, n))
    return { x: Math.round(g.sx + cl(u) * g.sw), y: Math.round(g.sy + cl(v) * g.sh), w: f.displayWidth, h: f.displayHeight }
  }

  // ---- layer media (webcam, screen, image, video, web page) ----
  sync() {
    const keep = new Set()
    const fsc = id => this.s.frames?.find(f => f.id === id)?.sceneId
    const ids = new Set([this.s.sceneId, ...Object.values(this.xc || {}).map(x => x.frameId ? fsc(x.frameId) : x.sceneId), ...(this.viewFrames || []).map(fsc)].filter(Boolean)), all = []
    for (let i = 0; i < 3; i++) for (const sc of this.s.scenes || []) if (ids.has(sc.id)) for (const l of sc.layers) { if (l.type === 'scene') ids.add(l.src); if (i === 2) all.push(l) }
    for (const l of all) {
      if (!(['webcam', 'screen', 'image', 'video', 'browser'].includes(l.type) || (l.type === 'banner' && l.src)) || keep.has(l.id)) continue
      keep.add(l.id)
      const key = l.type + '|' + (l.src || '') + '|' + (l.res || '') + '|' + (l.capFps || '')
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
      const R = { '720': [1280, 720], '1080': [1920, 1080], '1440': [2560, 1440], '2160': [3840, 2160] }[l.res || '720']
      await live(await md.getUserMedia({ video: { deviceId: l.src === 'default' ? undefined : { exact: l.src }, width: { ideal: R[0] }, height: { ideal: R[1] }, frameRate: { ideal: l.capFps || 30 } } }))
    } else if (l.type === 'screen') {
      await api.invoke('screen:pick', l.src)
      const H = { '1080': 1080, '1440': 1440, '2160': 2160 }[l.res]
      await live(await md.getDisplayMedia({ video: { frameRate: { ideal: l.capFps || 30 }, ...(H ? { height: { max: H } } : {}) } }))
    } else if (l.type === 'browser') {
      await api.invoke('browser:open', l.id, l.src)
      r.stop = () => api.send('browser:close', l.id)
    } else {
      const vid = l.type === 'video'
      const url = URL.createObjectURL(new Blob([await api.invoke('file:read', l.src)], vid ? { type: /\.webm$/i.test(l.src) ? 'video/webm' : 'video/mp4' } : {}))
      r.stop = () => URL.revokeObjectURL(url)
      if (vid) { // video files: their sound goes through its own gain into the stream mix (off unless the source asks for it)
        const v = document.createElement('video'); v.loop = l.loop !== false; v.src = url
        r.g = this.ac.createGain(); r.g.gain.value = 0; this.ac.createMediaElementSource(v).connect(r.g); r.g.connect(this.master); r.g.connect(this.ac.destination)
        const st0 = r.stop; r.stop = () => { st0?.(); v.pause(); r.g.disconnect() }
        await v.play(); r.el = v }
      else { const i = new Image(); i.src = url; await i.decode(); r.el = i }
    }
  }

  // ---- audio / webcam inputs ----
  async openMic(id, label) {
    await api.invoke('media:ask', 'microphone')
    const c = { echoCancellation: false, autoGainControl: false, noiseSuppression: false }, devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId !== 'default')
    const pick = id === 'default' ? null : devs.find(d => d.deviceId === id) || (label && devs.find(d => d.label === label))
    try { const st = await navigator.mediaDevices.getUserMedia({ audio: { ...c, ...(pick ? { deviceId: { exact: pick.deviceId } } : {}) } }); return { st, id: pick ? pick.deviceId : 'default', label: pick?.label || '', lost: id !== 'default' && !pick } }
    catch { const st = await navigator.mediaDevices.getUserMedia({ audio: c }); return { st, id: 'default', label: '', lost: true } }
  }
  async setMic(id, label) {
    this.micSrc?.disconnect(); this.micStream?.getTracks().forEach(t => t.stop()); this.micSrc = this.micStream = null
    if (!id) return
    const r = await this.openMic(id, label)
    this.micStream = r.st
    this.micSrc = this.ac.createMediaStreamSource(this.micStream)
    this.micSrc.connect(this.gate)
    this.denoise(this.s.noise)
    return r
  }

  async denoise(on) { // RNNoise between the mic and the gate
    if (!this.micSrc) return
    this.micSrc.disconnect(); this.rn?.disconnect()
    if (on) {
      if (!this.rn) { const wasmBinary = await loadRnnoise({ url: rnWasm, simdUrl: rnSimd }); await this.ac.audioWorklet.addModule(rnWorklet); this.rn = new RnnoiseWorkletNode(this.ac, { wasmBinary, maxChannels: 2 }) }
      this.micSrc.connect(this.rn); this.rn.connect(this.gate)
    } else this.micSrc.connect(this.gate)
  }
  noiseGate() { // mic noise gate: closes when the raw mic level stays under the threshold, so room noise between words is cut
    const th = this.s.mix?.mic?.gate || 0, ng = this.ch.mic.ng
    if (!th) { if (ng.gain.value !== 1) ng.gain.value = 1; return }
    const a = this.rawMic ??= (() => { const an = this.ac.createAnalyser(); an.fftSize = 512; this.gate.connect(an); return { an, buf: new Float32Array(512) } })()
    a.an.getFloatTimeDomainData(a.buf); let p = 0; for (const x of a.buf) p = Math.max(p, Math.abs(x))
    const lv = p ? Math.max(0, 1 + 20 * Math.log10(p) / 54) : 0, now = performance.now()
    if (lv > th) this.gateOpen = now + 250
    ng.gain.setTargetAtTime(now < (this.gateOpen || 0) ? 1 : 0, this.ac.currentTime, now < (this.gateOpen || 0) ? 0.005 : 0.08)
  }
  setGate(open) { this.gate.gain.setTargetAtTime(open ? 1 : 0, this.ac.currentTime, 0.015) }
  async playMusic(path) { // background music: own channel, heard by you and the stream
    if (!this.music) { this.music = new Audio(); this.ac.createMediaElementSource(this.music).connect(this.musicG); this.music.onended = () => this.onMusicEnd?.() }
    if (path) { const u = URL.createObjectURL(new Blob([await api.invoke('file:read', path)])); if (this.musicUrl) URL.revokeObjectURL(this.musicUrl); this.musicUrl = u; this.music.src = u }
    await this.music.play()
  }
  pauseMusic() { this.music?.pause() }
  duck() { // music volume follows settings; lowered while you talk
    if (!this.music) return
    const s = this.s, base = s.musicVol ?? 0.5, talking = s.duck !== false && this.level('mic') > 0.35
    if (talking) this.duckUntil = performance.now() + 600
    this.musicG.gain.setTargetAtTime(performance.now() < (this.duckUntil || 0) ? base * 0.25 : base, this.ac.currentTime, 0.12)
  }

  level(k) { // peak mapped from -54dB..0dB to 0..1
    if (!this.ch[k]) return 0
    const { an, buf } = this.ch[k]
    an.getFloatTimeDomainData(buf)
    let p = 0
    for (const x of buf) p = Math.max(p, Math.abs(x))
    return p ? Math.max(0, Math.min(1, 1 + (20 * Math.log10(p)) / 54)) : 0
  }

  // ---- outputs ----
  // Video track for an output: the main canvas, or a private canvas when the destination has its own scene or size.
  outTrack(id, o) {
    if (o.frameId) { // a frame's own output: always its current scene at the frame's size, whatever the studio shows
      const f = this.s.frames?.find(v => v.id === o.frameId)
      if (f) { const size = o.size || f.size; o = { ...o, size }; const key = 'f:' + f.id + '|' + size, [w, h] = size.split('x').map(Number), xc = this.xc ??= {}
        if (!xc[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; xc[key] = { c, ctx: c.getContext('2d', { alpha: false }), frameId: f.id, n: 0, stream: c.captureStream(o.fps || this.s.fps) }; this.sync?.() }
        xc[key].n++; return [xc[key].stream.getVideoTracks()[0], key] }
    }
    if (!o.sceneId && !o.size) {
      if (!Object.values(this.recs).some(r => !r.xkey)) this.vstream = this.canvas.captureStream(this.s.fps)
      return [this.vstream.getVideoTracks()[0]]
    }
    const key = (o.sceneId || '') + '|' + (o.size || this.s.canvas), [w, h] = (o.size || this.s.canvas).split('x').map(Number), xc = this.xc ??= {}
    if (!xc[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; xc[key] = { c, ctx: c.getContext('2d', { alpha: false }), sceneId: o.sceneId || '', n: 0, stream: c.captureStream(o.fps || this.s.fps) }; this.sync?.() }
    xc[key].n++
    return [xc[key].stream.getVideoTracks()[0], key]
  }
  async startOutput(id, o) {
    await api.invoke('out:start', id, o)
    const [vt, xkey] = this.outTrack(id, o)
    const stream = new MediaStream([vt, this.dest.stream.getAudioTracks()[0]])
    const mimeType = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'].find(m => MediaRecorder.isTypeSupported(m))
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: id === 'rec' ? o.vbr || 12e6 : Math.max(8e6, o.bitrate * 2500), audioBitsPerSecond: 192000 })
    let chain = Promise.resolve()
    rec.ondataavailable = e => { if (e.data.size) chain = chain.then(async () => api.send('out:data', id, new Uint8Array(await e.data.arrayBuffer()))) }
    rec.onstop = () => chain.then(() => api.send('out:stop', id))
    rec.start(200)
    rec.xkey = xkey
    this.recs[id] = rec
  }

  stopOutput(id) {
    const r = this.recs[id]
    delete this.recs[id]
    const x = r?.xkey && this.xc?.[r.xkey]
    if (x && --x.n <= 0) delete this.xc[r.xkey]
    if (r && r.state !== 'inactive') r.stop()
    else api.send('out:stop', id)
  }
}
