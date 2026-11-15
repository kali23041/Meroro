// Annotation overlay for the preview: captures the pointer while it is on, draws into engine.ann (which the stream shows),
// and holds the tool bar. Keys: P pen, H highlighter, E eraser, L line, A arrow, R box, O ellipse, T text, N step, X laser, S spotlight.
import { useEffect, useRef, useState } from 'react'
import { MousePointer2, Pencil, Highlighter, Eraser, Minus, MoveUpRight, Square, Circle, Type, ListOrdered, Zap, Focus, Undo2, Redo2, Trash2, Download, Presentation, Timer, PaintBucket, X } from 'lucide-react'
import { hit, BOARDS } from './ann'
import { cx } from './ui'

const TOOLS = [['pen', 'Pen (P)', Pencil, 'p'], ['hl', 'Highlighter (H)', Highlighter, 'h'], ['eraser', 'Eraser (E)', Eraser, 'e'], ['line', 'Line (L)', Minus, 'l'], ['arrow', 'Arrow (A)', MoveUpRight, 'a'],
  ['rect', 'Box (R)', Square, 'r'], ['ellipse', 'Ellipse (O)', Circle, 'o'], ['text', 'Text (T)', Type, 't'], ['step', 'Numbered step (N)', ListOrdered, 'n'], ['laser', 'Laser pointer (X)', Zap, 'x'], ['spot', 'Spotlight (S)', Focus, 's']]
