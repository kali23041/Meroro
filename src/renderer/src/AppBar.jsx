// Bottom app bar: what's open on the phone, a dock of apps, game-controls prompt, and an "All apps" window.
import { useState } from 'react'
import { LayoutGrid, Search, X, Gamepad2, Move, Play, Check } from 'lucide-react'
import { Button, Select, cx } from './ui'
import { AppIcon } from './Library'

export default function AppBar({ apps, meta, focus, ready, dev, err, retry, s, set, pickApp, openKeys }) {
  const [all, setAll] = useState(false), [q, setQ] = useState('')
  const user = (apps || []).filter(a => !a.system)
  const isGame = a => meta[a.pkg]?.cat?.startsWith('GAME') || Object.values(s.keymaps).some(m => m.pkg === a.pkg)
  const dock = [...user.filter(isGame), ...user.filter(a => !isGame(a))].slice(0, 14)
  const front = apps?.find(a => a.pkg === focus), frontIsApp = !!focus && focus.includes('.') && !/launcher|systemui/i.test(focus)
  const owned = Object.keys(s.keymaps).find(k => s.keymaps[k].pkg === focus)
  const game = front && isGame(front)
  const [choice, setChoice] = useState('')
  const pickMap = choice || owned || s.keymapId
  const applied = s.keymapOn && s.keymapId === pickMap && (!!owned || s.keymaps[pickMap]?.pkg === focus)
  const apply = () => set({ keymapId: pickMap, keymapOn: true, control: true, keymaps: { ...s.keymaps, [pickMap]: { ...s.keymaps[pickMap], pkg: focus } } })

  return (
    <>
      <div className="h-[60px] shrink-0 flex items-center gap-2.5 px-2 rounded-2xl border border-white/[0.06] bg-[#1b1b1d]">
        {/* what's open on the phone */}
        <div className="w-[230px] shrink-0 flex items-center gap-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] px-2.5 h-[44px]">
          {front ? <AppIcon app={front} meta={meta} size={30} /> : <span className={cx('size-2.5 rounded-full mx-2.5', ready ? 'bg-zinc-500' : 'bg-zinc-700')} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">{ready && frontIsApp && <span className="size-1.5 rounded-full bg-emerald-400 live-dot" />}On phone now</div>
            <div className="truncate text-[12px] font-medium text-zinc-100">{!dev ? 'No phone connected' : !ready ? 'Tap “Allow” on the phone' : front?.name || (frontIsApp ? focus : 'Home screen')}</div>
          </div>
        </div>

        {/* game detected → apply controls */}
        {ready && frontIsApp && (game || owned) && (
          <div className="shrink-0 flex items-center gap-1.5 rounded-2xl bg-white/[0.07] border border-white/15 pl-2.5 pr-1.5 h-[44px]">
            <Gamepad2 size={15} className="text-amber-300" />
            <span className="text-[12px] text-zinc-300 mr-1">Game detected</span>
            <Select className="w-[150px]" value={pickMap} onChange={setChoice} options={Object.entries(s.keymaps).map(([k, m]) => [k, m.name])} />
            {applied ? <Button className="h-7" onClick={() => set({ keymapOn: false })}><Check size={12} className="text-emerald-400" />Controls on</Button>
              : <Button variant="primary" className="h-7" onClick={apply}>Apply controls</Button>}
            <Button variant="ghost" className="h-7" title="Rearrange controls" onClick={openKeys}><Move size={13} />Rearrange</Button>
          </div>
        )}

        {/* dock */}
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
          {err ? <div className="flex items-center gap-2 text-[12px] text-red-400"><span className="truncate">Couldn't read apps: {err}</span><Button className="h-7" onClick={retry}>Retry</Button></div>
            : ready && apps === null ? <span className="text-[12px] text-zinc-500 px-2">Reading apps from your phone…</span>
            : dock.map(a => (
              <button key={a.pkg} onClick={() => pickApp(a.pkg)} title={`${a.name} · click to open and stream`}
                className={cx('relative shrink-0 p-1.5 rounded-xl transition-transform hover:-translate-y-0.5 hover:bg-white/5', a.pkg === s.pkg && s.mode === 'app' && 'bg-violet-500/15')}>
                <AppIcon app={a} meta={meta} size={34} />
                {a.pkg === focus && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 size-1 rounded-full bg-white" />}
              </button>
            ))}
        </div>

        <Button className="h-[44px] px-3 shrink-0" disabled={!apps?.length} onClick={() => setAll(true)}><LayoutGrid size={15} />All apps</Button>
      </div>

      {all && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-md" onPointerDown={e => e.target === e.currentTarget && setAll(false)}>
          <div className="w-[860px] max-w-[92vw] h-[600px] max-h-[86vh] flex flex-col rounded-2xl border border-white/15 bg-zinc-900/80 backdrop-blur-2xl shadow-2xl overflow-hidden">
            <div className="h-11 flex items-center gap-2 px-3 border-b border-white/10">
              <div className="flex gap-1.5 mr-2">
                <button onClick={() => setAll(false)} className="size-3 rounded-full bg-[#ff5f57] grid place-items-center group"><X size={8} className="opacity-0 group-hover:opacity-100 text-black/60" /></button>
                <span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="flex-1 text-center text-[13px] font-semibold text-zinc-200">All apps{dev ? ` · ${dev.model}` : ''}</span>
              <span className="w-[52px]" />
            </div>
            <div className="p-4 pb-2 flex justify-center">
              <div className="relative w-[320px]">
                <Search size={14} className="absolute left-3 top-[9px] text-zinc-400" />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="w-full h-8 rounded-lg bg-white/10 border border-white/10 pl-9 pr-3 text-[13px] text-white outline-none focus:border-violet-400/70 placeholder:text-zinc-400" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-x-2 gap-y-4">
                {user.filter(a => (a.name + a.pkg).toLowerCase().includes(q.toLowerCase())).map(a => (
                  <button key={a.pkg} onClick={() => { pickApp(a.pkg); setAll(false) }} className="group relative flex flex-col items-center gap-1.5 rounded-xl p-2 hover:bg-white/10">
                    <AppIcon app={a} meta={meta} size={60} />
                    <span className="w-full truncate text-center text-[12px] text-zinc-200">{a.name}</span>
                    {a.pkg === focus && <span className="absolute top-1.5 right-2 size-2 rounded-full bg-emerald-400" />}
                    <Play size={12} className="absolute top-2 left-2 text-white/0 group-hover:text-white/70" />
                  </button>
                ))}
              </div>
            </div>
            <div className="h-9 flex items-center justify-center border-t border-white/10 text-[11px] text-zinc-400">Click an app to open it on the phone and stream it</div>
          </div>
        </div>
      )}
    </>
  )
}
