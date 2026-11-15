// Voice changer window: a library of 42 voices plus your own, live on the chosen mic, with a record-and-preview test.
import { useEffect, useState } from 'react'
import { Mic, Play, Square, Headphones, Save, Trash2, Check, Wand2, Loader2 } from 'lucide-react'
import { Button, Input, Row, Select, Slider, Switch, cx } from './ui'
import { Dialog } from './Dialogs'
import { VOICES, VCATS, V0, voiceOf } from './voice'

const SL = [['pitch', 'Pitch', -12, 12, 0.5, v => (v > 0 ? '+' : '') + v + ' st'], ['formant', 'Voice character', -1, 1, 0.05, v => v > 0.05 ? 'Lighter ' + Math.round(v * 100) : v < -0.05 ? 'Heavier ' + Math.round(-v * 100) : 'Natural'],
  ['low', 'Bass', -12, 12, 0.5, v => v + ' dB'], ['high', 'Treble', -12, 12, 0.5, v => v + ' dB'], ['robot', 'Robot', 0, 1, 0.01], ['ringHz', 'Robot tone', 20, 400, 1, v => v + ' Hz'],
  ['tel', 'Radio / phone', 0, 1, 0.01], ['dist', 'Grit', 0, 1, 0.01], ['chorus', 'Wobble', 0, 1, 0.01], ['echo', 'Echo', 0, 1, 0.01], ['echoTime', 'Echo time', 0.05, 0.8, 0.01, v => Math.round(v * 1000) + ' ms'],
  ['reverb', 'Room', 0, 1, 0.01], ['room', 'Room size', 0.3, 4, 0.1, v => v.toFixed(1) + ' s']]

