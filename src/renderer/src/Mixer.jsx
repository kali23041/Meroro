// Mixer bar: five channels (phone, mic, music, effects, master) with mute, fader + live meter, dB readout and clip light.
// Phone and mic open a channel panel with pan, 3-band EQ, compressor, noise gate, low-cut, sync delay, monitor and presets.
import { useEffect, useRef, useState } from 'react'
import { Play, AudioLines, ChevronRight, Gauge, Headphones, Mic, MicOff, Music, Plus, SlidersHorizontal, Sparkles, Trash2, Volume2, VolumeX, Wand2, X } from 'lucide-react'
import { Button, Row, Select, Slider, Switch, cx } from './ui'
import { MIX0 } from './engine'
import { voiceName } from './voice'
import VoiceLab from './VoiceLab'

const db = v => v <= 0.001 ? '−∞' : (20 * Math.log10(v) >= 0 ? '+' : '') + (20 * Math.log10(v)).toFixed(1)
const PRESETS = {
  flat: ['Flat', {}],
  voice: ['Clear voice', { low: -3, mid: 2, high: 4, comp: 0.45, hp: true, gate: 0.32 }],
  radio: ['Radio voice', { low: 4, mid: 1, high: 3, comp: 0.75, hp: true, gate: 0.35 }],
  game: ['Game sound', { low: 3, mid: -1, high: 2, comp: 0.3 }],
  quiet: ['Tame loud game', { low: -2, mid: 0, high: -1, comp: 0.85 }]
}

// Small clip light: goes red for a moment when the channel peaks near full scale.
function Clip({ level }) {
  const ref = useRef()
  useEffect(() => { let id, hot = 0; const tick = () => { const l = level(); if (l > 0.985) hot = performance.now(); if (ref.current) ref.current.style.opacity = performance.now() - hot < 900 ? 1 : 0.15; id = requestAnimationFrame(tick) }; tick(); return () => cancelAnimationFrame(id) }, [])
  return <span ref={ref} title="Clipping light: lower the volume if this flashes red" className="size-1.5 shrink-0 rounded-full bg-red-500" style={{ opacity: 0.15 }} />
}

