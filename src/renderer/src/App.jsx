import { useEffect, useRef, useState } from 'react'
import {
  SlidersVertical, Settings2, Film, GripHorizontal, MessageSquare, Music, Bell, Wand2, LayoutDashboard, Sparkles, Zap, Gamepad2, Smartphone, Wifi, Usb, Radio, Circle, Square, Mic, Volume2, Headphones, Camera, Layers, ChevronLeft, Search,
  AppWindow, ShieldCheck, ExternalLink, Info, X, Eye, EyeOff, RefreshCw, MousePointerClick, FolderOpen,
  BellDot, ChevronRight, House, LayoutGrid, MicOff, Power, Undo2, Volume1
} from 'lucide-react'
import { Engine } from './engine'
import Panel from './Panel'
import Permissions from './Permissions'
import { Logo, About, VERSION } from './Brand'
import { useMeta, AppIcon } from './Library'
import AddSource from './AddSource'
import Perf from './Perf'
import Sounds from './Sounds'
import Overlays from './Overlays'
import StreamPlus, { titleFor } from './StreamPlus'
import WhatsNew, { LATEST } from './WhatsNew'
import { PAD } from './keymap'
import { parseCube, setLut } from './gpu'
import CleanScreen from './Clean'
import { SourceDialog, SceneDialog, FloatChat } from './Dialogs'
import Device from './Device'
import Wireless from './Wireless'
import { AutoPanel, ChatBox, Quick } from './Pages'
import HeaderBar from './HeaderBar'
import Manager from './Manager'
import { SideBySide } from './Frames'
import { migrateFrames, frameSync } from './framemodel'
import Mixer from './Mixer'
import { SFX, SFX_FOR } from './sfx'
import Editor from './Editor'
import Annotate from './Annotate'
import StreamTabs, { GoLiveBar } from './StreamTabs'
import { platform, destOut } from './platforms'
import Settings from './Settings'
import PresetPicker from './PresetPicker'
import Keys, { KeyHints } from './Keys'
import { KEYMAPS, MAP_DEFAULTS, Mapper, combo, matchTrigger } from './keymap'
import { PRESETS, patchLayer, newLayer } from './scene'
import { Button, Segmented, Slider, Switch, Select, Input, Row, Section, Card, Tabs, cx } from './ui'

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
Object.assign(DEF, { autoSwitch: false, rules: [], fallbackScene: '', trans: 300, autos: [], chatUrl: '', cover: false, micMute: false, phoneMute: false,
  audioDup: true, keymaps: KEYMAPS, keymapId: 'bgmi', keymapOn: false, keymapAuto: true, layout: [['apps'], ['preview', 'mixer'], ['scene', 'live']] })

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

