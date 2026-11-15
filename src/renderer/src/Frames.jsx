// Frames bar (top of the Scene tab), frame settings window, and the side-by-side view of every frame.
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { platform } from './platforms'
import { PIcon } from './StreamTabs'
import { Plus, Settings2, Columns2, Trash2, Radio, X, Frame, Link2, ChevronRight, ArrowLeft, Type, Grid3x3, Pin, Pencil, Camera, SkipForward } from 'lucide-react'
import { Button, Input, Row, Section, Select, Switch, cx } from './ui'
import { Dialog } from './Dialogs'
import { FRAME_PRESETS, newFrame } from './framemodel'
import { uid } from './scene'

const Shape = ({ size, big }) => { const [a, b] = size.split('x').map(Number), k = (big ? 22 : 13) / Math.max(a, b); return <span className="rounded-[2px] border border-current opacity-80 shrink-0" style={{ width: a * k, height: b * k }} /> }

function FrameDialog({ frame, onSave, onDelete, onClose, canDelete, scenes, frames, existing }) {
  const [d, setD] = useState(frame), [w, h] = d.size.split('x').map(Number), up = o => setD(v => ({ ...v, ...o }))
  const size = v => { const n = Math.round(+v / 2) * 2; return n >= 240 && n <= 3840 ? n : null }
  return <Dialog title={frame.isNew ? 'New frame' : 'Frame settings'} onClose={onClose} className="w-[640px]" footer={<>
    {!frame.isNew && <Button variant="ghost" className="text-red-400" disabled={!canDelete} onClick={() => { onDelete(d.id); onClose() }}><Trash2 size={13} />Delete frame</Button>}
    <span className="flex-1" /><Button onClick={onClose}>Cancel</Button><Button variant="primary" className="px-4" onClick={() => { onSave(d); onClose() }}>{frame.isNew ? 'Create frame' : 'Save'}</Button></>}>
    <div className="flex gap-4">
      <div className="w-[180px] shrink-0 grid place-items-center h-[200px] rounded-xl bg-black/30">
        <div className="rounded-lg ring-1 ring-white/30 bg-white/[0.06] grid place-items-center text-[11px] text-zinc-300" style={{ aspectRatio: w / h, [w >= h ? 'width' : 'height']: w >= h ? 160 : 180 }}>{w}×{h}</div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <Row label="Name"><Input autoFocus value={d.name} onChange={e => up({ name: e.target.value })} /></Row>
        <div className="grid grid-cols-2 gap-1">{FRAME_PRESETS.map(([id, n, sz]) => <button key={id} onClick={() => up({ preset: id, size: sz, ...(frame.isNew && (!d.name || FRAME_PRESETS.some(p => p[1] === d.name)) ? { name: n } : {}) })}
          className={cx('flex items-center gap-2 rounded-lg px-2 h-9 text-left', d.preset === id ? 'bg-accent text-white' : 'bg-[#323236] text-zinc-300 hover:bg-[#3a3a3f]')}>
          <span className="w-4 grid place-items-center"><Shape size={sz} /></span><span className="min-w-0"><span className="block truncate text-[11px] font-medium">{n}</span><span className="block text-[10px] text-zinc-500">{sz.replace('x', '×')}</span></span></button>)}</div>
        <Row label="Custom"><Input key={'w' + d.size} defaultValue={w} onBlur={e => { const n = size(e.target.value); if (n) up({ size: n + 'x' + h, preset: '' }) }} /><span className="text-zinc-500">×</span>
          <Input key={'h' + d.size} defaultValue={h} onBlur={e => { const n = size(e.target.value); if (n) up({ size: w + 'x' + n, preset: '' }) }} /></Row>
        <Row label="Linked to"><Select className="flex-1" value={d.parent || ''} onChange={parent => up({ parent, copyNow: parent ? d.copyNow ?? true : false })}
          options={[['', 'Not linked (own sources)'], ...frames.filter(f => f.id !== d.id && !f.parent && !frames.some(k => k.parent === d.id)).map(f => [f.id, 'Child of ' + f.name])]} /></Row>
        {d.parent && d.parent !== frame.parent && <Row label="Copy now"><span className="flex-1 text-[11px] text-zinc-500">Also copy the sources {frames.find(f => f.id === d.parent)?.name} already has</span><Switch checked={!!d.copyNow} onChange={copyNow => up({ copyNow })} /></Row>}
        {d.parent && <p className="text-[11px] leading-relaxed text-zinc-500">Sources you add to the parent frame appear here too. Each copy has its own position, size, crop and style; the camera, file or text itself follows the parent.</p>}
        {!frame.isNew && <p className="text-[11px] text-zinc-500">{scenes} scene{scenes === 1 ? '' : 's'} in this frame. Changing the size keeps your sources where they are, in proportion.</p>}
      </div>
    </div>
  </Dialog>
}

