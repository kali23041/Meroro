// Stream tab: one tab per platform you stream to (the main stream first), a + that opens the platform library,
// and a short set-up step (or Skip) after picking one.
import { useState } from 'react'
import { Plus, Eye, EyeOff, ExternalLink, Trash2, Copy, ChevronLeft, Radio, Repeat2, Settings2 } from 'lucide-react'
import { Button, Input, Row, Select, Switch, cx } from './ui'
import { Dialog } from './Dialogs'
import { uid } from './scene'
import { PLATFORMS, platform, OUT_SIZES } from './platforms'

const mac = window.api.platform === 'darwin'
const DOT = { on: 'bg-emerald-400', starting: 'bg-amber-400', retry: 'bg-amber-400', error: 'bg-red-500' }
const LABEL = { on: 'Live', starting: 'Connecting…', retry: 'Reconnecting…', error: 'Failed' }
const frameOpts = s => [['', 'Follow the studio preview'], ...(s.frames || []).map(f => [f.id, `${f.name} · ${f.size.replace('x', '×')}`])]
const BITRATES = [['2500', '2500 kbps · 720p'], ['3500', '3500 kbps'], ['4500', '4500 kbps · 1080p'], ['6000', '6000 kbps · 1080p'], ['9000', '9000 kbps · 1080p60']]

// Platform icon: the site's own icon fetched at run time, with a coloured letter tile as the fallback.
export function PIcon({ p, size = 28 }) {
  const [bad, setBad] = useState(false)
  return p.site && !bad
    ? <img src={`https://www.google.com/s2/favicons?domain=${p.site}&sz=128`} width={size} height={size} onError={() => setBad(true)} draggable={false} className="shrink-0 rounded-[24%] bg-white/[0.06]" />
    : <span className="shrink-0 rounded-[24%] grid place-items-center font-bold text-black" style={{ width: size, height: size, fontSize: size * 0.45, background: p.color }}>{p.id === 'custom' ? <Radio size={size * 0.55} /> : p.name[0]}</span>
}

function Key({ value, onChange, disabled, placeholder }) {
  const [show, setShow] = useState(false)
  return <><Input disabled={disabled} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'xxxx-xxxx-xxxx-xxxx'} />
    <Button variant="ghost" className="px-1.5" onClick={() => setShow(!show)}>{show ? <EyeOff size={13} /> : <Eye size={13} />}</Button></>
}
const Help = ({ p }) => p.help ? <button onClick={() => window.open(p.help)} className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"><ExternalLink size={11} />Get the {p.ask ? 'server and key' : 'key'} from {p.name}</button> : null