function Channel({ icon: I, off: O, name, vol, max = 1.5, muted, onVol, onMute, level, gear, open, extra }) {
  return (
    <div className={cx('flex items-center gap-1 min-w-0', muted && 'opacity-55')}>
      <button title={muted ? 'Unmute' : 'Mute'} onClick={onMute} className={cx('size-8 shrink-0 rounded-lg grid place-items-center transition-colors', muted ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:bg-white/[0.08] hover:text-white')}>{muted ? <O size={14} /> : <I size={14} />}</button>
      <Slider label={name} level={level} value={vol} onChange={onVol} max={max} format={v => db(v) + ' dB'} />
      <Clip level={level} />
      {extra}
      {gear && <button title={'More controls for ' + name} onClick={gear} className={cx('size-8 shrink-0 rounded-lg grid place-items-center transition-colors', open ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/[0.08] hover:text-white')}><SlidersHorizontal size={13} /></button>}
    </div>
  )
}

// Channel panel (phone / mic), opened from the gear; placed above the bar wherever the bar sits in the layout.
function Panel({ k, s, set, at, onClose, mics, onVoice }) {
  const m = { ...MIX0, ...s.mix?.[k] }, up = o => set({ mix: { ...s.mix, [k]: { ...m, ...o } } })
  const S = (label, key, o) => <Row label={label}><Slider value={m[key]} onChange={v => up({ [key]: v })} {...o} /></Row>
  const eq = v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB'
  return <>
    <div className="fixed inset-0 z-40" onPointerDown={onClose} />
    <div className="pop fixed z-50 w-[340px] rounded-2xl border border-white/10 bg-[#1c1c1f]/95 backdrop-blur-xl p-3 shadow-2xl space-y-1.5" style={{ left: Math.min(at.left, innerWidth - 352), bottom: innerHeight - at.top + 8 }}>
      <div className="flex items-center gap-2 mb-1"><span className="flex-1 text-[13px] font-semibold text-white">{k === 'mic' ? 'Microphone' : 'Phone audio'}</span>
        <Select className="w-[140px]" value="" onChange={p => p && up({ ...MIX0, gate: m.gate, delay: m.delay, mon: m.mon, pan: m.pan, ...PRESETS[p][1] })} options={[['', 'Presets…'], ...Object.entries(PRESETS).map(([id, [n]]) => [id, n])]} />
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={14} /></button></div>
      {k === 'mic' && <VoiceRow s={s} k="main" onVoice={onVoice} />}
      {k === 'mic' && <Row label="Device"><Select className="flex-1" value={s.mic} onChange={mic => set({ mic })} options={[['', 'Remove'], ['default', 'System default'], ...mics]} /></Row>}
      {S('Pan', 'pan', { min: -1, max: 1, format: v => Math.abs(v) < 0.02 ? 'Centre' : (v < 0 ? 'L ' : 'R ') + Math.round(Math.abs(v) * 100) })}
      <div className="pt-1 text-[10px] uppercase tracking-wider text-zinc-500">Equaliser</div>
      {S('Bass', 'low', { min: -12, max: 12, step: 0.5, format: eq })}{S('Mids', 'mid', { min: -12, max: 12, step: 0.5, format: eq })}{S('Treble', 'high', { min: -12, max: 12, step: 0.5, format: eq })}
      <Row label="Low cut"><span className="flex-1 text-[11px] text-zinc-500">Removes rumble and desk bumps</span><Switch checked={m.hp} onChange={hp => up({ hp })} /></Row>
      <div className="pt-1 text-[10px] uppercase tracking-wider text-zinc-500">Dynamics</div>
      {S('Compressor', 'comp', { format: v => v < 0.02 ? 'Off' : v < 0.4 ? 'Light ' + Math.round(v * 100) : v < 0.7 ? 'Medium ' + Math.round(v * 100) : 'Strong ' + Math.round(v * 100) })}
      {k === 'mic' && S('Noise gate', 'gate', { max: 0.7, format: v => v < 0.02 ? 'Off' : Math.round(-54 + v * 54) + ' dB' })}
      {k === 'mic' && <Row label="Noise removal"><span className="flex-1 text-[11px] text-zinc-500">AI (RNNoise)</span><Switch checked={!!s.noise} onChange={noise => set({ noise })} /></Row>}
      <div className="pt-1 text-[10px] uppercase tracking-wider text-zinc-500">Timing &amp; listening</div>
      {S(k === 'phone' ? 'Audio sync' : 'Delay', 'delay', { max: 1, step: 0.01, format: v => Math.round(v * 1000) + ' ms' })}
      <Row label="Hear it"><span className="flex-1 text-[11px] text-zinc-500">{k === 'mic' ? 'Use headphones' : 'In your speakers'}</span>
        <Switch checked={k === 'phone' ? !!s.monitor : m.mon} onChange={v => k === 'phone' ? set({ monitor: v }) : up({ mon: v })} /></Row>
      <Button className="w-full h-7" onClick={() => up({ ...MIX0 })}>Reset channel</Button>
    </div>
  </>
}

const uid = () => Math.random().toString(36).slice(2, 9)
const pop = (at, w = 340) => ({ left: Math.max(8, Math.min(at.left, innerWidth - w - 12)), bottom: innerHeight - at.top + 8 })
const Pop = ({ at, w = 340, onClose, children }) => <>
  <div className="fixed inset-0 z-40" onPointerDown={onClose} />
  <div className="pop fixed z-50 rounded-2xl border border-white/10 bg-[#1c1c1f]/95 backdrop-blur-xl p-3 shadow-2xl space-y-1.5" style={{ ...pop(at, w), width: w }}>{children}</div>
</>
// A channel with nothing feeding it: greyed out, with one button that adds the missing source.
const Empty = ({ icon: I, text, onAdd }) => <div className="flex items-center gap-1 min-w-0 opacity-70">
  <span className="size-8 shrink-0 grid place-items-center text-zinc-600"><I size={14} /></span>
  <button onClick={onAdd} className="flex-1 min-w-0 h-8 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-[11px] text-zinc-500 hover:border-white/30 hover:text-zinc-200"><Plus size={12} /><span className="truncate">{text}</span></button>
</div>
// One mic inside the shared mic slot; its settings button lives inside the fader.
function MicBar({ m, eng, onVol, onMute, onOpen, open }) {
  const lv = () => eng.current?.level(m.id === 'main' ? 'mic' : 'mic:' + m.id) || 0
  return <div className={cx('flex items-center gap-1 min-w-0 flex-1', m.mute && 'opacity-55')} title={`${m.name} · ${db(m.vol ?? 1)} dB`}>
    <div className="relative flex-1 min-w-0 flex">
      <Slider label={<span className="flex items-center gap-1 max-w-[120px]"><button title={m.mute ? 'Unmute' : 'Mute'} onPointerDown={e => e.stopPropagation()} onClick={onMute} className={cx('pointer-events-auto shrink-0 -ml-1 size-6 grid place-items-center rounded-md hover:bg-white/15', m.mute && 'text-red-400')}>{m.mute ? <MicOff size={12} /> : <Mic size={12} />}</button><span className="truncate">{m.name}</span></span>} level={lv} value={m.vol ?? 1} onChange={onVol} max={1.5} format={() => ''} />
      <button title={'Settings for ' + m.name} onClick={e => onOpen(e.currentTarget.getBoundingClientRect())}
        className={cx('absolute right-1 top-1/2 -translate-y-1/2 size-6 grid place-items-center rounded-md', open ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/15 hover:text-white')}><SlidersHorizontal size={12} /></button>
    </div>
  </div>
}

function VoiceRow({ s, k, onVoice }) {
  return <Row label="Voice"><span className="flex-1 truncate text-[12px] text-zinc-300">{voiceName(s, k === 'main' ? s.voice : s.mics?.find(m => m.id === k)?.voice)}</span>
    <Button className="h-7" onClick={() => onVoice(k)}><Wand2 size={12} />Voice changer</Button></Row>
}
function ExtraPanel({ m, s, set, at, mics, onClose, onVoice }) {
  const up = o => set({ mics: s.mics.map(x => x.id === m.id ? { ...x, ...o } : x) })
  return <Pop at={at} onClose={onClose}>
    <div className="flex items-center gap-2 mb-1"><span className="flex-1 text-[13px] font-semibold text-white truncate">{m.name}</span><button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={14} /></button></div>
    <Row label="Name"><input value={m.name} onChange={e => up({ name: e.target.value })} className="flex-1 h-8 rounded-lg bg-[#323236] px-2.5 text-[12px] text-white outline-none" /></Row>
    <Row label="Device"><Select className="flex-1" value={m.device} onChange={device => up({ device })} options={[['default', 'System default'], ...mics]} /></Row>
    <VoiceRow s={s} k={m.id} onVoice={onVoice} />
    <Row label="Hear it"><span className="flex-1 text-[11px] text-zinc-500">Use headphones</span><Switch checked={!!m.mon} onChange={mon => up({ mon })} /></Row>
    <Button className="w-full h-7 text-red-300" onClick={() => { set({ mics: s.mics.filter(x => x.id !== m.id) }); onClose() }}><Trash2 size={12} />Remove microphone</Button>
  </Pop>
}

// Every sound effect in every scene, with its own volume; the Effects fader stays the master over all of them.
function FxPanel({ s, set, at, onClose }) {
  const rows = s.scenes.flatMap(sc => sc.layers.filter(l => l.type === 'sound').map(l => ({ l, sc, owner: sc.layers.find(p => p.id === l.parent) })))
  const up = (sc, id, o) => set({ scenes: s.scenes.map(x => x.id !== sc.id ? x : { ...x, layers: x.layers.map(l => l.id === id ? { ...l, ...o } : l) }) })
  return <Pop at={at} w={380} onClose={onClose}>
    <div className="flex items-center gap-2 mb-1"><span className="flex-1 text-[13px] font-semibold text-white">Sound effects</span><span className="text-[11px] text-zinc-500">Effects fader = master</span><button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={14} /></button></div>
    <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
      {!rows.length && <div className="py-4 text-center text-[12px] text-zinc-500">No sound effects yet. Add one from Add source → Sound effect.</div>}
      {rows.map(({ l, sc, owner }) => <div key={l.id} className={cx('rounded-xl bg-black/25 p-2 space-y-1', l.visible === false && 'opacity-50')}>
        <div className="flex items-center gap-1.5 text-[12px]"><span className="flex-1 min-w-0 truncate text-zinc-100">{l.name}<span className="text-zinc-500"> · {owner ? owner.name : 'own source'} · {sc.name}</span></span>
          <button title="Play" onClick={() => window.__eng?.playSfx(l.sfx, l.vol ?? 1)} className="size-6 grid place-items-center rounded-md text-zinc-300 hover:bg-white/10"><Play size={12} /></button>
          <button title={l.visible === false ? 'Turn on' : 'Turn off'} onClick={() => up(sc, l.id, { visible: l.visible === false })} className={cx('size-6 grid place-items-center rounded-md hover:bg-white/10', l.visible === false ? 'text-red-400' : 'text-zinc-300')}>{l.visible === false ? <VolumeX size={12} /> : <Volume2 size={12} />}</button></div>
        <Slider value={l.vol ?? 1} onChange={vol => up(sc, l.id, { vol })} max={1.5} format={v => db(v) + ' dB'} />
      </div>)}
    </div>
  </Pop>
}

export default function Mixer({ s, set, eng, mics, onAddSource, onMusic, onEffects, onAddMic }) {
  const [open, setOpen] = useState(null), [voiceFor, setVoiceFor] = useState(''), lv = k => () => eng.current?.level(k) || 0
  const gear = k => e => { const r = e.currentTarget.getBoundingClientRect(); setOpen(open?.k === k ? null : { k, at: r }) }
  const ducking = s.duck !== false
  const devName = id => id === 'default' ? 'Mic' : (mics.find(m => m[0] === id)?.[1] || 'Mic').replace(/\s*\(.*\)$/, '')
  const all = [...(s.mic ? [{ id: 'main', name: devName(s.mic), device: s.mic, vol: s.micVol, mute: s.micMute }] : []), ...(s.mics || []).map(m => ({ ...m, name: m.name || devName(m.device) }))]
  const upMic = (m, o) => m.id === 'main' ? set({ ...(o.vol !== undefined ? { micVol: o.vol } : {}), ...(o.mute !== undefined ? { micMute: o.mute } : {}) }) : set({ mics: s.mics.map(x => x.id === m.id ? { ...x, ...o } : x) })
  const addMic = (device, name) => { onAddMic(device, name); setOpen(null) }
  useEffect(() => { const h = e => setVoiceFor(e.detail); addEventListener('meroro:voice', h); return () => removeEventListener('meroro:voice', h) }, [])
  const hasPhone = s.scenes.some(sc => sc.layers.some(l => l.type === 'phone' || l.type === 'ios'))
  const hasMusic = !!(s.playlist || []).length, hasFx = !!(s.pads || []).length || s.scenes.some(sc => sc.layers.some(l => l.type === 'sound')) || (s.autos || []).some(r => r.sound || r.sfx)
  const micBar = m => <MicBar key={m.id} m={m} eng={eng} open={open?.k === 'mic:' + m.id} onVol={vol => upMic(m, { vol })} onMute={() => upMic(m, { mute: !m.mute })} onOpen={at => setOpen(open?.k === 'mic:' + m.id ? null : { k: 'mic:' + m.id, at, m })} />
  return (
    <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-x-2 gap-y-1 p-1.5 min-w-0">
      {hasPhone ? <Channel icon={Volume2} off={VolumeX} name="Phone" vol={s.phoneVol} muted={s.phoneMute} onVol={phoneVol => set({ phoneVol })} onMute={() => set({ phoneMute: !s.phoneMute })} level={lv('phone')}
        extra={<button title="Hear phone audio" onClick={() => set({ monitor: !s.monitor })} className={cx('size-8 shrink-0 rounded-lg grid place-items-center', s.monitor ? 'bg-white/[0.14] text-white' : 'text-zinc-500 hover:bg-white/[0.08] hover:text-white')}><Headphones size={13} /></button>}
        gear={gear('phone')} open={open?.k === 'phone'} /> : <Empty icon={Volume2} text="Phone audio · add a phone source" onAdd={() => onAddSource('phone')} />}
      <div className="col-span-2 flex items-center gap-1.5 min-w-0">
        {all.length ? <>{all.slice(0, 3).map(micBar)}
          {all.length > 3 && <button title="All microphones" onClick={gear('mics')} className="h-8 shrink-0 flex items-center gap-0.5 rounded-lg bg-white/[0.08] px-2 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.14]">View all<ChevronRight size={12} /></button>}</>
          : <div className="flex-1 min-w-0"><Empty icon={Mic} text="Microphone · add a mic" onAdd={() => onAddSource('mic')} /></div>}
        <button onClick={gear('addmic')} className="h-8 shrink-0 flex items-center justify-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.12]"><Plus size={12} />Mic</button>
        <button title="Voice changer" disabled={!all.length} onClick={() => setVoiceFor(all[0]?.id || 'main')} className={cx('size-8 shrink-0 grid place-items-center rounded-lg disabled:opacity-35', s.voice ? 'bg-white/[0.14] text-white' : 'text-zinc-400 hover:bg-white/[0.08] hover:text-white')}><Wand2 size={13} /></button>
        <button title="Noise removal (RNNoise)" onClick={() => set({ noise: !s.noise })} className={cx('size-8 shrink-0 grid place-items-center rounded-lg', s.noise ? 'bg-white/[0.14] text-white' : 'text-zinc-500 hover:bg-white/[0.08] hover:text-white')}><AudioLines size={13} /></button>
      </div>
      {hasMusic ? <Channel icon={Music} off={VolumeX} name="Music" vol={s.musicVol ?? 0.5} max={1} muted={s.musicMute} onVol={musicVol => set({ musicVol })} onMute={() => set({ musicMute: !s.musicMute })} level={lv('music')}
        extra={<button title={ducking ? 'Music gets quieter while you talk (on)' : 'Music ducking is off'} onClick={() => set({ duck: !ducking })} className={cx('h-8 shrink-0 rounded-lg px-2 text-[11px] font-medium', ducking ? 'bg-white/[0.14] text-white' : 'text-zinc-500 hover:bg-white/[0.08] hover:text-white')}>Duck</button>} />
        : <Empty icon={Music} text="Music · add songs" onAdd={onMusic} />}
      {hasFx ? <Channel icon={Sparkles} off={VolumeX} name="Effects" vol={s.fxVol ?? 0.8} max={1.5} muted={s.fxMute} onVol={fxVol => set({ fxVol })} onMute={() => set({ fxMute: !s.fxMute })} level={lv('fx')} gear={gear('fx')} open={open?.k === 'fx'} />
        : <Empty icon={Sparkles} text="Effects · add a sound effect" onAdd={onEffects} />}
      <Channel icon={Gauge} off={VolumeX} name="Master" vol={s.masterVol ?? 1} muted={s.masterMute} onVol={masterVol => set({ masterVol })} onMute={() => set({ masterMute: !s.masterMute })} level={lv('master')} />
      {open?.k === 'fx' && <FxPanel s={s} set={set} at={open.at} onClose={() => setOpen(null)} />}
      {open?.k === 'phone' && <Panel k="phone" at={open.at} s={s} set={set} mics={mics} onClose={() => setOpen(null)} />}
      {open?.k === 'mic:main' && <Panel k="mic" at={open.at} s={s} set={set} mics={mics} onClose={() => setOpen(null)} onVoice={k => { setOpen(null); setVoiceFor(k) }} />}
      {open?.k?.startsWith('mic:') && open.k !== 'mic:main' && open.m && <ExtraPanel m={s.mics.find(x => x.id === open.m.id) || open.m} s={s} set={set} at={open.at} mics={mics} onClose={() => setOpen(null)} onVoice={k => { setOpen(null); setVoiceFor(k) }} />}
      {open?.k === 'mics' && <Pop at={open.at} w={380} onClose={() => setOpen(null)}>
        <div className="text-[13px] font-semibold text-white mb-1">All microphones</div>
        {all.map(m => <div key={m.id} className="flex">{micBar(m)}</div>)}
      </Pop>}
      {open?.k === 'addmic' && <Pop at={open.at} w={300} onClose={() => setOpen(null)}>
        <div className="text-[13px] font-semibold text-white mb-1">Add a microphone</div>
        {[['default', 'System default'], ...mics].map(([id, name]) => <button key={id} onClick={() => addMic(id, name)} className="w-full h-9 flex items-center gap-2 rounded-lg px-2.5 text-left text-[12px] text-zinc-200 hover:bg-white/[0.08]"><Mic size={13} className="text-zinc-500" /><span className="truncate">{name}</span></button>)}
      </Pop>}
      {voiceFor && <VoiceLab s={s} set={set} eng={eng} target={voiceFor} mics={all} onClose={() => setVoiceFor('')} />}
    </div>
  )
}
