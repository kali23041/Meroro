// Settings page: global hotkeys for scenes, and profiles (save every setting under a name, export a backup file, import it again).
import { useEffect, useRef, useState } from 'react'
import { POINTERS, PTR_DEFAULT, drawPointer } from './pointerfx'
import { Slider, Switch } from './ui'
import { TriangleAlert, RotateCcw, Swords, Keyboard, Save, Upload, Download, Trash2, FolderOpen, X, ChevronRight, ChevronLeft, Clapperboard } from 'lucide-react'
import { Button, Input, cx } from './ui'
import { KeyCap } from './Keys'

const api = window.api
const SECRET = ['key', 'keyEnc'] // the stream key never goes into a profile or backup file
const noKey = ({ key, keyEnc, ...d }) => d
const strip = s => ({ ...Object.fromEntries(Object.entries(s).filter(([k]) => !SECRET.includes(k) && k !== 'out2')), ...(s.dests ? { dests: s.dests.map(noKey) } : {}) })

// One animated preview tile per pointer style (it "clicks" every two seconds so the click effect shows).
function PtrTile({ st, on, onClick, name }) {
  const ref = useRef()
  useEffect(() => { let raf; const c = ref.current.getContext('2d')
    const loop = () => { const t = performance.now() / 1000; c.clearRect(0, 0, 120, 90); drawPointer(c, 44, 26, 17, st, t, t % 2); raf = requestAnimationFrame(loop) }
    loop(); return () => cancelAnimationFrame(raf) }, [st.style, st.color, st.click])
  return <button onClick={onClick} className={cx('rounded-xl bg-[#242427] ring-1 transition-all hover:-translate-y-0.5', on ? 'ring-white/70' : 'ring-white/[0.06] hover:ring-white/30')}>
    <canvas ref={ref} width={120} height={90} className="block w-full" /><div className="pb-2 text-[11px] font-medium text-zinc-300">{name}</div></button>
}
function Pointers({ s, set }) {
  const p = { ...PTR_DEFAULT, ...s.ptr }, up = o => set({ ptr: { ...p, ...o } })
  return <section className="col-span-2 rounded-2xl bg-[#1a1a1c] border border-white/[0.06] p-4 space-y-3">
    <div className="flex items-center gap-2"><Swords size={16} className="text-zinc-400" /><h2 className="flex-1 text-[15px] font-semibold text-white">Stream pointer</h2>
      <span className="text-[12px] text-zinc-400">Show on stream</span><Switch checked={p.on} onChange={on => up({ on })} /></div>
    <p className="text-[12px] leading-relaxed text-zinc-500">Replaces the mouse cursor on your Screen sources with an animated one that follows your real mouse and reacts to clicks anywhere on the computer. It is drawn only on the stream and recordings, not on your desktop.</p>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">{POINTERS.map(([k, n]) => <PtrTile key={k} name={n} st={{ ...p, style: k }} on={p.style === k} onClick={() => up({ style: k, on: true })} />)}</div>
    <div className="grid grid-cols-4 gap-x-6 gap-y-2 items-center">
      <label className="col-span-2 flex items-center gap-3 text-[12px] text-zinc-300"><span className="w-12 shrink-0">Size</span><Slider value={p.size} onChange={size => up({ size })} min={0.5} max={3} format={v => v.toFixed(1) + '×'} /></label>
      <label className="flex items-center gap-3 text-[12px] text-zinc-300">Colour<input type="color" value={p.color} onChange={e => up({ color: e.target.value })} className="h-7 w-10 rounded-md bg-transparent border border-white/10 p-0.5" /></label>
      <div className="flex items-center gap-4 text-[12px] text-zinc-300"><span className="flex items-center gap-2">Trail<Switch checked={p.trail !== false} onChange={trail => up({ trail })} /></span><span className="flex items-center gap-2">Click effect<Switch checked={p.click !== false} onChange={click => up({ click })} /></span></div>
    </div>
  </section>
}

