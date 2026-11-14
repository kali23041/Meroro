// Title-bar quick controls: compact volume sliders and one-click toggles. The gear picks which ones show (saved in settings).
import { useState } from 'react'
import { Circle, Mic, MicOff, Volume2, VolumeX, Headphones, AudioLines, EyeOff, Eye, Gamepad2, MousePointer2, MessageSquare, Camera, Wand2, Settings2, Clapperboard, Check } from 'lucide-react'
import { Slider, Select, cx } from './ui'

const ACTIONS = {
  rec: ['Record', Circle], mic: ['Mute mic', MicOff], phone: ['Mute phone audio', VolumeX], monitor: ['Hear phone audio', Headphones],
  noise: ['Noise suppression', AudioLines], cover: ['Hide phone on stream', EyeOff], keys: ['Game controls', Gamepad2], control: ['Control phone with mouse', MousePointer2],
  auto: ['Auto scene switching', Wand2], chat: ['Chat window', MessageSquare], shot: ['Phone screenshot', Camera]
}
const SLIDERS = { phoneVol: ['Phone', Volume2, 'phone'], micVol: ['Mic', Mic, 'mic'] }
export const HQ_DEFAULT = { hq: ['rec', 'mic', 'phone', 'cover', 'keys', 'chat', 'shot'], hqSliders: ['phoneVol', 'micVol'], hqScene: true }

export default function HeaderBar({ q, eng, toggleKeys }) {
  const { s, set } = q, [edit, setEdit] = useState(false)
  const shown = s.hq ?? HQ_DEFAULT.hq, sliders = s.hqSliders ?? HQ_DEFAULT.hqSliders, scene = s.hqScene ?? HQ_DEFAULT.hqScene
  const state = {
    rec: [!!q.rec, q.record], mic: [s.micMute, () => set({ micMute: !s.micMute })], phone: [s.phoneMute, () => set({ phoneMute: !s.phoneMute })],
    monitor: [s.monitor, () => set({ monitor: !s.monitor })], noise: [s.noise, () => set({ noise: !s.noise })], cover: [s.cover, () => set({ cover: !s.cover })],
    keys: [s.keymapOn, toggleKeys], control: [s.control, () => set({ control: !s.control })], auto: [s.autoSwitch, () => set({ autoSwitch: !s.autoSwitch })],
    chat: [s.chatFloat, () => set({ chatFloat: !s.chatFloat })], shot: [false, q.shot, !q.ready]
  }
  const flip = (k, list, key) => set({ [key]: list.includes(k) ? list.filter(x => x !== k) : [...list, k] })

  return (
    <div className="no-drag relative flex items-center gap-1.5 min-w-0">
      {sliders.map(k => { const [t, I, ch] = SLIDERS[k]; const muted = ch === 'mic' ? s.micMute : s.phoneMute
        return <div key={k} className={cx('w-[150px] shrink-0', muted && 'opacity-50')}>
          <Slider className="h-7" label={<span className="flex items-center gap-1"><I size={12} />{t}</span>} level={() => eng.current?.level(ch) || 0} value={s[k]} onChange={v => set({ [k]: v })} max={1.5} />
        </div> })}
      {scene && s.scenes?.length > 1 && <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] pl-2"><Clapperboard size={12} className="text-zinc-500" />
        <Select className="w-[120px] h-7 bg-transparent" value={s.sceneId} onChange={sceneId => set({ sceneId })} options={s.scenes.map(x => [x.id, x.name])} /></div>}
      <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
        {shown.filter(k => ACTIONS[k]).map(k => { const [t, Icon] = ACTIONS[k], [on, fn, dis] = state[k]
          const I = k === 'mic' && !on ? Mic : k === 'phone' && !on ? Volume2 : k === 'cover' && on ? Eye : Icon
          return <button key={k} title={t} disabled={dis} onClick={fn}
            className={cx('h-7 min-w-7 px-1.5 rounded-md grid place-items-center transition-colors disabled:opacity-35',
              on ? (k === 'rec' ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.14] text-white') : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]')}>
            {k === 'rec' && on ? <span className="flex items-center gap-1 text-[11px] tabular-nums"><Circle size={9} fill="currentColor" className="live-dot" />{q.rec}</span> : <I size={14} />}
          </button> })}
        <button title="Choose quick controls" onClick={() => setEdit(!edit)} className={cx('h-7 w-7 rounded-md grid place-items-center text-zinc-500 hover:text-white hover:bg-white/[0.08]', edit && 'bg-white/[0.1] text-white')}><Settings2 size={13} /></button>
      </div>

      {edit && <>
        <div className="fixed inset-0 z-40" onClick={() => setEdit(false)} />
        <div className="pop absolute right-0 top-9 z-50 w-[250px] rounded-2xl border border-white/10 bg-[#1c1c1f]/95 backdrop-blur-xl p-2 shadow-2xl">
          <div className="px-2 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">Sliders</div>
          {Object.entries(SLIDERS).map(([k, [t, I]]) => <Item key={k} on={sliders.includes(k)} I={I} t={t + ' volume'} onClick={() => flip(k, sliders, 'hqSliders')} />)}
          <Item on={scene} I={Clapperboard} t="Scene switcher" onClick={() => set({ hqScene: !scene })} />
          <div className="px-2 pt-2.5 pb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">Buttons</div>
          {Object.entries(ACTIONS).map(([k, [t, I]]) => <Item key={k} on={shown.includes(k)} I={I} t={t} onClick={() => flip(k, shown, 'hq')} />)}
          <button onClick={() => set(HQ_DEFAULT)} className="mt-1.5 w-full h-7 rounded-lg text-[11px] text-zinc-400 hover:bg-white/[0.06] hover:text-white">Reset to default</button>
        </div>
      </>}
    </div>
  )
}

const Item = ({ on, I, t, onClick }) => (
  <button onClick={onClick} className="w-full h-8 flex items-center gap-2.5 rounded-lg px-2 text-left text-[12px] text-zinc-200 hover:bg-white/[0.06]">
    <I size={13} className="text-zinc-400" /><span className="flex-1">{t}</span>
    <span className={cx('size-4 rounded grid place-items-center border', on ? 'bg-white border-white text-black' : 'border-white/20')}>{on && <Check size={11} strokeWidth={3} />}</span>
  </button>
)
