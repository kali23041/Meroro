// Keys page: emulator-style key mapping. Toolbox of control types, live phone picture with gamepad markers, and an inspector.
import { useEffect, useRef, useState } from 'react'
import { Gamepad2, Trash2, RotateCcw, Copy, Move, Crosshair, MousePointerClick, ArrowUpRight, Target, Repeat, ToggleRight, Eye, Sparkle, ListOrdered, Plus, MousePointer2, X, ScanEye, Check } from 'lucide-react'
import { Button, Segmented, Select, Input, Switch, Slider, Row, Section, cx } from './ui'
import { KEYMAPS, KINDS, MAP_DEFAULTS, PAD, newItem, combo, keyName, uidK, samplePts, matchTrigger } from './keymap'

const ICON = { tap: MousePointerClick, joystick: Move, look: Crosshair, fire: Target, repeat: Repeat, toggle: ToggleRight, freelook: Eye, skill: Sparkle, swipe: ArrowUpRight, macro: ListOrdered }
export const kindOf = it => it.type !== 'tap' ? it.type : it.kind === 'fire' || it.key === 'MouseLeft' ? 'fire' : it.mode === 'repeat' ? 'repeat' : it.mode === 'toggle' ? 'toggle' : 'tap'
const short = k => keyName(k).replace('Mouse Left', 'LMB').replace('Mouse Right', 'RMB').replace('Mouse Middle', 'MMB').replace('Wheel Up', 'WH↑').replace('Wheel Down', 'WH↓').replace('Backquote', '`').replace('Space', '␣').replace('Shift+', '⇧').replace('Ctrl+', '⌃').replace('Alt+', '⌥')

// Click, then press a key / mouse button (with Shift/Ctrl/Alt for combos like Shift+W).
export function KeyCap({ value, onChange, plain }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!on) return
    const k = e => { e.preventDefault(); e.stopPropagation(); if (e.code === 'Escape') return setOn(false); if (!plain && /^(Shift|Control|Alt|Meta)/.test(e.code) && e.type === 'keydown') return; onChange(plain ? e.code : combo(e)); setOn(false) }
    const up = e => { if (/^(Shift|Control|Alt)/.test(e.code)) { onChange(e.code); setOn(false) } }
    const m = e => { e.preventDefault(); onChange(['MouseLeft', 'MouseMiddle', 'MouseRight'][e.button]); setOn(false) }
    const w = e => { onChange(e.deltaY < 0 ? 'WheelUp' : 'WheelDown'); setOn(false) }
    addEventListener('keydown', k, true); addEventListener('keyup', up, true); addEventListener('mousedown', m, true); addEventListener('wheel', w, true)
    let raf; const pad = () => { for (const g of navigator.getGamepads?.() || []) { const i = g?.buttons.findIndex(b => b.pressed); if (i >= 0) { onChange('Pad' + (PAD[i] || i)); setOn(false); return } } raf = requestAnimationFrame(pad) }; pad()
    return () => { cancelAnimationFrame(raf); removeEventListener('keydown', k, true); removeEventListener('keyup', up, true); removeEventListener('mousedown', m, true); removeEventListener('wheel', w, true) }
  }, [on])
  return <button onClick={() => setOn(true)} className={cx('h-8 min-w-[92px] px-2.5 rounded-lg text-[12px] font-semibold', on ? 'bg-white text-black animate-pulse' : 'bg-[#323236] text-zinc-100 hover:bg-[#3a3a3f]')}>{on ? 'Press a key…' : keyName(value)}</button>
}

// One gamepad marker on the phone picture.
const cap = (sel, dup) => cx('grid place-items-center rounded-full border text-white font-semibold shadow-lg backdrop-blur-sm select-none transition-[box-shadow,background-color] duration-150',
  sel ? 'bg-white/25 border-white ring-2 ring-white/60' : dup ? 'bg-amber-500/40 border-amber-300' : 'bg-black/60 border-white/45 hover:border-white/80')
