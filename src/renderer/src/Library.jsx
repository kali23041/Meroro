// App Library: every app on the phone as a grid of icons, with filters and per-app actions.
import { useEffect, useState } from 'react'
import { Search, Play, Square, Radio, Info, Gamepad2, LayoutGrid, Cpu, Check, RefreshCw } from 'lucide-react'
import { Button, Segmented, cx } from './ui'

const api = window.api
const hue = pkg => [...pkg].reduce((h, c) => h + c.charCodeAt(0), 0) % 360

// Loads icon + category for each app (6 at a time) and keeps them for the session.
const cache = {}
export function useMeta(apps) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!apps?.length) return
    let on = true
    const todo = apps.filter(a => !(a.pkg in cache))
    const next = async () => {
      const a = todo.shift()
      if (!a || !on) return
      cache[a.pkg] = null
      cache[a.pkg] = await api.invoke('app:meta', a.pkg).catch(() => ({}))
      if (on) tick(t => t + 1)
      next()
    }
    for (let i = 0; i < 6; i++) next()
    return () => { on = false; for (const a of todo) delete cache[a.pkg] }
  }, [apps])
  return cache
}

export function AppIcon({ app, meta, size = 40 }) {
  const m = meta[app.pkg]
  return m?.icon
    ? <img src={m.icon} width={size} height={size} className="shrink-0 rounded-[22%] shadow-sm" draggable={false} />
    : <span className="shrink-0 rounded-[22%] grid place-items-center font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg,hsl(${hue(app.pkg)} 60% 50%),hsl(${hue(app.pkg) + 40} 60% 38%))` }}>{app.name[0]?.toUpperCase()}</span>
}

export default function Library({ apps, meta, serial, ready, focus, picked, onStream, reload }) {
  const [q, setQ] = useState(''), [filter, setFilter] = useState('apps'), [sel, setSel] = useState(''), [info, setInfo] = useState(null), [busy, setBusy] = useState('')
  const isGame = a => meta[a.pkg]?.cat?.startsWith('GAME')
  const list = (apps || []).filter(a => (filter === 'system' ? a.system : !a.system) && (filter !== 'games' || isGame(a)) && (a.name + a.pkg).toLowerCase().includes(q.toLowerCase()))
  const app = apps?.find(a => a.pkg === sel)
  useEffect(() => { setInfo(null); if (app && ready) api.invoke('app:info', serial, app.pkg).then(setInfo).catch(() => {}) }, [sel])
  const act = async (a, kind) => { setBusy(kind); await api.invoke('app:action', serial, a.pkg, kind).catch(() => {}); setBusy('') }
  const games = (apps || []).filter(a => !a.system && isGame(a)).length

  return (
    <div className="flex-1 min-w-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-6 pt-5 pb-4">
          <div className="flex-1">
            <h1 className="text-[20px] font-bold tracking-tight text-white">App Library</h1>
            <p className="text-[12px] text-zinc-500">{ready ? `${(apps || []).filter(a => !a.system).length} apps · ${games} games on your phone` : 'Connect a phone to see its apps'}</p>
          </div>
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-[9px] text-zinc-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search apps" className="w-full h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] pl-8 pr-2 text-[13px] outline-none focus:border-violet-400/70" />
          </div>
          <div className="w-[300px]"><Segmented value={filter} onChange={setFilter} options={[['apps', 'Apps', LayoutGrid], ['games', 'Games', Gamepad2], ['system', 'System', Cpu]]} /></div>
          <Button variant="ghost" disabled={!ready} onClick={reload} title="Reload apps"><RefreshCw size={14} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {ready && apps === null && <div className="py-20 text-center text-zinc-500">Reading apps from your phone…</div>}
          {ready && apps && !list.length && <div className="py-20 text-center text-zinc-500">{filter === 'games' ? 'No games found yet. Categories load with the icons.' : 'No apps match.'}</div>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
            {list.map(a => (
              <button key={a.pkg} onClick={() => setSel(a.pkg)} onDoubleClick={() => onStream(a.pkg)}
                className={cx('relative flex flex-col items-center gap-2 rounded-xl p-3 pt-4 border transition-colors', a.pkg === sel ? 'bg-violet-500/15 border-violet-400/50' : 'border-transparent hover:bg-white/[0.05]')}>
                <AppIcon app={a} meta={meta} size={52} />
                <span className="w-full truncate text-center text-[12px] text-zinc-200">{a.name}</span>
                {a.pkg === focus && <span className="absolute top-2 right-2 size-2 rounded-full bg-emerald-400 live-dot" title="Open on phone" />}
                {a.pkg === picked && <span className="absolute top-1.5 left-1.5 rounded bg-violet-500 px-1 text-[9px] font-bold text-white">LIVE</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="w-[290px] shrink-0 border-l border-white/[0.06] bg-zinc-900/40 p-5">
        {!app ? <div className="h-full grid place-items-center text-center text-[12px] text-zinc-500">Select an app to see details.<br />Double-click to stream it.</div> : <>
          <div className="flex flex-col items-center text-center">
            <AppIcon app={app} meta={meta} size={84} />
            <h2 className="mt-3 text-[16px] font-semibold text-white">{app.name}</h2>
            <p className="text-[11px] text-zinc-500 break-all">{app.pkg}</p>
            <div className="mt-2 flex gap-1.5">
              {isGame(app) && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">GAME</span>}
              {app.pkg === focus && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">OPEN NOW</span>}
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <Button variant="primary" className="w-full h-9" onClick={() => onStream(app.pkg)}>{app.pkg === picked ? <><Check size={14} />Streaming this app</> : <><Radio size={14} />Stream this app</>}</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-8" disabled={!ready || !!busy} onClick={() => act(app, 'launch')}><Play size={13} />Open on phone</Button>
              <Button className="h-8" disabled={!ready || !!busy} onClick={() => act(app, 'stop')}><Square size={12} />Force stop</Button>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-white/[0.06] divide-y divide-white/[0.06] text-[12px]">
            {[['Version', info?.version], ['Installed', info?.installed], ['Updated', info?.updated], ['Category', meta[app.pkg]?.cat?.replace(/_/g, ' ').toLowerCase()]].map(([k, v]) => (
              <div key={k} className="flex gap-2 px-3 py-2"><span className="w-[72px] text-zinc-500">{k}</span><span className="flex-1 min-w-0 truncate capitalize text-zinc-200">{v || '—'}</span></div>
            ))}
          </div>
          <p className="mt-3 flex gap-1.5 text-[11px] text-zinc-600"><Info size={12} className="shrink-0 mt-px" />Icons and categories come from the app's Google Play page.</p>
        </>}
      </aside>
    </div>
  )
}
