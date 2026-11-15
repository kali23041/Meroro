// "Add source" window: pick a kind of source, then (for screens, windows, cameras) pick exactly which one.
import { useEffect, useState } from 'react'
import { Mic, Volume2, Play, Captions, PanelBottom, Target, EyeOff, Layers, TabletSmartphone, Usb, Cast, Download, Loader2, Smartphone, Webcam, Monitor, AppWindow, Image as ImageIcon, Film, Globe, MessageSquare, BellRing, Type, Clock, Palette, X, ChevronLeft, RefreshCw, Camera, Aperture, Wifi } from 'lucide-react'
import { Button, Input, Tabs, cx } from './ui'
import { newLayer } from './scene'
import { AppIcon } from './Library'
import { SFX } from './sfx'
import Wireless from './Wireless'

const api = window.api
const KINDS = [
  ['phone', 'Android', 'Android phone · USB or Wi-Fi', Smartphone], ['ios', 'iPhone / iPad', 'USB (Mac) or AirPlay', TabletSmartphone],
  ['droidcam', 'Android camera', 'Phone as webcam · USB or Wi-Fi', Camera], ['icam', 'iPhone camera', 'Phone as webcam · wireless', Aperture], ['screen', 'Screen', 'A whole display', Monitor], ['window', 'Window', 'One app window', AppWindow],
  ['mic', 'Microphone', 'Voice input · voice changer', Mic], ['webcam', 'Webcam', 'Camera / facecam', Webcam], ['sound', 'Sound effect', 'Whoosh, coin, ding…', Volume2], ['image', 'Image', 'PNG, JPG, GIF', ImageIcon], ['video', 'Video file', 'MP4, MOV, WebM', Film],
  ['browser', 'Web page', 'Alerts, widgets', Globe], ['chat', 'YouTube chat', 'Live chat box', MessageSquare], ['alert', 'Alert box', 'Super Chat pop-up', BellRing],
  ['text', 'Text', 'Title or label', Type], ['clock', 'Clock', 'Live time', Clock], ['color', 'Color', 'Solid or gradient', Palette],
  ['lower', 'Lower third', 'Name that slides in', PanelBottom], ['goal', 'Goal bar', 'Super Chat / member goal', Target], ['caption', 'Live captions', 'Your voice as text', Captions], ['mask', 'Blur box', 'Hide an area on stream', EyeOff], ['scene', 'Scene', 'Reuse another scene', Layers]
]

