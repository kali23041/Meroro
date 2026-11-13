import { useEffect, useRef, useState } from 'react'
import {
  Smartphone, Wifi, Usb, Radio, Circle, Square, Mic, Volume2, Headphones, Camera, Layers, ChevronLeft, Search,
  AppWindow, ShieldCheck, ExternalLink, Info, X, Eye, EyeOff, RefreshCw, MousePointerClick, FolderOpen
} from 'lucide-react'
import { Engine } from './engine'
import Panel from './Panel'
import Permissions from './Permissions'
import { Logo, About, VERSION } from './Brand'
import { PRESETS, patchLayer, newLayer } from './scene'
import { Button, Segmented, Slider, Switch, Select, Input, Row, Section, cx } from './ui'

const api = window.api
const mac = api.platform === 'darwin'
const clean = e => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
const KEYS = { Enter: 66, Backspace: 67, Escape: 4, ArrowUp: 19, ArrowDown: 20, ArrowLeft: 21, ArrowRight: 22, Tab: 61, Delete: 112 }

const DEF = {
  mode: 'phone', appMode: 'guard', pkg: '', vdisplay: '', maxSize: 1920, capFps: 60, capBitrate: 8, phoneAudio: true, control: true, system: false,
  dest: 'youtube', key: '', customUrl: '', bitrate: 4500, fps: 30, encoder: mac ? 'hw' : 'x264',
  canvas: '1920x1080', fit: 'fit', scale: 0.94, bg: '#0b0b0f', blur: true, radius: 36, text: '', textPos: 'bottom',
  cam: '', camPos: 'br', camShape: 'circle', camSize: 1, mic: '', micVol: 1, phoneVol: 1, monitor: false
}

const firstScene = PRESETS['Phone · blurred backdrop']().scene
DEF.scenes = [firstScene]; DEF.sceneId = firstScene.id
DEF.control = false
Object.assign(DEF, { autoSwitch: false, rules: [], fallbackScene: '', trans: 300 })

