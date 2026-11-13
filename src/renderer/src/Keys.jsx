// Keys page: per-game key maps with a visual editor over the live phone picture, plus a short guide.
import { useEffect, useRef, useState } from 'react'
import { Gamepad2, Plus, Trash2, RotateCcw, Copy, Keyboard, Mouse, Move, Crosshair, MousePointerClick, ArrowUpRight } from 'lucide-react'
import { Button, Segmented, Select, Input, Switch, Slider, Row, cx } from './ui'
import { KEYMAPS, newItem, combo, keyName, uidK } from './keymap'

const ICON = { tap: MousePointerClick, joystick: Move, look: Crosshair, swipe: ArrowUpRight }

// Click, then press a key / mouse button (with Shift/Ctrl/Alt for combos like Shift+W).
function KeyCap({ value, onChange, plain }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!on) return
    const k = e => { e.preventDefault(); e.stopPropagation(); if (e.code === 'Escape') return setOn(false); if (!plain && /^(Shift|Control|Alt|Meta)/.test(e.code) && e.type === 'keydown') return; onChange(plain ? e.code : combo(e)); setOn(false) }
    const up = e => { if (/^(Shift|Control|Alt)/.test(e.code)) { onChange(e.code); setOn(false) } } // a modifier pressed alone
    const m = e => { e.preventDefault(); onChange(['MouseLeft', 'MouseMiddle', 'MouseRight'][e.button]); setOn(false) }
    const w = e => { onChange(e.deltaY < 0 ? 'WheelUp' : 'WheelDown'); setOn(false) }
    addEventListener('keydown', k, true); addEventListener('keyup', up, true); addEventListener('mousedown', m, true); addEventListener('wheel', w, true)
    return () => { removeEventListener('keydown', k, true); removeEventListener('keyup', up, true); removeEventListener('mousedown', m, true); removeEventListener('wheel', w, true) }
  }, [on])
  return <button onClick={() => setOn(true)} className={cx('h-7 min-w-[86px] px-2 rounded-md border text-[12px] font-semibold', on ? 'border-violet-400 bg-violet-500/20 text-white animate-pulse' : 'border-white/10 bg-black/40 text-zinc-100 hover:border-white/25')}>{on ? 'Press a key…' : keyName(value)}</button>
}