// A main-page panel: drag its grip onto another panel to swap their places.
const TALL = ['apps', 'preview', 'scene']
function Slot({ id, pos, swap, children }) {
  const [over, setOver] = useState(false)
  return (
    <div style={pos} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setOver(false)} onDrop={e => { setOver(false); swap(e.dataTransfer.getData('text/plain'), id) }}
      className={cx('group/slot relative min-w-0 min-h-0 flex flex-col rounded-2xl transition-shadow', over && 'ring-2 ring-violet-400/80')}>
      <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move' }} title="Drag onto another panel to swap places"
        className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 h-4 w-10 rounded-full grid place-items-center bg-zinc-800 border border-white/15 text-zinc-300 opacity-0 group-hover/slot:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"><GripHorizontal size={12} /></span>
      {children}
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

// Mixer channel: one bar — name as the label, live level bouncing inside, drag to set volume.
function Strip({ icon: Icon, title, right, level, value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <Slider label={<span className="flex items-center gap-1.5"><Icon size={13} />{title}</span>} level={level} value={value} onChange={onChange} max={1.5} />
      {right}
    </div>
  )
}

export default function App() {
  const [saved, setS] = useState(null)
  const [devices, setDevices] = useState([])
  const [serial, setSerial] = useState('')
  const [apps, setApps] = useState(null)
  const [q, setQ] = useState('')
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
  const [view, setView] = useState('studio'), [side, setSide] = useState('scene'), [games, setGames] = useState(false), [adding, setAdding] = useState(null), [srcDlg, setSrcDlg] = useState(null), [sceneDlg, setSceneDlg] = useState(null), [rtab, setRtab] = useState('props'), [picker, setPicker] = useState(false)
  const [editStart, setEditStart] = useState(null), trackRef = useRef({ pts: [], t0: 0, edit: false })
  const [overlayOn, setOverlayOn] = useState(false), [sbs, setSbs] = useState(false), [mgr, setMgr] = useState(false)
  useEffect(() => { if (!saved) return; const n = frameSync(saved); if (n !== saved) setS(n) }, [saved])
  useEffect(() => api.on('overlay:state', setOverlayOn), [])
  useEffect(() => api.on('pointer', (...a) => eng.current?.setPtr(...a)), [])
  const [fxTab, setFxTab] = useState(''), [annot, setAnnot] = useState(false)
  const canvas = useRef(), eng = useRef(), down = useRef(false), drag = useRef(null)
  const s = saved || DEF
  const sRef = useRef()
  sRef.current = s
  const [chat, setChat] = useState([]), [chatSt, setChatSt] = useState({})
  const set = p => setS(o => ({ ...o, ...p }))
  // ---- undo / redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z or Ctrl+Y): snapshots of the settings, quick changes grouped ----
  const undoH = useRef({ past: [], future: [], last: null, t: 0, skip: false })
  useEffect(() => {
    const h = undoH.current
    if (!saved) return
    if (h.skip) { h.skip = false; h.last = saved; return }
    if (h.last && h.last !== saved) { if (Date.now() - h.t > 600) { h.past.push(h.last); if (h.past.length > 100) h.past.shift() } h.future = [] }
    h.last = saved; h.t = Date.now()
  }, [saved])
  const travel = back => { const h = undoH.current, from = back ? h.past : h.future, to = back ? h.future : h.past; if (!from.length) return; to.push(h.last); h.skip = true; h.t = 0; setS(from.pop()); setNote({ text: back ? 'Undone' : 'Redone' }) }
  useEffect(() => {
    const k = e => {
      if (!(e.metaKey || e.ctrlKey) || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || document.querySelector('[data-annotating]')) return
      const key = e.key.toLowerCase()
      if (key === 'z') { e.preventDefault(); travel(!e.shiftKey) } else if (key === 'y') { e.preventDefault(); travel(false) }
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [])
  const fail = e => setNote({ text: clean(e), bad: true })

  useEffect(() => {
    const e = eng.current = window.__eng = new Engine(canvas.current)
    e.onError = fail
    e.onMicFix = (id, r) => !r.lost && setS(o => ({ ...o, mics: (o.mics || []).map(m => m.id === id ? { ...m, device: r.id, label: r.label } : m) }))
    api.invoke('settings:get').then(v => { let n = { ...DEF, ...v }; if (!n.dests && v.out2?.key) n.dests = [{ id: 'out2', on: !!v.out2.on, name: 'Second output', platform: v.out2.dest === 'custom' ? 'custom' : 'youtube', url: v.out2.url || '', key: v.out2.key, sceneId: v.out2.sceneId || '', size: v.out2.size || '1080x1920', bitrate: v.out2.bitrate || 6000 }]; delete n.out2; if (!n.scenes?.length) n.scenes = DEF.scenes; n.keymaps = { ...KEYMAPS, ...v.keymaps }; if (!n.scenes.some(x => x.id === n.sceneId)) n.sceneId = n.scenes[0].id; setS(migrateFrames(n)) })
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
      api.on('ios:video', p => e.pushIos(p)),
      api.on('ios:audio', d => e.pushIosAudio(d)),
      api.on('ios:end', err => { e.ios.clear(); iosRun.current = ''; if (err) setNote({ text: err, bad: true }) }),
      api.on('chat:msg', m => {
        e.pushChat(m); setChat(c => [...c.slice(-199), m])
        if (m.old) return
        hot.current.fire(m.type, m)
        if (m.type === 'chat') { hot.current.fire('command', m); hot.current.fire('keyword', m) }
        hot.current.chat(m)
      }),
      api.on('session:log', l => /WARN|ERROR|unavailable/.test(l) && setNote({ text: l.replace(/^\[server\]\s*/, '') })),
      api.on('session:end', err => { e.clear(); setCap('idle'); if (err) setNote({ text: err, bad: true }) }),
      api.on('out:stats', (id, st) => { if (id.startsWith('x:')) setXst(o => ({ ...o, [id.slice(2)]: { state: 'on', kbps: Math.round(st.kbps), fps: st.fps } })); else if (id === 'live') { setStats(st); setLive('on'); setHist(h => [...h.slice(-59), st]); hot.current.stat(st) } else if (id === 'rec') setRec(st.time.slice(0, 8)) }),
      api.on('out:end', (id, r) => {
        e.stopOutput(id)
        if (id === 'export') return dispatchEvent(new CustomEvent('export-end', { detail: r }))
        if (id.startsWith('x:')) return hot.current.xend(id.slice(2), r)
        if (id === 'rec') hot.current.recEnd(r)
        if (id === 'live' && hot.current.again(r)) return // reconnecting or changing bitrate
        if (id === 'live') { setLive(null); setStats(null); setHist([]); hot.current.xstop(); hot.current.fire('end') } else setRec(null)
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
  useEffect(() => { saved && eng.current.setMic(s.mic, s.micLabel).then(r => { eng.current.refreshMedia()
    if (!r) return
    if (r.lost) setNote({ text: `Your saved microphone${s.micLabel ? ` (${s.micLabel})` : ''} isn't connected, so the default mic is used.`, bad: true })
    else if (r.id !== s.mic || r.label !== (s.micLabel || '')) set({ mic: r.id, micLabel: r.label }) // found again by its name
  }).catch(e => setNote({ text: `Couldn't open the microphone (${clean(e)}). Pick another device in its settings.`, bad: true })) }, [s.mic, !saved])

  const dev = devices.find(d => d.serial === serial)
  const ready = dev?.state === 'device'
  useEffect(() => { if (!dev) setSerial(devices.find(d => d.state === 'device')?.serial || devices[0]?.serial || '') }, [devices])
  const [appsErr, setAppsErr] = useState('')
  const loadApps = () => { setApps(null); setAppsErr(''); if (ready) api.invoke('apps', serial).then(setApps).catch(e => { setApps([]); setAppsErr(clean(e)) }) }
  useEffect(loadApps, [serial, ready])
  useEffect(() => { // phone plugged in but the app list came back empty or failed: keep retrying until it loads
    if (!ready || (apps && apps.length && !appsErr)) return
    let n = 0; const t = setInterval(() => { if (++n > 15) return clearInterval(t); api.invoke('apps', serial).then(a => { if (a?.length) { setApps(a); setAppsErr(''); clearInterval(t) } }).catch(() => {}) }, 4000)
    return () => clearInterval(t)
  }, [ready, serial, apps?.length, appsErr])
  const meta = useMeta(apps)

  // Watch which app is in front on the phone (drives "On phone now" and the privacy cover).
  useEffect(() => {
    if (!ready) return setFocus('')
    let on = true, last = ''
    const tick = async () => { // a change counts only after two identical reads, so transitions don't flicker
      const f = await api.invoke('focus', serial).catch(() => '')
      if (on && f && f === last) { eng.current.focus = f; setFocus(f) }
      last = f
    }
    tick()
    const t = setInterval(tick, 600)
    return () => { on = false; clearInterval(t) }
  }, [serial, ready])

  // Auto scene switching: follow the app in front on the phone.
  useEffect(() => {
    if (!s.autoSwitch || !focus) return
    const r = (s.rules || []).find(r => r.pkg === (/launcher/i.test(focus) ? '__home' : focus))
    const id = r?.sceneId || s.fallbackScene
    if (id && id !== s.sceneId && s.scenes.some(x => x.id === id)) set({ sceneId: id })
  }, [focus, s.autoSwitch])

  // Hotkeys: Cmd/Ctrl+1..9 switch scenes, Cmd/Ctrl+R toggles recording.
  const hot = useRef()
  hot.current = { record: () => record(), fire: (...a) => fire(...a), xend: (...a) => xEnd(...a), recEnd: r => recEnd(r), xstop: () => xStop(), stat: st => liveStat(st), again: r => liveAgain(r), chat: m => chatExtras(m) } // lazy: both are declared further down
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
        audio: o.phoneAudio, dup: o.audioDup, maxSize: +o.maxSize, fps: +o.capFps, bitrate: o.capBitrate,
        virtual: isApp && o.appMode === 'virtual', display: o.vdisplay, pkg: isApp && !(o.appMode === 'guard' && focus === o.pkg) ? o.pkg : ''
      })
      setCap('on')
    } catch (e) { setCap('idle'); fail(e) }
  }
  const source = p => { const n = { ...s, ...p }; setS(n); if (cap === 'on') start(n) } // source changes restart a running capture
  // A phone that is plugged in after a preset (or scene) needed it: start capturing by itself, once per connection.
  const autoCap = useRef('')
  useEffect(() => {
    if (!ready) { autoCap.current = ''; return }
    const sc = s.scenes.find(x => x.id === s.sceneId), wants = sc?.layers.some(l => l.type === 'phone' && l.visible !== false)
    if (wants && cap === 'idle' && autoCap.current !== serial) { autoCap.current = serial; setTimeout(() => start(sRef.current), 600) }
  }, [ready, serial, s.sceneId, cap])
  // Microphones are sources too: adding one puts a Microphone source in the current scene; removing its last source removes the mic.
  const addMicSource = (device, name = '') => setS(o => {
    const nm = name.replace(/\s*\(.*\)$/, '') || 'Microphone', n = { ...o }; let micId = 'main'
    if (!o.mic) n.mic = device; else { micId = Math.random().toString(36).slice(2, 9); n.mics = [...(o.mics || []), { id: micId, device, name: nm, vol: 1 }] }
    const lay = { ...newLayer('mic'), name: nm, micId, device }; setSel(lay.id)
    n.scenes = o.scenes.map(sc => sc.id !== o.sceneId ? sc : { ...sc, layers: [...sc.layers, lay] }); return n
  })
  const micSeen = useRef(null)
  useEffect(() => {
    if (!saved) return
    const ids = new Set(saved.scenes.flatMap(sc => sc.layers.filter(l => l.type === 'mic').map(l => l.micId)))
    const have = [...(saved.mic ? ['main'] : []), ...(saved.mics || []).map(m => m.id)], prev = micSeen.current; micSeen.current = ids
    const gone = prev ? have.filter(id => prev.has(id) && !ids.has(id)) : [], missing = have.filter(id => !ids.has(id) && !gone.includes(id))
    const orphan = [...ids].filter(id => !have.includes(id)) // a Microphone source whose mic was lost: bring the mic back
    if (!gone.length && !missing.length && !orphan.length) return
    const lay = id => saved.scenes.flatMap(sc => sc.layers).find(l => l.type === 'mic' && l.micId === id)
    setS(o => ({ ...o, ...(gone.includes('main') ? { mic: '' } : orphan.includes('main') ? { mic: lay('main')?.device || 'default' } : {}),
      mics: [...(o.mics || []).filter(m => !gone.includes(m.id)), ...orphan.filter(id => id !== 'main').map(id => ({ id, device: lay(id)?.device || 'default', name: lay(id)?.name || 'Microphone', vol: 1 }))],
      scenes: missing.length ? o.scenes.map(sc => sc.id !== o.sceneId ? sc : { ...sc, layers: [...sc.layers, ...missing.map(id => ({ ...newLayer('mic'), name: id === 'main' ? 'Microphone' : o.mics?.find(m => m.id === id)?.name || 'Microphone', micId: id }))] }) : o.scenes }))
  }, [saved])
  // Landscape lock: when a locked phone source turns upright, switch to the chosen scene (or cover the phone); switch back when it turns sideways.
  const landLock = useRef(null)
  useEffect(() => {
    const id = setInterval(() => {
      const e = eng.current, S = sRef.current; let w = 0, h = 0
      try { w = e?.frame?.displayWidth || 0; h = e?.frame?.displayHeight || 0 } catch {}
      if (!w || !h) return
      const upright = h > w * 1.05, lk = landLock.current
      if (upright && !lk) {
        const cur = S.scenes.find(x => x.id === S.sceneId), l = cur?.layers.find(x => x.type === 'phone' && x.landLock && x.visible !== false)
        if (!l) return
        if (l.landScene && S.scenes.some(x => x.id === l.landScene)) { landLock.current = { from: S.sceneId, to: l.landScene }; set({ sceneId: l.landScene }) }
        else if (!S.cover) { landLock.current = { cover: true }; set({ cover: true }) }
      } else if (!upright && lk) {
        landLock.current = null
        if (lk.cover) { if (S.cover) set({ cover: false }) } else if (S.sceneId === lk.to && S.scenes.some(x => x.id === lk.from)) set({ sceneId: lk.from })
      }
    }, 400)
    return () => clearInterval(id)
  }, [])
  const restartCap = async () => { await api.invoke('session:stop').catch(() => {}); setCap('idle'); setTimeout(() => start(sRef.current), 400) }
  const refreshPhone = () => { api.invoke('devices').then(setDevices).catch(() => {}); loadApps() }

  // ---- outputs ----
  const [hist, setHist] = useState([])
  const want = useRef(false), br = useRef(0), restart = useRef(false), slow = useRef(0), fine = useRef(0)
  // ---- simultaneous streams: every enabled destination gets its own encoder, and its own canvas if it has its own scene or size ----
  const [xst, setXst] = useState({})
  const xStart = d => {
    const id = 'x:' + d.id
    if (eng.current.recs[id] || !d.on || !d.key) return
    setXst(o => ({ ...o, [d.id]: { state: 'starting' } }))
    eng.current.startOutput(id, destOut(d, sRef.current)).catch(e => { setXst(o => ({ ...o, [d.id]: { state: 'error', error: clean(e) } })); setNote({ text: `${d.name || platform(d.platform).name}: ${clean(e)}`, bad: true }) })
  }
  const xStop = () => { for (const k of Object.keys(eng.current.recs)) if (k.startsWith('x:')) eng.current.stopOutput(k); setXst({}) }
  const xEnd = (id, r) => { // one destination dropped: the others keep going, this one retries
    const d = (sRef.current.dests || []).find(x => x.id === id)
    if (!want.current || !d) return setXst(o => { const n = { ...o }; delete n[id]; return n })
    if (r.error) setNote({ text: `${d.name || platform(d.platform).name}: ${r.error.split('\n').pop()}`, bad: true })
    if (sRef.current.reconnect === false) return setXst(o => ({ ...o, [id]: { state: 'error', error: r.error } }))
    setXst(o => ({ ...o, [id]: { state: 'retry' } }))
    setTimeout(() => { const n = (sRef.current.dests || []).find(x => x.id === id); if (want.current && n) xStart(n) }, 4000)
  }
  const startLive = async bitrate => {
    const p = platform(s.dest)
    await eng.current.startOutput('live', { ...destOut({ platform: s.dest, url: p.ask ? s.customUrl : '', key: s.key, frameId: s.liveFrame || '' }, s), bitrate })
    for (const d of s.dests || []) xStart(d)
  }
  const goLive = async () => {
    const mainOn = s.mainOn !== false, extra = (s.dests || []).filter(d => d.on && d.key)
    if (live) { want.current = false; xStop(); if (eng.current.recs.live) return eng.current.stopOutput('live'); setLive(null); return }
    if (!mainOn) { if (!extra.length) return setNote({ text: 'Turn on at least one platform (gear on Go Live).', bad: true }); want.current = true; setNote(null); extra.forEach(xStart); setLive('on'); fire('live'); return }
    if (!s.key) return setNote({ text: `Paste your ${platform(s.dest).name} stream key first (Stream tab).`, bad: true })
    if (platform(s.dest).ask && !/^rtmps?:\/\//.test(s.customUrl)) return setNote({ text: 'Enter the RTMP server URL (rtmp://…).', bad: true })
    setNote(null); setLive('starting'); want.current = true; br.current = +s.bitrate
    try { await startLive(br.current); fire('live') }
    catch (e) { want.current = false; setLive(null); xStop(); fail(e) }
  }
  const liveAgain = r => { // called when ffmpeg ends: restart for a bitrate change, or reconnect after a drop
    if (!want.current) return false
    if (restart.current) { restart.current = false; startLive(br.current).catch(fail); return true }
    if (r.error && s.reconnect !== false) {
      setLive('retry'); setNote({ text: 'Connection lost — reconnecting…', bad: true })
      setTimeout(() => want.current && startLive(br.current).then(() => setNote({ text: 'Reconnected' })).catch(() => liveAgain(r)), 3000)
      return true
    }
    want.current = false; return false
  }
  const liveStat = st => { // adaptive bitrate: step down when the encoder/upload falls behind, back up when steady
    if (!s.autoBitrate || restart.current) return
    if (st.speed < 0.92) { fine.current = 0; if (++slow.current >= 8 && br.current > 1500) { slow.current = 0; br.current = Math.max(1500, Math.round(br.current * 0.7)); restart.current = true; setNote({ text: `Upload is slow — bitrate lowered to ${br.current} kbps` }); eng.current.stopOutput('live') } }
    else { slow.current = 0; if (++fine.current >= 60 && br.current < +s.bitrate) { fine.current = 0; br.current = Math.min(+s.bitrate, Math.round(br.current * 1.25)); restart.current = true; setNote({ text: `Connection steady — bitrate raised to ${br.current} kbps` }); eng.current.stopOutput('live') } }
  }
  const cmdAt = useRef({})
  const chatExtras = m => { // goal bars + chat commands
    const amt = m.type === 'superchat' ? parseFloat(String(m.amount || '').replace(/[^\d.]/g, '')) || 0 : 0
    setS(o => ({ ...o, scenes: o.scenes.map(sc => ({ ...sc, layers: sc.layers.map(l => l.type !== 'goal' ? l : l.auto === 'superchat' && amt ? { ...l, cur: (l.cur || 0) + amt } : l.auto === 'member' && m.type === 'member' ? { ...l, cur: (l.cur || 0) + 1 } : l.auto === 'chat' && m.type === 'chat' ? { ...l, cur: (l.cur || 0) + 1 } : l) })) }))
    const t = (m.text || '').trim().toLowerCase()
    for (const c of sRef.current.cmds || []) {
      if (!c.on || !c.trigger || !t.startsWith(c.trigger.toLowerCase()) || Date.now() - (cmdAt.current[c.id] || 0) < c.cd * 1000) continue
      cmdAt.current[c.id] = Date.now()
      api.invoke('chat:send', c.reply.replace('{name}', m.author || '')).catch(e => setNote({ text: clean(e), bad: true }))
    }
  }
  // While recording, remember where the pointer goes on the preview: the editor turns it into automatic zooms and a drawn cursor.
  useEffect(() => {
    if (!rec) return
    const tr = trackRef.current; let last = 0
    const on = e => {
      const r = canvas.current?.getBoundingClientRect(); if (!r) return
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, now = performance.now(), d = e.type === 'pointerdown' ? 1 : e.type === 'pointerup' ? 2 : 0
      if (x < 0 || x > 1 || y < 0 || y > 1 || (!d && now - last < 30)) return
      last = now; tr.pts.push({ t: +((now - tr.t0) / 1000).toFixed(3), x: +x.toFixed(4), y: +y.toFixed(4), d })
    }
    for (const n of ['pointermove', 'pointerdown', 'pointerup']) addEventListener(n, on, true)
    return () => { for (const n of ['pointermove', 'pointerdown', 'pointerup']) removeEventListener(n, on, true) }
  }, [!!rec])
  const recEnd = r => { const tr = trackRef.current; if (r.file && tr.edit) { tr.edit = false; api.send('editor:open', { video: r.file, track: tr.pts }) } }
  const recOut = s => { // what to record: the studio preview, one frame or one scene, optionally scaled to 1080p / 2K / 4K
    const ro = { target: 'preview', res: '', quality: 'high', ...s.recOpt }, fr = ro.target === 'frame' && s.frames?.find(f => f.id === ro.frameId), sc = ro.target === 'scene' && s.scenes.find(x => x.id === ro.sceneId)
    const base = fr ? fr.size : sc ? (s.frames?.find(f => f.scenes.includes(sc.id))?.size || s.canvas) : s.canvas, [bw, bh] = base.split('x').map(Number)
    const k = ro.res ? +ro.res / Math.min(bw, bh) : 1, size = Math.round(bw * k / 2) * 2 + 'x' + Math.round(bh * k / 2) * 2, [w, h] = size.split('x').map(Number)
    const vbr = Math.round(w * h * (+s.fps || 30) * ({ standard: 0.08, high: 0.13, max: 0.22 }[ro.quality] || 0.13))
    return { ...(fr ? { frameId: fr.id } : {}), ...(sc ? { sceneId: sc.id } : {}), ...(ro.res || sc ? { size } : {}), fps: +s.fps, vbr: Math.max(6e6, Math.min(vbr, 120e6)) }
  }
  const record = async edit => {
    if (!rec) trackRef.current = { pts: [], t0: performance.now() + 250, edit: edit === true }
    if (rec) return eng.current.stopOutput('rec')
    setRec('00:00:00')
    try { await eng.current.startOutput('rec', recOut(sRef.current)) } catch (e) { setRec(null); fail(e) }
  }

  // ---- automation: chat / stream triggers → alert, sound, scene ----
  // sound-effect sources nested under an effect (alert box, banner, lower third) in the current scene
  const soundsOf = test => { const sc = sRef.current.scenes.find(x => x.id === sRef.current.sceneId), owners = new Set(sc?.layers.filter(test).map(l => l.id)); return sc?.layers.filter(l => l.type === 'sound' && l.visible !== false && owners.has(l.parent)) || [] }
  const withSound = (layer, sfx) => { const snd = { ...newLayer('sound'), name: SFX.find(x => x[0] === sfx)?.[1] + ' sound', sfx, parent: layer.id }; eng.current.playSfx(sfx).catch(() => {}); return [layer, snd] }
  const act = (r, m = {}) => {
    const fill = t => (t || '').replace('{name}', m.author || 'Someone').replace('{amount}', m.amount || '').replace('{text}', m.text || '')
    if (r.alert) { eng.current.showAlert(fill(r.alert), fill(r.sub), undefined, r.afx); if (!r.sfx) soundsOf(l => l.type === 'alert').forEach(x => eng.current.playSfx(x.sfx, x.vol)) }
    if (r.sfx) eng.current.playSfx(r.sfx).catch(() => {})
    if (r.sound) eng.current.playSound(r.sound).catch(fail)
    if (r.scene && sRef.current.scenes.some(x => x.id === r.scene)) set({ sceneId: r.scene })
  }
  const fire = (on, m = {}) => {
    for (const r of sRef.current.autos || []) {
      if (!r.enabled || r.on !== on) continue
      const t = (m.text || '').trim().toLowerCase(), arg = (r.arg || '').trim().toLowerCase()
      if ((on === 'command' && !(arg && t.startsWith(arg))) || (on === 'keyword' && !(arg && t.includes(arg)))) continue
      act(r, m)
    }
  }
  const chatGo = async () => {
    if (chatSt.on) { api.invoke('chat:stop'); return setChatSt({}) }
    setChatSt({ busy: true })
    try { setChatSt({ on: true, title: (await api.invoke('chat:start', s.chatUrl)).title }) } catch (e) { setChatSt({ err: clean(e) }) }
  }
  const applyPreset = r => { set({ scenes: [...s.scenes, r.scene], sceneId: r.scene.id, ...(live || rec ? {} : r.set) }); setSel(''); setView('studio'); if (r.set?.pkg && ready && cap === 'idle') start({ ...s, ...r.set }) }
  const pickApp = pkg => { // dock / All apps: open the app on the phone and make it the streamed app
    api.invoke('app:action', serial, pkg, 'launch').catch(() => {})
    if (cap === 'on' && s.mode === 'app' && s.appMode === 'guard') set({ pkg }); else source({ mode: 'app', pkg })
  }
  const qa = {
    s, set, cap, live, rec, ready, start: () => start(), stop: () => api.invoke('session:stop'), goLive: () => goLive(), record: () => record(), recEdit: () => record(true),
    shot: () => api.invoke('device:shot', serial).then(file => setNote({ text: 'Screenshot saved to Pictures', file })).catch(fail)
  }

  // ---- phone control from the preview ----
  const canCtl = cap === 'on' && s.control
  // Game controls: keyboard + mouse → multi-touch through the active key map
  const mapper = useRef()
  mapper.current ??= new Mapper(m => api.send('ctl', m), () => { const f = eng.current?.frame; return f && { w: f.displayWidth, h: f.displayHeight } })
  const km = s.keymaps[s.keymapId] || Object.values(s.keymaps)[0]
  useEffect(() => { mapper.current.reset(); mapper.current.items = km.items; mapper.current.opts = { ...MAP_DEFAULTS, ...km } }, [km])
  useEffect(() => { // auto-pick the map that belongs to the game in front
    if (s.keymapAuto === false || !focus) return
    const k = (s.appKeymaps?.[focus] in s.keymaps && s.appKeymaps[focus]) || Object.keys(s.keymaps).find(k => s.keymaps[k].pkg === focus)
    if (k && k !== s.keymapId) set({ keymapId: k })
  }, [focus, s.keymapAuto])
  const game = canCtl && s.keymapOn
  const locked = () => document.pointerLockElement === canvas.current
  // Free mouse: map / bag keys, the cursor key, or a screen trigger (crate open…) release the mouse so you can click on the phone.
  const [free, setFreeS] = useState(''), freeRef = useRef('')
  const setFree = (why, by = 'key') => {
    freeRef.current = why ? { why, by } : ''; setFreeS(why); mapper.current.reset()
    if (why) { if (locked()) document.exitPointerLock() }
    else try { canvas.current?.requestPointerLock()?.catch?.(() => {}) } catch {}
  }
  mapper.current.onCursor = it => freeRef.current ? setFree('') : setFree(it.label || 'Menu')
  useEffect(() => { if (!game && freeRef.current) { freeRef.current = ''; setFreeS('') } }, [game])
  useEffect(() => { const h = () => { if (!locked()) mapper.current.reset() }; document.addEventListener('pointerlockchange', h); return () => document.removeEventListener('pointerlockchange', h) }, [])
  useEffect(() => { // screen triggers: two matching reads in a row free the mouse, two misses take it back
    const trs = (km.triggers || []).filter(t => t.on !== false && t.points?.length)
    if (!game || !trs.length) return
    let hit = 0, miss = 0
    const t = setInterval(() => {
      const f = eng.current?.frame; if (!f) return
      const m = trs.find(tr => matchTrigger(f, tr))
      if (m) { miss = 0; if (++hit === 2 && !freeRef.current) setFree(m.label || 'Screen', 'auto') }
      else { hit = 0; if (++miss === 2 && freeRef.current?.by === 'auto') setFree('') }
    }, 150)
    return () => clearInterval(t)
  }, [game, km.triggers])
  // Mouse buttons are read from e.buttons on every event: a release while another button is held arrives as a move, not an "up"
  const BTN = [[1, 'MouseLeft'], [2, 'MouseRight'], [4, 'MouseMiddle']]
  const buttons = b => { for (const [bit, code] of BTN) mapper.current.key(code, !!(b & bit)) }
  const gamePtr = {
    onContextMenu: e => e.preventDefault(),
    onPointerDown: e => {
      e.preventDefault(); canvas.current.focus()
      if (freeRef.current) { if (e.button) return; const p = pos(e); if (!p) return; e.currentTarget.setPointerCapture(e.pointerId); api.send('ctl', { t: 'touch', a: 0, ...p }); down.current = true; return }
      if (!locked()) return canvas.current.requestPointerLock()
      buttons(e.buttons)
    },
    onPointerUp: e => { if (freeRef.current) { if (down.current) { const p = pos(e); p && api.send('ctl', { t: 'touch', a: 1, ...p }); down.current = false } return } locked() && buttons(e.buttons) },
    onPointerMove: e => { if (freeRef.current) { if (down.current) { const p = pos(e); p && api.send('ctl', { t: 'touch', a: 2, ...p }) } return } if (locked()) { buttons(e.buttons); mapper.current.look(e.movementX, e.movementY) } },
    onWheel: e => { if (freeRef.current) { const p = pos(e); if (p) api.send('ctl', { t: 'scroll', ...p, dx: -e.deltaX / 40, dy: -e.deltaY / 40 }) } else if (locked()) mapper.current.pulse(e.deltaY < 0 ? 'WheelUp' : 'WheelDown') },
    onKeyDown: e => {
      if (e.code === (km.cursorKey || 'Backquote')) { e.preventDefault(); return freeRef.current ? setFree('') : locked() ? setFree('Cursor') : canvas.current.requestPointerLock() }
      if (e.code === 'Escape' || e.metaKey) return
      e.preventDefault(); if (!e.repeat) mapper.current.key(e.code, true, combo(e))
    },
    onKeyUp: e => { e.preventDefault(); mapper.current.key(e.code, false) },
    onBlur: () => mapper.current.reset()
  }
  const cpt = e => { const c = canvas.current, b = c.getBoundingClientRect(); return [((e.clientX - b.left) * c.width) / b.width, ((e.clientY - b.top) * c.height) / b.height] }
  const pos = e => canCtl ? eng.current.toPhone(...cpt(e), down.current) : null
  const upL = (id, p) => setS(o => ({ ...o, ...patchLayer(o, id, p) }))
  const layerOf = id => (s.scenes.find(x => x.id === s.sceneId) || s.scenes[0]).layers.find(l => l.id === id)
  const touch = (a, e) => { const p = pos(e); if (p) api.send('ctl', { t: 'touch', a, ...p }) }
  const key = code => api.send('ctl', { t: 'key', code })
  const pkey = k => cap === 'on' && k !== 'notifications' ? key(k) : api.invoke('phone:key', serial, k).catch(fail) // phone button, with or without capture
  const sceneStep = d => { const f = s.frames?.find(x => x.id === s.frameId), list = f ? f.scenes : s.scenes.map(x => x.id), i = list.indexOf(s.sceneId); if (list.length > 1) set({ sceneId: list[(i + d + list.length) % list.length] }) }
  const shortcuts = [
    [['Home', House, () => pkey(3), false, !ready], ['Back', Undo2, () => pkey(4), false, !ready], ['Recents · open apps', LayoutGrid, () => pkey(187), false, !ready], ['Alerts · notifications', BellDot, () => pkey('notifications'), false, !ready],
     ['Vol −', Volume1, () => pkey(25), false, !ready], ['Vol +', Volume2, () => pkey(24), false, !ready], ['Lock · screen on/off', Power, () => pkey(26), false, !ready], ['Shot · phone screenshot', Camera, () => qa.shot(), false, !ready]],
    [['Prev · previous scene', ChevronLeft, () => sceneStep(-1)], ['Next · next scene', ChevronRight, () => sceneStep(1)], [s.cover ? 'Show · show phone' : 'Hide · hide phone', s.cover ? Eye : EyeOff, () => set({ cover: !s.cover }), s.cover],
     [s.micMute ? 'Unmute · mic' : 'Mute · mic', s.micMute ? MicOff : Mic, () => set({ micMute: !s.micMute }), s.micMute], [rec ? 'Stop · recording' : 'Record', Circle, () => record(), !!rec]]
  ]
  const ptr = game ? gamePtr : s.control ? {
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
      if (d.mode === 'move') { // snap edges/centres to the canvas and to other sources
        let x = d.l.x + (px - d.px) / c.width, y = d.l.y + (py - d.py) / c.height
        const others = layersNow().filter(l => l.id !== d.id && l.visible), gx = [0, 0.5, 1, ...others.flatMap(l => [l.x - l.w / 2, l.x, l.x + l.w / 2])], gy = [0, 0.5, 1, ...others.flatMap(l => [l.y - l.h / 2, l.y, l.y + l.h / 2])]
        const fit = (v, half, gs) => { for (const o of [-half, 0, half]) for (const g of gs) if (Math.abs(v + o - g) < 0.01) return [g - o, g]; return [v, null] }
        const [sx, lx] = fit(x, d.l.w / 2, gx), [sy, ly] = fit(y, d.l.h / 2, gy)
        setGuides([lx, ly]); upL(d.id, { x: sx, y: sy })
      }
      else { const k = Math.max(0.05, Math.hypot(...E.local(E.geo[d.id], px, py)) / d.d0); upL(d.id, { w: d.l.w * k, h: d.l.h * k }) }
    },
    onPointerUp: () => { drag.current = null; setGuides([null, null]) },
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

  const shown = (apps || []).filter(a => (s.system || !a.system) && (!games || meta[a.pkg]?.cat?.startsWith('GAME')) && (a.name + a.pkg).toLowerCase().includes(q.toLowerCase()))
  const picked = apps?.find(a => a.pkg === s.pkg)
  const front = apps?.find(a => a.pkg === focus)
  const frontIsApp = !!focus && focus.includes('.') && !/launcher|systemui/i.test(focus)
  const pick = pkg => { // on-phone mode keeps the same capture running; isolated mode needs a new virtual display
    if (cap === 'on' && s.appMode === 'guard') { set({ pkg }); api.send('ctl', { t: 'app', pkg }) } else source({ pkg })
  }
  const busy = !!live || !!rec
  const covered = guarding && focus && focus !== s.pkg

  const lay = s.layout?.flat().length === 5 ? s.layout : DEF.layout
  const swap = (a, b) => a && a !== b && lay.flat().includes(a) && set({ layout: lay.map(c => c.map(x => x === a ? b : x === b ? a : x)) })
  const place = id => { // grid cell for a panel: tall panels stretch, short ones hug the top or bottom
    const c = lay.findIndex(x => x.includes(id)), col = lay[c], i = col.indexOf(id), t = TALL.includes(id), o = col.length > 1 && TALL.includes(col[1 - i])
    const row = col.length === 1 ? '1 / 5' : i === 0 ? (t ? (o ? '1 / 3' : '1 / 4') : '1 / 2') : (t ? (o ? '3 / 5' : '2 / 5') : '4 / 5')
    return { gridColumn: c + 1, gridRow: row }
  }
  useEffect(() => { document.documentElement.dataset.accent = s.accent || 'lime' }, [s.accent])
  const curLayers = (s.scenes.find(x => x.id === s.sceneId) || s.scenes[0])?.layers || []
  useEffect(() => { if (!curLayers.some(l => l.id === sel)) setSel(curLayers.filter(l => !l.bgOnly).at(-1)?.id || '') }, [s.sceneId, curLayers.length, sel])
  // Game controls for any app: a key map bound to the app (by package), applied right away
  const ctlApp = apps?.find(a => a.pkg === (s.mode === 'app' && s.pkg ? s.pkg : focus))
  const mapFor = pkg => pkg && s.appKeymaps?.[pkg] in s.keymaps ? s.appKeymaps[pkg] : Object.keys(s.keymaps).find(k => s.keymaps[k].pkg === pkg) || ''
  // everything the Props panel needs to show a source's own settings (same fields as the source window)
  const srcProps = { onCapture: p => source(p), sx: s, setx: set, micList: media.mics, cams: media.cams, maps: s.keymaps, app: ctlApp, front: frontIsApp ? apps?.find(a => a.pkg === focus) : null, scenes: s.scenes, cap, ready,
    onRestart: () => restartCap(), onRefresh: () => refreshPhone(), onUseApp: pkg => source({ mode: 'app', pkg }), mapFor: pkg => mapFor(pkg), bindMap: (pkg, k) => bindMap(pkg, k) }
  const bindMap = (pkg, k) => {
    if (!pkg && !k) return
    setS(o => ({ ...o, appKeymaps: pkg ? { ...o.appKeymaps, [pkg]: k || undefined } : o.appKeymaps, ...(k ? { keymapId: k, keymapOn: true, control: true } : pkg && mapFor(pkg) ? { keymapOn: false } : {}) }))
  }
  // iPhone / iPad feed: runs while any scene has an iPhone source (the current scene's wins)
  const iosRun = useRef('')
  const iosOf = sc => sc?.layers.find(l => l.type === 'ios' && l.src)?.src
  const iosSrc = iosOf(s.scenes.find(x => x.id === s.sceneId)) || s.scenes.map(iosOf).find(Boolean) || ''
  useEffect(() => {
    if (!saved || iosSrc === iosRun.current) return
    iosRun.current = iosSrc; eng.current.ios.clear()
    if (!iosSrc) api.invoke('ios:stop').catch(() => {})
    else api.invoke('ios:start', iosSrc).then(() => setNote({ text: iosSrc === 'airplay' ? 'AirPlay ready: on the iPhone open Control Center → Screen Mirroring → Meroro' : 'Connecting to the iPhone over USB…' })).catch(e => { iosRun.current = ''; fail(e) })
  }, [iosSrc, !saved])
  const [guides, setGuides] = useState([null, null]), [fxEdit, setFxEdit] = useState(null)
  useEffect(() => { if (view !== 'fx') setFxEdit(null) }, [view])
  // reminder alerts ("Subscribe!") every N minutes while live
  const timerAt = useRef({})
  useEffect(() => { if (!live) return; const t = setInterval(() => { for (const r of sRef.current.autos || []) { if (!r.enabled || r.on !== 'timer') continue; const gap = (+r.arg || 10) * 60000, last = timerAt.current[r.id] ??= Date.now(); if (Date.now() - last >= gap) { timerAt.current[r.id] = Date.now(); act(r) } } }, 15000); return () => clearInterval(t) }, [!!live])
  const layersNow = () => (sRef.current.scenes.find(x => x.id === sRef.current.sceneId) || sRef.current.scenes[0]).layers
  // LUT files used by sources load once
  useEffect(() => { for (const sc of s.scenes) for (const l of sc.layers) if (l.fx?.lut && !window.__luts?.[l.fx.lut]) { (window.__luts ??= {})[l.fx.lut] = 1; api.invoke('file:read', l.fx.lut).then(b => setLut(l.fx.lut, parseCube(new TextDecoder().decode(b)))).catch(() => {}) } }, [s.scenes])
  // push-to-talk / push-to-mute (while Meroro is focused)
  useEffect(() => {
    const p = { mode: 'off', key: 'KeyV', ...s.ptt }, E = eng.current
    E.setGate(p.mode !== 'ptt')
    if (p.mode === 'off') return
    const h = down => e => { if (e.code !== p.key || e.repeat || /INPUT|TEXTAREA/.test(e.target.tagName)) return; E.setGate(p.mode === 'ptt' ? down : !down) }
    const d = h(true), u = h(false); addEventListener('keydown', d); addEventListener('keyup', u)
    return () => { removeEventListener('keydown', d); removeEventListener('keyup', u) }
  }, [s.ptt?.mode, s.ptt?.key])
  // soundboard keys work everywhere
  const hk = [...(s.pads || []).map(p => ({ id: p.id, key: p.key })), ...Object.entries(s.sceneKeys || {}).filter(([, k]) => k).map(([id, key]) => ({ id: 'scene:' + id, key }))]
  useEffect(() => { api.invoke('hotkeys:set', hk) }, [JSON.stringify(hk)])
  useEffect(() => { api.send('pointer:on', !!s.ptr?.on) }, [!!s.ptr?.on])
  useEffect(() => { // talking → talk scene, quiet for N seconds → quiet scene
    const t = s.talkSw
    if (!t?.on || !t.talk) return
    let quietSince = performance.now()
    const id = setInterval(() => {
      const e = eng.current, cur = sRef.current.sceneId
      if (!e) return
      if (e.talking()) { quietSince = performance.now(); if (cur !== t.talk) set({ sceneId: t.talk }) }
      else if (t.quiet && cur === t.talk && performance.now() - quietSince > t.after * 1000) set({ sceneId: t.quiet })
    }, 120)
    return () => clearInterval(id)
  }, [JSON.stringify(s.talkSw)])
  useEffect(() => api.on('hotkey', id => {
    if (id.startsWith('scene:')) { // scene hotkeys from Settings
      const k = id.slice(6), sc = sRef.current.scenes, i = sc.findIndex(x => x.id === sRef.current.sceneId)
      const to = k === 'next' ? sc[(i + 1) % sc.length] : k === 'prev' ? sc[(i - 1 + sc.length) % sc.length] : sc.find(x => x.id === k)
      if (to) set({ sceneId: to.id })
      return
    } const p = sRef.current.pads?.find(x => x.id === id); if (p) eng.current.playSound(p.file).catch(() => {}) }), [])
  // controllers: buttons → key map, left stick → move, right stick → aim
  useEffect(() => {
    if (!game) return
    let raf, prev = {}
    const tick = () => {
      for (const g of navigator.getGamepads?.() || []) {
        if (!g) continue
        g.buttons.forEach((b, i) => { const c = 'Pad' + (PAD[i] || i); if (!!prev[c] !== b.pressed) { prev[c] = b.pressed; mapper.current.key(c, b.pressed) } })
        const [lx, ly, rx, ry] = g.axes
        mapper.current.pad = [lx, ly]; mapper.current.stick()
        if (Math.hypot(rx, ry) > 0.15) mapper.current.look(rx * 14, ry * 14)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); mapper.current.pad = null }
  }, [game])
  // stream title: copy a fresh title when the game in front changes while live
  const lastGame = useRef('')
  useEffect(() => { const a = apps?.find(x => x.pkg === focus); if (!s.autoTitle || !live || !a || a.pkg === lastGame.current || !frontIsApp) return; lastGame.current = a.pkg; navigator.clipboard.writeText(titleFor(s, a.name)).then(() => setNote({ text: `New title copied for ${a.name} — paste it in YouTube Studio` })).catch(() => {}) }, [focus, live])
  // updates
  const [upd, setUpd] = useState(null)
  useEffect(() => { if (saved && s.autoUpdate !== false) api.invoke('update:check').then(setUpd).catch(() => {}) }, [!saved])
  const go = r => { if (r.view === 'edit') return api.send('editor:open'); setView(r.view || 'studio'); if (r.rtab) setRtab(r.rtab); if (r.add) { const l = newLayer(r.add); if (r.add === 'ios') setAdding('src'); else setSrcDlg({ layer: l, isNew: true }) } }
  const DOCK = [['studio', 'Studio', SlidersVertical], ['new', 'What’s new', Bell], ['fx', 'Overlays', Wand2], ['keys', 'Keys', Gamepad2], ['edit', 'Editor', Film], ['device', 'Device', Smartphone], ['settings', 'Settings', Settings2]]
  const addLayer = n => setS(o => { if (n.type === 'caption') o = { ...o, capOn: true } // from the Add source window; "bg" adds a hidden source used only as the blurred backdrop
    const bg = adding === 'bg', l = bg ? { ...n, bgOnly: true } : n
    return { ...o, scenes: o.scenes.map(sc => sc.id !== o.sceneId ? sc : { ...sc, layers: bg ? [l, ...sc.layers] : [...sc.layers, l], ...(bg ? { bgBlur: true, bgSrc: l.id } : {}) }) }
  })

  return (
    <div className="backdrop h-full flex flex-col text-zinc-200">
      {/* title bar */}
      <header className={cx('drag h-11 shrink-0 flex items-center gap-3', mac ? 'pl-[88px] pr-3' : 'pl-3 pr-[150px]')}>
        <button onClick={() => setAbout(true)} className="no-drag flex items-center gap-2 rounded-md pr-1.5 hover:bg-white/5" title="About Meroro">
          <Logo size={22} /><span className="text-[15px] font-extrabold tracking-tight text-white">Meroro</span><span className="text-[11px] text-zinc-500">by Kartik Sabale</span>
        </button>
        <div className="flex-1" />
        {view === 'studio' && <HeaderBar q={{ ...qa, annot, setAnnot, overlayOn }} eng={eng} toggleKeys={() => s.keymapOn ? set({ keymapOn: false }) : bindMap(ctlApp?.pkg, km === s.keymaps[s.keymapId] ? s.keymapId : Object.keys(s.keymaps)[0])} />}
        {upd && <button className="no-drag h-7 px-3 rounded-full bg-orange-500 text-black text-[12px] font-semibold" onClick={() => setView('new')}>Update {upd.version} available</button>}
        {view === 'studio' && JSON.stringify(lay) !== JSON.stringify(DEF.layout) && <Button variant="ghost" className="no-drag px-2" title="Reset layout" onClick={() => set({ layout: DEF.layout })}><LayoutDashboard size={13} /></Button>}
        {note && (
          <div className={cx('no-drag pop min-w-0 max-w-[46%] flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] pl-2.5 pr-1 h-7 text-[12px]', note.bad ? 'text-red-400' : 'text-zinc-300')}>
            <Info size={13} className="shrink-0" /><span className="truncate">{note.text}</span>
            {note.file && <Button variant="ghost" className="h-5" onClick={() => api.send('reveal', note.file)}><FolderOpen size={12} />Show</Button>}
            <button onClick={() => setNote(null)} className="p-1 text-zinc-500 hover:text-zinc-200"><X size={12} /></button>
          </div>
        )}
        {live === 'on' && stats && (
          <div className="flex items-center gap-3 text-[11px] tabular-nums text-zinc-400">
            <span>{Math.round(stats.kbps)} kbps</span><span>{stats.fps} fps</span>
            <span className={stats.speed < 0.95 ? 'text-amber-400' : 'text-emerald-400'}>{stats.speed < 0.95 ? 'Encoder lagging' : 'Healthy'}</span>
          </div>
        )}
      </header>

      <div className="relative flex-1 min-h-0 flex gap-2 px-2 pb-2">
        {/* rail */}
        <nav className="w-[52px] shrink-0 flex flex-col items-center gap-1.5 py-2">
          {DOCK.map(([v, t, I]) => (
            <button key={v} onClick={() => v === 'edit' ? api.send('editor:open') : setView(v)} title={t}
              className={cx('relative size-10 rounded-full grid place-items-center transition-all duration-200', view === v ? 'bg-white/[0.1] text-violet-300' : 'text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.06]')}><I size={18} strokeWidth={1.75} />
              {v === 'new' && (s.seenNew !== LATEST || upd) && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-orange-500" />}</button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setPerm(true)} title="Permissions" className="size-10 rounded-full grid place-items-center text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.08]"><ShieldCheck size={17} /></button>
          <button onClick={() => setAbout(true)} title="About" className="size-10 rounded-full grid place-items-center hover:bg-white/[0.08]"><Logo size={22} /></button>
        </nav>

        {view !== 'studio' && <Card key={view} className="pop flex-1 min-w-0 flex">
          {view === 'new' && <WhatsNew go={go} s={s} set={set} />}
          {view === 'fx' && <Overlays canvas={s.canvas} editing={fxEdit}
            tab0={fxTab} capStyle={s.scenes.find(x => x.id === s.sceneId)?.layers.find(l => l.type === 'caption')?.preset}
            onCaption={st => setS(o => { // apply to the scene's caption box, or add one
              const { name, ...look } = st, cur = o.scenes.find(x => x.id === o.sceneId), has = cur?.layers.some(l => l.type === 'caption')
              return { ...o, capOn: true, scenes: o.scenes.map(sc => sc.id !== o.sceneId ? sc : { ...sc, layers: has ? sc.layers.map(l => l.type === 'caption' ? { ...l, ...look, preset: name } : l) : [...sc.layers, { ...newLayer('caption'), ...look, preset: name }] }) }
            })}
            onBanner={l => { const add = withSound(l, 'swoosh'); setS(o => ({ ...o, scenes: o.scenes.map(sc => sc.id !== o.sceneId ? sc : { ...sc, layers: [...sc.layers, ...add] }) })); setSel(l.id) }}
            onScene={sc => { eng.current.playSfx('whoosh').catch(() => {}); setS(o => ({ ...o, scenes: [...o.scenes, sc], sceneId: sc.id })); setSel(''); setView('studio') }}
            onAlert={r => { const sfx = SFX_FOR[r.afx?.style] || 'ding'; eng.current.playSfx(sfx).catch(() => {}); setS(o => ({ ...o, autos: [...(o.autos || []), { id: Math.random().toString(36).slice(2, 9), enabled: true, sound: '', scene: '', ...r }],
              scenes: o.scenes.map(sc => { if (sc.id !== o.sceneId) return sc; const box = sc.layers.find(l => l.type === 'alert'), b = box || newLayer('alert')
                return { ...sc, layers: [...(box ? sc.layers : [...sc.layers, b]), ...(sc.layers.some(l => l.type === 'sound' && l.parent === b.id) ? [] : [{ ...newLayer('sound'), name: SFX.find(x => x[0] === sfx)?.[1] + ' sound', sfx, parent: b.id }])] } }) })) }}
            onSave={(id, p) => { setS(o => ({ ...o, scenes: o.scenes.map(sc => ({ ...sc, layers: sc.layers.map(l => l.id === id ? { ...l, ...p } : l) })) })); setFxEdit(null); setView('studio') }} />}
          {view === 'keys' && <Keys s={s} set={set} eng={eng} focus={focus} apps={apps} />}
          {view === 'edit' && <Editor start={editStart} onNote={setNote} />}
          {view === 'settings' && <Settings s={s} set={set} onNote={setNote} />}
          {view === 'device' && <Device devices={devices} serial={serial} setSerial={setSerial} ready={ready} focus={focus} apps={apps} meta={meta} onNote={setNote} />}
        </Card>}
        <div className={cx('flex-1 min-w-0 grid gap-1.5', view !== 'studio' && 'hidden')} style={{ gridTemplateColumns: lay.map(c => c.includes('preview') ? 'minmax(0,1fr)' : c.includes('scene') ? '322px' : '264px').join(' '), gridTemplateRows: 'auto minmax(0,1fr) minmax(0,1fr) auto' }}>
        {/* left card: app library + phone */}
        <Slot key="apps" id="apps" pos={place('apps')} swap={swap}><Card className="relative flex-1 min-h-0 flex flex-col">
          {mgr && <Manager s={s} set={set} sel={sel} setSel={setSel} editScene={id => setSceneDlg(id)} editSource={l => setSrcDlg({ layer: l })} onClose={() => setMgr(false)} />}
          {!mgr && side === 'scene' && <button title="View all frames, scenes and sources" onClick={() => setMgr(true)} className="absolute right-3 bottom-3 z-20 h-9 flex items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-semibold text-black shadow-xl transition-transform hover:-translate-y-0.5"><Layers size={13} />View all</button>}
          <div className="p-2.5 pb-1.5"><Segmented value={side} onChange={setSide} options={[['scene', 'Scene', Layers], ['apps', 'Apps', AppWindow], ['phone', 'Phone', Smartphone]]} /></div>
          {side === 'scene' ? <div className="flex-1 min-h-0 -mt-1.5"><Panel part={side} s={s} set={set} live={live} busy={busy} media={media} sel={sel} setSel={setSel} focus={focus} apps={apps} goPresets={() => setPicker(true)} addSource={k => setAdding(k || 'src')} editScene={setSceneDlg} editSource={l => setSrcDlg({ layer: l })} onSideBySide={() => setSbs(true)} goGame={g => setPicker({ game: g })} onPresetFor={(f, ori) => { set({ frameId: f.id, canvas: f.size, sceneId: f.sceneId }); setPicker({ ori }) }} onViewAll={() => setMgr(true)} /></div>
          : side === 'apps' ? <>
            <div className="px-2.5 pb-2 flex gap-1.5">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-[9px] text-zinc-500" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Find app" className="h-8 pl-8 rounded-xl" />
              </div>
              <Button className={cx('h-8 px-2.5', games && 'bg-white text-black hover:bg-white')} title="Games only" onClick={() => setGames(!games)}><Gamepad2 size={14} /></Button>
            </div>
            <div className="px-3.5 pb-1 flex items-center text-[11px] text-zinc-500"><span className="flex-1">{ready ? `Installed · ${shown.length}` : 'No phone'}</span>
              <button onClick={loadApps} disabled={!ready} title="Reload apps" className="hover:text-zinc-200"><RefreshCw size={11} /></button></div>
            <div className="flex-1 overflow-y-auto px-1.5 pb-2">
              {!ready && <div className="p-4 text-center text-[12px] leading-relaxed text-zinc-500">Connect a phone to see its apps. Open the <button className="text-zinc-200 underline" onClick={() => setSide('phone')}>Phone</button> tab.</div>}
              {ready && apps === null && <div className="p-6 text-center text-[12px] text-zinc-500">Reading apps from your phone…</div>}
              {appsErr && <div className="p-4 text-center text-[12px] text-red-400">Couldn't read apps: {appsErr}<div className="mt-2"><Button onClick={loadApps}>Retry</Button></div></div>}
              {shown.map(a => { const on = a.pkg === s.pkg && s.mode === 'app', c = meta[a.pkg]?.cat; return (
                <button key={a.pkg} onClick={() => pickApp(a.pkg)} title="Open on the phone and stream this app"
                  className={cx('w-full flex items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors', on ? 'bg-black' : 'hover:bg-white/[0.06]')}>
                  <AppIcon app={a} meta={meta} size={38} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-zinc-100">{a.name}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{c ? c.replace(/_/g, ' ').toLowerCase().replace(/^./, x => x.toUpperCase()) : a.pkg}</span></span>
                  {on ? <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-zinc-200">STREAM</span> : a.pkg === focus && <span className="size-2 rounded-full bg-emerald-400 live-dot" title="Open on phone" />}
                </button>) })}
            </div>
            <div className="px-3.5 py-2 border-t border-white/[0.06] flex items-center text-[11px] text-zinc-500"><span className="flex-1">System apps</span><Switch checked={s.system} onChange={system => set({ system })} /></div>
          </> : <div className="flex-1 overflow-y-auto">
            <Section icon={Smartphone} title="Devices">
              {devices.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 p-3 text-[12px] text-zinc-500 leading-relaxed">
                  No phone detected. Plug in an Android phone with <b className="text-zinc-300">USB debugging</b> on — it appears here automatically.
                </div>
              )}
              {devices.map(d => (
                <button key={d.serial} onClick={() => setSerial(d.serial)} disabled={cap !== 'idle'}
                  className={cx('w-full flex items-center gap-2.5 rounded-xl p-2 text-left border transition-colors', d.serial === serial ? 'bg-white/[0.08] border-white/20' : 'border-transparent hover:bg-white/5')}>
                  <div className="size-8 rounded-lg bg-white/[0.06] grid place-items-center shrink-0">{d.wifi ? <Wifi size={15} /> : <Usb size={15} />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{d.model}</div>
                    <div className={cx('text-[11px] truncate', d.state === 'device' ? 'text-emerald-400' : 'text-amber-400')}>
                      {d.state === 'device' ? 'Ready' : d.state === 'unauthorized' ? 'Tap “Allow” on the phone' : d.state}
                    </div>
                  </div>
                </button>
              ))}
              <Wireless compact serial={serial} usbReady={ready && !dev?.wifi} />
            </Section>
            <Section icon={AppWindow} title="Capture">
              <Segmented value={s.mode} onChange={mode => source({ mode })} options={[['phone', 'Whole phone', Smartphone], ['app', 'One app', AppWindow]]} />
              {s.mode === 'app' && <>
                <Segmented value={s.appMode} onChange={appMode => source({ appMode })} options={[['guard', 'On phone', Smartphone], ['virtual', 'Isolated', Layers]]} />
                <button onClick={() => setSide('apps')} className="w-full flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.06] px-2 h-10 text-left hover:bg-white/[0.09]">
                  {picked ? <AppIcon app={picked} meta={meta} size={24} /> : <AppWindow size={15} className="text-zinc-500 mx-1" />}
                  <span className="flex-1 truncate text-[12px]">{picked?.name || 'Pick an app…'}</span><span className="text-[11px] text-zinc-500">Change</span>
                </button>
                {s.appMode === 'virtual' && (
                  <Row label="Display"><Select className="flex-1" value={s.vdisplay} onChange={vdisplay => source({ vdisplay })}
                    options={[['', 'Same as phone'], ['1920x1080/280', 'Landscape 1080p'], ['1080x1920/420', 'Portrait 1080p']]} /></Row>
                )}
              </>}
              <Row label="Quality"><Select className="flex-1" value={s.maxSize} onChange={maxSize => source({ maxSize })} options={[[0, 'Native (sharpest)'], [2560, '1440p / 2K'], [1920, '1080p'], [1600, '900p'], [1280, '720p']]} /></Row>
              <Row label="Frame rate"><Select className="flex-1" value={s.capFps} onChange={capFps => source({ capFps })} options={[[120, '120 fps'], [90, '90 fps'], [60, '60 fps'], [30, '30 fps']]} /></Row>
              <Row label="Bitrate"><Select className="flex-1" value={s.capBitrate} onChange={capBitrate => source({ capBitrate: +capBitrate })} options={[[4, '4 Mbps'], [8, '8 Mbps'], [12, '12 Mbps'], [16, '16 Mbps'], [24, '24 Mbps'], [32, '32 Mbps'], [40, '40 Mbps']]} /></Row>
              <Row label="Phone audio"><Switch checked={s.phoneAudio} onChange={phoneAudio => source({ phoneAudio })} /></Row>
              {s.phoneAudio && <Row label="Sound plays"><Select className="flex-1" value={s.audioDup ? 'both' : 'pc'} onChange={v => source({ audioDup: v === 'both' })}
                options={[['both', 'On phone + stream'], ['pc', 'Stream only (phone silent)']]} /></Row>}
              {cap === 'idle'
                ? <Button variant="primary" className="w-full h-8" disabled={!ready} onClick={() => start()}>Start capture</Button>
                : <Button className="w-full h-8" onClick={() => api.invoke('session:stop')}>{cap === 'starting' ? 'Connecting…' : 'Stop capture'}</Button>}
            </Section>
          </div>}
        </Card></Slot>

        {/* center: preview card + dock card */}
        <Slot key="preview" id="preview" pos={place('preview')} swap={swap}>
            <div className="relative flex-1 min-h-0 flex flex-col gap-2">
            <div className="relative flex-1 min-h-0">
              <canvas ref={canvas} tabIndex={0} {...ptr}
                className={cx('absolute inset-0 m-auto max-w-full max-h-full rounded-2xl ring-1 ring-white/10 shadow-2xl outline-none', canCtl ? 'cursor-pointer' : !s.control && 'cursor-move')} />
              {annot && <Annotate eng={eng} canvas={canvas} onClose={() => setAnnot(false)} />}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
                <span className="h-7 px-2.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/15 text-[11px] font-semibold grid place-items-center">{s.canvas.replace('x', '×')}</span>
                <span className="h-7 px-2.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-[11px] tabular-nums text-amber-300 grid place-items-center">{s.fps} FPS</span>
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button onClick={record} title={rec ? 'Stop recording' : 'Record'} className="h-8 px-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2 text-[11px] font-semibold tabular-nums hover:bg-black/80 transition-colors">
                  <Circle size={9} className={cx('fill-red-500 text-red-500', rec && 'live-dot')} />{rec || 'REC'}</button>
                <span className={cx('h-8 px-3 rounded-xl border flex items-center gap-2 text-[11px] font-semibold tabular-nums backdrop-blur-md', live === 'on' ? 'bg-red-500 border-red-400 text-white' : 'bg-black/60 border-white/10 text-zinc-400')}>
                  {live === 'on' ? <><span className="size-1.5 rounded-full bg-white live-dot" />LIVE {stats?.time.slice(0, 8)}</> : live === 'retry' ? 'RECONNECTING…' : live ? 'CONNECTING…' : 'OFFLINE'}</span>
              </div>
              {game && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 h-7 px-3 rounded-full bg-white text-black text-[12px] font-semibold flex items-center gap-1.5 pointer-events-none whitespace-nowrap"><Gamepad2 size={13} />{free ? `Mouse free · ${free} · click to tap the phone · ${km.cursorKey === 'Backquote' || !km.cursorKey ? '`' : km.cursorKey} to aim again` : `${km.name} controls on · click the preview · \` frees the cursor`}</div>}
              {game && km.hints !== false && <KeyHints eng={eng} canvas={canvas} map={km} />}
              {!s.control && sel && <SelBox eng={eng} canvas={canvas} id={sel} />}
              {guides.map((g, i) => g != null && <div key={i} className="absolute pointer-events-none bg-orange-400/80" style={(() => { const c = canvas.current; if (!c) return {}; const k = c.clientWidth / c.width; return i ? { left: c.offsetLeft, width: c.clientWidth, top: c.offsetTop + g * c.height * k, height: 1 } : { top: c.offsetTop, height: c.clientHeight, left: c.offsetLeft + g * c.width * k, width: 1 } })()} />)}
              {cap === 'starting' && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 h-7 px-3 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[12px] text-zinc-300 flex items-center gap-1.5 pointer-events-none whitespace-nowrap"><RefreshCw size={12} className="animate-spin" />Connecting to {dev?.model}…</div>}
              {covered && <div className="absolute top-12 left-1/2 -translate-x-1/2 h-7 px-3 rounded-full bg-amber-500 text-black text-[12px] font-semibold flex items-center gap-1.5 whitespace-nowrap"><ShieldCheck size={13} />Stream covered — {picked?.name || 'the app'} is not in front</div>}
            </div>
            <Perf serial={serial} ready={ready} eng={eng} actions={shortcuts} />
            <div className="h-10 shrink-0 flex items-center gap-1 px-3 rounded-2xl border border-white/[0.06] bg-[#1b1b1d]">
              <Button variant="ghost" className="px-2" disabled={!canCtl} onClick={() => key(4)} title="Back"><ChevronLeft size={15} /></Button>
              <Button variant="ghost" className="px-2" disabled={!canCtl} onClick={() => key(3)} title="Home"><Circle size={12} /></Button>
              <Button variant="ghost" className="px-2" disabled={!canCtl} onClick={() => key(187)} title="Recents"><Square size={12} /></Button>
              <span className="mx-2 h-4 w-px bg-white/10" />
              <MousePointerClick size={13} className="text-zinc-500" />
              <span className="text-[12px] text-zinc-400 mr-1">{s.control ? 'Control phone' : 'Arrange sources'}</span>
              <Switch checked={s.control} onChange={control => set({ control })} />
              <div className="flex-1" />
              <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] pl-0.5">
                <Button variant="ghost" title={s.keymapOn ? 'Turn game controls off' : 'Turn game controls on'} className={cx('px-2', s.keymapOn && 'text-white bg-white/10')} onClick={() => s.keymapOn ? set({ keymapOn: false }) : bindMap(ctlApp?.pkg, km === s.keymaps[s.keymapId] ? s.keymapId : Object.keys(s.keymaps)[0])}><Gamepad2 size={14} />{s.keymapOn ? 'On' : 'Keys'}</Button>
                <Select className="w-[124px]" value={s.keymapId} onChange={k => bindMap(ctlApp?.pkg, k)} options={Object.entries(s.keymaps).map(([k, m]) => [k, m.name])} />
                <Button variant="ghost" className="px-1.5" title="Edit key map" onClick={() => setView('keys')}><SlidersVertical size={13} /></Button>
              </div>
              <CleanScreen serial={serial} ready={ready} s={s} set={set} apps={apps} meta={meta} live={live} />
              <Button variant="ghost" title="YouTube chat window" className={cx('px-2', s.chatFloat && 'text-white bg-white/10')} onClick={() => set({ chatFloat: !s.chatFloat })}><MessageSquare size={14} />Chat</Button>
              <Quick compact q={qa} />
            </div>
          </div></Slot>

          <Slot key="mixer" id="mixer" pos={place('mixer')} swap={swap}><Card className="flex-1 flex">
            <Mixer s={s} set={set} eng={eng} mics={media.mics} onAddMic={addMicSource} onAddSource={k => setAdding(k === 'phone' ? 'src' : k)} onMusic={() => { setView('studio'); setRtab('sounds') }} onEffects={() => setAdding('sound')} />
          </Card></Slot>


        {/* right: scene panel + go live */}

          <Slot key="scene" id="scene" pos={place('scene')} swap={swap}><Card className="flex-1 min-h-0 flex flex-col">
            <div className="px-1.5 pt-1.5"><Segmented value={rtab} onChange={setRtab} options={[['props', 'Props', SlidersVertical], ['live', 'Stream', Radio], ['auto', 'Auto', Zap], ['sounds', 'Sound', Music]]} /></div>
            {rtab === 'auto' ? <div className="flex-1 min-h-0 overflow-y-auto p-1.5"><AutoPanel s={s} set={set} stopSound={() => eng.current.stopSound()} test={r => act(r, { author: 'Test viewer', amount: '₹100', text: 'Great stream!' })}
              appRules={<Panel mode="auto" s={s} set={set} focus={focus} apps={apps} media={media} sel="" setSel={() => {}} />} /></div>
            : rtab === 'sounds' ? <div className="flex-1 min-h-0 overflow-y-auto p-1.5"><Sounds s={s} set={set} eng={eng} addLayer={addLayer} openStyles={() => { setFxTab('caption'); setView('fx') }} /></div>
            : rtab === 'live' ? <div className="flex-1 min-h-0 overflow-y-auto"><StreamTabs s={s} set={set} live={live} busy={busy} xst={xst} />
              <div className="px-1.5 pb-1.5"><StreamPlus s={s} set={set} hist={hist} live={live} busy={busy} xst={xst} game={apps?.find(x => x.pkg === focus)?.name} /></div></div>
            : <Panel part={rtab} srcProps={srcProps} editFx={l => { setFxEdit(l); setView('fx') }} editSource={l => setSrcDlg({ layer: l })} s={s} set={set} live={live} busy={busy} media={media} sel={sel} setSel={setSel} focus={focus} apps={apps} />}
          </Card></Slot>
          <Slot key="live" id="live" pos={place('live')} swap={swap}><Card className="flex-1 p-2.5 flex flex-col justify-center gap-2">
            <GoLiveBar s={s} set={set} live={live} rec={rec} goLive={goLive} record={() => record()} />
            <div className="text-center text-[10px] text-zinc-500 truncate">{platform(s.dest).name}{(s.dests || []).filter(d => d.on && d.key).length ? ` + ${(s.dests || []).filter(d => d.on && d.key).length} more` : ''} · {s.canvas.replace('x', '×')} · {s.fps} fps · {s.bitrate} kbps</div>
          </Card></Slot>

        </div>

        {adding && <AddSource kind0={adding === 'mic' || adding === 'sound' ? adding : ''} mics={media.mics} onMic={addMicSource} only={adding === 'bg'} cams={media.cams} meta={meta} front={adding !== 'bg' && frontIsApp ? apps?.find(a => a.pkg === focus) : null}
          onAddApp={a => { // the open app becomes a phone source showing only that app
            const l = { ...newLayer('phone'), name: a.name, pkg: a.pkg, w: 1, h: 1 }, o2 = { ...s, mode: 'app', appMode: 'guard', pkg: a.pkg }
            setS(o => ({ ...o, mode: 'app', appMode: 'guard', pkg: a.pkg, scenes: o.scenes.map(sc => sc.id !== o.sceneId ? sc : { ...sc, layers: [...sc.layers, l] }) }))
            setSel(l.id)
            if (cap === 'on' && s.mode === 'app' && s.appMode === 'guard') api.send('ctl', { t: 'app', pkg: a.pkg }); else if (ready) start(o2)
          }} onClose={() => setAdding(null)} onPick={n => adding === 'bg' ? addLayer(n) : setSrcDlg({ layer: n, isNew: true })} />}
        {sbs && s.frames && <SideBySide s={s} set={set} eng={eng} live={live} xst={xst} onClose={() => setSbs(false)} />}
        {srcDlg && <SourceDialog onCapture={p => source(p)} sx={s} setx={set} micList={media.mics} front={frontIsApp ? apps?.find(a => a.pkg === focus) : null} onUseApp={pkg => source({ mode: 'app', pkg })} cap={cap} ready={ready} onRestart={restartCap} onRefresh={refreshPhone} layer={srcDlg.layer} isNew={srcDlg.isNew} cams={media.cams} eng={eng} onClose={() => setSrcDlg(null)} maps={s.keymaps} app={ctlApp} mapFor={mapFor}
          onSave={d => { if (d.type === 'phone') bindMap(d.pkg || ctlApp?.pkg, d.keymap); delete d.keymap; if (srcDlg.isNew) { addLayer(d); setSel(d.id); set({ control: false }) } else setS(o => ({ ...o, ...patchLayer(o, d.id, d) })) }}
          onDelete={id => setS(o => ({ ...o, scenes: o.scenes.map(sc => ({ ...sc, layers: sc.layers.filter(x => x.id !== id) })) }))} />}
        {sceneDlg && (() => { const cur = s.scenes.find(x => x.id === s.sceneId) || s.scenes[0], isNew = sceneDlg === 'new'
          const sc = isNew ? { id: Math.random().toString(36).slice(2, 9), name: 'Scene ' + (s.scenes.length + 1), bg: '#0b0b0f', bg2: '', bgBlur: false, layers: [] } : s.scenes.find(x => x.id === sceneDlg)
          return sc && <SceneDialog onPreset={() => setPicker(true)} onSize={canvas => set({ canvas })} count={s.scenes.length} busy={busy} scene={sc} isNew={isNew} current={cur} canvas={s.canvas} canDelete={s.scenes.length > 1} onClose={() => setSceneDlg(null)} pickBg={() => { set({ sceneId: sc.id }); setAdding('bg') }}
            onSave={d => setS(o => isNew ? { ...o, scenes: [...o.scenes, d], sceneId: d.id } : { ...o, scenes: o.scenes.map(x => x.id === d.id ? d : x) })}
            onDelete={id => setS(o => { const n = o.scenes.filter(x => x.id !== id); return { ...o, scenes: n, sceneId: o.sceneId === id ? n[0].id : o.sceneId } })} /> })()}
        {s.chatFloat && <FloatChat pos={s.chatPos} onMove={chatPos => set({ chatPos })} onClose={() => set({ chatFloat: false })}><ChatBox s={s} set={set} chat={chat} st={chatSt} go={chatGo} /></FloatChat>}
        {picker && <PresetPicker ori0={picker.ori} game={picker.game} onPick={applyPreset} onClose={() => setPicker(false)} />}
        {about && <About onClose={() => setAbout(false)} />}
        {perm && <Permissions devices={devices} onClose={() => { setPerm(false); eng.current.refreshMedia() }} addScreen={x => {
          const n = { ...newLayer('screen'), src: x.id, name: x.name }
          setS(o => ({ ...o, scenes: o.scenes.map(sc => sc.id !== o.sceneId ? sc : { ...sc, layers: [...sc.layers, n] }) }))
        }} />}
      </div>
    </div>
  )
}
