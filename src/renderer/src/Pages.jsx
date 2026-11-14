// Home (apps + quick actions), Presets gallery with previews, and the Automation page.
import { useEffect, useRef, useState } from 'react'
import {
  Radio, Circle, Camera, Mic, MicOff, Volume2, VolumeX, EyeOff, Eye, Play, Square, Smartphone, Zap, MessageSquare, AppWindow, Plus, Trash2,
  Music, FlaskConical, Gamepad2, LayoutGrid, RectangleVertical, Clapperboard, Check
} from 'lucide-react'
import { Button, Segmented, Select, Input, Switch, cx } from './ui'
import { PRESETS, uid } from './scene'
import Library from './Library'

const api = window.api

// ---------- Quick actions ----------
export function Quick({ q, compact }) {
  const { s, set } = q
  const items = [
    !compact && [q.cap === 'idle' ? 'Start capture' : 'Stop capture', q.cap === 'idle' ? Play : Square, q.cap === 'idle' ? q.start : q.stop, q.cap !== 'idle', !q.ready && q.cap === 'idle'],
    !compact && [q.live ? 'End stream' : 'Go Live', Radio, q.goLive, !!q.live, false, 'text-red-400'],
    !compact && [q.rec ? 'Stop recording' : 'Record', Circle, q.record, !!q.rec],
    [s.micMute ? 'Unmute mic' : 'Mute mic', s.micMute ? MicOff : Mic, () => set({ micMute: !s.micMute }), s.micMute],
    [s.phoneMute ? 'Unmute phone' : 'Mute phone', s.phoneMute ? VolumeX : Volume2, () => set({ phoneMute: !s.phoneMute }), s.phoneMute],
    [s.cover ? 'Show screen' : 'Hide screen', s.cover ? Eye : EyeOff, () => set({ cover: !s.cover }), s.cover],
    ['Screenshot', Camera, q.shot, false, !q.ready]
  ].filter(Boolean)
  if (compact) return <div className="flex items-center gap-0.5">{items.map(([t, I, fn, on, dis]) =>
    <Button key={t} variant="ghost" title={t} disabled={dis} onClick={fn} className={cx('px-2', on && 'text-amber-300 bg-amber-400/10')}><I size={14} /></Button>)}</div>
  return (
    <div className="grid grid-cols-7 gap-2">
      {items.map(([t, I, fn, on, dis, tone]) => (
        <button key={t} disabled={dis} onClick={fn}
          className={cx('h-[68px] rounded-xl border flex flex-col items-center justify-center gap-1.5 text-[11px] font-medium transition-colors disabled:opacity-40',
            on ? 'bg-white/[0.14] border-white/30 text-white' : 'bg-white/[0.03] border-white/[0.06] text-zinc-300 hover:bg-white/[0.07]')}>
          <I size={18} className={on ? 'text-violet-300' : tone || 'text-zinc-400'} />{t}
        </button>
      ))}
    </div>
  )
}

// ---------- Home ----------
export function Home({ q, dev, front, lib }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/[0.06] grid place-items-center"><Smartphone size={18} /></div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-white">{dev ? dev.model : 'No phone connected'}</div>
            <div className={cx('text-[12px]', dev?.state === 'device' ? 'text-emerald-400' : 'text-zinc-500')}>
              {!dev ? 'Plug in over USB, or connect by Wi-Fi from the Device page' : dev.state === 'device' ? `Ready${front ? ' · ' + front.name + ' is open' : ''}` : 'Tap “Allow” on the phone'}
            </div>
          </div>
          <span className="text-[11px] text-zinc-500">Double-click an app to stream it</span>
        </div>
        <Quick q={q} />
      </div>
      <div className="flex-1 min-h-0 flex"><Library {...lib} /></div>
    </div>
  )
}

// ---------- Presets ----------
const catOf = n => /Vertical|Shorts/.test(n) ? 'vertical' : /BGMI|Free Fire|Portrait game/.test(n) ? 'gaming' : 'studio'

