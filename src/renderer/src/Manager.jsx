// "View all": one stacked tree of every frame → its scenes → their sources, sliding over the left panel.
import { useState } from 'react'
import { X, ChevronRight, Eye, EyeOff, Settings2, Trash2, Copy, ChevronUp, ChevronDown, Search, Link2 } from 'lucide-react'
import { cx } from './ui'
import { uid } from './scene'

const Shape = ({ size }) => { const [a, b] = size.split('x').map(Number), k = 13 / Math.max(a, b); return <span className="rounded-[2px] border border-current opacity-80 shrink-0" style={{ width: a * k, height: b * k }} /> }
const I = ({ title, onClick, children, danger }) => <button title={title} onClick={e => { e.stopPropagation(); onClick() }} className={cx('size-6 grid place-items-center rounded-md text-zinc-500 hover:bg-white/10', danger ? 'hover:text-red-400' : 'hover:text-white')}>{children}</button>

export default function Manager({ s, set, sel, setSel, editScene, editSource, onClose }) {
  const [open, setOpen] = useState(() => new Set([s.frameId, s.sceneId])), [q, setQ] = useState('')
  const flip = id => setOpen(o => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n })
  const frames = s.frames || [{ id: 'all', name: 'Scenes', size: s.canvas, scenes: s.scenes.map(x => x.id) }]
  const upScene = (id, f) => set({ scenes: s.scenes.map(sc => sc.id === id ? f(sc) : sc) })
  const goScene = (f, sc) => set(f.id === 'all' ? { sceneId: sc.id } : { frameId: f.id, canvas: f.size, sceneId: sc.id })
  const match = t => !q || t.toLowerCase().includes(q.toLowerCase())
  const dupScene = sc => { const n = { ...sc, id: uid(), name: sc.name + ' copy', layers: sc.layers.map(l => ({ ...l, id: uid() })) }; set({ scenes: [...s.scenes, n], sceneId: n.id }) }
  return (
    <div className="pop absolute inset-0 z-30 flex flex-col rounded-2xl bg-[#18181a] ring-1 ring-white/10 shadow-2xl">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3">
        <span className="flex-1 text-[14px] font-semibold text-white">Frames, scenes & sources</span>
        <button onClick={onClose} className="size-8 grid place-items-center rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white"><X size={14} /></button>
      </div>
      <div className="px-3 pb-2"><div className="flex items-center gap-2 h-8 rounded-lg bg-[#2a2a2e] px-2.5"><Search size={13} className="text-zinc-500" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a scene or source" className="flex-1 bg-transparent text-[12px] text-white outline-none" /></div></div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2">
        {frames.map(f => {
          const scenes = f.scenes.map(id => s.scenes.find(x => x.id === id)).filter(Boolean).filter(sc => match(sc.name) || sc.layers.some(l => match(l.name)))
          return <div key={f.id} className={cx('rounded-xl bg-[#222225] ring-1', f.id === s.frameId ? 'ring-white/25' : 'ring-white/[0.05]')}>
            <div onClick={() => flip(f.id)} className="flex items-center gap-2 h-10 px-2.5 cursor-pointer">
              <ChevronRight size={13} className={cx('text-zinc-500 transition-transform', open.has(f.id) && 'rotate-90')} />
              <span className="w-4 grid place-items-center text-zinc-300"><Shape size={f.size} /></span>
              <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-white">{f.name}{f.parent && <Link2 size={11} className="inline ml-1 text-zinc-500" />}</span>
              <span className="text-[11px] text-zinc-500">{f.size.replace('x', '×')} · {f.scenes.length}</span>
            </div>
            {open.has(f.id) && <div className="pb-2 pl-5 pr-2 space-y-1">
              {!scenes.length && <div className="py-2 text-[11px] text-zinc-600">No scenes{q ? ' match' : ''}</div>}
              {scenes.map(sc => {
                const on = sc.id === s.sceneId, layers = [...sc.layers].reverse().filter(l => match(l.name) || match(sc.name))
                return <div key={sc.id} className={cx('rounded-lg', on ? 'bg-white/[0.07]' : 'bg-black/20')}>
                  <div onClick={() => { goScene(f, sc); flip(sc.id) }} className="group flex items-center gap-1.5 h-9 px-2 cursor-pointer">
                    <ChevronRight size={12} className={cx('text-zinc-500 transition-transform', open.has(sc.id) && 'rotate-90')} />
                    <span className={cx('flex-1 min-w-0 truncate text-[12px]', on ? 'font-semibold text-white' : 'text-zinc-300')}>{sc.name}</span>
                    <span className="text-[10.5px] text-zinc-500 group-hover:hidden">{sc.layers.length}</span>
                    <span className="hidden group-hover:flex"><I title="Scene settings" onClick={() => editScene(sc.id)}><Settings2 size={12} /></I><I title="Duplicate" onClick={() => dupScene(sc)}><Copy size={12} /></I>
                      {s.scenes.length > 1 && <I danger title="Delete scene" onClick={() => set({ scenes: s.scenes.filter(x => x.id !== sc.id), ...(on ? { sceneId: s.scenes.find(x => x.id !== sc.id).id } : {}) })}><Trash2 size={12} /></I>}</span>
                  </div>
                  {open.has(sc.id) && <div className="pb-1.5 pl-5 pr-1 space-y-0.5">
                    {!layers.length && <div className="py-1 text-[11px] text-zinc-600">Empty scene</div>}
                    {layers.map(l => {
                      const i = sc.layers.indexOf(l), child = l.parent && sc.layers.some(p => p.id === l.parent)
                      return <div key={l.id} onClick={() => { if (!on) goScene(f, sc); setSel(l.id) }} className={cx('group flex items-center gap-1 h-8 rounded-md pl-2 pr-1 cursor-pointer', child && 'ml-4', l.id === sel && on ? 'bg-white/[0.12] text-white' : 'hover:bg-white/[0.05]')}>
                        <I title={l.visible === false ? 'Show' : 'Hide'} onClick={() => upScene(sc.id, x => ({ ...x, layers: x.layers.map(y => y.id === l.id ? { ...y, visible: y.visible === false } : y) }))}>{l.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}</I>
                        <span className={cx('flex-1 min-w-0 truncate text-[12px]', l.visible === false ? 'text-zinc-600' : 'text-zinc-200')}>{l.name}</span>
                        <span className="hidden group-hover:flex">
                          <I title="Move up" onClick={() => upScene(sc.id, x => { const a = [...x.layers]; if (i < a.length - 1) [a[i], a[i + 1]] = [a[i + 1], a[i]]; return { ...x, layers: a } })}><ChevronUp size={12} /></I>
                          <I title="Move down" onClick={() => upScene(sc.id, x => { const a = [...x.layers]; if (i > 0) [a[i], a[i - 1]] = [a[i - 1], a[i]]; return { ...x, layers: a } })}><ChevronDown size={12} /></I>
                          <I title="Settings" onClick={() => { if (!on) goScene(f, sc); editSource(l) }}><Settings2 size={12} /></I>
                          <I danger title="Remove" onClick={() => upScene(sc.id, x => ({ ...x, layers: x.layers.filter(y => y.id !== l.id && y.parent !== l.id) }))}><Trash2 size={12} /></I>
                        </span>
                      </div>
                    })}
                  </div>}
                </div>
              })}
            </div>}
          </div>
        })}
      </div>
    </div>
  )
}