function ResetAll() {
  const [ask, setAsk] = useState(false), [txt, setTxt] = useState('')
  return <section className="col-span-2 rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-4">
    <div className="flex items-center gap-3"><TriangleAlert size={16} className="text-red-400" />
      <div className="flex-1"><h2 className="text-[15px] font-semibold text-white">Reset everything</h2><p className="text-[12px] text-zinc-500">Puts Meroro back to how it was on first launch.</p></div>
      {!ask && <Button className="h-8 text-red-300" onClick={() => setAsk(true)}><RotateCcw size={12} />Reset everything…</Button>}</div>
    {ask && <div className="mt-3 space-y-2 rounded-xl bg-black/30 p-3 text-[12px] leading-relaxed text-zinc-300">
      <p><b className="text-red-300">This can’t be undone.</b> It deletes all frames, scenes, sources, overlays, key maps, automation, sounds, hotkeys, stream keys, voices, saved profiles and downloaded pictures and speech models, then restarts Meroro. Your recordings and exported videos are kept. Back up first (Profiles → Back up now) if you might want them later.</p>
      <div className="flex items-center gap-2"><Input value={txt} onChange={e => setTxt(e.target.value)} placeholder="Type RESET to confirm" />
        <Button onClick={() => { setAsk(false); setTxt('') }}>Cancel</Button>
        <Button className="h-8 shrink-0 whitespace-nowrap bg-red-600 text-white hover:bg-red-500 disabled:opacity-40" disabled={txt.trim().toUpperCase() !== 'RESET'} onClick={() => api.invoke('app:reset')}>Reset and restart</Button></div>
    </div>}
  </section>
}