function Marker({ it, sel, dup, bw, bh, op }) {
  const k = kindOf(it), I = ICON[k]
  if (k === 'joystick') {
    const d = it.r * bh * 2, c = (key, cls) => <span className={cx('absolute size-7 -translate-x-1/2 -translate-y-1/2 text-[11px]', cap(false, false), cls)}>{short(key)}</span>
    return <div className="relative" style={{ width: d, height: d, opacity: op }}>
      <div className={cx('absolute inset-0 rounded-full border-2 border-dashed', sel ? 'border-white bg-white/10' : 'border-white/45 bg-black/25')} />
      <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
      {c(it.up, 'left-1/2 top-0')}{c(it.left, 'left-0 top-1/2')}{c(it.down, 'left-1/2 top-full')}{c(it.right, 'left-full top-1/2')}
      {it.sprint && <span className="absolute left-1/2 top-full mt-5 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-200">{short(it.sprint)} sprint</span>}
    </div>
  }
  if (k === 'look') return <div className={cx('size-16 text-[10px] flex-col gap-0.5', cap(sel, dup))} style={{ opacity: op }}><Crosshair size={18} />Aim</div>
  if (k === 'skill') return <div className="relative grid place-items-center" style={{ width: it.r * bh * 2, height: it.r * bh * 2, opacity: op }}>
    <div className="absolute inset-0 rounded-full border border-dashed border-white/35" /><span className={cx('size-10 text-[12px]', cap(sel, dup))}>{short(it.key)}</span></div>
  if (k === 'swipe') { const dx = it.dx * bw, dy = it.dy * bh, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx)
    return <div className="relative" style={{ opacity: op }}>
      <span className="absolute left-1/2 top-1/2 h-[2px] origin-left bg-white/60" style={{ width: len, transform: `rotate(${a}rad)` }}><span className="absolute -right-1 -top-[5px] size-3 rotate-45 border-r-2 border-t-2 border-white/70" /></span>
      <span className={cx('relative size-9 text-[11px]', cap(sel, dup))}>{short(it.key)}</span></div> }
  return <div className={cx('relative size-9 text-[11px]', k === 'macro' && 'rounded-xl', cap(sel, dup))} style={{ opacity: op }}>
    {short(it.key) === 'Unset' ? <I size={14} /> : short(it.key).slice(0, 5)}
    {k !== 'tap' && <span className="absolute -right-1 -top-1 size-4 rounded-full bg-white text-black grid place-items-center"><I size={9} strokeWidth={2.5} /></span>}
  </div>
}