export function Preview({ name, preset, className }) {
  const ref = useRef()
  useEffect(() => {
    const { scene, set } = preset || PRESETS[name](), [W, H] = (set?.canvas || '1920x1080').split('x').map(Number)
    const cv = ref.current, k = 360 / Math.max(W, H), w = cv.width = W * k, h = cv.height = H * k, c = cv.getContext('2d')
    const grad = (x, y, bw, bh, a, b) => { const g = c.createLinearGradient(x, y, x + bw, y + bh); g.addColorStop(0, a); g.addColorStop(1, b); return g }
    c.fillStyle = scene.bg2 ? grad(0, 0, w, h, scene.bg, scene.bg2) : scene.bgBlur ? grad(0, 0, w, h, '#1e293b', '#3b1d5e') : scene.bg
    c.fillRect(0, 0, w, h)
    for (const l of scene.layers) {
      let bw = l.w * w, bh = l.h * h
      if (l.type === 'phone' && l.fit === 'contain') { const ar = bw > bh ? 20 / 9 : 9 / 20, f = Math.min(bw / ar, bh); bw = f * ar; bh = f }
      if (l.type === 'text') bw = Math.min(w * 0.9, (l.text.length * 0.3 + 0.9) * bh)
      const x = l.x * w - bw / 2, y = l.y * h - bh / 2
      c.save(); c.beginPath(); c.roundRect(x, y, bw, bh, l.radius * Math.min(bw, bh)); c.clip()
      if (l.type === 'phone' || l.type === 'screen') { c.fillStyle = grad(x, y, bw, bh, '#0ea5e9', '#4f46e5'); c.fillRect(x, y, bw, bh); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(x + bw * 0.18, y + bh * 0.78, Math.min(bw, bh) * 0.1, 0, 7); c.arc(x + bw * 0.86, y + bh * 0.74, Math.min(bw, bh) * 0.07, 0, 7); c.fill() }
      else if (l.type === 'webcam') { c.fillStyle = '#334155'; c.fillRect(x, y, bw, bh); c.fillStyle = '#94a3b8'; c.beginPath(); c.arc(x + bw / 2, y + bh * 0.42, Math.min(bw, bh) * 0.2, 0, 7); c.fill(); c.beginPath(); c.arc(x + bw / 2, y + bh * 1.05, Math.min(bw, bh) * 0.42, 0, 7); c.fill() }
      else if (l.type === 'text') { if (l.bgOn) { c.fillStyle = l.bg; c.fillRect(x, y, bw, bh) } c.fillStyle = l.color; c.font = `700 ${bh * 0.5}px -apple-system, "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(l.text.replace('{time}', '21:30'), x + bw / 2, y + bh / 2, bw * 0.9) }
      else { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x, y, bw, bh); c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) c.fillRect(x + bw * 0.08, y + bh * (0.14 + i * 0.17), bw * (0.5 + (i % 3) * 0.15), bh * 0.06) }
      c.restore()
      if (l.border) { c.beginPath(); c.roundRect(x, y, bw, bh, l.radius * Math.min(bw, bh)); c.lineWidth = 1.5; c.strokeStyle = l.borderColor; c.stroke() }
    }
  }, [name, preset])
  return <canvas ref={ref} className={cx(className || 'max-w-full max-h-full', 'rounded-md shadow-lg ring-1 ring-white/10')} />
}

export function Presets({ apply, busy }) {
  const [cat, setCat] = useState('all'), [done, setDone] = useState('')
  const names = Object.keys(PRESETS).filter(n => cat === 'all' || catOf(n) === cat)
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-4 px-6 pt-5 pb-4">
        <div className="flex-1"><h1 className="text-[20px] font-bold tracking-tight text-white">Presets</h1>
          <p className="text-[12px] text-zinc-500">Ready-made scenes. Click one to add it and open the Studio.{busy ? ' Canvas size stays as it is while you are live.' : ''}</p></div>
        <div className="w-[420px]"><Segmented value={cat} onChange={setCat} options={[['all', 'All', LayoutGrid], ['gaming', 'Gaming', Gamepad2], ['vertical', 'Vertical', RectangleVertical], ['studio', 'Studio', Clapperboard]]} /></div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {names.map(n => (
            <button key={n} onClick={() => { setDone(n); apply(n) }} className="group text-left rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-400/50 hover:bg-white/[0.06] transition-colors overflow-hidden">
              <div className="h-[170px] grid place-items-center bg-black/40 p-3"><Preview name={n} /></div>
              <div className="p-3">
                <div className="text-[13px] font-medium text-zinc-100 truncate">{n.split(' · ').slice(1).join(' · ') || n}</div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-500">
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 capitalize">{catOf(n)}</span>
                  {PRESETS[n]().set?.fps === 60 && <span className="rounded bg-white/[0.06] px-1.5 py-0.5">60 fps</span>}
                  {done === n && <span className="ml-auto flex items-center gap-1 text-emerald-400"><Check size={11} />Added</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- YouTube chat box (used in Studio's Chat tab and on the Automation page) ----------
export function ChatBox({ s, set, chat, st, go, tall }) {
  const end = useRef()
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [chat.length])
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input value={s.chatUrl || ''} disabled={st.on} onChange={e => set({ chatUrl: e.target.value })} placeholder="Your live stream link or @channel" />
        <Button variant={st.on ? 'default' : 'primary'} disabled={st.busy || (!st.on && !s.chatUrl)} onClick={() => go()}>{st.on ? 'Disconnect' : st.busy ? '…' : 'Connect'}</Button>
      </div>
      {st.err && <p className="text-[11px] text-red-400">{st.err}</p>}
      {st.on && <p className="flex items-center gap-1.5 text-[11px] text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400 live-dot" /><span className="truncate">{st.title}</span></p>}
      <div className={cx('overflow-y-auto rounded-lg bg-black/30 border border-white/[0.06] p-2 space-y-1', tall ? 'h-[420px]' : 'h-[360px]')}>
        {!chat.length && <div className="h-full grid place-items-center text-center text-[12px] text-zinc-600">Chat messages appear here.<br />Add a “YouTube chat” source to show them on stream.</div>}
        {chat.map((m, i) => (
          <div key={m.id || i} className={cx('rounded px-1.5 py-0.5 text-[12px] leading-snug', m.type === 'superchat' ? 'bg-yellow-400/90 text-black' : m.type === 'member' ? 'bg-emerald-400/90 text-black' : '')}>
            <b className={m.type === 'chat' ? 'text-violet-300' : ''}>{m.author}{m.amount && ' · ' + m.amount}</b> <span className={m.type === 'chat' ? 'text-zinc-300' : ''}>{m.text}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  )
}

// ---------- Automation ----------
const TRIG = [['superchat', 'Super Chat / Super Sticker'], ['member', 'New member'], ['chat', 'Any chat message'], ['command', 'Chat command (starts with)'], ['keyword', 'Chat contains word'], ['live', 'Stream started'], ['end', 'Stream ended']]
const IDEAS = [
  ['Super Chat → music + alert', { on: 'superchat', alert: '{name} sent {amount}!', sub: '{text}' }],
  ['New member → alert', { on: 'member', alert: 'Welcome {name}!', sub: 'New member' }],
  ['!brb → BRB scene', { on: 'command', arg: '!brb' }],
  ['Stream started → alert', { on: 'live', alert: 'We are LIVE', sub: 'Welcome to the stream' }]
]

export function Automation({ s, set, test, appRules, chatBox, stopSound }) {
  const [tab, setTab] = useState('rules')
  const rules = s.autos || [], up = (id, p) => set({ autos: rules.map(r => r.id === id ? { ...r, ...p } : r) })
  const add = o => set({ autos: [...rules, { id: uid(), enabled: true, on: 'superchat', arg: '', alert: '', sub: '', sound: '', scene: '', ...o }] })
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-4 px-6 pt-5 pb-4">
        <div className="flex-1"><h1 className="text-[20px] font-bold tracking-tight text-white">Automation</h1>
          <p className="text-[12px] text-zinc-500">Make things happen by themselves: when chat, Super Chats or your phone do something, Meroro reacts.</p></div>
        <div className="w-[440px]"><Segmented value={tab} onChange={setTab} options={[['rules', 'Chat triggers', Zap], ['apps', 'Phone apps', AppWindow], ['chat', 'YouTube chat', MessageSquare]]} /></div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {tab === 'rules' && <div className="space-y-3 max-w-[980px]">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => add({})}><Plus size={13} />New rule</Button>
            {IDEAS.map(([t, o]) => <Button key={t} onClick={() => add(o)}>{t}</Button>)}
            <div className="flex-1" /><Button variant="ghost" onClick={stopSound}><Square size={11} />Stop sound</Button>
          </div>
          {!rules.length && <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-zinc-500">No rules yet. Try “Super Chat → music + alert”, then pick a sound file.</div>}
          {rules.map(r => (
            <div key={r.id} className={cx('rounded-xl border p-3 space-y-2', r.enabled ? 'bg-white/[0.03] border-white/[0.08]' : 'border-white/[0.05] opacity-60')}>
              <div className="flex items-center gap-2">
                <Switch checked={r.enabled} onChange={enabled => up(r.id, { enabled })} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 w-10">When</span>
                <Select className="w-[230px]" value={r.on} onChange={on => up(r.id, { on })} options={TRIG} />
                {(r.on === 'command' || r.on === 'keyword') && <Input className="w-[150px]" value={r.arg} onChange={e => up(r.id, { arg: e.target.value })} placeholder={r.on === 'command' ? '!hello' : 'word'} />}
                <div className="flex-1" />
                <Button onClick={() => test(r)}><FlaskConical size={12} />Test</Button>
                <Button variant="ghost" className="px-1.5" onClick={() => set({ autos: rules.filter(x => x.id !== r.id) })}><Trash2 size={13} /></Button>
              </div>
              <div className="grid grid-cols-[52px_1fr_1fr] items-center gap-2 pl-10">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Alert</span>
                <Input value={r.alert} onChange={e => up(r.id, { alert: e.target.value })} placeholder="Title, e.g. {name} sent {amount}!  (empty = no alert)" />
                <Input value={r.sub} onChange={e => up(r.id, { sub: e.target.value })} placeholder="Second line, e.g. {text}" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Sound</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Button onClick={async () => { const f = await api.invoke('file:pick', 'audio'); if (f) up(r.id, { sound: f }) }}><Music size={12} />{r.sound ? 'Change' : 'Choose music / sound'}</Button>
                  <span className="truncate text-[11px] text-zinc-500">{r.sound.split(/[\\/]/).pop()}</span>
                  {r.sound && <button className="text-zinc-500 hover:text-zinc-200" onClick={() => up(r.id, { sound: '' })}><Trash2 size={11} /></button>}
                </div>
                <div className="flex items-center gap-2"><span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Scene</span>
                  <Select className="flex-1" value={r.scene} onChange={scene => up(r.id, { scene })} options={[['', 'Don’t switch'], ...s.scenes.map(x => [x.id, x.name])]} /></div>
              </div>
            </div>
          ))}
        </div>}
        {tab === 'apps' && <div className="max-w-[560px] rounded-xl border border-white/[0.06] bg-white/[0.02]">{appRules}</div>}
        {tab === 'chat' && <div className="max-w-[560px]">{chatBox}</div>}
      </div>
    </div>
  )
}

// Compact automation for the right panel: chat triggers and phone-app scene rules, stacked.
export function AutoPanel({ s, set, test, appRules, stopSound }) {
  const [tab, setTab] = useState('rules')
  const rules = s.autos || [], up = (id, p) => set({ autos: rules.map(r => r.id === id ? { ...r, ...p } : r) })
  const add = o => set({ autos: [...rules, { id: uid(), enabled: true, on: 'superchat', arg: '', alert: '', sub: '', sound: '', scene: '', ...o }] })
  return (
    <div className="space-y-1.5">
      <Segmented value={tab} onChange={setTab} options={[['rules', 'Chat triggers', Zap], ['apps', 'Phone apps', AppWindow]]} />
      {tab === 'apps' ? appRules : <>
        <div className="flex gap-1.5">
          <Select className="flex-1" value="" onChange={v => add(v === 'new' ? {} : IDEAS[+v][1])} options={[['', 'Add rule…'], ['new', 'Blank rule'], ...IDEAS.map(([t], i) => [String(i), t])]} />
          <Button title="Stop sound" onClick={stopSound}><Square size={11} /></Button>
        </div>
        {!rules.length && <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-[12px] text-zinc-500">No rules yet</div>}
        {rules.map(r => (
          <div key={r.id} className={cx('rounded-xl bg-[#242427] p-2.5 space-y-1.5', !r.enabled && 'opacity-60')}>
            <div className="flex items-center gap-1.5">
              <Switch checked={r.enabled} onChange={enabled => up(r.id, { enabled })} />
              <Select className="flex-1 min-w-0" value={r.on} onChange={on => up(r.id, { on })} options={TRIG} />
              <Button variant="ghost" className="px-1.5" title="Test" onClick={() => test(r)}><FlaskConical size={12} /></Button>
              <Button variant="ghost" className="px-1.5" title="Delete" onClick={() => set({ autos: rules.filter(x => x.id !== r.id) })}><Trash2 size={12} /></Button>
            </div>
            {(r.on === 'command' || r.on === 'keyword') && <Input value={r.arg} onChange={e => up(r.id, { arg: e.target.value })} placeholder={r.on === 'command' ? '!hello' : 'word'} />}
            <Input value={r.alert} onChange={e => up(r.id, { alert: e.target.value })} placeholder="Alert title, e.g. {name} sent {amount}!" />
            <Input value={r.sub} onChange={e => up(r.id, { sub: e.target.value })} placeholder="Second line, e.g. {text}" />
            <div className="flex gap-1.5">
              <Button className="flex-1 min-w-0 h-8" onClick={async () => { const f = await api.invoke('file:pick', 'audio'); if (f) up(r.id, { sound: f }) }}><Music size={12} /><span className="truncate">{r.sound ? r.sound.split(/[\\/]/).pop() : 'Sound'}</span></Button>
              <Select className="flex-1 min-w-0" value={r.scene} onChange={scene => up(r.id, { scene })} options={[['', 'No scene switch'], ...s.scenes.map(x => [x.id, x.name])]} />
            </div>
          </div>
        ))}
      </>}
    </div>
  )
}
