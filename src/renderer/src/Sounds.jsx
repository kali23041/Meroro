// Sounds tab: mic clean-up (noise suppression, push-to-talk), background music with ducking, and a soundboard.
import { useEffect, useState } from 'react'
import { Captions as CapIcon, Mic, Music, Play, Pause, SkipForward, SkipBack, Plus, Trash2, Square, Grid3x3, Shuffle } from 'lucide-react'
import { Button, Row, Section, Segmented, Slider, Switch, Input, Select, cx } from './ui'
import { KeyCap } from './Keys'
import { uid, newLayer } from './scene'
import { CAP_LANGS } from './captions'

const api = window.api
const base = p => p.split(/[\\/]/).pop().replace(/\.\w+$/, '')

// Live captions: speech-to-text on this computer (no account, no internet after the first download).
function CaptionsBox({ s, set, eng, addLayer, openStyles }) {
  const [st, setSt] = useState('off'), [pct, setPct] = useState(0)
  useEffect(() => window.api.on('captions:progress', setPct), [])
  useEffect(() => { const t = setInterval(() => setSt(eng.current?.cap?.state || 'off'), 400); return () => clearInterval(t) }, [])
  const has = s.scenes.find(x => x.id === s.sceneId)?.layers.some(l => l.type === 'caption')
  const msg = !s.capOn ? 'Turns your voice into text on the stream' : st === 'loading' ? `Getting the speech model ready (about 40 MB, one time)…${pct && pct < 100 ? ' ' + pct + '%' : ''}` : st === 'error' ? 'Could not load the speech model. Check your internet and try again.'
    : !s.mic ? 'Choose a microphone in the mixer first' : 'Listening'
  return <Section icon={CapIcon} title="Live captions" right={<Switch checked={!!s.capOn} onChange={capOn => set({ capOn })} />}>
    <div className={cx('text-[11px]', st === 'error' && s.capOn ? 'text-red-400' : s.capOn && st === 'on' && s.mic ? 'text-emerald-400' : 'text-zinc-500')}>{msg}</div>
    <Row label="Language"><Select className="flex-1" value={s.capLang || 'en-in'} onChange={capLang => set({ capLang })} options={CAP_LANGS.map(l => [l[0], l[1]])} /></Row>
    {!has && <Button className="w-full h-8" onClick={() => { set({ capOn: true }); addLayer(newLayer('caption')) }}><Plus size={12} />Add caption box to this scene</Button>}
    <Button className="w-full h-8" onClick={openStyles}>Browse caption styles</Button>
  </Section>
}