export default function VoiceLab({ s, set, eng, target: t0, mics, onClose }) {
  const [target, setTarget] = useState(t0), [cat, setCat] = useState('All'), [take, setTake] = useState(eng.current?.take ? 'ready' : ''), [err, setErr] = useState(''), [name, setName] = useState('')
  const raw = target === 'main' ? s.voice : s.mics?.find(m => m.id === target)?.voice
  const [cur, setCur] = useState({ ...V0, ...(voiceOf(s, target) || {}) })
  const custom = (s.customVoices || []).map(v => ({ ...v, cat: 'My voices' })), all = [...VOICES, ...custom]
  const apply = x => target === 'main' ? set({ voice: x }) : set({ mics: s.mics.map(m => m.id === target ? { ...m, voice: x } : m) })
  const use = v => { apply(v ? v.id : null); setCur({ ...V0, ...(v?.v || {}) }) }
  const tweak = o => { const n = { ...cur, ...o }; setCur(n); apply(n) }
  const mon = target === 'main' ? !!s.mix?.mic?.mon : !!s.mics?.find(m => m.id === target)?.mon
  const setMon = v => target === 'main' ? set({ mix: { ...s.mix, mic: { ...s.mix?.mic, mon: v } } }) : set({ mics: s.mics.map(m => m.id === target ? { ...m, mon: v } : m) })
  const record = async () => { setErr(''); setTake('rec'); try { await eng.current.recordTake(target, 4); setTake('ready') } catch (e) { setTake(''); setErr(String(e.message || e)) } }
  const preview = v => { if (take !== 'ready') return setErr('Press “Record a test” and say something first, then preview any voice.'); eng.current.previewVoice(v?.v || v || null).catch(e => setErr(String(e.message || e))) }
  const list = all.filter(v => cat === 'All' || v.cat === cat)
  return (
    <Dialog title="Voice changer" onClose={onClose} className="w-[1080px] h-[680px]">
      <div className="h-full flex flex-col gap-3">
        {/* test bar */}
        <div className="flex items-center gap-2 rounded-xl bg-[#242427] p-2">
          <Select className="w-[200px]" value={target} onChange={k => { setTarget(k); setCur({ ...V0, ...(voiceOf(s, k) || {}) }) }} options={mics.map(m => [m.id, m.name])} />
          <Button className="h-8" disabled={take === 'rec'} onClick={record}>{take === 'rec' ? <><Loader2 size={12} className="animate-spin" />Listening… speak now</> : <><Mic size={12} />Record a 4 s test</>}</Button>
          <Button className="h-8" disabled={take !== 'ready'} onClick={() => preview(null)}><Play size={12} />Original</Button>
          <Button className="h-8" disabled={take !== 'ready'} onClick={() => preview(cur)}><Play size={12} />With this voice</Button>
          <Button variant="ghost" className="h-8 px-2" onClick={() => eng.current.stopPreview()}><Square size={12} /></Button>
          <span className="flex-1 truncate text-[11px] text-red-400">{err}</span>
          <span className="flex items-center gap-2 text-[12px] text-zinc-300"><Headphones size={13} />Hear yourself live<Switch checked={mon} onChange={setMon} /></span>
        </div>
        <div className="flex-1 min-h-0 flex gap-3">
          {/* library */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">{['All', ...VCATS, ...(custom.length ? ['My voices'] : []), 'AI apps'].map(c => <button key={c} onClick={() => setCat(c)}
              className={cx('h-7 rounded-full px-3 text-[11px] font-medium', cat === c ? 'bg-white text-black' : 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12]')}>{c}</button>)}</div>
            {cat === 'AI apps' ? <AiApps s={s} set={set} /> :
            <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-3 gap-1.5 content-start pr-1">
              <Card name="Off" sub="Your normal voice" on={!raw} onUse={() => use(null)} onPreview={() => preview(null)} />
              {list.map(v => <Card key={v.id} name={v.name} sub={v.cat} on={raw === v.id} onUse={() => use(v)} onPreview={() => preview(v)}
                onDelete={v.cat === 'My voices' ? () => set({ customVoices: s.customVoices.filter(x => x.id !== v.id) }) : null} />)}
            </div>
            }
          </div>
          {/* external AI voice changers come in as a virtual microphone */}
          {cat === 'AI apps' && <div className="hidden" />}
          {/* custom voice */}
          <div className="w-[330px] shrink-0 flex flex-col rounded-xl bg-[#242427] p-3">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white"><Wand2 size={14} />Make your own</div>
            <p className="mt-0.5 mb-2 text-[11px] text-zinc-500">Changes are live on the mic. Start from any voice, then tweak.</p>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
              {SL.map(([k, n, mn, mx, st, f]) => <Row key={k} label={n}><Slider value={cur[k]} onChange={x => tweak({ [k]: x })} min={mn} max={mx} step={st} format={f} /></Row>)}
            </div>
            <div className="mt-2 flex gap-1.5"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Name, e.g. My stream voice" />
              <Button variant="primary" className="h-8 shrink-0" disabled={!name.trim()} onClick={() => { const v = { id: 'my-' + Date.now().toString(36), name: name.trim(), v: cur }; set({ customVoices: [...(s.customVoices || []), v] }); apply(v.id); setName(''); setCat('My voices') }}><Save size={12} />Save</Button></div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function Card({ name, sub, on, onUse, onPreview, onDelete }) {
  return <div onClick={onUse} className={cx('group relative cursor-pointer rounded-xl p-2.5 transition-all', on ? 'bg-white text-black' : 'bg-[#242427] text-zinc-100 hover:bg-[#2e2e32]')}>
    <div className="text-[12px] font-semibold truncate pr-14">{name}</div><div className={cx('text-[10.5px]', on ? 'text-black/60' : 'text-zinc-500')}>{sub}</div>
    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
      {on && <span className="size-7 grid place-items-center"><Check size={14} /></span>}
      <button title="Preview with your test recording" onClick={e => { e.stopPropagation(); onPreview() }} className={cx('size-7 grid place-items-center rounded-full', on ? 'bg-black/10 hover:bg-black/20' : 'bg-white/[0.08] hover:bg-white/[0.16]')}><Play size={12} /></button>
      {onDelete && <button title="Delete" onClick={e => { e.stopPropagation(); onDelete() }} className="size-7 grid place-items-center rounded-full bg-white/[0.08] hover:bg-red-500/30"><Trash2 size={12} /></button>}
    </div>
  </div>
}

// AI voice changers (w-okada / RVC, Voicemod and others) run as their own app and output a virtual microphone;
// pick that device here and Meroro streams the converted voice (turn Meroro's own voice off to avoid doubling).
const VIRT = /blackhole|vb-?audio|cable|voicemod|virtual|loopback|soundflower|krisp|voice ?changer|rvc|okada/i
function AiApps({ s, set }) {
  const [devs, setDevs] = useState(null)
  useEffect(() => { navigator.mediaDevices.enumerateDevices().then(d => setDevs(d.filter(x => x.kind === 'audioinput' && x.deviceId !== 'default'))) }, [])
  const virt = (devs || []).filter(d => VIRT.test(d.label)), use = d => set({ mic: d.deviceId, micLabel: d.label, voice: null })
  const L = (u, t) => <button onClick={() => window.open(u)} className="text-zinc-200 underline decoration-white/30 hover:decoration-white">{t}</button>
  return <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 text-[12px] leading-relaxed text-zinc-400">
    <div className="rounded-xl bg-[#242427] p-3 space-y-1.5">
      <div className="text-[13px] font-semibold text-white">Use an AI voice changer app</div>
      <p>AI voice changers copy a real voice model much more closely than any live effect, but they need a strong computer and add some delay. They run as their own app and give you a virtual microphone. Pick that microphone below and Meroro streams the changed voice.</p>
      <ol className="list-decimal pl-4 space-y-1">
        <li>Install a virtual audio cable: {L('https://existential.audio/blackhole/', 'BlackHole')} (Mac) or {L('https://vb-audio.com/Cable/', 'VB-CABLE')} (Windows). Both are free.</li>
        <li>Install a voice changer, for example the free, open-source {L('https://github.com/w-okada/voice-changer', 'w-okada Voice Changer')} (RVC voice models), and set its output to the virtual cable.</li>
        <li>Choose the virtual cable below as Meroro’s microphone.</li>
      </ol>
    </div>
    <div className="rounded-xl bg-[#242427] p-3 space-y-1.5">
      <div className="text-[13px] font-semibold text-white">Virtual microphones on this computer</div>
      {devs === null ? <p>Looking…</p> : !virt.length ? <p>None found yet. After installing one of the cables above, it shows up here.</p>
        : virt.map(d => <div key={d.deviceId} className="flex items-center gap-2 rounded-lg bg-black/25 px-2.5 h-10"><span className="flex-1 truncate text-zinc-100">{d.label}</span>
          {s.mic === d.deviceId ? <span className="text-emerald-400">In use</span> : <Button className="h-7" onClick={() => use(d)}>Use as microphone</Button>}</div>)}
      {!!devs?.length && <details className="pt-1"><summary className="cursor-pointer text-zinc-300">Other microphones</summary>
        {devs.filter(d => !VIRT.test(d.label)).map(d => <div key={d.deviceId} className="mt-1 flex items-center gap-2 rounded-lg bg-black/25 px-2.5 h-9"><span className="flex-1 truncate">{d.label}</span>
          {s.mic === d.deviceId ? <span className="text-emerald-400">In use</span> : <Button className="h-7" onClick={() => use(d)}>Use</Button>}</div>)}</details>}
    </div>
  </div>
}