export default function AddSource({ only, cams, onPick, onClose, front, meta, onAddApp, mics = [], onMic, kind0 }) {
  const [kind, setKind] = useState(only ? 'screen' : kind0 || ''), [shots, setShots] = useState(null), [tab, setTab] = useState('screen'), [url, setUrl] = useState('')
  const [ios, setIos] = useState(null), [inst, setInst] = useState('')
  useEffect(() => { if (kind !== 'ios') return; const f = () => api.invoke('ios:list').then(setIos).catch(() => {}); f(); const t = setInterval(f, 2000); return () => clearInterval(t) }, [kind])
  const install = async () => { setInst('busy'); try { await api.invoke('airplay:install'); setInst('') } catch (e) { setInst(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')) } }
  const load = () => { setShots(null); api.invoke('screen:thumbs').then(setShots).catch(() => setShots([])) }
  useEffect(() => { if (kind === 'screen' || kind === 'window') { setTab(kind); load() } }, [kind])
  const add = (type, o) => { onPick({ ...newLayer(type), ...o }); onClose() }
  const choose = async k => {
    if (['screen', 'window', 'ios', 'mic', 'sound', 'droidcam', 'icam'].includes(k)) return setKind(k)
    if (k === 'image' || k === 'video') { const src = await api.invoke('file:pick', k); return src && add(k, { src, name: src.split(/[\\/]/).pop() }) }
    add(k)
  }
  const list = (shots || []).filter(x => x.id.startsWith(tab))
  const title = kind === 'mic' ? 'Add a microphone' : kind === 'sound' ? 'Add a sound effect' : !kind ? 'Add source' : only ? 'Choose a screen or window for the backdrop' : kind === 'ios' ? 'Add an iPhone or iPad' : kind === 'webcam' ? 'Choose a camera' : kind === 'droidcam' ? 'Use an Android phone as a webcam' : kind === 'icam' ? 'Use an iPhone as a webcam' : kind === 'browser' ? 'Web page' : 'Choose what to capture'

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-md" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div className="pop w-[760px] max-w-[92vw] max-h-[84vh] flex flex-col rounded-[26px] border border-white/15 bg-zinc-900/85 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-white/[0.07]">
          {kind && !only && <Button variant="ghost" className="px-2" onClick={() => setKind('')}><ChevronLeft size={14} />Back</Button>}
          <span className="flex-1 text-[14px] font-semibold text-white">{title}</span>
          {(kind === 'screen' || kind === 'window') && <>
            <Tabs value={tab} onChange={setTab} options={[['screen', 'Screens', Monitor], ['window', 'Windows', AppWindow]]} />
            <Button variant="ghost" className="px-2" onClick={load} title="Refresh"><RefreshCw size={13} /></Button>
          </>}
          <Button variant="ghost" className="px-2" onClick={onClose}><X size={14} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!kind && front && <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.05] p-3">
            <AppIcon app={front} meta={meta} size={44} />
            <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500"><span className="size-1.5 rounded-full bg-emerald-400 live-dot" />Open on phone now</div>
              <div className="truncate text-[14px] font-semibold text-white">{front.name}</div></div>
            <Button variant="primary" className="h-9 px-4" onClick={() => { onAddApp(front); onClose() }}><Smartphone size={14} />Add as source</Button>
          </div>}
          {!kind && <div className="grid grid-cols-4 gap-2.5">
            {KINDS.map(([k, t, d, I]) => (
              <button key={k} onClick={() => choose(k)} className="group flex flex-col items-start gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3.5 text-left transition-all duration-200 hover:bg-white/[0.1] hover:-translate-y-0.5 hover:border-white/20">
                <span className="size-9 rounded-xl bg-white/[0.08] grid place-items-center group-hover:bg-white group-hover:text-black transition-colors"><I size={17} /></span>
                <span><span className="block text-[13px] font-medium text-white">{t}</span><span className="block text-[11px] text-zinc-500">{d}</span></span>
              </button>
            ))}
          </div>}
          {(kind === 'screen' || kind === 'window') && (shots === null ? <div className="py-16 text-center text-zinc-500">Looking for screens and windows…</div>
            : !list.length ? <div className="py-16 text-center text-[12px] text-zinc-500">Nothing found. If this stays empty, allow Screen Recording for Meroro in Permissions.</div>
            : <div className="grid grid-cols-3 gap-2.5">
              {list.map(x => (
                <button key={x.id} onClick={() => add('screen', { src: x.id, name: x.name })} className="rounded-2xl border border-white/[0.07] bg-black/30 overflow-hidden text-left transition-all duration-200 hover:border-white/40 hover:-translate-y-0.5">
                  <img src={x.thumb} className="w-full aspect-video object-contain bg-black" draggable={false} />
                  <span className="block truncate px-2.5 py-2 text-[12px] text-zinc-200">{x.name}</span>
                </button>
              ))}
            </div>)}
          {kind === 'ios' && <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-white"><Usb size={13} />USB cable</div>
              {!ios ? <div className="text-[12px] text-zinc-500">Looking…</div>
                : !ios.mac ? <div className="rounded-xl bg-white/[0.04] p-3 text-[12px] text-zinc-400">USB capture of an iPhone works on Mac. On Windows, use AirPlay below.</div>
                : !ios.usb.length ? <div className="rounded-xl bg-white/[0.04] p-3 text-[12px] leading-relaxed text-zinc-400">No iPhone or iPad found. Plug it in with a cable, unlock it and tap <b className="text-zinc-200">Trust</b>. It shows up here by itself.</div>
                : <div className="grid grid-cols-2 gap-2">{ios.usb.map(d => (
                  <button key={d.id} onClick={() => add('ios', { src: 'usb:' + d.id, name: d.name })} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3 text-left hover:bg-white/[0.1]">
                    <span className="size-9 rounded-xl bg-white/[0.08] grid place-items-center"><TabletSmartphone size={17} /></span>
                    <span className="min-w-0"><span className="block truncate text-[13px] font-medium text-white">{d.name}</span><span className="block text-[11px] text-zinc-500">USB · sharp, low delay</span></span>
                  </button>))}</div>}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-white"><Cast size={13} />AirPlay (wireless)</div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                <span className="size-9 rounded-xl bg-white/[0.08] grid place-items-center"><Cast size={17} /></span>
                <span className="flex-1 min-w-0"><span className="block text-[13px] font-medium text-white">Meroro AirPlay receiver</span>
                  <span className="block text-[11px] leading-snug text-zinc-500">{ios?.airplay ? 'On the iPhone: Control Center → Screen Mirroring → Meroro' : inst && inst !== 'busy' ? <span className="text-red-400">{inst}</span> : 'Needs the free UxPlay receiver (installed with one click)'}</span></span>
                {ios?.airplay ? <Button variant="primary" className="h-9 px-4" onClick={() => add('ios', { src: 'airplay', name: 'iPhone (AirPlay)' })}>Add</Button>
                  : <Button className="h-9 px-3" disabled={inst === 'busy' || !ios} onClick={install}>{inst === 'busy' ? <><Loader2 size={13} className="animate-spin" />Installing…</> : <><Download size={13} />Install</>}</Button>}
              </div>
            </div>
          </div>}
          {kind === 'mic' && <div className="space-y-1.5">
            {[['default', 'System default microphone'], ...mics].map(([id, name]) => (
              <button key={id} onClick={() => { onMic(id, name); onClose() }} className="w-full flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 h-11 text-left hover:bg-white/[0.1]">
                <Mic size={15} className="text-zinc-400" /><span className="truncate">{name}</span>
              </button>))}
            <p className="pt-1 text-[11px] text-zinc-500">Add as many microphones as you like; each gets its own fader, voice changer and settings in the mixer.</p>
          </div>}
          {kind === 'sound' && <div className="grid grid-cols-4 gap-2">
            {SFX.map(([id, name]) => (
              <div key={id} className="flex items-center gap-1 rounded-xl bg-white/[0.04] border border-white/[0.07] p-1.5">
                <button title="Listen" onClick={() => window.__eng?.playSfx(id)} className="size-8 shrink-0 grid place-items-center rounded-lg bg-white/[0.08] hover:bg-white/[0.16]"><Play size={13} /></button>
                <button onClick={() => { window.__eng?.playSfx(id); add('sound', { sfx: id, name: name + ' sound' }) }} className="flex-1 min-w-0 h-8 truncate rounded-lg px-1.5 text-left text-[12px] text-zinc-100 hover:bg-white/[0.08]">{name}</button>
              </div>))}
          </div>}
          {kind === 'webcam' && <div className="space-y-1.5">
            {[['default', 'System default camera'], ...cams].map(([id, name]) => (
              <button key={id} onClick={() => add('webcam', { src: id, fit: 'cover', name: id === 'default' ? 'Webcam' : name })} className="w-full flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 h-11 text-left hover:bg-white/[0.1]">
                <Webcam size={15} className="text-zinc-400" /><span className="truncate">{name}</span>
              </button>
            ))}
          </div>}
          {kind === 'droidcam' && <DroidCam add={add} />}
          {kind === 'icam' && <div className="space-y-4">
            <div>
              <H icon={Aperture}>Continuity Camera {api.platform === 'darwin' ? '· wireless, built into macOS' : '(Mac only)'}</H>
              {api.platform !== 'darwin' ? <Note>On Windows, use the Wi-Fi option below. It works with any iPhone.</Note>
                : cams.filter(([, n]) => /iphone|ipad|continuity/i.test(n)).length ? <div className="grid grid-cols-2 gap-2">{cams.filter(([, n]) => /iphone|ipad|continuity/i.test(n)).map(([id, n]) => (
                  <Pick key={id} icon={Aperture} title={n} sub="Continuity Camera · sharp, low delay" onClick={() => add('webcam', { src: id, fit: 'cover', res: '1080', name: n })} />))}</div>
                : <Note>No iPhone camera yet. Bring an iPhone (iOS 16+) signed in to the same Apple ID near this Mac, with Wi-Fi and Bluetooth on. Lock it and stand it up in landscape: it shows up here by itself.</Note>}
            </div>
            <WifiCam add={add} />
          </div>}
          {kind === 'browser' && <div className="flex gap-2">
            <Input autoFocus className="h-9" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… (alerts, chat overlay, any widget)" onKeyDown={e => e.key === 'Enter' && url && add('browser', { src: url.trim() })} />
            <Button variant="primary" className="h-9 px-4" disabled={!url} onClick={() => add('browser', { src: url.trim() })}>Add</Button>
          </div>}
        </div>
      </div>
    </div>
  )
}