// Centre window: platform library → set-up (or Skip).
function PlatformDialog({ s, mode, onDone, onClose }) {
  const [p, setP] = useState(null), [d, setD] = useState(null), up = o => setD(v => ({ ...v, ...o }))
  const pick = x => { setP(x); setD({ url: '', key: '', sceneId: '', frameId: x.vertical ? (s.frames || []).find(f => { const [a, b] = f.size.split('x').map(Number); return b > a })?.id || '' : '', size: x.vertical ? '1080x1920' : '', bitrate: x.vertical ? 4500 : 0 }) }
  if (!p) return (
    <Dialog title={mode === 'main' ? 'Choose the main platform' : 'Add a platform'} onClose={onClose} className="w-[760px]">
      <div className="grid grid-cols-4 gap-2.5">
        {PLATFORMS.map(x => (
          <button key={x.id} onClick={() => pick(x)} className="group flex flex-col items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-2 py-4 text-center transition-all duration-200 hover:bg-white/[0.1] hover:-translate-y-0.5 hover:border-white/20">
            <PIcon p={x} size={52} />
            <span className="text-[13px] font-medium text-white">{x.name}</span>
            <span className="text-[10.5px] text-zinc-500">{x.id === 'custom' ? 'Any RTMP server' : x.ask ? 'Needs your server URL' : x.vertical ? 'Vertical' : mode === 'add' && x.id === 'youtube' ? 'Another account works too' : 'Just a stream key'}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
  const done = skip => onDone(p, skip ? { ...d, url: '', key: '' } : d)
  return (
    <Dialog title={`Set up ${p.name}`} onClose={onClose} className="w-[520px]"
      footer={<><Button variant="ghost" onClick={() => setP(null)}><ChevronLeft size={13} />Back</Button><span className="flex-1" />
        <Button onClick={() => done(true)}>Skip for now</Button><Button variant="primary" className="px-4" onClick={() => done(false)}>{mode === 'main' ? 'Use ' + p.name : 'Add ' + p.name}</Button></>}>
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3"><PIcon p={p} size={44} />
          <div className="min-w-0"><div className="text-[14px] font-semibold text-white">{p.name}</div><Help p={p} /></div></div>
        {p.ask && <Row label="Server"><Input autoFocus value={d.url} onChange={e => up({ url: e.target.value })} placeholder="rtmp://… or rtmps://…" /></Row>}
        <Row label="Stream key"><Key value={d.key} onChange={key => up({ key })} /></Row>
        {mode === 'add' && <>
          {s.frames ? <Row label="Frame"><Select className="flex-1" value={d.frameId || ''} onChange={frameId => up({ frameId })} options={frameOpts(s)} /></Row> : <>
          <Row label="Scene"><Select className="flex-1" value={d.sceneId} onChange={sceneId => up({ sceneId })} options={[['', 'Main scene (follows you)'], ...s.scenes.map(x => [x.id, 'Only: ' + x.name])]} /></Row>
          <Row label="Size"><Select className="flex-1" value={d.size} onChange={size => up({ size })} options={OUT_SIZES} /></Row></>}
          <Row label="Bitrate"><Select className="flex-1" value={String(d.bitrate || 0)} onChange={v => up({ bitrate: +v })} options={[['0', 'Same as main'], ...BITRATES]} /></Row>
        </>}
        <p className="text-[11px] leading-relaxed text-zinc-500">You can change all of this later in the platform’s tab. Stream keys are stored encrypted on this computer.</p>
      </div>
    </Dialog>
  )
}

export default function StreamTabs({ s, set, live, busy, xst }) {
  const list = s.dests || [], [tab, setTab] = useState('main'), [dlg, setDlg] = useState('')
  const d = list.find(x => x.id === tab), cur = d ? tab : 'main'
  const up = p => set({ dests: list.map(x => x.id === cur ? { ...x, ...p } : x) })
  const mp = platform(s.dest), p = d ? platform(d.platform) : mp, st = d && live ? xst[d.id] : null
  const done = (pl, v) => {
    if (dlg === 'main') set({ dest: pl.id, ...(v.url ? { customUrl: v.url } : {}), ...(v.key ? { key: v.key } : {}) })
    else if (dlg === 'change') up({ platform: pl.id, url: v.url, ...(v.key ? { key: v.key } : {}) })
    else { const n = { id: uid(), on: true, name: '', platform: pl.id, fps: 0, ...v }; set({ dests: [...list, n] }); setTab(n.id) }
    setDlg('')
  }
  const chip = (id, pl, name, dim, state) => (
    <button key={id} onClick={() => setTab(id)} title={name}
      className={cx('relative shrink-0 h-9 flex items-center gap-1.5 rounded-xl pl-1.5 pr-2.5 text-[12px] font-medium transition-colors', cur === id ? 'bg-white/[0.14] text-white' : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100', dim && 'opacity-50')}>
      <PIcon p={pl} size={24} /><span className="max-w-[84px] truncate">{name}</span>
      {state && <span className={cx('absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-[#1a1a1c]', DOT[state])} />}
    </button>
  )
  return (
    <div className="px-1.5 pt-1.5">
      <div className="flex items-center gap-1 overflow-x-auto pb-1.5">
        {chip('main', mp, 'Main', false, live === 'on' ? 'on' : live ? 'starting' : '')}
        {list.map(x => chip(x.id, platform(x.platform), x.name || platform(x.platform).name, !x.on, live && x.on ? xst[x.id]?.state : ''))}
        <button title="Add a platform" onClick={() => setDlg('add')} className="shrink-0 size-9 rounded-xl grid place-items-center bg-white/[0.04] text-zinc-400 hover:bg-white/[0.1] hover:text-white"><Plus size={15} /></button>
      </div>

      <div className="mb-1.5 rounded-xl bg-[#242427] p-2.5 space-y-1.5">
        <div className="flex items-center gap-2.5">
          <PIcon p={p} size={36} />
          <div className="flex-1 min-w-0"><div className="truncate text-[13px] font-semibold text-white">{d ? d.name || p.name : p.name}</div>
            <div className="truncate text-[11px] text-zinc-500">{d ? (st ? `${LABEL[st.state] || ''}${st.kbps ? ` · ${st.kbps} kbps · ${st.fps} fps` : ''}` : 'Goes live together with the main stream') : 'Main stream · shows the scene you are on'}</div></div>
          <Button variant="ghost" className="px-2" disabled={!!live} title="Change platform" onClick={() => setDlg(d ? 'change' : 'main')}><Repeat2 size={13} /></Button>
          {d && <Switch checked={d.on} onChange={on => up({ on })} />}
        </div>
        {d ? <>
          <Row label="Name"><Input value={d.name} onChange={e => up({ name: e.target.value })} placeholder={p.id === 'youtube' ? 'e.g. Second channel' : p.name} /></Row>
          {(p.ask || d.url) && <Row label="Server"><Input disabled={!!live} value={d.url} onChange={e => up({ url: e.target.value })} placeholder="rtmp://… or rtmps://…" /></Row>}
          <Row label="Stream key"><Key disabled={!!live} value={d.key} onChange={key => up({ key })} placeholder="key for this stream" /></Row>
          <Help p={p} />
          {s.frames ? <Row label="Frame"><Select className="flex-1" disabled={!!live} value={d.frameId || ''} onChange={frameId => up({ frameId })} options={frameOpts(s)} /></Row> : <>
          <Row label="Scene"><Select className="flex-1" disabled={!!live} value={d.sceneId} onChange={sceneId => up({ sceneId })} options={[['', 'Main scene (follows you)'], ...s.scenes.map(x => [x.id, 'Only: ' + x.name])]} /></Row>
          <Row label="Size"><Select className="flex-1" disabled={!!live} value={d.size} onChange={size => up({ size })} options={OUT_SIZES} /></Row></>}
          <Row label="Bitrate"><Select className="flex-1" disabled={!!live} value={String(d.bitrate || 0)} onChange={v => up({ bitrate: +v })} options={[['0', 'Same as main'], ...BITRATES]} /></Row>
          <Row label="Frame rate"><Select className="flex-1" disabled={!!live} value={String(d.fps || 0)} onChange={v => up({ fps: +v })} options={[['0', 'Same as main'], ['30', '30 fps'], ['60', '60 fps']]} /></Row>
          <div className="flex gap-1">
            <Button className="flex-1 h-7" disabled={!!live} onClick={() => { const n = { ...d, id: uid(), name: (d.name || p.name) + ' copy', key: '' }; set({ dests: [...list, n] }); setTab(n.id) }}><Copy size={11} />Duplicate</Button>
            <Button className="flex-1 h-7" disabled={!!live} onClick={() => { set({ dests: list.filter(x => x.id !== d.id) }); setTab('main') }}><Trash2 size={11} />Remove</Button>
          </div>
        </> : <>
          {mp.ask && <Row label="Server"><Input disabled={!!live} value={s.customUrl} onChange={e => set({ customUrl: e.target.value })} placeholder="rtmp://live.example.com/app" /></Row>}
          <Row label="Stream key"><Key disabled={!!live} value={s.key} onChange={key => set({ key })} /></Row>
          {s.frames && <Row label="Frame"><Select className="flex-1" disabled={!!live} value={s.liveFrame || ''} onChange={liveFrame => set({ liveFrame })} options={frameOpts(s)} /></Row>}
          <Help p={mp} />
          <Row label="Bitrate"><Select className="flex-1" disabled={!!live} value={String(s.bitrate)} onChange={bitrate => set({ bitrate: +bitrate })} options={BITRATES} /></Row>
          <Row label="Frame rate"><Select className="flex-1" disabled={busy} value={s.fps} onChange={fps => set({ fps: +fps })} options={[[30, '30 fps'], [60, '60 fps']]} /></Row>
          <Row label="Encoder"><Select className="flex-1" disabled={!!live} value={s.encoder} onChange={encoder => set({ encoder })} options={[...(mac ? [['hw', 'Hardware (VideoToolbox)']] : []), ['x264', 'Software (x264)']]} /></Row>
        </>}
      </div>
      {list.filter(x => x.on && x.key).length > 2 && <p className="px-1 pb-1 text-[11px] leading-relaxed text-zinc-500">Each stream is encoded separately, so many at once need a fast computer and upload.</p>}
      {dlg && <PlatformDialog s={s} mode={dlg === 'add' ? 'add' : 'main'} onDone={done} onClose={() => setDlg('')} />}
    </div>
  )
}

// Go Live (70%) + Record (30%). The gear on Go Live picks which platforms go live, as a popup anchored to it.
export function GoLiveBar({ s, set, live, rec, goLive, record }) {
  const [at, setAt] = useState(null), [rat, setRat] = useState(null), dests = s.dests || [], mp = platform(s.dest)
  const on = (s.mainOn !== false && s.key ? 1 : 0) + dests.filter(d => d.on && d.key).length
  return <div className="flex gap-2">
    <div className="relative flex-[7] min-w-0">
      <button onClick={goLive} className={cx('w-full h-11 rounded-2xl pl-4 pr-11 flex items-center justify-center gap-2 text-[13px] font-semibold transition-colors', live ? 'bg-[#323236] text-white hover:bg-[#3a3a3f]' : 'bg-red-500 text-white hover:bg-red-400')}>
        {live ? <><span className="size-2.5 rounded-[3px] bg-current" />{live === 'on' ? 'End stream' : 'Cancel'}</> : <><Radio size={15} />Go Live{on > 1 ? ` · ${on}` : ''}</>}</button>
      <button title="Choose platforms" onClick={e => setAt(at ? null : e.currentTarget.getBoundingClientRect())} className={cx('absolute right-1.5 top-1/2 -translate-y-1/2 size-8 grid place-items-center rounded-xl transition-colors', at ? 'bg-white text-black' : 'bg-black/20 text-white hover:bg-black/35')}><Settings2 size={14} /></button>
    </div>
    <div className="relative flex-[3] min-w-0">
      <button onClick={record} title={rec ? 'Stop recording' : 'Record'} className={cx('w-full h-11 rounded-2xl pl-2 pr-9 flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-colors', rec ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40' : 'bg-[#323236] text-white hover:bg-[#3a3a3f]')}>
        {rec ? <><span className="size-2 rounded-full bg-red-500 live-dot" /><span className="tabular-nums">{rec}</span></> : <><span className="size-2.5 rounded-full bg-red-500" />Record</>}</button>
      <button title="Recording settings" onClick={e => setRat(rat ? null : e.currentTarget.getBoundingClientRect())} className={cx('absolute right-1 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-lg transition-colors', rat ? 'bg-white text-black' : 'text-zinc-300 hover:bg-white/10')}><Settings2 size={13} /></button>
    </div>
    {rat && <RecPop s={s} set={set} at={rat} rec={rec} onClose={() => setRat(null)} />}
    {at && <>
      <div className="fixed inset-0 z-40" onPointerDown={() => setAt(null)} />
      <div className="pop fixed z-50 w-[320px] rounded-2xl border border-white/10 bg-[#1c1c1f]/95 backdrop-blur-xl p-2 shadow-2xl" style={{ right: Math.max(8, innerWidth - at.right - 4), bottom: innerHeight - at.top + 10 }}>
        <div className="px-1.5 pb-1.5 text-[12px] font-semibold text-white">Go live on</div>
        {[{ id: 'main', p: mp, name: 'Main · ' + mp.name, on: s.mainOn !== false, key: s.key, flip: v => set({ mainOn: v }) },
          ...dests.map(d => ({ id: d.id, p: platform(d.platform), name: d.name || platform(d.platform).name, on: d.on, key: d.key, flip: v => set({ dests: dests.map(x => x.id === d.id ? { ...x, on: v } : x) }) }))].map(x =>
          <label key={x.id} className={cx('flex items-center gap-2.5 rounded-xl px-2 h-11 cursor-pointer hover:bg-white/[0.05]', !x.key && 'opacity-60')}>
            <PIcon p={x.p} size={26} /><span className="flex-1 min-w-0"><span className="block truncate text-[12px] text-zinc-100">{x.name}</span>
              <span className="block text-[10.5px] text-zinc-500">{x.key ? (x.on ? 'Will go live' : 'Off') : 'Needs a stream key (Stream tab)'}</span></span>
            <Switch disabled={!!live} checked={!!x.on && !!x.key} onChange={v => x.key && x.flip(v)} /></label>)}
        {live && <p className="px-2 pt-1 text-[11px] text-zinc-500">End the stream to change platforms.</p>}
      </div>
    </>}
  </div>
}

// Recording settings: what to record (preview, a frame, one scene), size (up to 4K) and quality.
function RecPop({ s, set, at, rec, onClose }) {
  const ro = { target: 'preview', res: '', quality: 'high', ...s.recOpt }, up = o => set({ recOpt: { ...ro, ...o } })
  const fr = s.frames || [], base = ro.target === 'frame' ? fr.find(f => f.id === ro.frameId)?.size : ro.target === 'scene' ? (fr.find(f => f.scenes.includes(ro.sceneId))?.size || s.canvas) : s.canvas
  const [bw, bh] = (base || s.canvas).split('x').map(Number), sz = r => { const k = r / Math.min(bw, bh); return `${Math.round(bw * k / 2) * 2}×${Math.round(bh * k / 2) * 2}` }
  return <>
    <div className="fixed inset-0 z-40" onPointerDown={onClose} />
    <div className="pop fixed z-50 w-[340px] rounded-2xl border border-white/10 bg-[#1c1c1f]/95 backdrop-blur-xl p-3 shadow-2xl space-y-1.5" style={{ right: Math.max(8, innerWidth - at.right - 4), bottom: innerHeight - at.top + 10 }}>
      <div className="pb-1 text-[13px] font-semibold text-white">Recording</div>
      <Row label="Record"><Select className="flex-1" disabled={!!rec} value={ro.target} onChange={target => up({ target, frameId: ro.frameId || fr[0]?.id, sceneId: ro.sceneId || s.sceneId })}
        options={[['preview', 'What the studio shows'], ...(fr.length ? [['frame', 'One frame']] : []), ['scene', 'Only one scene']]} /></Row>
      {ro.target === 'frame' && <Row label="Frame"><Select className="flex-1" disabled={!!rec} value={ro.frameId} onChange={frameId => up({ frameId })} options={fr.map(f => [f.id, `${f.name} · ${f.size.replace('x', '×')}`])} /></Row>}
      {ro.target === 'scene' && <Row label="Scene"><Select className="flex-1" disabled={!!rec} value={ro.sceneId} onChange={sceneId => up({ sceneId })} options={s.scenes.map(x => [x.id, x.name])} /></Row>}
      <Row label="Size"><Select className="flex-1" disabled={!!rec} value={ro.res} onChange={res => up({ res })}
        options={[['', `Same as source · ${bw}×${bh}`], ['1080', `1080p · ${sz(1080)}`], ['1440', `2K · ${sz(1440)}`], ['2160', `4K · ${sz(2160)}`]]} /></Row>
      <Row label="Quality"><Select className="flex-1" disabled={!!rec} value={ro.quality} onChange={quality => up({ quality })} options={[['standard', 'Standard · smaller files'], ['high', 'High'], ['max', 'Maximum · large files']]} /></Row>
      <p className="text-[11px] leading-relaxed text-zinc-500">{ro.target === 'preview' ? 'Records whatever is on the studio canvas.' : ro.target === 'frame' ? 'Records that frame’s current scene, even when the studio shows another one.' : 'Records only this scene, whatever you switch to.'} 2K and 4K need a fast computer; sources look sharpest when their own quality is high too.</p>
      {rec && <p className="text-[11px] text-amber-300">Stop recording to change these.</p>}
    </div>
  </>
}
