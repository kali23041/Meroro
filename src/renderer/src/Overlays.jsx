// Overlays page: animated libraries (name banners, stream scenes, alert effects) with a live editor.
// Everything is drawn in code, so text, fonts, colours, glow and animation stay editable after it is in a scene.
import { useEffect, useRef, useState } from 'react'
import { Wand2, Image as ImageIcon, Trash2, Copy, Download, Check, PanelBottom, Clapperboard, BellRing, Save } from 'lucide-react'
import { Button, Input, Row, Section, Segmented, Select, Slider, Switch, cx } from './ui'
import { L, uid } from './scene'
import { FONTS, PALETTES, ANIMS, TPL_NAMES, BG_NAMES, TX_NAMES, AFX_NAMES, BANNERS, SCENES, SCENE_KINDS, ALERTS, ALERT_KINDS, drawBanner, drawBg, drawText, drawScenePreview, drawAlertFx } from './fx'

const api = window.api
const Color = ({ value, onChange }) => <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="h-7 w-10 shrink-0 rounded-md bg-transparent border border-white/10 p-0.5" />

// One shared animation loop for every preview on the page (about 24 fps).
const live = new Set(); let loop = 0
function run() { let last = 0; const tick = now => { if (!live.size) { loop = 0; return } if (now - last > 40) { last = now; for (const d of live) d(now / 1000) } loop = requestAnimationFrame(tick) }; loop = requestAnimationFrame(tick) }
function Anim({ draw, w = 320, h = 180, className }) {
  const ref = useRef(), fn = useRef(draw); fn.current = draw
  useEffect(() => { const c = ref.current.getContext('2d'), d = t => { c.clearRect(0, 0, w, h); try { fn.current(c, w, h, t) } catch {} }; live.add(d); if (!loop) run(); return () => live.delete(d) }, [w, h])
  return <canvas ref={ref} width={w} height={h} className={className} />
}
const sample = { title: 'Rahul sent ₹100!', sub: 'GG bro, love the stream' }
const fill = (s, a = sample) => (s || '').replace('{name}', 'Rahul').replace('{amount}', '₹100').replace('{text}', 'GG bro, love the stream')
const bannerDraw = (b, img) => (c, w, h, t) => { c.fillStyle = '#17171b'; c.fillRect(0, 0, w, h); drawBanner(c, 0, h * 0.42, w, h * 0.56, b, t, img) }
const alertDraw = (f, title, sub) => (c, w, h, t) => { c.fillStyle = '#17171b'; c.fillRect(0, 0, w, h); drawAlertFx(c, w * 0.08, h * 0.26, w * 0.84, h * 0.48, f, { title: fill(title) || sample.title, sub: fill(sub) }, t % 4.5) }

function Looks({ v, up, anim }) { // font, colours, palette row — shared by every editor
  return <>
    <Row label="Font"><Select className="flex-1" value={v.font} onChange={font => up({ font })} options={FONTS} /></Row>
    <Row label="Italic"><Switch checked={!!v.italic} onChange={italic => up({ italic })} /></Row>
    <Row label="Colours"><Color value={v.c1} onChange={c1 => up({ c1 })} /><Color value={v.c2 || v.c1} onChange={c2 => up({ c2 })} /></Row>
    <div className="flex flex-wrap gap-1">{PALETTES.map(p => <button key={p[0]} title={p[0]} onClick={() => up({ c1: p[1], c2: p[2] })} className="size-6 rounded-md ring-1 ring-white/10" style={{ background: `linear-gradient(135deg,${p[1]},${p[2]})` }} />)}</div>
    {anim && <><Row label="Animation"><Select className="flex-1" value={v.anim} onChange={a => up({ anim: a })} options={ANIMS} /></Row>
      <Row label="Glow"><Slider value={v.glow ?? 0.7} onChange={glow => up({ glow })} max={1.5} /></Row></>}
  </>
}