const H = ({ icon: I, children }) => <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-white"><I size={13} />{children}</div>
const Note = ({ children }) => <div className="rounded-xl bg-white/[0.04] p-3 text-[12px] leading-relaxed text-zinc-400">{children}</div>
const Pick = ({ icon: I, title, sub, onClick, right }) => <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3 text-left">
  <span className="size-9 shrink-0 rounded-xl bg-white/[0.08] grid place-items-center"><I size={17} /></span>
  <span className="flex-1 min-w-0"><span className="block truncate text-[13px] font-medium text-white">{title}</span><span className="block text-[11px] text-zinc-500">{sub}</span></span>
  {right || <Button variant="primary" className="h-8 px-3" onClick={onClick}>Add</Button>}
</div>

// Android camera through USB debugging (cable or Wi-Fi): back/front camera, sharp and low delay. Android 12+.
function DroidCam({ add }) {
  const [devs, setDevs] = useState(null)
  useEffect(() => { const f = () => api.invoke('devices').then(d => setDevs(d.filter(x => x.state === 'device'))).catch(() => setDevs([])); f(); const t = setInterval(f, 2000); return () => clearInterval(t) }, [])
  const cam = (d, facing) => add('webcam', { src: `droid:${facing}:${d.serial}`, fit: 'cover', res: '1080', name: `${d.model} · ${facing} camera` })
  return <div className="space-y-4">
    <div>
      <H icon={Usb}>USB debugging · cable or wireless</H>
      {!devs ? <Note>Looking…</Note> : !devs.length ? <Note>No phone connected. Plug it in with USB debugging on, or pair it over Wi-Fi with the QR code below.</Note>
        : <div className="space-y-2">{devs.map(d => <Pick key={d.serial} icon={d.wifi ? Wifi : Usb} title={d.model} sub={(d.wifi ? 'Wi-Fi' : 'USB') + ' · Android 12 or newer'}
          right={<span className="flex gap-1.5"><Button className="h-8 px-3" onClick={() => cam(d, 'back')}><Camera size={13} />Back</Button><Button className="h-8 px-3" onClick={() => cam(d, 'front')}><Camera size={13} />Front</Button></span>} />)}</div>}
    </div>
    <div>
      <H icon={Wifi}>Connect a phone over Wi-Fi</H>
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3"><Wireless compact /></div>
    </div>
    <WifiCam add={add} />
  </div>
}