const COLORS = ['#ff3b30', '#ff9500', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#ffffff', '#111111']
const SIZES = [0.003, 0.006, 0.011]

export default function Annotate({ eng, canvas, onClose, overlay }) {
  const [tool, setTool] = useState('pen'), [color, setColor] = useState(COLORS[0]), [size, setSize] = useState(1), [fill, setFill] = useState(false), [fade, setFade] = useState(0)
  const [, tick] = useState(0), [txt, setTxt] = useState(null), re = () => tick(n => n + 1)
  const a = eng.current.ann, st = useRef({}); st.current = { tool, color, size, fill, fade }
  const pos = e => { const r = canvas.current.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] }
  const inside = p => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1
  const commit = it => { a.items.push(it); a.redo = []; a.live = null; re() }
  const undo = () => { const it = a.items.pop(); if (it) { a.redo.push(it); if (it.k === 'step') a.n = Math.max(1, a.n - 1) } re() }
  const redo = () => { const it = a.redo.pop(); if (it) { a.items.push({ ...it, t: performance.now() }); if (it.k === 'step') a.n++ } re() }
  const clear = () => { if (a.items.length) a.redo = [{ group: a.items }]; a.items = []; a.n = 1; a.live = null; re() }
  const erase = p => { const asp = canvas.current.width / canvas.current.height, n = a.items.length; a.items = a.items.filter(it => !hit(it, p[0], p[1], asp)); if (a.items.length !== n) re() }

  const down = e => {
    if (e.button !== 0) return
    const p = pos(e), { tool, color, size, fill, fade } = st.current
    if (!inside(p)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const base = { c: color, w: SIZES[size], t: performance.now(), fade }
    if (tool === 'pen' || tool === 'hl') a.live = { ...base, k: tool, pts: [p] }
    else if (['line', 'arrow', 'rect', 'ellipse'].includes(tool)) a.live = { ...base, k: tool, a: p, b: p, fill }
    else if (tool === 'eraser') { st.current.erasing = true; erase(p) }
    else if (tool === 'step') commit({ ...base, k: 'step', a: p, n: a.n++ })
    else if (tool === 'text') setTxt({ p, v: '', x: e.clientX, y: e.clientY })
  }
  const move = e => {
    const p = pos(e), { tool } = st.current, L = a.live
    if (tool === 'laser') { if (inside(p)) { a.laser.push([p[0], p[1], performance.now()]); a.laserC = st.current.color } return }
    if (tool === 'spot') { a.spot = inside(p) ? p : null; return }
    if (st.current.erasing) return erase(p)
    if (!L) return
    if (L.pts) { const q = L.pts.at(-1); if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.0015) L.pts.push(p) }
    else L.b = e.shiftKey && L.k !== 'line' && L.k !== 'arrow' ? [p[0], L.a[1] + (p[0] - L.a[0]) * canvas.current.width / canvas.current.height * Math.sign((p[1] - L.a[1]) * (p[0] - L.a[0]) || 1)] : p
  }
  const up = () => { st.current.erasing = false; const L = a.live; if (!L) return; if (L.pts || Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]) > 0.004) commit({ ...L, t: performance.now() }); else { a.live = null } }

  useEffect(() => { // shortcuts, and tidy up pointer-only effects when the tool changes or the bar closes
    const k = e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase()
      if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      else if (!mod && e.key === 'Escape') onClose()
      else if (!mod) { const t = TOOLS.find(x => x[3] === key); if (t) setTool(t[0]); else if (/^[1-8]$/.test(key)) setColor(COLORS[+key - 1]) }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])
  useEffect(() => { if (tool !== 'spot') a.spot = null; if (overlay) window.api.send('overlay:ignore', tool === 'mouse') }, [tool])
  useEffect(() => () => { a.spot = null; a.live = null; a.laser = [] }, [])
  const save = () => canvas.current.toBlob(b => { const u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = `Meroro board ${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000) })
  const B = ({ on, title, onClick, children, disabled }) => <button title={title} disabled={disabled} onClick={onClick}
    className={cx('size-8 rounded-lg grid place-items-center transition-colors disabled:opacity-30', on ? 'bg-white text-black' : 'text-zinc-300 hover:bg-white/[0.12] hover:text-white')}>{children}</button>

  return (
    <div data-annotating="" className="absolute inset-0 z-20" style={{ cursor: tool === 'mouse' ? 'default' : tool === 'text' ? 'text' : tool === 'laser' || tool === 'spot' ? 'none' : 'crosshair' }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => { a.spot = null }}>
      <div className="pop absolute left-2 top-2 flex gap-1 cursor-default" onPointerDown={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()}
        onMouseEnter={() => overlay && window.api.send('overlay:ignore', false)} onMouseLeave={() => overlay && st.current.tool === 'mouse' && window.api.send('overlay:ignore', true)}>
        <div className="grid grid-cols-3 gap-0.5 rounded-2xl border border-white/10 bg-[#1c1c1f]/90 backdrop-blur-xl p-1 shadow-2xl">
          {overlay && <B on={tool === 'mouse'} title="Use the computer normally (drawing paused)" onClick={() => setTool('mouse')}><MousePointer2 size={15} /></B>}
          {TOOLS.map(([k, t, I]) => <B key={k} on={tool === k} title={t} onClick={() => setTool(k)}><I size={15} /></B>)}
          <B title="Close (Esc)" onClick={onClose}><X size={15} /></B>
          <div className="col-span-3 my-0.5 h-px bg-white/10" />
          {[...COLORS, '#ff6ad5'].map((c, i) => <button key={c} title={`Colour ${i + 1}`} onClick={() => setColor(c)} className="size-8 grid place-items-center"><span className={cx('size-5 rounded-full ring-2 transition-transform', color === c ? 'ring-white scale-110' : 'ring-white/15')} style={{ background: c }} /></button>)}
          <div className="col-span-3 my-0.5 h-px bg-white/10" />
          <div className="col-span-3 flex items-center justify-around h-8">{SIZES.map((_, i) => <button key={i} title={['Thin', 'Medium', 'Thick'][i]} onClick={() => setSize(i)} className="size-7 grid place-items-center"><span className={cx('rounded-full', size === i ? 'bg-white' : 'bg-zinc-500')} style={{ width: 5 + i * 5, height: 5 + i * 5 }} /></button>)}</div>
          <B on={fill} title="Fill shapes" onClick={() => setFill(!fill)}><PaintBucket size={15} /></B>
          <B on={!!fade} title={fade ? `Ink disappears after ${fade} s (click to change)` : 'Ink stays (click for disappearing ink)'} onClick={() => setFade(fade === 0 ? 3 : fade === 3 ? 8 : 0)}>{fade ? <span className="text-[11px] font-bold">{fade}s</span> : <Timer size={15} />}</B>
          <B on={a.board !== 'none'} title={'Board: ' + BOARDS.find(b => b[0] === a.board)[1] + ' (click to change)'} onClick={() => { a.board = BOARDS[(BOARDS.findIndex(b => b[0] === a.board) + 1) % BOARDS.length][0]; re() }}><Presentation size={15} /></B>
          <B title="Save picture" onClick={save}><Download size={15} /></B>
          <B title="Undo (Ctrl+Z)" disabled={!a.items.length} onClick={undo}><Undo2 size={15} /></B>
          <B title="Redo (Ctrl+Shift+Z)" disabled={!a.redo.length} onClick={() => { const g = a.redo.at(-1)?.group; if (g) { a.redo.pop(); a.items = g; re() } else redo() }}><Redo2 size={15} /></B>
          <button title="Clear all" onClick={clear} className="col-span-3 h-8 rounded-lg flex items-center justify-center gap-1.5 text-[11px] text-zinc-300 hover:bg-red-500/20 hover:text-red-300"><Trash2 size={13} />Clear</button>
        </div>
      </div>
      {txt && <textarea autoFocus value={txt.v} onChange={e => setTxt({ ...txt, v: e.target.value })} onPointerDown={e => e.stopPropagation()}
        onBlur={() => { if (txt.v.trim()) commit({ k: 'text', c: color, w: SIZES[size], a: txt.p, text: txt.v, t: performance.now(), fade }); setTxt(null) }}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) e.currentTarget.blur() }}
        placeholder="Type, then Enter" rows={1} className="fixed z-30 min-w-[160px] rounded-md bg-black/70 px-2 py-1 text-[14px] font-bold outline-none ring-1 ring-white/40" style={{ left: txt.x, top: txt.y, color }} />}
    </div>
  )
}