export default function Sounds({ s, set, eng, addLayer, openStyles }) {
  const list = s.playlist || [], pads = s.pads || [], ptt = { mode: 'off', key: 'KeyV', ...s.ptt }
  const [cur, setCur] = useState(-1), [playing, setPlaying] = useState(false), [edit, setEdit] = useState(false)
  const play = async i => { if (!list.length) return; const n = (i + list.length) % list.length; setCur(n); setPlaying(true); try { await eng.current.playMusic(list[n]) } catch { setPlaying(false) } }
  useEffect(() => { eng.current.onMusicEnd = () => play(s.shuffle ? Math.floor(Math.random() * list.length) : cur + 1) }, [cur, list, s.shuffle])
  const toggle = () => { if (playing) { eng.current.pauseMusic(); setPlaying(false) } else if (cur < 0) play(0); else { eng.current.playMusic(); setPlaying(true) } }
  const upPad = (id, p) => set({ pads: pads.map(x => x.id === id ? { ...x, ...p } : x) })

  return <>
    <CaptionsBox s={s} set={set} eng={eng} addLayer={addLayer} openStyles={openStyles} />
    <Section icon={Mic} title="Microphone">
      <Row label="Noise removal"><Switch checked={!!s.noise} onChange={noise => set({ noise })} /></Row>
      <Segmented value={ptt.mode} onChange={mode => set({ ptt: { ...ptt, mode } })} options={[['off', 'Always on'], ['ptt', 'Push to talk'], ['ptm', 'Push to mute']]} />
      {ptt.mode !== 'off' && <Row label="Hold key"><KeyCap plain value={ptt.key} onChange={key => set({ ptt: { ...ptt, key } })} /></Row>}
    </Section>

    <Section icon={Music} title="Music" right={<button className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10" title="Add songs" onClick={async () => { const f = await api.invoke('file:pick', 'audio', true); if (f?.length) set({ playlist: [...list, ...f] }) }}><Plus size={13} /></button>}>
      <div className="flex items-center gap-1">
        <Button className="h-8 px-2" disabled={!list.length} onClick={() => play(cur - 1)}><SkipBack size={13} /></Button>
        <Button variant="primary" className="h-8 flex-1" disabled={!list.length} onClick={toggle}>{playing ? <><Pause size={13} />Pause</> : <><Play size={13} />Play</>}</Button>
        <Button className="h-8 px-2" disabled={!list.length} onClick={() => play(cur + 1)}><SkipForward size={13} /></Button>
        <Button className={cx('h-8 px-2', s.shuffle && '!bg-white !text-black')} title="Shuffle" onClick={() => set({ shuffle: !s.shuffle })}><Shuffle size={13} /></Button>
      </div>
      <Row label="Volume"><Slider value={s.musicVol ?? 0.5} onChange={musicVol => set({ musicVol })} max={1} /></Row>
      <Row label="Lower when I talk"><Switch checked={s.duck !== false} onChange={duck => set({ duck })} /></Row>
      <div className="max-h-[150px] overflow-y-auto rounded-lg bg-black/20 p-1">
        {!list.length && <div className="p-3 text-center text-[11px] text-zinc-500">Press + to add songs</div>}
        {list.map((p, i) => <div key={p + i} className={cx('group flex items-center gap-2 rounded-md px-2 h-7 text-[12px]', i === cur ? 'bg-accent text-white' : 'hover:bg-white/5 text-zinc-300')}>
          <button className="flex-1 min-w-0 truncate text-left" onClick={() => play(i)}>{base(p)}</button>
          <button className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white" onClick={() => set({ playlist: list.filter((_, j) => j !== i) })}><Trash2 size={11} /></button>
        </div>)}
      </div>
    </Section>

    <Section icon={Grid3x3} title="Soundboard" right={<>
      <button className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10" title="Stop all" onClick={() => eng.current.stopSound()}><Square size={11} /></button>
      <button className={cx('px-1.5 rounded text-[11px]', edit ? 'text-white bg-white/10' : 'text-zinc-500 hover:text-white')} onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</button>
      <button className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10" title="Add sound" onClick={async () => { const f = await api.invoke('file:pick', 'audio'); if (f) set({ pads: [...pads, { id: uid(), name: base(f), file: f, key: '' }] }) }}><Plus size={13} /></button></>}>
      {!pads.length && <div className="text-[11px] text-zinc-500">Press + to add a sound. Give it a key to play it from anywhere.</div>}
      <div className="grid grid-cols-3 gap-1">
        {pads.map(p => edit ? <div key={p.id} className="col-span-3 flex items-center gap-1">
            <Input className="flex-1 min-w-0" value={p.name} onChange={e => upPad(p.id, { name: e.target.value })} />
            <KeyCap value={p.key} onChange={key => upPad(p.id, { key })} />
            <button className="p-1 text-zinc-500 hover:text-white" onClick={() => set({ pads: pads.filter(x => x.id !== p.id) })}><Trash2 size={12} /></button></div>
          : <button key={p.id} onClick={() => eng.current.playSound(p.file)} className="h-14 rounded-lg bg-[#323236] hover:bg-[#3a3a3f] active:scale-95 transition-transform px-1.5 text-left">
            <span className="block truncate text-[11px] font-semibold text-zinc-100">{p.name}</span><span className="block text-[10px] text-zinc-500">{p.key ? p.key.replace(/Key|Digit/g, '') : '—'}</span></button>)}
      </div>
    </Section>
  </>
}