// Any phone, no USB debugging: open a page from a QR code and the phone's browser sends its camera over Wi-Fi (WebRTC).
function WifiCam({ add }) {
  const [info, setInfo] = useState(null), [ph, setPh] = useState([]), [ip, setIp] = useState(0), [img, setImg] = useState('')
  useEffect(() => {
    api.invoke('wcam:info').then(setInfo).catch(e => setInfo({ err: String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }))
    const f = () => setPh(window.__eng?.phones() || []); f(); const t = setInterval(f, 1000); return () => clearInterval(t)
  }, [])
  useEffect(() => { if (info?.urls?.[ip]) api.invoke('wcam:qr', info.urls[ip]).then(setImg) }, [info, ip])
  return <div>
    <H icon={Wifi}>Any phone over Wi-Fi · no app, no cable</H>
    {info?.err ? <Note>{info.err}</Note> : info && !info.urls.length ? <Note>This computer is not on a network. Connect it to the same Wi-Fi as the phone.</Note> : <div className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
      <div className="relative size-[150px] shrink-0 rounded-xl bg-white p-1.5">{img ? <img src={img} className="size-full" draggable={false} /> : <Loader2 size={18} className="absolute inset-0 m-auto animate-spin text-zinc-400" />}</div>
      <div className="min-w-0 flex-1 space-y-1.5 text-[11.5px] leading-snug text-zinc-400">
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Phone on the same Wi-Fi as this computer.</li>
          <li>Scan the code with the phone's camera.</li>
          <li>Tap <b className="text-zinc-200">Start camera</b> and allow the camera. Flip cameras and pick 720p, 1080p or 4K on the phone.</li>
        </ol>
        {info?.urls?.length > 1 && <div className="flex flex-wrap gap-1">{info.ips.map((x, i) => <button key={x} onClick={() => setIp(i)} className={cx('h-6 rounded-full px-2 text-[10.5px]', i === ip ? 'bg-white text-black' : 'bg-white/[0.08] text-zinc-300')}>{x}</button>)}</div>}
        {info?.urls?.[ip] && <div className="truncate font-mono text-[10.5px] text-zinc-500 select-text">{info.urls[ip]}</div>}
        {info && !info.trusted && <div className="text-amber-300/90">Couldn't get the secure link (no internet?). The phone will warn that the page isn't private, and iPhone may block the camera.</div>}
        {info?.trusted && <details className="text-zinc-500"><summary className="cursor-pointer hover:text-zinc-300">Link doesn't open?</summary>
          Some routers block this kind of address. Use the backup link instead (the phone warns that it isn't private; tap Show Details → visit this website, or Advanced → Proceed):
          <button onClick={() => api.invoke('wcam:qr', info.backups[ip]).then(setImg)} className="ml-1 text-zinc-200 underline">show backup QR</button>
          <div className="truncate font-mono text-[10.5px] select-text">{info.backups[ip]}</div></details>}
        <div className="text-zinc-500">The phone connects directly, or falls back to a Wi-Fi relay if the network blocks that. On Mac, allow Meroro in System Settings → Privacy & Security → Local Network.</div>
      </div>
    </div>}
    {!!ph.length && <div className="mt-2 space-y-2">{ph.map(p => <Pick key={p.id} icon={Camera} title={p.name} sub={p.on ? (p.relay ? 'Connected · Wi-Fi relay' : 'Connected over Wi-Fi') : 'Connecting…'} onClick={() => add('webcam', { src: 'wifi:' + p.id, fit: 'cover', name: p.name })} />)}</div>}
    {!ph.length && info?.urls?.length > 0 && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500"><Loader2 size={11} className="animate-spin" />Phones that open the page show up here.</div>}
  </div>
}