export default function Overlays({ editing, onBanner, onScene, onAlert, onSave, canvas }) {
  const [tab, setTab] = useState('banner'), [filter, setFilter] = useState('all'), [cur, setCur] = useState(null), [img, setImg] = useState(null), [done, setDone] = useState('')
  useEffect(() => { // editing a layer that is already in a scene
    if (!editing) return
    setCur(editing.type === 'banner' ? { type: 'banner', name: editing.name, b: { ...editing.b }, src: editing.src || '' } : editing.type === 'fxbg' ? { type: 'bg', name: editing.name, b: { ...editing.b } } : { type: 'text', name: editing.name, b: { ...editing.b } })
  }, [editing?.id])
  useEffect(() => { // banner picture
    if (!cur?.src) return setImg(null)
    let u; api.invoke('file:read', cur.src).then(b => { u = URL.createObjectURL(new Blob([b])); const i = new Image(); i.onload = () => setImg(i); i.src = u }).catch(() => setImg(null))
    return () => u && URL.revokeObjectURL(u)
  }, [cur?.src])
  const up = p => setCur(c => ({ ...c, ...p })), upB = p => setCur(c => ({ ...c, b: { ...c.b, ...p } }))
  const flash = k => { setDone(k); setTimeout(() => setDone(''), 1800) }
  const [cw, ch] = canvas.split('x').map(Number), tall = ch > cw
  const tabs = [['banner', 'Name banners', PanelBottom], ['scene', 'Stream scenes', Clapperboard], ['alert', 'Alert effects', BellRing]]
  const chips = tab === 'banner' ? [['all', 'All'], ...Object.entries(TPL_NAMES)] : tab === 'scene' ? [['all', 'All'], ...Object.entries(SCENE_KINDS).map(([k, v]) => [k, v[0]])] : [['all', 'All'], ...Object.entries(AFX_NAMES)]

  const useAlert = () => { const k = cur.kind || 'superchat', K = ALERT_KINDS[k]; onAlert({ on: k === 'subscribe' ? 'timer' : k, arg: k === 'subscribe' ? '10' : '', alert: cur.title ?? K[1], sub: cur.sub ?? K[2], afx: cur.f }); flash('ok') }
  const useScene = () => { const s = cur.s, st = s.title.style === 'stack'
    onScene({ id: uid(), name: cur.name.split(' · ')[0], bg: '#000000', bg2: '', bgBlur: false, layers: [
      L('fxbg', { name: 'Background', x: 0.5, y: 0.5, w: 1, h: 1, fit: 'stretch', b: s.bg }), L('fxtext', { name: 'Title', x: 0.5, y: 0.42, w: 0.84, h: st ? 0.5 : 0.3, fit: 'stretch', b: s.title }),
      L('fxtext', { name: 'Subtitle', x: 0.5, y: 0.73, w: 0.62, h: 0.08, fit: 'stretch', b: s.sub }), ...(s.clock ? [L('fxtext', { name: 'Clock', x: 0.5, y: 0.87, w: 0.2, h: 0.08, fit: 'stretch', b: { text: '{time}', style: 'glow', font: FONTS[11][0], c1: s.bg.c1, color: '#ffffff' } })] : [])] }); flash('ok') }
  const useBanner = () => { onBanner(L('banner', { name: cur.b.title || 'Banner', x: 0.5, y: tall ? 0.92 : 0.87, w: 1, h: tall ? 0.12 : 0.26, fit: 'stretch', b: cur.b, src: cur.src || '' })); flash('ok') }

  return (
    <div className="flex-1 min-w-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <Wand2 size={18} className="text-zinc-400" /><h1 className="text-[18px] font-bold tracking-tight text-white mr-2">Overlays</h1>
          <div className="w-[460px]"><Segmented value={tab} onChange={t => { setTab(t); setFilter('all') }} options={tabs} /></div>
          <span className="ml-auto text-[12px] text-zinc-500">{tab === 'banner' ? BANNERS.length : tab === 'scene' ? SCENES.length : ALERTS.length} animated presets · click one to edit</span>
        </div>
        <div className="flex gap-1 px-5 pb-3 overflow-x-auto">{chips.map(([k, n]) => <button key={k} onClick={() => setFilter(k)} className={cx('shrink-0 h-7 px-3 rounded-lg text-[12px] font-medium', filter === k ? 'bg-accent text-white' : 'bg-[#242427] text-zinc-400 hover:text-white')}>{n}</button>)}</div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2.5">
            {tab === 'banner' && BANNERS.filter(p => filter === 'all' || p.b.tpl === filter).map(p => (
              <button key={p.name} onClick={() => setCur({ type: 'banner', name: p.name, b: { ...p.b }, src: '' })} className={cx('text-left rounded-xl overflow-hidden bg-[#242427] border transition-all hover:-translate-y-0.5', cur?.name === p.name ? 'border-white/60' : 'border-transparent hover:border-white/25')}>
                <Anim draw={bannerDraw(p.b)} className="w-full block" /><div className="px-3 py-2 text-[12px] font-medium text-zinc-200 truncate">{p.name}</div></button>))}
            {tab === 'scene' && SCENES.filter(p => filter === 'all' || p.kind === filter).map(p => (
              <button key={p.name} onClick={() => setCur({ type: 'scene', name: p.name, s: JSON.parse(JSON.stringify(p)) })} className={cx('text-left rounded-xl overflow-hidden bg-[#242427] border transition-all hover:-translate-y-0.5', cur?.name === p.name ? 'border-white/60' : 'border-transparent hover:border-white/25')}>
                <Anim draw={(c, w, h, t) => drawScenePreview(c, w, h, p, t)} className="w-full block" /><div className="px-3 py-2 text-[12px] font-medium text-zinc-200 truncate">{p.name}</div></button>))}
            {tab === 'alert' && ALERTS.filter(p => filter === 'all' || p.f.style === filter).map(p => (
              <button key={p.name} onClick={() => setCur({ type: 'alert', name: p.name, f: { ...p.f }, kind: 'superchat' })} className={cx('text-left rounded-xl overflow-hidden bg-[#242427] border transition-all hover:-translate-y-0.5', cur?.name === p.name ? 'border-white/60' : 'border-transparent hover:border-white/25')}>
                <Anim draw={alertDraw(p.f)} className="w-full block" /><div className="px-3 py-2 text-[12px] font-medium text-zinc-200 truncate">{p.name}</div></button>))}
          </div>
        </div>
      </div>

      {/* editor */}
      <aside className="w-[350px] shrink-0 overflow-y-auto border-l border-white/[0.06] p-2">
        {!cur ? <div className="h-full grid place-items-center text-center text-[12px] text-zinc-500 px-8">Pick a preset to edit its text, font, colours, glow and animation, then copy it into your scene.</div> : <>
          <div className="rounded-xl overflow-hidden ring-1 ring-white/10 mb-2">
            {cur.type === 'banner' && <Anim w={640} h={360} draw={bannerDraw(cur.b, img)} className="w-full block" />}
            {cur.type === 'scene' && <Anim w={640} h={360} draw={(c, w, h, t) => drawScenePreview(c, w, h, cur.s, t)} className="w-full block" />}
            {cur.type === 'alert' && <Anim w={640} h={360} draw={alertDraw(cur.f, cur.title ?? ALERT_KINDS[cur.kind][1], cur.sub ?? ALERT_KINDS[cur.kind][2])} className="w-full block" />}
            {cur.type === 'bg' && <Anim w={640} h={360} draw={(c, w, h, t) => drawBg(c, 0, 0, w, h, cur.b, t)} className="w-full block" />}
            {cur.type === 'text' && <Anim w={640} h={360} draw={(c, w, h, t) => { c.fillStyle = '#17171b'; c.fillRect(0, 0, w, h); drawText(c, w * 0.08, h * 0.25, w * 0.84, h * 0.5, cur.b, t) }} className="w-full block" />}
          </div>

          {cur.type === 'banner' && <>
            <Section title="Text">
              <Row label="Name"><Input value={cur.b.title} onChange={e => upB({ title: e.target.value })} /></Row>
              <Row label="Tagline"><Input value={cur.b.sub} onChange={e => upB({ sub: e.target.value })} /></Row>
              <Row label="Handle 1"><Input value={cur.b.h1} onChange={e => upB({ h1: e.target.value })} placeholder="IG @name" /></Row>
              <Row label="Handle 2"><Input value={cur.b.h2} onChange={e => upB({ h2: e.target.value })} placeholder="YT /name" /></Row>
              <Row label="Handle 3"><Input value={cur.b.h3} onChange={e => upB({ h3: e.target.value })} placeholder="Discord…" /></Row>
              {cur.b.tpl === 'neon' && <Row label="Pay tag / ID"><Input className="w-[70px]" value={cur.b.tag} onChange={e => upB({ tag: e.target.value })} /><Input value={cur.b.upi} onChange={e => upB({ upi: e.target.value })} placeholder="name@upi (empty hides)" /></Row>}
            </Section>
            <Section title="Style">
              <Row label="Layout"><Select className="flex-1" value={cur.b.tpl} onChange={tpl => upB({ tpl })} options={Object.entries(TPL_NAMES)} /></Row>
              <Looks v={cur.b} up={upB} anim />
              <Row label="Picture"><span className="flex-1 truncate text-[11px] text-zinc-400">{cur.src?.split(/[\\/]/).pop() || 'None (PNG with no background works best)'}</span>
                {cur.src && <Button variant="ghost" className="px-1.5" onClick={() => up({ src: '' })}><Trash2 size={12} /></Button>}
                <Button onClick={async () => { const f = await api.invoke('file:pick', 'image'); if (f) up({ src: f }) }}><ImageIcon size={12} />Choose</Button></Row>
            </Section>
          </>}

          {cur.type === 'scene' && <>
            <Section title="Text">
              <Row label="Title"><Input value={cur.s.title.text} onChange={e => up({ s: { ...cur.s, title: { ...cur.s.title, text: e.target.value } } })} /></Row>
              <Row label="Second line"><Input value={cur.s.sub.text} onChange={e => up({ s: { ...cur.s, sub: { ...cur.s.sub, text: e.target.value } } })} /></Row>
              <Row label="Title effect"><Select className="flex-1" value={cur.s.title.style} onChange={style => up({ s: { ...cur.s, title: { ...cur.s.title, style } } })} options={Object.entries(TX_NAMES)} /></Row>
              <Row label="Second line effect"><Select className="flex-1" value={cur.s.sub.style} onChange={style => up({ s: { ...cur.s, sub: { ...cur.s.sub, style } } })} options={Object.entries(TX_NAMES)} /></Row>
              <Row label="Show clock"><Switch checked={!!cur.s.clock} onChange={clock => up({ s: { ...cur.s, clock } })} /></Row>
            </Section>
            <Section title="Style">
              <Row label="Background"><Select className="flex-1" value={cur.s.bg.style} onChange={style => up({ s: { ...cur.s, bg: { ...cur.s.bg, style } } })} options={Object.entries(BG_NAMES)} /></Row>
              <Looks v={{ ...cur.s.title, c2: cur.s.bg.c2 }} up={p => up({ s: { ...cur.s, title: { ...cur.s.title, ...p }, sub: { ...cur.s.sub, ...(p.c1 ? { c1: p.c1 } : {}) }, bg: { ...cur.s.bg, ...(p.c1 ? { c1: p.c1 } : {}), ...(p.c2 ? { c2: p.c2 } : {}) } } })} />
            </Section>
          </>}

          {cur.type === 'alert' && <>
            <Section title="When">
              <Row label="Show on"><Select className="flex-1" value={cur.kind} onChange={kind => up({ kind, title: undefined, sub: undefined })} options={Object.entries(ALERT_KINDS).map(([k, v]) => [k, v[0]])} /></Row>
              <Row label="Title"><Input value={cur.title ?? ALERT_KINDS[cur.kind][1]} onChange={e => up({ title: e.target.value })} /></Row>
              <Row label="Second line"><Input value={cur.sub ?? ALERT_KINDS[cur.kind][2]} onChange={e => up({ sub: e.target.value })} /></Row>
            </Section>
            <Section title="Style">
              <Row label="Effect"><Select className="flex-1" value={cur.f.style} onChange={style => up({ f: { ...cur.f, style } })} options={Object.entries(AFX_NAMES)} /></Row>
              <Looks v={cur.f} up={p => up({ f: { ...cur.f, ...p } })} />
            </Section>
          </>}

          {cur.type === 'bg' && <Section title="Animated background"><Row label="Style"><Select className="flex-1" value={cur.b.style} onChange={style => upB({ style })} options={Object.entries(BG_NAMES)} /></Row>
            <Row label="Colours"><Color value={cur.b.c1} onChange={c1 => upB({ c1 })} /><Color value={cur.b.c2} onChange={c2 => upB({ c2 })} /></Row></Section>}
          {cur.type === 'text' && <Section title="Animated text"><Row label="Text"><Input value={cur.b.text} onChange={e => upB({ text: e.target.value })} /></Row>
            <Row label="Effect"><Select className="flex-1" value={cur.b.style} onChange={style => upB({ style })} options={Object.entries(TX_NAMES)} /></Row>
            <Row label="Text colour"><Color value={cur.b.color || '#ffffff'} onChange={color => upB({ color })} /></Row><Looks v={cur.b} up={upB} /></Section>}

          <div className="sticky bottom-0 pt-1 pb-1 bg-[#1a1a1c]">
            {editing ? <Button variant="primary" className="w-full h-10 !bg-white !text-black" onClick={() => onSave(editing.id, cur.type === 'banner' ? { b: cur.b, src: cur.src } : { b: cur.b })}><Save size={14} />Save to scene</Button>
              : <Button variant="primary" className="w-full h-10 !bg-white !text-black" onClick={cur.type === 'banner' ? useBanner : cur.type === 'scene' ? useScene : useAlert}>
                {done ? <><Check size={14} />Added</> : cur.type === 'banner' ? <><Copy size={14} />Copy to scene</> : cur.type === 'scene' ? <><Download size={14} />Import scene</> : <><Download size={14} />Import to scene</>}</Button>}
          </div>
        </>}
      </aside>
    </div>
  )
}