// Selection outline for the layer being arranged (DOM overlay, so it never appears in the stream).
function SelBox({ eng, canvas, id }) {
  const ref = useRef()
  useEffect(() => {
    let raf
    const tick = () => {
      const g = eng.current?.geo[id], c = canvas.current, el = ref.current
      if (el && c) {
        const k = c.clientWidth / c.width
        el.style.display = g ? 'block' : 'none'
        if (g) Object.assign(el.style, { left: c.offsetLeft + (g.cx - g.w / 2) * k + 'px', top: c.offsetTop + (g.cy - g.h / 2) * k + 'px', width: g.w * k + 'px', height: g.h * k + 'px', transform: `rotate(${g.rot}rad)` })
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [id])
  return (
    <div ref={ref} className="absolute pointer-events-none border border-violet-400 shadow-[0_0_0_1px_rgba(0,0,0,.5)]">
      {['-top-1 -left-1', '-top-1 -right-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map(c => <span key={c} className={'absolute size-2 rounded-sm bg-white border border-violet-500 ' + c} />)}
    </div>
  )
}

function Meter({ get }) {
  const ref = useRef()
  useEffect(() => {
    let id
    const tick = () => { if (ref.current) ref.current.style.width = get() * 100 + '%'; id = requestAnimationFrame(tick) }
    tick()
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div ref={ref} className="h-full w-0 rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" />
    </div>
  )
}

function Strip({ icon: Icon, title, right, level, value, onChange }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 flex flex-col justify-between">
      <div className="flex items-center gap-2 h-7">
        <Icon size={14} className="text-zinc-400 shrink-0" />
        <span className="text-[12px] font-medium shrink-0">{title}</span>
        <div className="flex-1 min-w-0 flex justify-end">{right}</div>
      </div>
      <Meter get={level} />
      <div className="flex items-center gap-2">
        <Slider value={value} onChange={onChange} max={1.5} />
        <span className="w-8 text-right text-[11px] tabular-nums text-zinc-500">{Math.round(value * 100)}%</span>
      </div>
    </div>
  )
}

export default function App() {
  const [saved, setS] = useState(null)
  const [devices, setDevices] = useState([])
  const [serial, setSerial] = useState('')
  const [apps, setApps] = useState(null)
  const [q, setQ] = useState('')
  const [addr, setAddr] = useState('')
  const [cap, setCap] = useState('idle') // idle | starting | on
  const [live, setLive] = useState(null) // null | starting | on
  const [rec, setRec] = useState(null) // null | elapsed time
  const [stats, setStats] = useState(null)
  const [note, setNote] = useState(null)
  const [focus, setFocus] = useState('')
  const [media, setMedia] = useState({ mics: [], cams: [] })
  const [sel, setSel] = useState('')
  const [perm, setPerm] = useState(false)
  const [about, setAbout] = useState(false)
  const canvas = useRef(), eng = useRef(), down = useRef(false), drag = useRef(null)
  const s = saved || DEF
  const set = p => setS(o => ({ ...o, ...p }))
  const fail = e => setNote({ text: clean(e), bad: true })

  useEffect(() => {
    const e = eng.current = window.__eng = new Engine(canvas.current)
    e.onError = fail
    api.invoke('settings:get').then(v => { const n = { ...DEF, ...v }; if (!n.scenes?.length) n.scenes = DEF.scenes; if (!n.scenes.some(x => x.id === n.sceneId)) n.sceneId = n.scenes[0].id; setS(n) })
    const refresh = e.refreshMedia = async () => {
      const d = await navigator.mediaDevices.enumerateDevices()
      const pick = kind => d.filter(x => x.kind === kind && x.label && x.deviceId !== 'default').map(x => [x.deviceId, x.label])
      setMedia({ mics: pick('audioinput'), cams: pick('videoinput') })
    }
    refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    const poll = () => api.invoke('devices').then(setDevices).catch(() => {})
    poll()
    const t = setInterval(poll, 2000)
    const offs = [
      api.on('session:video', p => e.pushVideo(p)),
      api.on('session:audio', d => e.pushAudio(d)),
      api.on('session:log', l => /WARN|ERROR|unavailable/.test(l) && setNote({ text: l.replace(/^\[server\]\s*/, '') })),
      api.on('session:end', err => { e.clear(); setCap('idle'); if (err) setNote({ text: err, bad: true }) }),
      api.on('out:stats', (id, st) => { if (id === 'live') { setStats(st); setLive('on') } else setRec(st.time.slice(0, 8)) }),
      api.on('out:end', (id, r) => {
        e.stopOutput(id)
        if (id === 'live') { setLive(null); setStats(null) } else setRec(null)
        if (r.error) setNote({ text: r.error, bad: true })
        else if (r.file) setNote({ text: 'Recording saved to Movies', file: r.file })
      })
    ]
    return () => { clearInterval(t); offs.forEach(f => f()) }
  }, [])

  const guarding = cap === 'on' && s.mode === 'app' && s.appMode === 'guard'
  useEffect(() => {
    if (!saved) return
    eng.current.set({ ...s, guardPkg: guarding ? s.pkg : '' })
    const t = setTimeout(() => api.send('settings:set', s), 400)
    return () => clearTimeout(t)
  }, [saved, guarding])
  useEffect(() => { saved && eng.current.setMic(s.mic).then(eng.current.refreshMedia).catch(e => { fail(e); set({ mic: '' }) }) }, [s.mic, !saved])

  const dev = devices.find(d => d.serial === serial)
  const ready = dev?.state === 'device'
  useEffect(() => { if (!dev) setSerial(devices.find(d => d.state === 'device')?.serial || devices[0]?.serial || '') }, [devices])
  useEffect(() => { setApps(null); if (ready) api.invoke('apps', serial).then(setApps).catch(() => setApps([])) }, [serial, ready])

  // Watch which app is in front on the phone (drives "On phone now" and the privacy cover).
  useEffect(() => {
    if (!ready || (s.mode !== 'app' && !s.autoSwitch)) return setFocus('')
    let on = true
    const tick = async () => { const f = await api.invoke('focus', serial).catch(() => ''); if (on && f) { eng.current.focus = f; setFocus(f) } }
    tick()
    const t = setInterval(tick, 1000)
    return () => { on = false; clearInterval(t) }
  }, [serial, ready, s.mode, s.autoSwitch])

  // Auto scene switching: follow the app in front on the phone.
  useEffect(() => {
    if (!s.autoSwitch || !focus) return
    const r = (s.rules || []).find(r => r.pkg === (/launcher/i.test(focus) ? '__home' : focus))
    const id = r?.sceneId || s.fallbackScene
    if (id && id !== s.sceneId && s.scenes.some(x => x.id === id)) set({ sceneId: id })
  }, [focus, s.autoSwitch])

  // Hotkeys: Cmd/Ctrl+1..9 switch scenes, Cmd/Ctrl+R toggles recording.
  const hot = useRef()
  hot.current = { record: () => record() } // lazy: record is declared further down
  useEffect(() => {
    const h = e => {
      if (!(e.metaKey || e.ctrlKey) || e.target.tagName === 'INPUT') return
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); setS(o => { const sc = o.scenes[+e.key - 1]; return sc ? { ...o, sceneId: sc.id } : o }) }
      else if (e.key === 'r') { e.preventDefault(); hot.current.record() }
    }
    addEventListener('keydown', h)
    return () => removeEventListener('keydown', h)
  }, [])

  // ---- capture ----
  const start = async (o = s) => {
    const isApp = o.mode === 'app'
    if (isApp && !o.pkg) return setNote({ text: 'Pick an app to stream first.' })
    setNote(null); setCap('starting')
    try {
      await api.invoke('session:start', serial, {
        audio: o.phoneAudio, maxSize: +o.maxSize, fps: +o.capFps, bitrate: o.capBitrate,
        virtual: isApp && o.appMode === 'virtual', display: o.vdisplay, pkg: isApp && !(o.appMode === 'guard' && focus === o.pkg) ? o.pkg : ''
      })
      setCap('on')
    } catch (e) { setCap('idle'); fail(e) }
  }
  const source = p => { const n = { ...s, ...p }; setS(n); if (cap === 'on') start(n) } // source changes restart a running capture

  // ---- outputs ----
  const goLive = async () => {
    if (live) return eng.current.stopOutput('live')
    if (!s.key) return setNote({ text: 'Paste your stream key first — YouTube Studio → Go live → Stream.', bad: true })
    if (s.dest === 'custom' && !/^rtmps?:\/\//.test(s.customUrl)) return setNote({ text: 'Enter the RTMP server URL (rtmp://…).', bad: true })
    setNote(null); setLive('starting')
    try { await eng.current.startOutput('live', { dest: s.dest, key: s.key.trim(), url: s.customUrl.trim(), bitrate: +s.bitrate, fps: +s.fps, encoder: s.encoder }) }
    catch (e) { setLive(null); fail(e) }
  }
  const record = async () => {
    if (rec) return eng.current.stopOutput('rec')
    setRec('00:00:00')
    try { await eng.current.startOutput('rec', {}) } catch (e) { setRec(null); fail(e) }
  }

  // ---- phone control from the preview ----
  const canCtl = cap === 'on' && s.control
  const cpt = e => { const c = canvas.current, b = c.getBoundingClientRect(); return [((e.clientX - b.left) * c.width) / b.width, ((e.clientY - b.top) * c.height) / b.height] }
  const pos = e => canCtl ? eng.current.toPhone(...cpt(e), down.current) : null
  const upL = (id, p) => setS(o => ({ ...o, ...patchLayer(o, id, p) }))
  const layerOf = id => (s.scenes.find(x => x.id === s.sceneId) || s.scenes[0]).layers.find(l => l.id === id)
  const touch = (a, e) => { const p = pos(e); if (p) api.send('ctl', { t: 'touch', a, ...p }) }
  const key = code => api.send('ctl', { t: 'key', code })
  const ptr = s.control ? {
    onContextMenu: e => { e.preventDefault(); canCtl && key(4) },
    onPointerDown: e => { if (e.button || !pos(e)) return; e.currentTarget.setPointerCapture(e.pointerId); touch(0, e); down.current = true },
    onPointerMove: e => down.current && touch(2, e),
    onPointerUp: e => { if (down.current) { touch(1, e); down.current = false } },
    onWheel: e => { const p = pos(e); if (p) api.send('ctl', { t: 'scroll', ...p, dx: -e.deltaX / 40, dy: -e.deltaY / 40 }) },
    onKeyDown: e => {
      if (!canCtl) return
      if (KEYS[e.key]) key(KEYS[e.key])
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) api.send('ctl', { t: 'text', text: e.key })
      else return
      e.preventDefault()
    }
  } : { // arrange mode: move / resize sources directly on the preview
    onPointerDown: e => {
      if (e.button) return
      const E = eng.current, c = canvas.current, [px, py] = cpt(e), g = E.geo[sel], loc = g && E.local(g, px, py), hs = (16 * c.width) / c.clientWidth
      let id = sel, mode = 'move'
      if (loc && Math.abs(Math.abs(loc[0]) - g.w / 2) < hs && Math.abs(Math.abs(loc[1]) - g.h / 2) < hs) mode = 'size'
      else { id = E.hit(px, py); setSel(id) }
      if (!id) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { id, mode, px, py, l: layerOf(id), d0: loc ? Math.hypot(...loc) : 1 }
    },
    onPointerMove: e => {
      const d = drag.current
      if (!d) return
      const E = eng.current, c = canvas.current, [px, py] = cpt(e), snap = v => Math.abs(v - 0.5) < 0.012 ? 0.5 : v
      if (d.mode === 'move') upL(d.id, { x: snap(d.l.x + (px - d.px) / c.width), y: snap(d.l.y + (py - d.py) / c.height) })
      else { const k = Math.max(0.05, Math.hypot(...E.local(E.geo[d.id], px, py)) / d.d0); upL(d.id, { w: d.l.w * k, h: d.l.h * k }) }
    },
    onPointerUp: () => { drag.current = null },
    onWheel: e => { const l = sel && layerOf(sel); if (l) { const k = e.deltaY < 0 ? 1.04 : 0.96; upL(sel, { w: l.w * k, h: l.h * k }) } },
    onKeyDown: e => {
      const l = sel && layerOf(sel), d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
      if (!l) return
      if (d) upL(sel, { x: l.x + d[0] * 0.005, y: l.y + d[1] * 0.005 })
      else if (e.key === 'Delete' || e.key === 'Backspace') { setS(o => ({ ...o, scenes: o.scenes.map(sc => ({ ...sc, layers: sc.layers.filter(x => x.id !== sel) })) })); setSel('') }
      else return
      e.preventDefault()
    }
  }

  const shown = (apps || []).filter(a => (s.system || !a.system) && (a.name + a.pkg).toLowerCase().includes(q.toLowerCase()))
  const picked = apps?.find(a => a.pkg === s.pkg)
  const front = apps?.find(a => a.pkg === focus)
  const frontIsApp = !!focus && focus.includes('.') && !/launcher|systemui/i.test(focus)
  const pick = pkg => { // on-phone mode keeps the same capture running; isolated mode needs a new virtual display
    if (cap === 'on' && s.appMode === 'guard') { set({ pkg }); api.send('ctl', { t: 'app', pkg }) } else source({ pkg })
  }
  const busy = !!live || !!rec
  const covered = guarding && focus && focus !== s.pkg

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-200">
      {/* title bar */}
      <header className={cx('drag h-11 shrink-0 flex items-center gap-3 border-b border-white/[0.06]', mac ? 'pl-[88px] pr-3' : 'pl-3 pr-[150px]')}>
        <button onClick={() => setAbout(true)} className="no-drag flex items-center gap-2 rounded-md pr-1.5 hover:bg-white/5" title="About Meroro">
          <Logo size={22} /><span className="font-semibold tracking-tight">Meroro</span><span className="text-[11px] text-zinc-500">by Kartik Sabale</span>
        </button>
        <div className="flex-1" />
        {live === 'on' && stats && (
          <div className="flex items-center gap-3 text-[11px] tabular-nums text-zinc-400">
            <span>{Math.round(stats.kbps)} kbps</span><span>{stats.fps} fps</span>
            <span className={stats.speed < 0.95 ? 'text-amber-400' : 'text-emerald-400'}>{stats.speed < 0.95 ? 'Encoder lagging' : 'Healthy'}</span>
          </div>
        )}
        <Button variant="ghost" onClick={() => setPerm(true)}><ShieldCheck size={13} />Permissions</Button>
        {rec && <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-zinc-300"><Circle size={8} className="fill-red-500 text-red-500 live-dot" />REC {rec}</span>}
        <span className={cx('h-6 px-2 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 tabular-nums', live === 'on' ? 'bg-red-500 text-white' : 'bg-white/[0.06] text-zinc-400')}>
          {live === 'on' ? <><span className="size-1.5 rounded-full bg-white live-dot" />LIVE {stats?.time.slice(0, 8)}</> : live ? 'CONNECTING…' : 'OFFLINE'}
        </span>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* left: device + source */}
        <aside className="w-[292px] shrink-0 border-r border-white/[0.06] overflow-y-auto bg-zinc-900/40">
          <Section icon={Smartphone} title="Devices" right={<RefreshCw size={12} className="text-zinc-600 animate-spin [animation-duration:3s]" />}>
            {devices.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 p-3 text-[12px] text-zinc-500 leading-relaxed">
                No phone detected. Plug in an Android phone with <b className="text-zinc-300">USB debugging</b> on — it appears here automatically.
              </div>
            )}
            {devices.map(d => (
              <button key={d.serial} onClick={() => setSerial(d.serial)} disabled={cap !== 'idle'}
                className={cx('w-full flex items-center gap-2.5 rounded-lg p-2 text-left border transition-colors', d.serial === serial ? 'bg-violet-500/10 border-violet-400/40' : 'border-transparent hover:bg-white/5')}>
                <div className="size-8 rounded-md bg-white/[0.06] grid place-items-center shrink-0">{d.wifi ? <Wifi size={15} /> : <Usb size={15} />}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{d.model}</div>
                  <div className={cx('text-[11px] truncate', d.state === 'device' ? 'text-emerald-400' : 'text-amber-400')}>
                    {d.state === 'device' ? 'Ready' : d.state === 'unauthorized' ? 'Tap “Allow” on the phone' : d.state}
                  </div>
                </div>
              </button>
            ))}
            <div className="flex gap-1.5">
              <Input value={addr} onChange={e => setAddr(e.target.value)} placeholder="Wi-Fi: 192.168.1.20:5555" />
              <Button disabled={!addr} onClick={() => api.invoke('adb:connect', addr.trim()).then(r => setNote({ text: r.trim() })).catch(fail)}>Connect</Button>
            </div>
          </Section>

          <Section icon={AppWindow} title="Source">
            <Segmented value={s.mode} onChange={mode => source({ mode })} options={[['phone', 'Entire phone', Smartphone], ['app', 'Single app', AppWindow]]} />
            {s.mode === 'app' && <>
              <Segmented value={s.appMode} onChange={appMode => source({ appMode })} options={[['guard', 'Play on phone', Smartphone], ['virtual', 'Isolated', Layers]]} />
              <p className="text-[11px] leading-relaxed text-zinc-500">
                {s.appMode === 'virtual'
                  ? 'Moves the app to a private virtual display: it leaves the phone screen and you control it from this preview.'
                  : 'Play on the phone as usual. Viewers see only the selected app — anything else (home screen, other apps, notifications) is covered.'}
              </p>
              {ready && focus && (
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] p-2">
                  <span className={cx('size-2 rounded-full shrink-0', frontIsApp ? 'bg-emerald-400 live-dot' : 'bg-zinc-600')} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">On phone now</div>
                    <div className="truncate text-[12px] font-medium">{front?.name || (frontIsApp ? focus : 'Home screen')}</div>
                  </div>
                  {focus === s.pkg ? <span className="text-[11px] text-emerald-400 shrink-0">Selected</span>
                    : frontIsApp && <Button variant="primary" className="shrink-0" onClick={() => pick(focus)}>Stream this</Button>}
                </div>
              )}
              {s.appMode === 'virtual' && (
                <Row label="Display"><Select className="flex-1" value={s.vdisplay} onChange={vdisplay => source({ vdisplay })}
                  options={[['', 'Same as phone'], ['1920x1080/280', 'Landscape 1080p'], ['1080x1920/420', 'Portrait 1080p']]} /></Row>
              )}
              <div className="relative">
                <Search size={13} className="absolute left-2 top-[7px] text-zinc-500" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder={ready ? 'Search apps' : 'Connect a phone to list apps'} className="pl-7" />
              </div>
              <div className="h-[196px] overflow-y-auto rounded-lg bg-black/30 border border-white/[0.06] p-1">
                {ready && apps === null && <div className="h-full grid place-items-center text-zinc-500 text-[12px]">Reading apps from phone…</div>}
                {shown.map(a => (
                  <button key={a.pkg} onClick={() => pick(a.pkg)}
                    className={cx('w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left', a.pkg === s.pkg ? 'bg-violet-500/20' : 'hover:bg-white/5')}>
                    <span className="size-6 shrink-0 rounded-md grid place-items-center text-[11px] font-bold text-white"
                      style={{ background: `hsl(${[...a.pkg].reduce((h, c) => h + c.charCodeAt(0), 0) % 360} 55% 42%)` }}>{a.name[0].toUpperCase()}</span>
                    <span className="min-w-0"><span className="block truncate text-[12px]">{a.name}</span><span className="block truncate text-[10px] text-zinc-500">{a.pkg}</span></span>
                  </button>
                ))}
              </div>
              <Row label="System apps"><Switch checked={s.system} onChange={system => set({ system })} /></Row>
            </>}
            <Row label="Quality"><Select className="flex-1" value={s.maxSize} onChange={maxSize => source({ maxSize })} options={[[1920, '1080p'], [1280, '720p'], [0, 'Native resolution']]} /></Row>
            <Row label="Frame rate"><Select className="flex-1" value={s.capFps} onChange={capFps => source({ capFps })} options={[[60, '60 fps'], [30, '30 fps']]} /></Row>
            <Row label="Phone audio"><Switch checked={s.phoneAudio} onChange={phoneAudio => source({ phoneAudio })} /></Row>
            {cap === 'idle'
              ? <Button variant="primary" className="w-full h-8" disabled={!ready} onClick={() => start()}>Start capture</Button>
              : <Button className="w-full h-8" onClick={() => api.invoke('session:stop')}>{cap === 'starting' ? 'Connecting…' : 'Stop capture'}</Button>}
          </Section>
          <div className="px-3 py-3 flex items-center gap-2 text-[11px] text-zinc-500">
            <Logo size={14} /><span>Meroro v{VERSION}</span><span className="text-zinc-700">·</span>
            <button onClick={() => setAbout(true)} className="hover:text-zinc-200">Created by <span className="text-zinc-300">Kartik Sabale</span></button>
          </div>
        </aside>

        {/* center: preview + dock */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="relative flex-1 min-h-0 bg-black/50">
            <canvas ref={canvas} tabIndex={0} {...ptr}
              className={cx('absolute inset-0 m-auto max-w-[calc(100%-32px)] max-h-[calc(100%-32px)] rounded-md ring-1 ring-white/10 shadow-2xl outline-none', canCtl ? 'cursor-pointer' : !s.control && 'cursor-move')} />
            {!s.control && sel && <SelBox eng={eng} canvas={canvas} id={sel} />}
            {cap !== 'on' && !sel && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center max-w-[340px] pointer-events-auto">
                  <div className="mx-auto size-14 rounded-2xl bg-white/[0.06] border border-white/10 grid place-items-center mb-3">
                    {cap === 'starting' ? <RefreshCw size={22} className="animate-spin text-violet-300" /> : <Logo size={40} />}
                  </div>
                  <div className="text-[15px] font-semibold text-white">
                    {cap === 'starting' ? `Connecting to ${dev?.model}…` : !dev ? 'Connect your Android phone' : ready ? dev.model : 'Check your phone'}
                  </div>
                  <p className="mt-1 text-[12px] text-zinc-400 leading-relaxed">
                    {cap === 'starting' ? 'Keep the phone unlocked.'
                      : !dev ? 'Plug it in over USB and enable USB debugging in Settings → Developer options. Meroro picks it up on its own.'
                      : ready ? (s.mode === 'app' ? (picked ? `Ready to stream ${picked.name} only.` : 'Pick the app you want to stream on the left.') : 'Ready to stream the whole screen.')
                      : 'Tap “Allow” on the USB debugging prompt.'}
                  </p>
                  {cap === 'idle' && ready && <Button variant="primary" className="mt-3 h-8 px-4" onClick={() => start()}>Start capture</Button>}
                </div>
              </div>
            )}
            {covered && <div className="absolute top-3 left-1/2 -translate-x-1/2 h-7 px-3 rounded-full bg-amber-500 text-black text-[12px] font-semibold flex items-center gap-1.5"><ShieldCheck size={13} />Stream covered — {picked?.name || 'the app'} is not in front</div>}
          </div>

          <div className="h-10 shrink-0 flex items-center gap-1 px-3 border-t border-white/[0.06]">
            <Button variant="ghost" disabled={!canCtl} onClick={() => key(4)} title="Back"><ChevronLeft size={15} /></Button>
            <Button variant="ghost" disabled={!canCtl} onClick={() => key(3)} title="Home"><Circle size={12} /></Button>
            <Button variant="ghost" disabled={!canCtl} onClick={() => key(187)} title="Recents"><Square size={12} /></Button>
            <span className="mx-2 h-4 w-px bg-white/10" />
            <MousePointerClick size={13} className="text-zinc-500" />
            <span className="text-[12px] text-zinc-400 mr-1">{s.control ? 'Control phone' : 'Arrange sources'}</span>
            <Switch checked={s.control} onChange={control => set({ control })} />
            <div className="flex-1" />
            {note && (
              <div className={cx('min-w-0 flex items-center gap-1.5 text-[12px]', note.bad ? 'text-red-400' : 'text-zinc-400')}>
                <Info size={13} className="shrink-0" /><span className="truncate">{note.text}</span>
                {note.file && <Button variant="ghost" onClick={() => api.send('reveal', note.file)}><FolderOpen size={13} />Show</Button>}
                <button onClick={() => setNote(null)} className="p-1 text-zinc-500 hover:text-zinc-200"><X size={12} /></button>
              </div>
            )}
          </div>

          <div className="h-[128px] shrink-0 flex gap-3 p-3 border-t border-white/[0.06] bg-zinc-900/40">
            <Strip icon={Volume2} title="Phone audio" level={() => eng.current?.level('phone') || 0} value={s.phoneVol} onChange={phoneVol => set({ phoneVol })}
              right={<Button variant="ghost" className={cx(s.monitor && 'text-violet-300')} onClick={() => set({ monitor: !s.monitor })}><Headphones size={13} />Monitor</Button>} />
            <Strip icon={Mic} title="Microphone" level={() => eng.current?.level('mic') || 0} value={s.micVol} onChange={micVol => set({ micVol })}
              right={<Select className="w-[150px]" value={s.mic} onChange={mic => set({ mic })} options={[['', 'Off'], ['default', 'System default'], ...media.mics]} />} />
            <div className="w-[220px] shrink-0 flex flex-col gap-2">
              <Button variant={live ? 'default' : 'live'} className="flex-1 text-[13px] font-semibold" onClick={goLive}>
                {live ? <><Square size={12} className="fill-current" />{live === 'on' ? 'End stream' : 'Cancel'}</> : <><Radio size={15} />Go Live</>}
              </Button>
              <Button className="h-8" onClick={record}>
                <Circle size={10} className={cx('fill-current', rec ? 'text-red-400' : 'text-zinc-400')} />{rec ? 'Stop recording' : 'Record'}
              </Button>
              <div className="text-center text-[10px] text-zinc-500 truncate">{s.dest === 'youtube' ? 'YouTube' : 'Custom RTMP'} · {s.canvas.replace('x', '×')} · {s.fps} fps · {s.bitrate} kbps</div>
            </div>
          </div>
        </main>

        <Panel s={s} set={set} live={live} busy={busy} media={media} sel={sel} setSel={setSel} focus={focus} apps={apps} />
        {about && <About onClose={() => setAbout(false)} />}
        {perm && <Permissions devices={devices} onClose={() => { setPerm(false); eng.current.refreshMedia() }} addScreen={x => {
          const n = { ...newLayer('screen'), src: x.id, name: x.name }
          setS(o => ({ ...o, scenes: o.scenes.map(sc => sc.id !== o.sceneId ? sc : { ...sc, layers: [...sc.layers, n] }) }))
        }} />}
      </div>
    </div>
  )
}