export default function Keys({ s, set, eng, focus, apps }) {
  const maps = s.keymaps, id = maps[s.keymapId] ? s.keymapId : Object.keys(maps)[0], map = { ...MAP_DEFAULTS, ...maps[id] }
  const [sel, setSel] = useState(''), box = useRef(), cv = useRef(), drag = useRef(null), [bs, setBs] = useState([1, 1]), [ar, setAr] = useState(20 / 9)
  const it = map.items.find(i => i.id === sel)
  const upMap = p => set({ keymaps: { ...maps, [id]: { ...maps[id], ...p } } })
  const up = (iid, p) => upMap({ items: map.items.map(i => i.id === iid ? { ...i, ...p } : i) })

  useEffect(() => { // live phone picture behind the markers
    const draw = () => { const f = eng.current?.frame, c = cv.current; if (!f || !c) return; c.width = 640; c.height = 640 * f.displayHeight / f.displayWidth; setAr(f.displayWidth / f.displayHeight); try { c.getContext('2d').drawImage(f, 0, 0, c.width, c.height) } catch {} }
    draw(); const t = setInterval(draw, 400); return () => clearInterval(t)
  }, [])
  useEffect(() => { const o = new ResizeObserver(([e]) => setBs([e.contentRect.width, e.contentRect.height])); box.current && o.observe(box.current); return () => o.disconnect() }, [])
  const pos = e => { const b = box.current.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), Math.max(0, Math.min(1, (e.clientY - b.top) / b.height))] }
  const add = type => { if ((type === 'joystick' || type === 'look') && map.items.some(i => i.type === type)) return; const n = newItem(type); upMap({ items: [...map.items, n] }); setSel(n.id) }
  const dupKeys = map.items.filter(i => i.key && map.items.some(j => j !== i && j.key === i.key)).map(i => i.id)
  const k = it && kindOf(it)
  // screen triggers: record colours of a few spots while a menu (crate, map, bag) is open on the phone
  const trs = map.triggers || [], [pick, setPick] = useState(''), [live, setLive] = useState({})
  const upT = (tid, p) => upMap({ triggers: trs.map(t => t.id === tid ? { ...t, ...p } : t) })
  useEffect(() => { const t = setInterval(() => { const f = eng.current?.frame; if (f) setLive(Object.fromEntries(trs.filter(x => x.points?.length).map(x => [x.id, matchTrigger(f, x)]))) }, 300); return () => clearInterval(t) }, [trs])
  const addSpot = e => { const f = eng.current?.frame, tr = trs.find(t => t.id === pick); if (!f || !tr || tr.points.length >= 4) return; const [x, y] = pos(e), c = samplePts(f, [{ x, y }])?.[0]; if (c) upT(pick, { points: [...tr.points, { x: +x.toFixed(3), y: +y.toFixed(3), c }] }) }
  const pickT = trs.find(t => t.id === pick)

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Gamepad2 size={18} className="text-zinc-400" />
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
          {Object.entries(maps).map(([key, m]) => (
            <button key={key} onClick={() => { set({ keymapId: key }); setSel('') }} className={cx('shrink-0 h-8 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5', key === id ? 'bg-accent text-white' : 'bg-[#242427] text-zinc-400 hover:text-white')}>
              {m.name}{m.pkg && m.pkg === focus && <span className="size-1.5 rounded-full bg-emerald-400 live-dot" />}
            </button>
          ))}
          <Button className="shrink-0 h-8" title="Duplicate map" onClick={() => { const n = uidK(); set({ keymaps: { ...maps, [n]: { ...maps[id], name: map.name + ' copy', items: map.items.map(i => ({ ...i, id: uidK() })) } }, keymapId: n }) }}><Copy size={12} />Duplicate</Button>
        </div>
        <span className="text-[12px] text-zinc-400">Game controls</span><Switch checked={!!s.keymapOn} onChange={keymapOn => set({ keymapOn, ...(keymapOn ? { control: true } : {}) })} />
        <span className="ml-2 text-[12px] text-zinc-400">Auto-pick</span><Switch checked={s.keymapAuto !== false} onChange={keymapAuto => set({ keymapAuto })} />
      </div>

      <div className="flex-1 min-h-0 flex gap-2 px-2 pb-2">
        {/* toolbox + map settings */}
        <aside className="w-[230px] shrink-0 overflow-y-auto">
          <Section title="Add control">
            <div className="grid grid-cols-2 gap-1">
              {KINDS.map(([t, name, desc]) => { const I = ICON[t], off = (t === 'joystick' || t === 'look') && map.items.some(i => i.type === t); return (
                <button key={t} disabled={off} onClick={() => add(t)} title={desc} className="flex flex-col items-start gap-1 rounded-lg bg-[#323236] hover:bg-[#3a3a3f] p-2 text-left disabled:opacity-35 transition-colors">
                  <I size={14} className="text-zinc-300" /><span className="text-[11px] font-medium leading-tight text-zinc-100">{name}</span>
                </button>) })}
            </div>
          </Section>
          <Section title="Screen triggers" right={<button className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10" title="Add trigger" onClick={() => { const n = { id: uidK(), label: 'Crate open', points: [], tol: 40, on: true }; upMap({ triggers: [...trs, n] }); setPick(n.id) }}><Plus size={13} /></button>}>
            {!trs.length && <div className="text-[11px] leading-relaxed text-zinc-500">Free the mouse by itself when a crate, map or bag opens. Press + and click spots of the open screen.</div>}
            {trs.map(t => (
              <div key={t.id} className="rounded-lg bg-[#2c2c30] p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Switch checked={t.on !== false} onChange={on => upT(t.id, { on })} />
                  <Input className="h-7 flex-1 min-w-0" value={t.label} onChange={e => upT(t.id, { label: e.target.value })} />
                  <span title={live[t.id] ? 'Matches the phone right now' : 'Not on screen now'} className={cx('size-2 shrink-0 rounded-full', live[t.id] ? 'bg-emerald-400' : 'bg-zinc-600')} />
                  <button className="p-1 rounded text-zinc-500 hover:text-white" title="Delete" onClick={() => { upMap({ triggers: trs.filter(x => x.id !== t.id) }); pick === t.id && setPick('') }}><Trash2 size={12} /></button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button className={cx('h-7 px-2', pick === t.id && '!bg-white !text-black')} onClick={() => setPick(pick === t.id ? '' : t.id)}><ScanEye size={12} />{t.points.length ? `${t.points.length} spots` : 'Pick spots'}</Button>
                  <Slider value={t.tol || 40} onChange={tol => upT(t.id, { tol })} min={10} max={100} step={1} format={v => 'Tol ' + Math.round(v)} />
                </div>
              </div>
            ))}
          </Section>
          <Section title="Map settings">
            <Row label="Name"><Input value={map.name} onChange={e => upMap({ name: e.target.value })} /></Row>
            <Row label="Game"><Select className="flex-1 min-w-0" value={map.pkg || ''} onChange={pkg => upMap({ pkg })} options={[['', 'Any game'], ...(apps || []).filter(a => !a.system).map(a => [a.pkg, a.name]), ...(map.pkg && !apps?.some(a => a.pkg === map.pkg) ? [[map.pkg, map.pkg]] : [])]} /></Row>
            <Row label="Mouse speed"><Slider value={map.sens} onChange={sens => upMap({ sens })} min={0.2} max={3} step={0.05} format={v => v.toFixed(2) + '×'} /></Row>
            <Row label="Key hints"><Switch checked={map.hints} onChange={hints => upMap({ hints })} /></Row>
            <Row label="Hint opacity"><Slider value={map.overlay} onChange={overlay => upMap({ overlay })} min={0.1} max={1} /></Row>
            <Row label="Free cursor"><KeyCap plain value={map.cursorKey} onChange={cursorKey => upMap({ cursorKey })} /></Row>
            <div className="flex gap-1 pt-1">
              {KEYMAPS[id] ? <Button className="flex-1 h-8" onClick={() => { upMap({ items: KEYMAPS[id].items.map(i => ({ ...i })) }); setSel('') }}><RotateCcw size={12} />Reset</Button>
                : <Button className="flex-1 h-8" onClick={() => { const { [id]: _, ...rest } = maps; set({ keymaps: rest, keymapId: Object.keys(rest)[0] }) }}><Trash2 size={12} />Delete map</Button>}
            </div>
          </Section>
        </aside>

        {/* phone picture with gamepad markers */}
        <div className="flex-1 min-w-0 grid place-items-center rounded-2xl bg-black/50 p-4" onPointerDown={e => e.target === e.currentTarget && setSel('')}>
          <div ref={box} className="relative max-w-full max-h-full rounded-xl overflow-hidden ring-1 ring-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900" style={{ aspectRatio: ar, height: ar > 1 ? undefined : '100%', width: ar > 1 ? '100%' : undefined }}
            onPointerMove={e => { if (drag.current) { const [x, y] = pos(e); up(drag.current, { x: +x.toFixed(3), y: +y.toFixed(3) }) } }} onPointerUp={() => { drag.current = null }} onPointerLeave={() => { drag.current = null }}
            onPointerDown={e => e.target === e.currentTarget || e.target.tagName === 'CANVAS' ? (pick ? addSpot(e) : setSel('')) : null}>
            <canvas ref={cv} className="absolute inset-0 w-full h-full opacity-60" />
            {map.items.map(i => (
              <div key={i.id} onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setSel(i.id); drag.current = i.id }} title={i.label}
                className={cx('absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing', i.id === sel && 'z-10')} style={{ left: i.x * 100 + '%', top: i.y * 100 + '%' }}>
                <Marker it={i} sel={i.id === sel} dup={dupKeys.includes(i.id)} bw={bs[0]} bh={bs[1]} op={1} />
              </div>
            ))}
            {pickT && pickT.points.map((p, n) => <span key={n} className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg pointer-events-none" style={{ left: p.x * 100 + '%', top: p.y * 100 + '%', background: `rgb(${p.c.join(',')})` }} />)}
            {pickT && <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-black/80 pl-3 pr-1 py-1 text-[11px] text-zinc-200">
              <ScanEye size={12} />Open it on the phone, then click 1–4 spots that only look like this when it’s open ({pickT.points.length}/4)
              {pickT.points.length > 0 && <Button className="h-6 px-2" onClick={() => upT(pick, { points: [] })}>Clear</Button>}
              <Button variant="primary" className="h-6 px-2" onClick={() => setPick('')}><Check size={11} />Done</Button></div>}
            <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-zinc-300 pointer-events-none flex items-center gap-1.5"><MousePointer2 size={11} />Drag markers onto the game's buttons · {keyName(map.cursorKey)} frees the cursor while playing</div>
          </div>
        </div>

        {/* inspector */}
        <aside className="w-[290px] shrink-0 overflow-y-auto">
          {it ? <Section title={KINDS.find(x => x[0] === k)?.[1] || 'Control'} right={<>
            <button className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10" title="Duplicate" onClick={() => { const n = { ...it, id: uidK(), x: Math.min(1, it.x + 0.04), y: Math.min(1, it.y + 0.04) }; upMap({ items: [...map.items, n] }); setSel(n.id) }}><Copy size={12} /></button>
            <button className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10" title="Delete" onClick={() => { upMap({ items: map.items.filter(i => i.id !== it.id) }); setSel('') }}><Trash2 size={12} /></button>
            <button className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10" title="Close" onClick={() => setSel('')}><X size={12} /></button></>}>
            <Row label="Label"><Input value={it.label} onChange={e => up(it.id, { label: e.target.value })} /></Row>
            {it.type === 'tap' && <>
              <Row label="Key"><KeyCap value={it.key} onChange={key => up(it.id, { key })} /></Row>
              <Segmented value={it.mode || 'hold'} onChange={m => up(it.id, { mode: m === 'hold' ? undefined : m, ...(m === 'repeat' && !it.rate ? { rate: 90 } : {}) })} options={[['hold', 'Hold'], ['tap', 'Tap'], ['toggle', 'Toggle'], ['repeat', 'Rapid']]} />
              <Row label="Frees the mouse"><Switch checked={!!it.cursor} onChange={cursor => up(it.id, { cursor })} /></Row>
              {it.mode === 'repeat' && <Row label="Speed"><Slider value={it.rate || 90} onChange={rate => up(it.id, { rate })} min={40} max={400} step={10} format={v => Math.round(1000 / v) + ' taps/s'} /></Row>}
            </>}
            {it.type === 'swipe' && <><Row label="Key"><KeyCap value={it.key} onChange={key => up(it.id, { key })} /></Row>
              <Row label="Swipe X"><Slider value={it.dx} onChange={dx => up(it.id, { dx })} min={-0.5} max={0.5} /></Row><Row label="Swipe Y"><Slider value={it.dy} onChange={dy => up(it.id, { dy })} min={-0.5} max={0.5} /></Row></>}
            {it.type === 'joystick' && <>
              {[['up', 'Forward'], ['left', 'Left'], ['down', 'Back'], ['right', 'Right'], ['sprint', 'Sprint (hold)'], ['walk', 'Walk slow (hold)']].map(([f, t]) => <Row key={f} label={t}><KeyCap plain value={it[f]} onChange={v => up(it.id, { [f]: v })} /></Row>)}
              <Row label="Stick size"><Slider value={it.r} onChange={r => up(it.id, { r })} min={0.04} max={0.2} /></Row>
              <Row label="Sprint push"><Slider value={it.mul} onChange={mul => up(it.id, { mul })} min={1} max={4} step={0.1} format={v => v.toFixed(1) + '×'} /></Row>
            </>}
            {it.type === 'look' && <>
              <Row label="Sensitivity X"><Slider value={it.sens} onChange={sens => up(it.id, { sens })} min={0.2} max={4} step={0.05} format={v => v.toFixed(2)} /></Row>
              <Row label="Sensitivity Y"><Slider value={it.sensY ?? it.sens} onChange={sensY => up(it.id, { sensY })} min={0.2} max={4} step={0.05} format={v => v.toFixed(2)} /></Row>
              <Row label="Acceleration"><Slider value={it.accel || 0} onChange={accel => up(it.id, { accel })} /></Row>
              <Row label="Swipe room"><Slider value={it.range || 0.22} onChange={range => up(it.id, { range })} min={0.1} max={0.4} /></Row>
              <Row label="Invert Y"><Switch checked={!!it.invert} onChange={invert => up(it.id, { invert })} /></Row>
            </>}
            {it.type === 'freelook' && <><Row label="Hold key"><KeyCap value={it.key} onChange={key => up(it.id, { key })} /></Row>
              <Row label="Sensitivity"><Slider value={it.sens || 1} onChange={sens => up(it.id, { sens })} min={0.2} max={4} step={0.05} format={v => v.toFixed(2)} /></Row></>}
            {it.type === 'skill' && <><Row label="Key"><KeyCap value={it.key} onChange={key => up(it.id, { key })} /></Row>
              <Row label="Aim range"><Slider value={it.r} onChange={r => up(it.id, { r })} min={0.05} max={0.3} /></Row></>}
            {it.type === 'macro' && <>
              <Row label="Key"><KeyCap value={it.key} onChange={key => up(it.id, { key })} /></Row>
              {(it.steps || []).map((st, n) => (
                <div key={n} className="flex items-center gap-1">
                  <span className="w-4 text-[11px] text-zinc-500">{n + 1}</span>
                  <Select className="flex-1 min-w-0" value={st.ref} onChange={ref => up(it.id, { steps: it.steps.map((x, j) => j === n ? { ...x, ref } : x) })} options={[['', 'Tap…'], ...map.items.filter(i => i.type === 'tap').map(i => [i.id, i.label])]} />
                  <Input className="w-[58px]" type="number" value={st.wait ?? 60} onChange={e => up(it.id, { steps: it.steps.map((x, j) => j === n ? { ...x, wait: +e.target.value } : x) })} title="Wait after (ms)" />
                  <button className="p-1 text-zinc-500 hover:text-white" onClick={() => up(it.id, { steps: it.steps.filter((_, j) => j !== n) })}><X size={12} /></button>
                </div>
              ))}
              <Button className="w-full h-8" onClick={() => up(it.id, { steps: [...(it.steps || []), { ref: '', hold: 40, wait: 60 }] })}><Plus size={12} />Add step</Button>
            </>}
            {dupKeys.includes(it.id) && <p className="text-[11px] text-amber-400">This key is also used by another control.</p>}
          </Section> : null}
          <Section title={`Controls · ${map.items.length}`}>
            {map.items.map(i => { const I = ICON[kindOf(i)]; return (
              <button key={i.id} onClick={() => setSel(i.id)} className={cx('w-full flex items-center gap-2 rounded-md px-1.5 h-7 text-left text-[12px]', i.id === sel ? 'bg-accent text-white' : 'hover:bg-white/5')}>
                <I size={12} className="text-zinc-500 shrink-0" /><span className="flex-1 truncate">{i.label}</span>
                <span className={cx('text-[11px] font-semibold', dupKeys.includes(i.id) ? 'text-amber-400' : 'text-zinc-300')}>{i.type === 'joystick' ? short(i.up) + short(i.left) + short(i.down) + short(i.right) : i.type === 'look' ? 'Mouse' : keyName(i.key)}</span>
              </button>) })}
          </Section>
        </aside>
      </div>
    </div>
  )
}

// Key hints drawn over the Studio preview while game controls are on.
export function KeyHints({ eng, canvas, map }) {
  const outer = useRef(), inner = useRef(), [bs, setBs] = useState([1, 1])
  useEffect(() => {
    let raf
    const tick = () => {
      const E = eng.current, c = canvas.current, g = E && Object.values(E.geo).reverse().find(g => g.phone), f = E?.frame, o = outer.current, n = inner.current
      if (o && n) {
        o.style.display = g && f && c ? 'block' : 'none'
        if (g && f && c) {
          const k = c.clientWidth / c.width, fx = g.w / g.sw, fy = g.h / g.sh
          Object.assign(o.style, { left: c.offsetLeft + (g.cx - g.w / 2) * k + 'px', top: c.offsetTop + (g.cy - g.h / 2) * k + 'px', width: g.w * k + 'px', height: g.h * k + 'px' })
          const w = f.displayWidth * fx * k, h = f.displayHeight * fy * k
          Object.assign(n.style, { left: -g.sx * fx * k + 'px', top: -g.sy * fy * k + 'px', width: w + 'px', height: h + 'px' })
          if (Math.abs(w - bs[0]) > 2 || Math.abs(h - bs[1]) > 2) setBs([w, h])
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [bs])
  return (
    <div ref={outer} className="absolute overflow-hidden pointer-events-none">
      <div ref={inner} className="absolute">
        {map.items.map(i => <div key={i.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: i.x * 100 + '%', top: i.y * 100 + '%' }}><Marker it={i} bw={bs[0]} bh={bs[1]} op={map.overlay ?? 0.55} /></div>)}
      </div>
    </div>
  )
}