// "All frames": a separate window (window.open) with its own React root; the studio's engine paints every frame into it,
// and each frame shows the logos of the platforms it is streamed to.
const streamsOf = (s, f) => [
  ...((s.liveFrame || s.frameId) === f.id ? [{ id: 'main', p: platform(s.dest) }] : []),
  ...(s.dests || []).filter(d => d.on && d.key && (d.frameId || s.frameId) === f.id).map(d => ({ id: d.id, p: platform(d.platform), name: d.name }))
]
// Bezel-less view: frames fill the window edge to edge; controls float on top as pills and fade away when the mouse rests.
const Round = ({ title, on, onClick, children, big }) => <button title={title} onClick={onClick}
  className={cx('no-drag grid place-items-center rounded-full shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95', big ? 'size-10' : 'size-9', on ? 'bg-[#eef07a] text-black' : 'bg-black/55 text-white hover:bg-black/75')}>{children}</button>
function FramesView({ s, set, eng, live, xst, win }) {
  const refs = useRef({}), sRef = useRef(s); sRef.current = s
  const [vw, setVw] = useState([win.innerWidth, win.innerHeight]), [ui, setUi] = useState(true), [hov, setHov] = useState(''), [opt, setOpt] = useState({ labels: true, logos: true, guides: false, top: false })
  const flip = k => setOpt(o => { const n = { ...o, [k]: !o[k] }; if (k === 'top') window.api.send('frames:top', n.top); return n })
  useEffect(() => { const r = () => setVw([win.innerWidth, win.innerHeight]); win.addEventListener('resize', r); return () => win.removeEventListener('resize', r) }, [])
  useEffect(() => { // controls show while the mouse moves and hide 1.8 s after it stops or leaves
    let t; const wake = () => { setUi(true); clearTimeout(t); t = setTimeout(() => setUi(false), 1800) }, out = () => { clearTimeout(t); setUi(false); setHov('') }
    win.addEventListener('mousemove', wake); win.document.addEventListener('mouseleave', out); wake()
    return () => { clearTimeout(t); win.removeEventListener('mousemove', wake); win.document.removeEventListener('mouseleave', out) }
  }, [])
  useEffect(() => {
    const e = eng.current; e.viewFrames = s.frames.map(f => f.id); e.sync()
    let on = true; const loop = () => { if (!on) return
      for (const f of sRef.current.frames) { const c = refs.current[f.id], sc = sRef.current.scenes.find(x => x.id === f.sceneId); if (!c || !sc) continue
        const [w, h] = f.size.split('x').map(Number), k = Math.min(1, 720 / Math.max(w, h)), W = Math.round(w * k), H = Math.round(h * k)
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
        const pg = e.geo; e.paint(sc, c.getContext('2d'), W, H); e.geo = pg }
      win.requestAnimationFrame(loop) }
    loop(); return () => { on = false; e.viewFrames = []; e.sync() }
  }, [s.frames.length])
  const L = pack(s.frames.map(f => { const [a, b] = f.size.split('x').map(Number); return a / b }), vw[0], vw[1], 3)
  const setScene = (f, id) => f.id === s.frameId ? set({ sceneId: id }) : set({ frames: s.frames.map(x => x.id === f.id ? { ...x, sceneId: id } : x) })
  const shot = f => refs.current[f.id]?.toBlob(b => { const a = win.document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${f.name} ${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`; a.click() })
  const fade = (show, from = '') => cx('transition-all duration-300 ease-out', show ? 'opacity-100 translate-x-0 translate-y-0 scale-100' : 'opacity-0 pointer-events-none scale-95 ' + from)
  const live1 = live && s.frames.some(f => streamsOf(s, f).length)
  return <div className={cx('drag relative w-screen h-screen overflow-hidden bg-black text-zinc-100 select-none', !ui && 'cursor-none')}>
    <div className="absolute" style={{ left: (vw[0] - L.w) / 2, top: (vw[1] - L.h) / 2, width: L.w, height: L.h }}>
      {s.frames.map((f, i) => { const b = L.boxes[i], sc = s.scenes.find(x => x.id === f.sceneId), [w, h] = f.size.split('x').map(Number), outs = streamsOf(s, f), act = f.id === s.frameId, show = ui && hov === f.id
        const scenes = f.scenes.map(id => s.scenes.find(x => x.id === id)).filter(Boolean)
        return <div key={f.id} className="no-drag absolute group" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} onMouseEnter={() => setHov(f.id)} onMouseLeave={() => setHov(h => h === f.id ? '' : h)}>
          <canvas ref={el => { refs.current[f.id] = el }} onDoubleClick={() => set({ frameId: f.id, canvas: f.size, sceneId: f.sceneId })} className={cx('w-full h-full rounded-[10px] transition-shadow duration-300', act ? 'shadow-[0_0_0_2px_#eef07a]' : '')} />
          {opt.guides && <div className="pointer-events-none absolute inset-0 rounded-[10px] [background:linear-gradient(to_right,transparent_33.2%,#fff3_33.3%,transparent_33.4%,transparent_66.6%,#fff3_66.7%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.2%,#fff3_33.3%,transparent_33.4%,transparent_66.6%,#fff3_66.7%,transparent_66.8%)]"><div className="absolute inset-[6%] rounded-md border border-dashed border-white/25" /></div>}
          {/* logos: always visible (that's what's going out) */}
          {opt.logos && !!outs.length && <span className={cx('pointer-events-none absolute right-2 top-2 transition-transform duration-300', ui && b.y < 60 && b.x + b.w > L.w - 80 && 'translate-y-12')}><span className="flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md p-1 pl-1.5 shadow-lg">
            {live && <span className="flex items-center gap-1 pr-0.5 text-[10px] font-bold tracking-wider text-red-400"><span className="size-1.5 rounded-full bg-red-500 live-dot" />LIVE</span>}
            {outs.map(o => { const st = o.id === 'main' ? (live === 'on' ? 'on' : live ? 'starting' : '') : live ? xst[o.id]?.state : ''
              return <span key={o.id} title={(o.name || o.p.name) + (st ? ' · ' + st : '')} className="relative"><PIcon p={o.p} size={20} />
                {st && <span className={cx('absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-black', st === 'on' ? 'bg-emerald-400' : st === 'error' ? 'bg-red-500' : 'bg-amber-400')} />}</span> })}
          </span></span>}
          {/* frame actions: a yellow pill that pops up on hover */}
          <div className={cx('absolute left-1/2 -translate-x-1/2 top-3 flex items-center gap-1 rounded-full bg-[#eef07a] p-1 text-black shadow-xl', fade(show, '-translate-y-2'))}>
            {[['Edit in studio', Pencil, () => { set({ frameId: f.id, canvas: f.size, sceneId: f.sceneId }); window.api.send('studio:focus') }], ['Save picture', Camera, () => shot(f)],
              ['Next scene', SkipForward, () => scenes.length > 1 && setScene(f, scenes[(scenes.findIndex(x => x.id === f.sceneId) + 1) % scenes.length].id)]].map(([t, I, fn]) =>
              <button key={t} title={t} onClick={fn} className="size-7 grid place-items-center rounded-full bg-black/85 text-[#eef07a] transition-transform hover:scale-110 active:scale-95"><I size={13} /></button>)}
          </div>
          {/* label + scene pills along the bottom */}
          {opt.labels && <span className={cx('pointer-events-none absolute left-2 bottom-2 flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md px-2.5 h-7 text-[11px] shadow-lg', fade(!show))}>
            <b>{f.name}</b><span className="text-zinc-400">{w}×{h}</span>{f.parent && <Link2 size={11} className="text-zinc-400" />}</span>}
          <div className={cx('absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 overflow-x-auto', fade(show, 'translate-y-2'))}>
            {scenes.map(x => <button key={x.id} onClick={() => setScene(f, x.id)} className={cx('shrink-0 h-7 rounded-full px-3 text-[11px] font-medium shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105', x.id === f.sceneId ? 'bg-[#eef07a] text-black' : 'bg-black/60 text-zinc-200 hover:bg-black/80')}>{x.name}</button>)}
          </div>
        </div> })}
    </div>
    {/* window controls */}
    <div className={cx('absolute left-3 top-3 flex flex-col gap-2', fade(ui, '-translate-x-2'))}>
      <Round big title="Back to studio" onClick={() => { window.api.send('studio:focus'); win.close() }}><ArrowLeft size={16} /></Round>
      <div className="h-1" />
      <Round title="Names" on={opt.labels} onClick={() => flip('labels')}><Type size={14} /></Round>
      <Round title="Platform logos" on={opt.logos} onClick={() => flip('logos')}><Radio size={14} /></Round>
      <Round title="Safe-area guides" on={opt.guides} onClick={() => flip('guides')}><Grid3x3 size={14} /></Round>
      <Round title="Keep on top" on={opt.top} onClick={() => flip('top')}><Pin size={14} /></Round>
    </div>
    <div className={cx('absolute left-1/2 -translate-x-1/2 top-3 flex items-center gap-1.5', fade(ui, '-translate-y-2'))}>
      <span className="no-drag flex items-center gap-2 h-9 rounded-full bg-black/55 backdrop-blur-md pl-3.5 pr-3 text-[12px] shadow-lg">{live1 && <span className="size-1.5 rounded-full bg-red-500 live-dot" />}All frames<span className="text-zinc-400">{s.frames.length}</span></span>
    </div>
    <div className={cx('absolute right-3 top-3', fade(ui, 'translate-x-2'))}>
      <Round big title="Close" onClick={() => win.close()}><X size={16} /></Round>
    </div>
    {/* frame switcher: timeline-style pills */}
    {s.frames.length > 1 && <div className={cx('no-drag absolute left-1/2 -translate-x-1/2 bottom-12 flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md p-1 shadow-xl', fade(ui && !hov, 'translate-y-2'))}>
      {s.frames.map(f => <button key={f.id} onClick={() => set({ frameId: f.id, canvas: f.size, sceneId: f.sceneId })} className={cx('h-7 flex items-center gap-1.5 rounded-full px-3 text-[11px] font-medium transition-all duration-200', f.id === s.frameId ? 'bg-[#eef07a] text-black' : 'text-zinc-300 hover:bg-white/10')}>
        <Shape size={f.size} />{f.name}</button>)}
    </div>}
  </div>
}
export function SideBySide({ s, set, eng, onClose, live, xst = {} }) {
  const w = useRef(null), root = useRef(null)
  useEffect(() => {
    const win = w.current = window.open('', 'meroro-frames')
    if (!win) return onClose()
    const d = win.document; d.title = 'All frames · Meroro'
    for (const n of document.querySelectorAll('style, link[rel="stylesheet"]')) { if (n.tagName === 'LINK') { const l = d.createElement('link'); l.rel = 'stylesheet'; l.href = n.href; d.head.appendChild(l) } else d.head.appendChild(n.cloneNode(true)) }
    d.documentElement.className = document.documentElement.className; d.body.style.margin = '0'; d.body.style.background = '#141416'
    const el = d.createElement('div'); d.body.appendChild(el); root.current = createRoot(el)
    // fit the window to the frames on first open
    const ar = s.frames.map(f => { const [a, b] = f.size.split('x').map(Number); return a / b }), L = pack(ar, Math.min(1600, screen.availWidth - 120), Math.min(900, screen.availHeight - 140), 3)
    win.resizeTo(Math.round(L.w + (win.outerWidth - win.innerWidth)), Math.round(L.h + (win.outerHeight - win.innerHeight)))
    const bye = () => onClose(); win.addEventListener('pagehide', bye)
    return () => { win.removeEventListener('pagehide', bye); const r = root.current; root.current = null; setTimeout(() => r?.unmount()); if (!win.closed) win.close() }
  }, [])
  useEffect(() => { if (root.current && w.current && !w.current.closed) root.current.render(<FramesView s={s} set={set} eng={eng} live={live} xst={xst} win={w.current} />) })
  return null
}

// Smart grid: tries every way of splitting the frames into rows (in order), sizes each row so it fills the width,
// scales the whole layout to fit, and keeps the arrangement with the biggest frames. Returns boxes plus the exact layout size.
function pack(ratios, W, H, gap) {
  const n = ratios.length; let best = null
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const rows = [[0]]; for (let i = 1; i < n; i++) (mask >> (i - 1)) & 1 ? rows.push([i]) : rows.at(-1).push(i)
    const hs = rows.map(r => (W - gap * (r.length - 1)) / r.reduce((a, i) => a + ratios[i], 0)), tot = hs.reduce((a, b) => a + b, 0) + gap * (rows.length - 1)
    const k = Math.min(1, (H - gap * (rows.length - 1)) / (tot - gap * (rows.length - 1)))
    const area = rows.reduce((a, r, j) => a + r.reduce((b, i) => b + ratios[i] * (hs[j] * k) ** 2, 0), 0)
    if (!best || area > best.area) best = { area, rows, hs: hs.map(h => h * k) }
  }
  const boxes = [], ws = best.rows.map((r, j) => r.reduce((a, i) => a + ratios[i] * best.hs[j], 0) + gap * (r.length - 1)), w = Math.max(...ws)
  let y = 0
  best.rows.forEach((r, j) => { let x = (w - ws[j]) / 2; for (const i of r) { const bw = ratios[i] * best.hs[j]; boxes[i] = { x, y, w: bw, h: best.hs[j] }; x += bw + gap } y += best.hs[j] + gap })
  return { boxes, w: Math.round(w), h: Math.round(y - gap) }
}

export default function FramesBar({ s, set, busy, onSideBySide, onPresetFor, onViewAll }) {
  const [dlg, setDlg] = useState(null), [ask, setAsk] = useState(null)
  const go = f => set({ frameId: f.id, canvas: f.size, sceneId: f.sceneId })
  const tall = sz => { const [a, b] = sz.split('x').map(Number); return b > a }
  const save = d => {
    const p0 = s.frames.find(f => f.id === d.id)?.parent || '', par = d.parent && s.frames.find(f => f.id === d.parent)
    if (par && d.parent !== p0 && tall(par.size) !== tall(d.size)) setAsk({ id: d.id, name: d.name, parent: par.name, vertical: tall(d.size) })
    const { copyNow, ...rest } = d; d = rest
    if (d.parent !== (s.frames.find(f => f.id === d.id)?.parent || '')) d.linked = !d.parent || copyNow ? [] : (s.frames.find(f => f.id === d.parent)?.scenes || []).flatMap(id => s.scenes.find(x => x.id === id)?.layers.map(l => l.id) || [])
    if (d.isNew) { // a new frame starts with one empty scene of its own
      const { isNew, ...f } = d, sc = { id: uid(), name: 'Scene 1', bg: '#0b0b0f', bg2: '', bgBlur: false, layers: [] }
      set({ scenes: [...s.scenes, sc], frames: [...s.frames, { ...f, scenes: [sc.id], sceneId: sc.id }], frameId: f.id, canvas: f.size, sceneId: sc.id })
    } else set({ frames: s.frames.map(f => f.id === d.id ? d : f), ...(d.id === s.frameId ? { canvas: d.size } : {}),
      ...(!d.parent ? { scenes: s.scenes.map(sc => d.scenes.includes(sc.id) && sc.layers.some(l => l.link) ? { ...sc, layers: sc.layers.map(({ link, ...l }) => l) } : sc) } : {}) }) // unlinked: copies become normal sources
  }
  const del = id => { const f = s.frames.find(x => x.id === id), rest = s.frames.filter(x => x.id !== id).map(x => x.parent === id ? { ...x, parent: '', linked: [] } : x)
    set({ frames: rest, scenes: s.scenes.filter(x => !f.scenes.includes(x.id)), ...(id === s.frameId ? { frameId: rest[0].id, canvas: rest[0].size, sceneId: rest[0].sceneId } : {}),
      dests: (s.dests || []).map(d => d.frameId === id ? { ...d, frameId: '' } : d), ...(s.liveFrame === id ? { liveFrame: '' } : {}) }) }
  return <>
    <Section icon={Frame} title="Frames" right={<span className="flex items-center gap-1.5"><button onClick={onViewAll} className="flex items-center gap-0.5 text-[11px] text-zinc-400 hover:text-white">View all<ChevronRight size={12} /></button>{s.frames.length > 1 && <button title="See all frames side by side" onClick={onSideBySide} className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"><Columns2 size={14} /></button>}</span>}>
      <Button variant="primary" className="w-full h-8" disabled={busy} onClick={() => setDlg({ ...newFrame('Phone / Shorts', '1080x1920', 'phone'), isNew: true })}><Plus size={13} />Add frame</Button>
      <div className="grid grid-cols-2 gap-1.5">
        {s.frames.map(f => <div key={f.id} className="group/fr relative">
          <button onClick={() => go(f)} title={f.size.replace('x', '×') + (f.parent ? ' · linked to ' + (s.frames.find(p => p.id === f.parent)?.name || '') : '')} className={cx('w-full h-8 flex items-center gap-1.5 pl-2 pr-7 rounded-md text-left text-[12px] font-medium', f.id === s.frameId ? 'bg-accent text-white font-semibold' : 'bg-[#323236] text-zinc-300 hover:bg-[#3a3a3f]')}>
            <span className="w-4 grid place-items-center"><Shape size={f.size} /></span><span className="truncate">{f.name}</span>{f.parent && <Link2 size={11} className="shrink-0 opacity-70" />}</button>
          <button title="Frame settings" onClick={() => setDlg(f)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10 opacity-60 group-hover/fr:opacity-100"><Settings2 size={12} /></button>
        </div>)}
      </div>
    </Section>
    {ask && <Dialog title="Different shape" onClose={() => setAsk(null)} className="w-[520px]" footer={<>
      <Button onClick={() => setAsk(null)}>Skip</Button><span className="flex-1" />
      <Button variant="primary" className="px-4" onClick={() => { const f = s.frames.find(x => x.id === ask.id); if (f) onPresetFor?.(f, ask.vertical ? 'v' : 'h'); setAsk(null) }}>Choose a {ask.vertical ? 'vertical' : 'horizontal'} preset</Button></>}>
      <div className="space-y-3 text-[13px] leading-relaxed text-zinc-300">
        <p>“{ask.name}” is {ask.vertical ? 'vertical' : 'horizontal'} but “{ask.parent}” is {ask.vertical ? 'horizontal' : 'vertical'}. Sources copied from “{ask.parent}” keep their shape, so they will look small. A {ask.vertical ? 'vertical' : 'horizontal'} preset gives this frame a layout made for its shape.</p>
        <label className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3"><Switch checked={!!s.frames.find(x => x.id === ask.id)?.onlyMain} onChange={v => set({ frames: s.frames.map(x => x.id === ask.id ? { ...x, onlyMain: v } : x) })} />
          <span><span className="block text-white">Copy only phone, camera and screen</span><span className="block text-[11px] text-zinc-500">Skip texts, overlays, alerts and other extras from “{ask.parent}”.</span></span></label>
      </div>
    </Dialog>}
    {dlg && <FrameDialog frame={dlg} frames={s.frames} scenes={dlg.scenes?.length || 0} canDelete={s.frames.length > 1 && !busy} onSave={save} onDelete={del} onClose={() => setDlg(null)} />}
  </>
}
