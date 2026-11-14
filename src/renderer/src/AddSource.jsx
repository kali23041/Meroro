// "Add source" window: pick a kind of source, then (for screens, windows, cameras) pick exactly which one.
import { useEffect, useState } from 'react'
import { Smartphone, Webcam, Monitor, AppWindow, Image as ImageIcon, Film, Globe, MessageSquare, BellRing, Type, Clock, Palette, X, ChevronLeft, RefreshCw } from 'lucide-react'
import { Button, Input, Tabs, cx } from './ui'
import { newLayer } from './scene'
import { AppIcon } from './Library'

const api = window.api
const KINDS = [
  ['phone', 'Phone', 'Your Android screen', Smartphone], ['screen', 'Screen', 'A whole display', Monitor], ['window', 'Window', 'One app window', AppWindow],
  ['webcam', 'Webcam', 'Camera / facecam', Webcam], ['image', 'Image', 'PNG, JPG, GIF', ImageIcon], ['video', 'Video file', 'MP4, MOV, WebM', Film],
  ['browser', 'Web page', 'Alerts, widgets', Globe], ['chat', 'YouTube chat', 'Live chat box', MessageSquare], ['alert', 'Alert box', 'Super Chat pop-up', BellRing],
  ['text', 'Text', 'Title or label', Type], ['clock', 'Clock', 'Live time', Clock], ['color', 'Color', 'Solid or gradient', Palette]
]

export default function AddSource({ only, cams, onPick, onClose, front, meta, onAddApp }) {
  const [kind, setKind] = useState(only ? 'screen' : ''), [shots, setShots] = useState(null), [tab, setTab] = useState('screen'), [url, setUrl] = useState('')
  const load = () => { setShots(null); api.invoke('screen:thumbs').then(setShots).catch(() => setShots([])) }
  useEffect(() => { if (kind === 'screen' || kind === 'window') { setTab(kind); load() } }, [kind])
  const add = (type, o) => { onPick({ ...newLayer(type), ...o }); onClose() }
  const choose = async k => {
    if (k === 'screen' || k === 'window') return setKind(k)
    if (k === 'image' || k === 'video') { const src = await api.invoke('file:pick', k); return src && add(k, { src, name: src.split(/[\\/]/).pop() }) }
    add(k)
  }
  const list = (shots || []).filter(x => x.id.startsWith(tab))
  const title = !kind ? 'Add source' : only ? 'Choose a screen or window for the backdrop' : kind === 'webcam' ? 'Choose a camera' : kind === 'browser' ? 'Web page' : 'Choose what to capture'

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
          {kind === 'webcam' && <div className="space-y-1.5">
            {[['default', 'System default camera'], ...cams].map(([id, name]) => (
              <button key={id} onClick={() => add('webcam', { src: id, fit: 'cover', name: id === 'default' ? 'Webcam' : name })} className="w-full flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 h-11 text-left hover:bg-white/[0.1]">
                <Webcam size={15} className="text-zinc-400" /><span className="truncate">{name}</span>
              </button>
            ))}
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