export default function Settings({ s, set, onNote }) {
  const keys = s.sceneKeys || {}, setKey = (id, k) => set({ sceneKeys: { ...keys, [id]: k } })
  const used = Object.values(keys).filter(Boolean), dup = k => k && used.filter(x => x === k).length > 1
  const [list, setList] = useState([]), [name, setName] = useState(''), [ask, setAsk] = useState('')
  const load = () => api.invoke('profile:list').then(setList).catch(() => setList([]))
  useEffect(() => { load() }, [])
  const err = e => onNote({ text: String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), bad: true })
  const save = async n => { n = (n || name).trim(); if (!n) return; await api.invoke('profile:save', n, strip(s)); setName(''); load(); onNote({ text: `Saved profile “${n}”` }) }
  const apply = async (settings, n) => { const p = strip(settings); set({ ...p, key: s.key, ...(p.dests ? { dests: p.dests.map(d => ({ ...d, key: (s.dests || []).find(x => x.id === d.id)?.key || '' })) } : {}) }); setAsk(''); onNote({ text: `Loaded profile “${n}”` }) }
  const exp = async n => { try { const f = await api.invoke('profile:export', n, n === null ? strip(s) : await api.invoke('profile:load', n)); if (f) onNote({ text: 'Backup saved', file: f }) } catch (e) { err(e) } }
  const imp = async () => { try { const r = await api.invoke('profile:import'); if (!r) return; await api.invoke('profile:save', r.name, strip(r.settings)); load(); setAsk(r.name); onNote({ text: `Imported “${r.name}”. Press Load to use it.` }) } catch (e) { err(e) } }

  const row = (id, label, icon) => (
    <div key={id} className="flex items-center gap-3 rounded-xl bg-[#242427] px-3 h-12">
      <span className="size-7 rounded-lg bg-white/[0.06] grid place-items-center text-zinc-400">{icon}</span>
      <span className="flex-1 min-w-0 truncate text-[13px] text-zinc-100">{label}</span>
      {dup(keys[id]) && <span className="text-[11px] text-amber-400">Used twice</span>}
      <KeyCap value={keys[id] || ''} onChange={k => setKey(id, /^(Mouse|Wheel)/.test(k) ? '' : k)} />
      <button title="Clear" disabled={!keys[id]} onClick={() => setKey(id, '')} className="p-1.5 rounded-md text-zinc-500 hover:text-white disabled:opacity-30"><X size={13} /></button>
    </div>
  )

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
      <h1 className="mb-4 text-[20px] font-bold tracking-tight text-white">Settings</h1>
      <div className="grid grid-cols-2 gap-4 items-start">
        <section className="rounded-2xl bg-[#1a1a1c] border border-white/[0.06] p-4 space-y-2">
          <div className="flex items-center gap-2"><Keyboard size={16} className="text-zinc-400" /><h2 className="flex-1 text-[15px] font-semibold text-white">Scene hotkeys</h2></div>
          <p className="text-[12px] leading-relaxed text-zinc-500">Press a key to switch scenes. Hotkeys work while you're in a game too, so pick combos the game doesn't use, like Ctrl+1 or F5.</p>
          {s.scenes.map((sc, i) => row(sc.id, sc.name, i + 1))}
          {row('next', 'Next scene', <ChevronRight size={14} />)}
          {row('prev', 'Previous scene', <ChevronLeft size={14} />)}
        </section>

        <section className="rounded-2xl bg-[#1a1a1c] border border-white/[0.06] p-4 space-y-2">
          <div className="flex items-center gap-2"><Save size={16} className="text-zinc-400" /><h2 className="flex-1 text-[15px] font-semibold text-white">Profiles</h2>
            <Button className="h-8" onClick={imp}><Upload size={12} />Import</Button><Button className="h-8" onClick={() => exp(null)}><Download size={12} />Back up now</Button></div>
          <p className="text-[12px] leading-relaxed text-zinc-500">A profile keeps every setting: scenes, sources, overlays, key maps, automation, sounds and hotkeys. Stream keys are never saved in a profile or backup file.</p>
          <div className="flex gap-2"><Input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Profile name, e.g. GTA VI night stream" />
            <Button variant="primary" className="h-8 px-4 shrink-0 whitespace-nowrap" disabled={!name.trim()} onClick={() => save()}><Save size={12} />Save current</Button></div>
          {!list.length && <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-[12px] text-zinc-500">No saved profiles yet</div>}
          {list.map(p => (
            <div key={p.name} className={cx('rounded-xl bg-[#242427] p-3', ask === p.name && 'ring-1 ring-white/30')}>
              <div className="flex items-center gap-2">
                <span className="size-8 rounded-lg bg-white/[0.06] grid place-items-center text-zinc-300"><FolderOpen size={14} /></span>
                <span className="flex-1 min-w-0"><span className="block truncate text-[13px] font-medium text-white">{p.name}</span>
                  <span className="block text-[11px] text-zinc-500"><Clapperboard size={10} className="inline -mt-0.5 mr-1" />{p.scenes} scenes · {new Date(p.saved).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                <Button className="h-7" onClick={() => setAsk(ask === p.name ? '' : p.name)}>Load</Button>
                <Button variant="ghost" className="h-7 px-2" title="Update with current settings" onClick={() => save(p.name)}><Save size={12} /></Button>
                <Button variant="ghost" className="h-7 px-2" title="Export to a file" onClick={() => exp(p.name)}><Download size={12} /></Button>
                <Button variant="ghost" className="h-7 px-2" title="Delete" onClick={async () => { await api.invoke('profile:delete', p.name); load() }}><Trash2 size={12} /></Button>
              </div>
              {ask === p.name && <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/30 p-2 text-[12px] text-zinc-300">
                <span className="flex-1">Replace your current settings with “{p.name}”? Save them first if you want to keep them.</span>
                <Button className="h-7" onClick={() => setAsk('')}>Cancel</Button>
                <Button variant="primary" className="h-7" onClick={async () => { try { apply(await api.invoke('profile:load', p.name), p.name) } catch (e) { err(e) } }}>Yes, load</Button>
              </div>}
            </div>
          ))}
        </section>
        <Pointers s={s} set={set} />
        <ResetAll />
      </div>
    </div>
  )
}