export default function Keys({ s, set, eng, focus, apps }) {
  const maps = s.keymaps, id = maps[s.keymapId] ? s.keymapId : Object.keys(maps)[0], map = maps[id]
  const [sel, setSel] = useState(''), box = useRef(), cv = useRef(), drag = useRef(null)
  const it = map.items.find(i => i.id === sel)
  const upMap = p => set({ keymaps: { ...maps, [id]: { ...map, ...p } } })
  const up = (iid, p) => upMap({ items: map.items.map(i => i.id === iid ? { ...i, ...p } : i) })
  const [ar, setAr] = useState(20 / 9)

  useEffect(() => { // live phone picture behind the markers
    const draw = () => { const f = eng.current?.frame, c = cv.current; if (!f || !c) return; c.width = 640; c.height = 640 * f.displayHeight / f.displayWidth; setAr(f.displayWidth / f.displayHeight); try { c.getContext('2d').drawImage(f, 0, 0, c.width, c.height) } catch {} }
    draw(); const t = setInterval(draw, 400); return () => clearInterval(t)
  }, [])
  const pos = e => { const b = box.current.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), Math.max(0, Math.min(1, (e.clientY - b.top) / b.height))] }
  const add = type => { const n = newItem(type); upMap({ items: [...map.items, n] }); setSel(n.id) }
  const dupKeys = map.items.filter(i => i.key && map.items.some(j => j !== i && j.key === i.key)).map(i => i.id)

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-3 px-6 pt-5 pb-4">
        <div className="flex-1"><h1 className="text-[20px] font-bold tracking-tight text-white">Key mapping</h1>
          <p className="text-[12px] text-zinc-500">Play phone games with keyboard and mouse. Each marker is a finger that taps where you put it.</p></div>
        <span className="text-[12px] text-zinc-400">Game controls</span><Switch checked={!!s.keymapOn} onChange={keymapOn => set({ keymapOn, ...(keymapOn ? { control: true } : {}) })} />
        <span className="ml-3 text-[12px] text-zinc-400">Auto-pick by game</span><Switch checked={s.keymapAuto !== false} onChange={keymapAuto => set({ keymapAuto })} />
      </div>
      <div className="flex-1 min-h-0 flex gap-4 px-6 pb-6">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(maps).map(([k, m]) => (
              <button key={k} onClick={() => { set({ keymapId: k }); setSel('') }} className={cx('h-8 px-3 rounded-lg border text-[12px] font-medium flex items-center gap-1.5', k === id ? 'bg-white/[0.14] border-white/30 text-white' : 'border-white/[0.08] text-zinc-400 hover:text-white')}>
                <Gamepad2 size={13} />{m.name}{m.pkg && m.pkg === focus && <span className="size-1.5 rounded-full bg-emerald-400 live-dot" />}
              </button>
            ))}
            <Button className="h-8" onClick={() => { const k = uidK(); set({ keymaps: { ...maps, [k]: { ...map, name: map.name + ' copy', items: map.items.map(i => ({ ...i, id: uidK() })) } }, keymapId: k }) }}><Copy size={12} />Duplicate</Button>
          </div>
          <div className="flex-1 min-h-0 grid place-items-center rounded-xl bg-black/40 border border-white/[0.06] p-3">
            <div ref={box} className="relative max-w-full max-h-full rounded-lg overflow-hidden ring-1 ring-white/10 bg-gradient-to-br from-slate-800 to-indigo-950" style={{ aspectRatio: ar, height: ar > 1 ? undefined : '100%', width: ar > 1 ? '100%' : undefined }}
              onPointerMove={e => { if (drag.current) { const [x, y] = pos(e); up(drag.current, { x: +x.toFixed(3), y: +y.toFixed(3) }) } }} onPointerUp={() => { drag.current = null }} onPointerLeave={() => { drag.current = null }}>
              <canvas ref={cv} className="absolute inset-0 w-full h-full opacity-70" />
              {map.items.map(i => {
                const I = ICON[i.type], big = i.type === 'joystick' || i.type === 'look'
                return (
                  <button key={i.id} onPointerDown={e => { e.preventDefault(); setSel(i.id); drag.current = i.id }} title={i.label}
                    className={cx('absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 grid place-items-center text-[10px] font-bold cursor-grab select-none',
                      i.id === sel ? 'border-white bg-violet-500 text-white z-10' : dupKeys.includes(i.id) ? 'border-amber-300 bg-amber-500/60 text-white' : 'border-violet-300/80 bg-black/60 text-violet-100')}
                    style={{ left: i.x * 100 + '%', top: i.y * 100 + '%', width: big ? 64 : 34, height: big ? 64 : 34 }}>
                    {big ? <span className="flex flex-col items-center leading-none gap-0.5"><I size={14} />{i.type === 'joystick' ? 'WASD' : 'Mouse'}</span> : keyName(i.key).slice(0, 5)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 mr-1">Add</span>
            <Button onClick={() => add('tap')}><MousePointerClick size={12} />Button</Button>
            <Button onClick={() => add('joystick')} disabled={map.items.some(i => i.type === 'joystick')}><Move size={12} />Joystick</Button>
            <Button onClick={() => add('look')} disabled={map.items.some(i => i.type === 'look')}><Crosshair size={12} />Mouse aim</Button>
            <Button onClick={() => add('swipe')}><ArrowUpRight size={12} />Swipe</Button>
            <div className="flex-1" />
            {KEYMAPS[id] && <Button variant="ghost" onClick={() => { upMap({ items: KEYMAPS[id].items.map(i => ({ ...i })) }); setSel('') }}><RotateCcw size={12} />Reset to default</Button>}
            {!KEYMAPS[id] && <Button variant="ghost" onClick={() => { const { [id]: _, ...rest } = maps; set({ keymaps: rest, keymapId: Object.keys(rest)[0] }) }}><Trash2 size={12} />Delete map</Button>}
          </div>
        </div>

        <aside className="w-[310px] shrink-0 overflow-y-auto space-y-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
            <Row label="Map name"><Input value={map.name} onChange={e => upMap({ name: e.target.value })} /></Row>
            <Row label="Game"><Select className="flex-1" value={map.pkg || ''} onChange={pkg => upMap({ pkg })} options={[['', 'Any game'], ...(apps || []).filter(a => !a.system).map(a => [a.pkg, a.name]), ...(map.pkg && !apps?.some(a => a.pkg === map.pkg) ? [[map.pkg, map.pkg]] : [])]} /></Row>
          </div>
          {it ? <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
            <div className="flex items-center gap-2"><Input value={it.label} onChange={e => up(it.id, { label: e.target.value })} /><Button variant="ghost" className="px-1.5" onClick={() => { upMap({ items: map.items.filter(i => i.id !== it.id) }); setSel('') }}><Trash2 size={13} /></Button></div>
            {(it.type === 'tap' || it.type === 'swipe') && <Row label="Key"><KeyCap value={it.key} onChange={key => up(it.id, { key })} /></Row>}
            {it.type === 'tap' && <p className="text-[11px] text-zinc-500">Tip: hold Shift, Ctrl or Alt while pressing to make a combo such as Shift + W.</p>}
            {it.type === 'swipe' && <><Row label="Swipe X"><Slider value={it.dx} onChange={dx => up(it.id, { dx })} min={-0.5} max={0.5} /></Row><Row label="Swipe Y"><Slider value={it.dy} onChange={dy => up(it.id, { dy })} min={-0.5} max={0.5} /></Row></>}
            {it.type === 'joystick' && <>
              {[['up', 'Forward'], ['left', 'Left'], ['down', 'Back'], ['right', 'Right'], ['sprint', 'Sprint (hold)']].map(([k, t]) => <Row key={k} label={t}><KeyCap plain value={it[k]} onChange={v => up(it.id, { [k]: v })} /></Row>)}
              <Row label="Stick size"><Slider value={it.r} onChange={r => up(it.id, { r })} min={0.04} max={0.2} /></Row>
              <Row label="Sprint push"><Slider value={it.mul} onChange={mul => up(it.id, { mul })} min={1} max={4} step={0.1} /></Row>
              <p className="text-[11px] text-zinc-500">Holding the sprint key pushes the stick further, which is how BGMI and similar games start sprinting.</p>
            </>}
            {it.type === 'look' && <><Row label="Sensitivity"><Slider value={it.sens} onChange={sens => up(it.id, { sens })} min={0.2} max={4} step={0.1} /></Row>
              <p className="text-[11px] text-zinc-500">Put this marker on an empty part of the right side of the screen. Mouse movement drags from there to turn the camera.</p></>}
            {dupKeys.includes(it.id) && <p className="text-[11px] text-amber-400">This key is also used by another button.</p>}
          </div> : <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[12px] text-zinc-500">Click a marker to edit it, or drag it onto the matching button of your game.</div>}

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 max-h-[220px] overflow-y-auto">
            {map.items.map(i => { const I = ICON[i.type]; return (
              <button key={i.id} onClick={() => setSel(i.id)} className={cx('w-full flex items-center gap-2 rounded-md px-1.5 h-7 text-left text-[12px]', i.id === sel ? 'bg-violet-500/20' : 'hover:bg-white/5')}>
                <I size={12} className="text-zinc-500 shrink-0" /><span className="flex-1 truncate">{i.label}</span>
                <span className="text-[11px] font-semibold text-zinc-300">{i.type === 'joystick' ? 'WASD' : i.type === 'look' ? 'Mouse' : keyName(i.key)}</span>
              </button>) })}
          </div>

          <div className="rounded-xl bg-violet-500/10 border border-violet-400/20 p-3 text-[12px] leading-relaxed text-zinc-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-white"><Keyboard size={13} />How to use</div>
            <p>1. Start capture and open your game on the phone.</p>
            <p>2. Pick the game's map here (it switches by itself when “Auto-pick” is on).</p>
            <p>3. Drag each marker onto the matching on-screen button. The picture updates live.</p>
            <p>4. Turn on <b>Game controls</b>, go to Studio and <b>click the preview</b> to capture the mouse.</p>
            <p className="flex items-center gap-1.5 text-zinc-400"><Mouse size={12} />Press Esc to release the mouse.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
