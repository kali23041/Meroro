// Recording editor page: preview, timeline (zooms, trims, speed, notes, extra audio), styling inspector and export.
import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Wand2, Scissors, Gauge, Type, Music, ZoomIn, Trash2, FolderOpen, Save, Download, Film, Image as ImageIcon, MousePointer2, Webcam, Frame, Square, MoveUpRight, Loader2, Plus, ArrowLeft, Pencil, X, Move } from 'lucide-react'
import { Button, Input, Row, Segmented, Select, Slider, Switch, cx } from './ui'
import { WALLS, ASPECTS, newProject, autoZooms, outSize, render, uid } from './edit'

const api = window.api
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor(t * 10 % 10)}`
const Color = ({ value, onChange }) => <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="h-7 w-10 shrink-0 rounded-md bg-transparent border border-white/10 p-0.5" />
const TOOLS = [['frame', 'Background & frame', Move, 'Frame'], ['zoom', 'Zooms', ZoomIn, 'Zoom'], ['text', 'Text & notes', Type, 'Text'], ['speed', 'Speed', Gauge, 'Speed'], ['cut', 'Cuts', Scissors, 'Cut'], ['audio', 'Audio', Music, 'Audio'], ['cursor', 'Pointer', MousePointer2, 'Pointer'], ['cam', 'Webcam bubble', Webcam, 'Cam']]
const LANE = { zoom: 'zooms', text: 'notes', speed: 'speeds', cut: 'trims', audio: 'audios' }, TOOL_OF = { zooms: 'zoom', notes: 'text', speeds: 'speed', trims: 'cut', audios: 'audio' }
const Round = ({ title, on, onClick, children, big }) => <button title={title} onClick={onClick}
  className={cx('no-drag grid place-items-center rounded-full shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95', big ? 'size-10' : 'size-9', on ? 'bg-[#eef07a] text-black' : 'bg-black/55 text-white ring-1 ring-white/10 hover:bg-black/75')}>{children}</button>
const Dot = ({ title, on, dark, onClick, children }) => <button title={title} onClick={onClick}
  className={cx('no-drag size-9 grid place-items-center rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95', on ? 'bg-[#eef07a] text-black' : dark ? 'bg-black/80 text-white' : 'bg-white/85 text-zinc-800 hover:bg-white backdrop-blur-md')}>{children}</button>
const Pill = ({ onClick, children }) => <button onClick={onClick} className="h-7 flex items-center gap-1 rounded-full bg-white/[0.08] px-3 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.16]">{children}</button>
const ROWS = [['zooms', 'Zoom', ZoomIn, '#8b5cf6'], ['trims', 'Cut', Scissors, '#ef4444'], ['speeds', 'Speed', Gauge, '#f59e0b'], ['notes', 'Notes', Type, '#10b981'], ['audios', 'Audio', Music, '#0ea5e9']]
const clean = p => JSON.stringify(p, (k, v) => k.startsWith('_') ? undefined : v)

export default function Editor({ start, onNote, windowed }) {
  const [p, setP] = useState(null), [path, setPath] = useState(''), [recent, setRecent] = useState([])
  const [t, setT] = useState(0), [dur, setDur] = useState(0), [playing, setPlaying] = useState(false), [sel, setSel] = useState(null), [tab, setTab] = useState(''), [exp, setExp] = useState(null)
  const vid = useRef(), cam = useRef(), cv = useRef(), pr = useRef(), res = useRef({ imgs: {} }), au = useRef({}), tl = useRef(), aud = useRef(null)
  pr.current = p
  const up = o => setP(v => ({ ...v, ...o })), upIn = (k, o) => setP(v => ({ ...v, [k]: { ...v[k], ...o } }))
  const upR = (row, id, o) => setP(v => ({ ...v, [row]: v[row].map(r => r.id === id ? { ...r, ...o } : r) }))
  const err = e => onNote({ text: String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), bad: true })

  const open = async (video, project, file) => {
    const np = project || newProject(video)
    vid.current.src = await api.invoke('media:url', np.video)
    cam.current.src = np.cam.file ? await api.invoke('media:url', np.cam.file) : ''
    setP(np); setPath(file || ''); setSel(null); setT(0); setPlaying(false)
  }
  useEffect(() => { api.invoke('recordings').then(setRecent); if (start) open(start.video, start.track ? { ...newProject(start.video, start.track) } : null) }, [start])
  useEffect(() => { // images used by the background and notes
    if (!p) return
    const load = async (src, set) => { const b = await api.invoke('file:read', src), i = new Image(); i.src = URL.createObjectURL(new Blob([b])); await i.decode(); set(i) }
    if (p.bg.type === 'image' && p.bg.src && res.current.bgSrc !== p.bg.src) { res.current.bgSrc = p.bg.src; load(p.bg.src, i => { res.current.bg = i }).catch(() => {}) }
    for (const n of p.notes) if (n.kind === 'image' && n.src && !res.current.imgs[n.id]) { res.current.imgs[n.id] = null; load(n.src, i => { res.current.imgs[n.id] = i }).catch(() => {}) }
  }, [p?.bg.src, p?.bg.type, p?.notes])
  useEffect(() => { // extra audio clips
    if (!p) return
    for (const a of p.audios) if (!au.current[a.id]) { const el = new Audio(); el.crossOrigin = 'anonymous'; au.current[a.id] = el; api.invoke('media:url', a.file).then(u => { el.src = u; el.onloadedmetadata = () => upR('audios', a.id, { b: a.a + el.duration, len: el.duration }) }) }
  }, [p?.audios.length])

  // ---- playback + drawing loop ----
  useEffect(() => {
    let raf
    const loop = () => {
      const v = vid.current, q = pr.current, c = cv.current
      if (v && q && c && v.videoWidth) {
        let ct = v.currentTime
        const cut = q.trims.find(x => ct >= x.a && ct < x.b - 0.02)
        if (cut && !v.seeking) { v.currentTime = Math.min(cut.b, v.duration); ct = cut.b }
        const sp = q.speeds.find(x => ct >= x.a && ct < x.b), rate = sp ? sp.r : 1
        if (v.playbackRate !== rate) v.playbackRate = rate
        const cm = cam.current; if (cm.src && Math.abs(cm.currentTime - ct) > 0.25) cm.currentTime = ct
        if (cm.src && cm.paused !== v.paused) v.paused ? cm.pause() : cm.play().catch(() => {})
        for (const a of q.audios) { const el = au.current[a.id]; if (!el?.src) continue; const on = !v.paused && ct >= a.a && ct < a.b; el.volume = a.vol ?? 1
          if (on && el.paused) { el.currentTime = ct - a.a; el.play().catch(() => {}) } else if (!on && !el.paused) el.pause() }
        const [W, H] = outSize(q, v.videoWidth, v.videoHeight, c._h || 720)
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
        render(c.getContext('2d'), W, H, q, ct, v, { ...res.current, cam: cm.src ? cm : null })
        setT(ct)
      }
      raf = requestAnimationFrame(loop)
    }
    loop(); return () => cancelAnimationFrame(raf)
  }, [])
  const toggle = () => { const v = vid.current; if (v.paused) { if (v.currentTime >= v.duration - 0.05) v.currentTime = 0; v.play() } else v.pause() }
  const seek = x => { vid.current.currentTime = Math.max(0, Math.min(dur, x)) }
  useEffect(() => { // Space = play/pause, Delete = remove the selected region
    const k = e => { if (!pr.current || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      if (e.code === 'Space') { e.preventDefault(); toggle() }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { setP(v => ({ ...v, [sel.row]: v[sel.row].filter(r => r.id !== sel.id) })); setSel(null) } }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [sel, dur])

  // ---- timeline ----
  const add = (row, o = {}) => { const a = Math.min(t, Math.max(0, dur - 0.5)), r = { id: uid(), a, b: Math.min(dur, a + 2.5), ...o }; setP(v => ({ ...v, [row]: [...v[row], r] })); setSel({ row, id: r.id }); setTab(TOOL_OF[row]) }
  const drag = (e, row, r, mode) => {
    e.stopPropagation(); setSel({ row, id: r.id }); setTab(TOOL_OF[row])
    const w = tl.current.clientWidth, x0 = e.clientX, len = r.b - r.a
    const mv = ev => { const d = (ev.clientX - x0) / w * dur
      if (mode === 'l') upR(row, r.id, { a: Math.max(0, Math.min(r.b - 0.2, r.a + d)) })
      else if (mode === 'r') upR(row, r.id, { b: Math.min(dur, Math.max(r.a + 0.2, r.b + d)) })
      else { const a = Math.max(0, Math.min(dur - len, r.a + d)); upR(row, r.id, { a, b: a + len }) } }
    const end = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', end) }
    addEventListener('pointermove', mv); addEventListener('pointerup', end)
  }
  const scrub = e => { const r = tl.current.getBoundingClientRect(), go = ev => seek((ev.clientX - r.left) / r.width * dur); go(e)
    const end = () => { removeEventListener('pointermove', go); removeEventListener('pointerup', end) }; addEventListener('pointermove', go); addEventListener('pointerup', end) }
  const cur = sel && p?.[sel.row].find(r => r.id === sel.id)

  // ---- project + export ----
  const save = async as => { try { const f = await api.invoke('project:save', as ? '' : path, clean(p), p.video.split(/[\\/]/).pop().replace(/\.\w+$/, '')); if (f) { setPath(f); onNote({ text: 'Project saved', file: f }) } } catch (e) { err(e) } }
  const openFile = async () => { try { const r = await api.invoke('project:open'); if (r) open(r.video, r.project, r.path) } catch (e) { err(e) } }
  const doExport = async () => {
    const v = vid.current, c = cv.current, o = p.exp, ext = o.fmt
    const file = await api.invoke('export:pick', p.video.split(/[\\/]/).pop().replace(/\.\w+$/, '') + ' edit', ext)
    if (!file) return
    try {
      v.pause(); c._h = o.fmt === 'gif' ? Math.min(720, o.height) : o.height
      const first = p.trims.find(x => x.a <= 0.01); v.currentTime = first ? first.b : 0
      await new Promise(r => { v.onseeked = r; setTimeout(r, 800) })
      const ac = aud.current ??= (() => { const a = new AudioContext(), d = a.createMediaStreamDestination(), s = a.createMediaElementSource(v); s.connect(a.destination); s.connect(d); return { a, d, wired: new Set() } })()
      for (const el of Object.values(au.current)) if (!ac.wired.has(el)) { ac.wired.add(el); const s = ac.a.createMediaElementSource(el); s.connect(ac.a.destination); s.connect(ac.d) }
      await ac.a.resume()
      await api.invoke('out:start', 'export', { ...o, file })
      const stream = new MediaStream([c.captureStream(o.fps).getVideoTracks()[0], ...ac.d.stream.getAudioTracks()])
      const mimeType = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'].find(m => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 40e6, audioBitsPerSecond: 256000 })
      let chain = Promise.resolve()
      rec.ondataavailable = e => { if (e.data.size) chain = chain.then(async () => api.send('out:data', 'export', new Uint8Array(await e.data.arrayBuffer()))) }
      rec.onstop = () => chain.then(() => api.send('out:stop', 'export'))
      const done = new Promise(r => { const h = e => { removeEventListener('export-end', h); r(e.detail) }; addEventListener('export-end', h) })
      setExp({ file }); rec.start(250); await v.play()
      await new Promise(r => { v.onended = r; v.onpause = () => v.currentTime >= v.duration - 0.1 && r() })
      await new Promise(r => setTimeout(r, 300)); rec.stop()
      const out = await done
      if (out.error) throw new Error(out.error)
      onNote({ text: `Exported ${ext.toUpperCase()}`, file })
    } catch (e) { err(e) }
    c._h = 0; setExp(null); v.onended = v.onpause = null
  }

  // ---- clips (split points), thumbnails, time ranges ----
  const [thumbs, setThumbs] = useState([]), [segI, setSeg] = useState(0), [naming, setNaming] = useState(false), [awake, setAwake] = useState(true), tv = useRef(), idle = useRef()
  const wake = () => { setAwake(true); clearTimeout(idle.current); idle.current = setTimeout(() => setAwake(false), 2000) }
  const ui = awake || !!exp || naming // everything hides 2 s after the mouse stops or leaves the window
  useEffect(() => { // filmstrip pictures: 32 frames from a second, hidden copy of the video
    if (!p || !dur) return
    let stop = false
    ;(async () => {
      const v = tv.current; v.src = vid.current.src
      await new Promise(r => v.readyState >= 1 ? r() : (v.onloadedmetadata = r))
      const N = 32, c = document.createElement('canvas'), x = c.getContext('2d'), out = []; c.width = 160; c.height = 90
      for (let i = 0; i < N && !stop; i++) {
        v.currentTime = (i + 0.5) * dur / N; await new Promise(r => { v.onseeked = r; setTimeout(r, 1500) })
        const k = Math.max(160 / v.videoWidth, 90 / v.videoHeight); x.fillStyle = '#18181b'; x.fillRect(0, 0, 160, 90); x.drawImage(v, (160 - v.videoWidth * k) / 2, (90 - v.videoHeight * k) / 2, v.videoWidth * k, v.videoHeight * k)
        out.push(c.toDataURL('image/jpeg', 0.6)); if (i % 8 === 7) setThumbs([...out])
      }
      if (!stop) setThumbs(out)
    })().catch(() => {})
    return () => { stop = true }
  }, [p?.video, dur])
  const cuts = p && dur ? [0, ...(p.splits || []).filter(x => x > 0.05 && x < dur - 0.05).sort((a, b) => a - b), dur] : []
  const segs = cuts.slice(1).map((b, i) => ({ a: cuts[i], b }))
  const same = (r, g) => Math.abs(r.a - g.a) < 0.02 && Math.abs(r.b - g.b) < 0.02
  const isCut = g => p.trims.some(r => r.a <= g.a + 0.02 && r.b >= g.b - 0.02), speedOf = g => p.speeds.find(r => same(r, g))
  const splitHere = () => { if (segs.some(g => t > g.a + 0.1 && t < g.b - 0.1)) { up({ splits: [...(p.splits || []), +t.toFixed(3)] }); setSeg(segs.findIndex(g => t > g.a && t < g.b) + 1) } }
  const cutSeg = g => isCut(g) ? up({ trims: p.trims.filter(r => !(r.a <= g.a + 0.02 && r.b >= g.b - 0.02)) }) : up({ trims: [...p.trims, { id: uid(), a: g.a, b: g.b }] })
  const speedSeg = g => { const r = speedOf(g), order = [1.5, 2, 4, 0.5, 0], nx = order[(order.indexOf(r?.r ?? 0) + 1) % order.length]
    up({ speeds: nx ? (r ? p.speeds.map(x => x === r ? { ...x, r: nx } : x) : [...p.speeds, { id: uid(), a: g.a, b: g.b, r: nx }]) : p.speeds.filter(x => x !== r) }) }
  const autoZoom = () => { const z = autoZooms(p.track, dur); up({ zooms: z }); onNote({ text: z.length ? `Added ${z.length} automatic zoom${z.length > 1 ? 's' : ''}` : 'No pointer activity was recorded with this video, so add zooms by hand.', bad: !z.length }) }
  const step = dur <= 60 ? 10 : dur <= 300 ? 30 : dur <= 900 ? 60 : 120, ranges = Array.from({ length: Math.ceil(dur / step) || 0 }, (_, i) => [i * step, Math.min(dur, (i + 1) * step)])
  const short = x => x < 60 ? `${Math.round(x)}s` : `${Math.floor(x / 60)}m${Math.round(x % 60) ? ' ' + Math.round(x % 60) + 's' : ''}`
  const pname = p?.name || p?.video.split(/[\\/]/).pop().replace(/\.\w+$/, '') || ''
  const fade = (show, from) => cx('transition-all duration-300 ease-out', show ? 'opacity-100' : 'opacity-0 pointer-events-none ' + from)
  const S = (label, value, onChange, o = {}) => <Row label={label}><Slider value={value} onChange={onChange} min={o.min ?? 0} max={o.max ?? 1} step={o.step ?? 0.01} format={o.format} /></Row>
  const T = (label, value, onChange) => <Row label={label}><span className="flex-1" /><Switch checked={!!value} onChange={onChange} /></Row>
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <video ref={vid} crossOrigin="anonymous" playsInline className="hidden" onLoadedMetadata={e => setDur(e.target.duration)} onDurationChange={e => isFinite(e.target.duration) && setDur(e.target.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <video ref={cam} crossOrigin="anonymous" muted playsInline className="hidden" />
      {!p ? (
        <div className="drag relative flex-1 grid place-items-center">
          {windowed && <div className="no-drag absolute right-3 top-3"><Round title="Close editor" onClick={() => api.send('win:close')}><X size={15} /></Round></div>}
          <div className="no-drag w-[560px] text-center">
            <Film size={34} className="mx-auto text-zinc-500" /><h1 className="mt-3 text-[20px] font-bold text-white">Recording editor</h1>
            <p className="mt-1 text-[13px] text-zinc-500">Add automatic zooms, a styled background, cuts, speed changes and notes, then export MP4 or GIF.</p>
            <div className="mt-4 flex justify-center gap-2"><Button variant="primary" className="h-9 px-4" onClick={openFile}><FolderOpen size={14} />Open recording or project</Button></div>
            {!!recent.length && <div className="mt-6 text-left"><div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">Recent recordings</div>
              <div className="space-y-1">{recent.map(r => <button key={r.file} onClick={() => open(r.file)} className="w-full flex items-center gap-3 rounded-xl bg-[#242427] px-3 h-11 text-left hover:bg-[#2c2c30]">
                <Film size={14} className="text-zinc-500" /><span className="flex-1 truncate text-[13px] text-zinc-100">{r.name}</span><span className="text-[11px] text-zinc-500">{(r.size / 1e6).toFixed(0)} MB · {new Date(r.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></button>)}</div></div>}
          </div>
        </div>
      ) : (
        <div className={cx('drag relative flex-1 min-w-0 overflow-hidden bg-black select-none', !windowed && 'rounded-2xl')} onMouseMove={wake} onPointerDown={wake} onMouseLeave={() => { clearTimeout(idle.current); setAwake(false) }} onDoubleClick={e => windowed && e.target === e.currentTarget && api.send('win:max')}>
          <video ref={tv} crossOrigin="anonymous" muted playsInline className="hidden" />
          {/* the edit, edge to edge as the window's background */}
          <canvas ref={cv} onClick={toggle} className={cx('no-drag absolute inset-x-0 top-0 w-full object-cover transition-[height] duration-300', ui ? 'h-[calc(100%-52px)]' : 'h-full', !ui && 'cursor-none')} />
          <div className={cx('pointer-events-none absolute inset-x-0 bottom-[52px] h-40 bg-gradient-to-t from-black/70 to-transparent', fade(ui, ''))} />

          {/* left: back, then the tools as round buttons */}
          <div className={cx('absolute left-3.5 top-3.5 z-10 flex flex-col items-center gap-2.5', fade(ui, '-translate-x-3'))}>
            <Dot dark title="Close recording" onClick={() => { vid.current.pause(); setP(null) }}><ArrowLeft size={15} /></Dot>
            <div className="h-3" />
            {TOOLS.map(([k, n, I]) => <Dot key={k} title={n} on={tab === k} onClick={() => setTab(tab === k ? '' : k)}><I size={14} /></Dot>)}
            <div className="h-1" />
            <Dot title={playing ? 'Pause (Space)' : 'Play (Space)'} on={playing} onClick={toggle}>{playing ? <Pause size={14} /> : <Play size={14} />}</Dot>
          </div>
          {/* top centre: project pill + "+" */}
          <div className={cx('absolute left-1/2 -translate-x-1/2 top-3.5 z-10 flex items-center gap-2', fade(ui, '-translate-y-3'))}>
            <div className="no-drag flex items-center gap-1.5 h-8 rounded-full bg-black/45 backdrop-blur-md pl-3.5 pr-1 text-[12px] text-white/90 shadow-lg">
              <span>Project:</span>
              {naming ? <input autoFocus defaultValue={pname} onBlur={e => { up({ name: e.target.value.trim() }); setNaming(false) }} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} className="w-[160px] bg-transparent outline-none text-white" />
                : <span className="max-w-[240px] truncate">{pname}</span>}
              <button title="Rename" onClick={() => setNaming(true)} className="size-6 grid place-items-center rounded-full hover:bg-white/15"><Pencil size={11} /></button>
            </div>
            <Dot title="Open another recording or project" onClick={openFile}><Plus size={15} /></Dot>
          </div>
          {/* top right */}
          <div className={cx('absolute right-3.5 top-3.5 z-10 flex items-center gap-2', fade(ui || !!exp, 'translate-x-3'))}>
            {exp && <span className="flex items-center gap-1.5 h-8 rounded-full bg-[#eef07a] px-3 text-[12px] font-semibold text-black shadow-lg"><Loader2 size={13} className="animate-spin" />{Math.round(100 * t / (dur || 1))}%</span>}
            <Dot title="Save project" onClick={() => save(false)}><Save size={14} /></Dot>
            <Dot title="Export" on={tab === 'exp'} onClick={() => setTab(tab === 'exp' ? '' : 'exp')}><Download size={14} /></Dot>
            {windowed && <Dot dark title="Close editor" onClick={() => api.send('win:close')}><X size={15} /></Dot>}
          </div>

          {/* floating inspector for the chosen tool */}
          <div className={cx('no-drag absolute right-3 top-16 z-20 w-[300px]', LANE[tab] ? 'bottom-[176px]' : 'bottom-[146px]', ' flex flex-col rounded-2xl bg-[#121214]/85 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl transition-all duration-300 ease-out',
            tab && ui ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none')}>
            <div className="h-11 shrink-0 flex items-center gap-2 px-3.5"><span className="flex-1 text-[13px] font-semibold text-white">{(TOOLS.find(x => x[0] === tab) || [, 'Export'])[1]}</span>
              <button onClick={() => setTab('')} className="size-7 grid place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"><X size={14} /></button></div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2">
              {LANE[tab] && <div className="flex flex-wrap gap-1.5">
                {tab === 'zoom' && <><Pill onClick={autoZoom}><Wand2 size={12} />Auto zoom</Pill><Pill onClick={() => add('zooms', { x: 0.5, y: 0.5, z: 1.8, follow: !!p.track.length })}><Plus size={12} />Zoom here</Pill></>}
                {tab === 'text' && <><Pill onClick={() => add('notes', { kind: 'text', text: 'Your note', x: 0.5, y: 0.85, size: 0.05, color: '#ffffff' })}><Type size={12} />Text</Pill>
                  <Pill onClick={() => add('notes', { kind: 'arrow', x: 0.4, y: 0.4, w: 0.12, h: 0.1, color: '#f43f5e' })}><MoveUpRight size={12} />Arrow</Pill>
                  <Pill onClick={() => add('notes', { kind: 'rect', x: 0.5, y: 0.5, w: 0.25, h: 0.2, color: '#f43f5e' })}><Square size={12} />Box</Pill>
                  <Pill onClick={async () => { const src = await api.invoke('file:pick', 'image'); if (src) add('notes', { kind: 'image', src, x: 0.5, y: 0.5, w: 0.25 }) }}><ImageIcon size={12} />Image</Pill></>}
                {tab === 'speed' && <Pill onClick={() => add('speeds', { r: 2 })}><Plus size={12} />Speed region</Pill>}
                {tab === 'cut' && <Pill onClick={() => add('trims')}><Plus size={12} />Cut region</Pill>}
                {tab === 'audio' && <Pill onClick={async () => { const file = await api.invoke('file:pick', 'audio'); if (file) add('audios', { file, vol: 1 }) }}><Plus size={12} />Add audio</Pill>}
              </div>}
              {LANE[tab] && !!p[LANE[tab]].length && <div className="flex flex-wrap gap-1">{p[LANE[tab]].map((r, i) => <button key={r.id} onClick={() => { setSel({ row: LANE[tab], id: r.id }); seek(r.a) }}
                className={cx('h-7 rounded-full px-2.5 text-[11px] font-medium', sel?.id === r.id ? 'bg-[#eef07a] text-black' : 'bg-white/[0.08] text-zinc-300 hover:bg-white/[0.14]')}>{i + 1} · {fmt(r.a).slice(0, -2)}</button>)}</div>}
            {tab === 'frame' && <div className="space-y-1.5">
              <Row label="Background"><Select className="flex-1" value={p.bg.type} onChange={type => upIn('bg', { type })} options={[['wall', 'Wallpaper'], ['grad', 'Gradient'], ['color', 'Solid colour'], ['image', 'Your image'], ['blur', 'Blurred video']]} /></Row>
              {p.bg.type === 'wall' && <div className="grid grid-cols-6 gap-1">{WALLS.map((w, i) => <button key={w[0]} title={w[0]} onClick={() => upIn('bg', { wall: i })} className={cx('h-8 rounded-md ring-2', p.bg.wall === i ? 'ring-white' : 'ring-transparent')} style={{ background: `linear-gradient(135deg,${w[1]},${w[2]},${w[3]})` }} />)}</div>}
              {(p.bg.type === 'grad' || p.bg.type === 'color') && <Row label="Colours"><Color value={p.bg.color} onChange={color => upIn('bg', { color })} />{p.bg.type === 'grad' && <Color value={p.bg.c2} onChange={c2 => upIn('bg', { c2 })} />}</Row>}
              {p.bg.type === 'image' && <Row label="Image"><span className="flex-1 truncate text-[11px] text-zinc-400">{p.bg.src?.split(/[\\/]/).pop() || 'None'}</span><Button onClick={async () => { const src = await api.invoke('file:pick', 'image'); if (src) upIn('bg', { src }) }}>Choose</Button></Row>}
              {p.bg.type === 'blur' && S('Blur', p.bg.blur, blur => upIn('bg', { blur }))}
              {S('Padding', p.pad, pad => up({ pad }), { max: 0.2 })}{S('Round corners', p.radius, radius => up({ radius }), { max: 0.12 })}{S('Shadow', p.shadow, shadow => up({ shadow }))}
              <Row label="Shape"><Select className="flex-1" value={p.aspect} onChange={aspect => up({ aspect })} options={ASPECTS} /></Row>
              {['Crop left', 'Crop top', 'Crop right', 'Crop bottom'].map((n, i) => <Row key={n} label={n}><Slider value={p.crop[i]} onChange={v => up({ crop: p.crop.map((c, j) => j === i ? v : c) })} max={0.45} /></Row>)}
            </div>}
            {tab === 'cursor' && <div className="space-y-1.5">
              {!p.track.length && <p className="text-[11px] leading-relaxed text-amber-300/90">This video has no pointer recording. Use “Record &amp; edit” in the studio header to capture one.</p>}
              {T('Show pointer', p.cursor.show, show => upIn('cursor', { show }))}{S('Size', p.cursor.size, size => upIn('cursor', { size }), { min: 0.5, max: 3 })}{S('Smoothing', p.cursor.smooth, smooth => upIn('cursor', { smooth }))}
              {T('Click bounce', p.cursor.bounce, bounce => upIn('cursor', { bounce }))}{T('Sway', p.cursor.sway, sway => upIn('cursor', { sway }))}{T('Motion blur', p.cursor.blur, blur => upIn('cursor', { blur }))}
            </div>}
            {tab === 'cam' && <div className="space-y-1.5">
              <Row label="Webcam video"><span className="flex-1 truncate text-[11px] text-zinc-400">{p.cam.file?.split(/[\\/]/).pop() || 'None'}</span>
                <Button onClick={async () => { const file = await api.invoke('file:pick', 'video'); if (file) { cam.current.src = await api.invoke('media:url', file); upIn('cam', { file, on: true }) } }}>{p.cam.file ? 'Replace' : 'Upload'}</Button>
                {p.cam.file && <Button variant="ghost" className="px-1.5" onClick={() => { cam.current.removeAttribute('src'); cam.current.load(); upIn('cam', { file: '' }) }}><Trash2 size={12} /></Button>}</Row>
              {p.cam.file && <>{T('Show', p.cam.on, on => upIn('cam', { on }))}{T('Mirror', p.cam.mirror, mirror => upIn('cam', { mirror }))}{S('Size', p.cam.size, size => upIn('cam', { size }), { min: 0.1, max: 0.6 })}
                <Row label="Position"><Select className="flex-1" value={p.cam.pos} onChange={pos => upIn('cam', { pos })} options={[['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left'], ['custom', 'Custom']]} /></Row>
                {p.cam.pos === 'custom' ? <>{S('X', p.cam.x, x => upIn('cam', { x }))}{S('Y', p.cam.y, y => upIn('cam', { y }))}</> : S('Margin', p.cam.margin, margin => upIn('cam', { margin }), { max: 0.15 })}
                {S('Roundness', p.cam.round, round => upIn('cam', { round }))}{S('Shadow', p.cam.shadow, shadow => upIn('cam', { shadow }))}{T('Shrink while zoomed', p.cam.react, react => upIn('cam', { react }))}</>}
              {!p.cam.file && <p className="text-[11px] leading-relaxed text-zinc-500">A webcam that was part of your scene is already in the recording. Upload a separate webcam video here to show it as a bubble.</p>}
            </div>}
            {LANE[tab] && <div className="space-y-1.5">
              {!cur ? <p className="text-[12px] text-zinc-500">Click a clip on the timeline to edit it. Drag it to move, drag its edges to resize, Delete to remove.</p> : <>
                <div className="flex items-center text-[12px] font-semibold text-white"><span className="flex-1">{ROWS.find(r => r[0] === sel.row)[1]} · {fmt(cur.a)} – {fmt(cur.b)}</span>
                  <Button variant="ghost" className="px-1.5" onClick={() => { setP(v => ({ ...v, [sel.row]: v[sel.row].filter(r => r.id !== sel.id) })); setSel(null) }}><Trash2 size={12} /></Button></div>
                {sel.row === 'zooms' && <>{S('Zoom', cur.z, z => upR('zooms', cur.id, { z }), { min: 1.1, max: 4, format: v => v.toFixed(1) + '×' })}{!!p.track.length && T('Follow pointer', cur.follow, follow => upR('zooms', cur.id, { follow }))}
                  {!(cur.follow && p.track.length) && <>{S('Focus X', cur.x, x => upR('zooms', cur.id, { x }))}{S('Focus Y', cur.y, y => upR('zooms', cur.id, { y }))}</>}</>}
                {sel.row === 'speeds' && <Row label="Speed"><Select className="flex-1" value={String(cur.r)} onChange={v => upR('speeds', cur.id, { r: +v })} options={[['0.25', '0.25× slow'], ['0.5', '0.5× slow'], ['1.5', '1.5×'], ['2', '2× fast'], ['4', '4× fast'], ['8', '8× fast']]} /></Row>}
                {sel.row === 'trims' && <p className="text-[11px] text-zinc-500">This part is skipped in the preview and left out of the export.</p>}
                {sel.row === 'notes' && <>
                  {cur.kind === 'text' && <><Row label="Text"><Input value={cur.text} onChange={e => upR('notes', cur.id, { text: e.target.value })} /></Row>{S('Size', cur.size, size => upR('notes', cur.id, { size }), { min: 0.02, max: 0.15 })}{T('Dark box', cur.box !== false, box => upR('notes', cur.id, { box }))}</>}
                  {cur.kind !== 'image' && <Row label="Colour"><Color value={cur.color} onChange={color => upR('notes', cur.id, { color })} /></Row>}
                  {S('X', cur.x, x => upR('notes', cur.id, { x }))}{S('Y', cur.y, y => upR('notes', cur.id, { y }))}
                  {cur.kind !== 'text' && S('Width', cur.w, w => upR('notes', cur.id, { w }), { min: cur.kind === 'arrow' ? -0.5 : 0.03, max: 0.9 })}{(cur.kind === 'rect' || cur.kind === 'arrow') && S('Height', cur.h, h => upR('notes', cur.id, { h }), { min: cur.kind === 'arrow' ? -0.5 : 0.03, max: 0.9 })}</>}
                {sel.row === 'audios' && S('Volume', cur.vol ?? 1, vol => upR('audios', cur.id, { vol }))}
              </>}
            </div>}
            {tab === 'exp' && <div className="space-y-1.5">
              <button disabled={!!exp} onClick={doExport} className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-[#eef07a] text-[13px] font-semibold text-black shadow-lg transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60">{exp ? <><Loader2 size={14} className="animate-spin" />Exporting {Math.round(100 * t / (dur || 1))}%</> : <><Download size={14} />Start export</>}</button>
              <Segmented value={p.exp.fmt} onChange={f => upIn('exp', { fmt: f })} options={[['mp4', 'MP4'], ['gif', 'GIF']]} />
              {p.exp.fmt === 'mp4' ? <>
                <Row label="Quality"><Select className="flex-1" value={p.exp.quality} onChange={quality => upIn('exp', { quality })} options={[['low', 'Small file'], ['medium', 'Medium'], ['high', 'High'], ['best', 'Best']]} /></Row>
                <Row label="Size"><Select className="flex-1" value={String(p.exp.height)} onChange={v => upIn('exp', { height: +v })} options={[['720', '720p'], ['1080', '1080p'], ['1440', '1440p'], ['2160', '4K']]} /></Row>
                <Row label="Frame rate"><Select className="flex-1" value={String(p.exp.fps)} onChange={v => upIn('exp', { fps: +v })} options={[['30', '30 fps'], ['60', '60 fps']]} /></Row>
              </> : <>
                <Row label="Size"><Select className="flex-1" value={String(p.exp.gifSize)} onChange={v => upIn('exp', { gifSize: +v })} options={[['480', 'Small · 480 wide'], ['720', 'Medium · 720 wide'], ['1080', 'Large · 1080 wide']]} /></Row>
                <Row label="Frame rate"><Select className="flex-1" value={String(p.exp.gifFps)} onChange={v => upIn('exp', { gifFps: +v })} options={[['10', '10 fps'], ['15', '15 fps'], ['20', '20 fps'], ['25', '25 fps']]} /></Row>
                {T('Loop forever', p.exp.gifLoop, gifLoop => upIn('exp', { gifLoop }))}
              </>}
              <Row label="Shape"><Select className="flex-1" value={p.aspect} onChange={aspect => up({ aspect })} options={ASPECTS} /></Row>
              <p className="text-[11px] leading-relaxed text-zinc-500">Export plays the video through once, so it takes as long as the edited video. Keep this page open until it finishes.</p>
              <Button className="w-full h-8" onClick={() => save(true)}><Save size={12} />Save project as…</Button>
            </div>}
            </div>
          </div>

          {/* filmstrip over the bottom of the video */}
          <div className={cx('no-drag absolute inset-x-3 z-10', LANE[tab] ? 'bottom-[92px]' : 'bottom-[62px]', exp && 'pointer-events-none', fade(ui, 'translate-y-6'))}>
            <div ref={tl} className="relative" onPointerDown={scrub}>
              {/* filmstrip: one rounded clip per split */}
              <div className="relative h-14">
                {segs.map((g, i) => { const cut = isCut(g), spd = speedOf(g), on = i === segI
                  const idx = thumbs.map((_, k) => k).filter(k => { const tt = (k + 0.5) * dur / thumbs.length; return tt >= g.a && tt < g.b }), use = idx.length ? idx : thumbs.length ? [Math.min(thumbs.length - 1, Math.floor(g.a / dur * thumbs.length))] : []
                  return <div key={i} onPointerDown={() => setSeg(i)} className="absolute inset-y-0 px-[13px]" style={{ left: g.a / dur * 100 + '%', width: (g.b - g.a) / dur * 100 + '%' }}>
                    <div className={cx('relative h-full rounded-full overflow-hidden flex bg-zinc-800 transition-all duration-200', on ? 'ring-[3px] ring-[#eef07a]' : 'ring-1 ring-white/10 hover:ring-white/30', cut && 'opacity-35')}>
                      {use.map(k => <img key={k} src={thumbs[k]} draggable={false} className="h-full flex-1 min-w-0 object-cover" />)}
                      {cut && <span className="absolute inset-0 grid place-items-center bg-[repeating-linear-gradient(135deg,#0008_0_6px,#0000_6px_12px)] text-[10px] font-bold text-white">CUT</span>}
                      {spd && <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-[#eef07a]">{spd.r}×</span>}
                    </div>
                  </div> })}
                {cuts.slice(1, -1).map(c => <button key={c} title="Join these clips" onPointerDown={e => e.stopPropagation()} onClick={() => up({ splits: (p.splits || []).filter(x => Math.abs(x - c) > 0.001) })}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] size-6 grid place-items-center rounded-full bg-zinc-700 text-zinc-200 ring-2 ring-black hover:bg-zinc-500" style={{ left: c / dur * 100 + '%' }}><Plus size={12} /></button>)}
                {/* selected clip: yellow pill with actions and a "+" that adds a zoom at the playhead */}
                {segs[segI] && <div className="absolute bottom-full mb-2 -translate-x-1/2 z-[2] flex flex-col items-center pointer-events-none" style={{ left: (segs[segI].a + segs[segI].b) / 2 / dur * 100 + '%' }}>
                  <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#eef07a] p-1 shadow-xl pop" onPointerDown={e => e.stopPropagation()}>
                    {[['Split at playhead', Scissors, splitHere], [speedOf(segs[segI]) ? `Speed ${speedOf(segs[segI]).r}× (click to change)` : 'Speed up', Gauge, () => speedSeg(segs[segI])], [isCut(segs[segI]) ? 'Restore clip' : 'Cut this clip', Trash2, () => cutSeg(segs[segI])]].map(([n, I, fn]) =>
                      <button key={n} title={n} onClick={fn} className="size-7 grid place-items-center rounded-full bg-black/85 text-[#eef07a] transition-transform hover:scale-110 active:scale-95"><I size={13} /></button>)}
                  </div>
                  <span className="w-[2px] h-2.5 bg-[#eef07a]" />
                  <button title="Add zoom at playhead" onPointerDown={e => e.stopPropagation()} onClick={() => add('zooms', { x: 0.5, y: 0.5, z: 1.8, follow: !!p.track.length })} className="pointer-events-auto -mb-3 size-6 grid place-items-center rounded-full bg-[#eef07a] text-black shadow-lg ring-2 ring-black/40 transition-transform hover:scale-110"><Plus size={13} strokeWidth={2.5} /></button>
                </div>}
              </div>
              {LANE[tab] && <div className="relative h-6 mt-2">{p[LANE[tab]].map(r => <div key={r.id} onPointerDown={e => drag(e, LANE[tab], r, 'm')}
                className={cx('absolute top-0 bottom-0 rounded-full cursor-grab overflow-hidden flex items-center justify-center text-[10px] font-semibold', sel?.id === r.id ? 'bg-[#eef07a] text-black' : 'bg-white/[0.16] text-white hover:bg-white/25')}
                style={{ left: r.a / dur * 100 + '%', width: Math.max(0.6, (r.b - r.a) / dur * 100) + '%' }}>
                <span className="absolute left-0 inset-y-0 w-2 cursor-ew-resize" onPointerDown={e => drag(e, LANE[tab], r, 'l')} />
                <span className="truncate px-2 pointer-events-none">{LANE[tab] === 'speeds' ? r.r + '×' : LANE[tab] === 'zooms' ? r.z.toFixed(1) + '×' : LANE[tab] === 'trims' ? 'cut' : r.text || r.kind || r.file?.split(/[\\/]/).pop()}</span>
                <span className="absolute right-0 inset-y-0 w-2 cursor-ew-resize" onPointerDown={e => drag(e, LANE[tab], r, 'r')} />
              </div>)}</div>}
              {/* playhead */}
              <div className="pointer-events-none absolute -top-3 bottom-0 z-[3] w-[2px] -translate-x-1/2 bg-[#eef07a] rounded-full" style={{ left: (dur ? t / dur * 100 : 0) + '%' }}><span className="absolute -top-1 left-1/2 -translate-x-1/2 size-2.5 rounded-full bg-[#eef07a]" /></div>
            </div>
          </div>
          {/* black bar: time ranges */}
          <div className={cx('no-drag absolute inset-x-0 bottom-0 h-[52px] z-10 bg-black flex items-center gap-1.5 px-3 overflow-x-auto', fade(ui, 'translate-y-full'))}>
            <span className="shrink-0 h-8 flex items-center rounded-full px-3 text-[11px] tabular-nums text-zinc-300 ring-1 ring-white/15">{fmt(t)}</span>
            {ranges.map(([a, b]) => { const st = t >= b ? 'past' : t >= a ? 'now' : 'next'
              return <button key={a} onClick={() => seek(a)} className={cx('shrink-0 h-8 flex items-center gap-1.5 rounded-full px-3.5 text-[10.5px] font-medium tabular-nums transition-colors', st === 'now' ? 'bg-[#eef07a] text-black' : st === 'past' ? 'bg-white text-black' : 'bg-[#2a2a2c] text-zinc-300 hover:bg-[#363638]')}>
                {short(a)}<span className="tracking-[2px] opacity-40">···</span>{short(b)}</button> })}
          </div>
        </div>
      )}
    </div>
  )
}
