// What's new: every feature added to Meroro, newest first, each with a button that takes you to it.
import { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, Download, RefreshCw, Loader2 } from 'lucide-react'
import { Button, Switch, cx } from './ui'
import { VERSION } from './Brand'

const api = window.api
const L = (title, desc, go, tag) => ({ title, desc, go, tag })
export const RELEASES = [
  { v: '1.4.0', items: [
    L('Name banners', '56 animated bottom banners: neon bar, slant, glass, cyber, esports and more. Edit name, handles, font, colours, glow and animation, add your own picture, then copy to the scene.', { view: 'fx' }, 'Overlays'),
    L('Stream scenes', '60 animated Starting soon, Ending and Be right back scenes with moving backgrounds and text effects. One click imports the scene.', { view: 'fx' }, 'Overlays'),
    L('Alert effects', '20 animated alerts (confetti, coin rain, neon, glitch…) for Super Chats, members, chat and subscribe reminders. Import adds the rule and the alert.', { view: 'fx' }, 'Overlays'),
    L('Reminder trigger', 'Automation rule that fires every N minutes while live, e.g. a Subscribe reminder.', { rtab: 'auto' }, 'Chat')
  ] },
  { v: '1.3.0', items: [
    L('Auto-reconnect', 'If the internet drops, Meroro keeps retrying and resumes the stream by itself, with a “Reconnecting…” badge.', { rtab: 'live' }, 'Stream'),
    L('Auto bitrate', 'Lowers quality when your upload slows down and raises it again when it recovers.', { rtab: 'live' }, 'Stream'),
    L('Stream health graph', 'Live chart of bitrate and encoder speed, plus dropped frames, with a warning before viewers notice.', { rtab: 'live' }, 'Stream'),
    L('Second output (vertical + horizontal)', 'Stream a second scene, e.g. 9:16 to Shorts or TikTok, at the same time as your main stream.', { rtab: 'live' }, 'Stream'),
    L('Stream title helper', 'Title template per game, copied for you when the game changes, and YouTube Studio / Twitch opened signed in.', { rtab: 'live' }, 'Stream'),
    L('More transitions', 'Slide, swipe, zoom and stinger videos with sound, besides fade and cut.', { rtab: 'auto' }, 'Scenes'),
    L('Lower thirds', 'Name and handle that slide in, hold and slide out. Three styles, press Play to show.', { add: 'lower' }, 'Sources'),
    L('Goal bars', 'Super Chat, member or chat-message goals that fill up live from your YouTube chat.', { add: 'goal' }, 'Sources'),
    L('Blur / mask box', 'Blur, pixelate or block an area — only on the stream, the phone is untouched.', { add: 'mask' }, 'Sources'),
    L('Green screen (chroma key)', 'Remove a colour from webcams and videos. In Properties → Color.', { rtab: 'props' }, 'Effects'),
    L('LUT colour filters', 'Load .cube colour profiles for a cinematic look. In Properties → Color.', { rtab: 'props' }, 'Effects'),
    L('Nested scenes', 'Show one scene inside another — edit your facecam frame once, it updates everywhere.', { add: 'scene' }, 'Sources'),
    L('Snap guides & align', 'Sources snap to edges, centres and each other while you drag; align buttons in Properties → Move.', { rtab: 'props' }, 'Scenes'),
    L('Noise suppression', 'RNNoise removes fan, keyboard and room noise from your mic.', { rtab: 'sounds' }, 'Audio'),
    L('Background music', 'Playlist with shuffle; music lowers by itself while you talk.', { rtab: 'sounds' }, 'Audio'),
    L('Push-to-talk / push-to-mute', 'Hold a key to talk, or to mute.', { rtab: 'sounds' }, 'Audio'),
    L('Soundboard', 'Sound buttons with keys that work even when Meroro is in the background.', { rtab: 'sounds' }, 'Audio'),
    L('Chat overlay styles', 'Classic, bubble, minimal or game chat, with optional fade-out.', { add: 'chat' }, 'Chat'),
    L('Chat commands & bot replies', '!discord, !specs… Meroro replies in YouTube chat as you (sign in once).', { rtab: 'auto' }, 'Chat'),
    L('Controller support', 'Xbox / PlayStation controllers in key maps: buttons, analog move stick and right-stick aim.', { view: 'keys' }, 'Games'),
    L('Auto-update', 'Meroro checks GitHub for new versions and installs them with one click.', { view: 'new' }, 'App')
  ] },
  { v: '1.2.0', items: [
    L('iPhone & iPad', 'USB capture on Mac and a built-in AirPlay receiver, in Add source.', { add: 'ios' }, 'Sources'),
    L('Clean screen', 'Hide notifications, Game Booster and floating apps on the phone while streaming.', {}, 'Phone'),
    L('Screen triggers', 'Free the mouse automatically when a crate, map or bag opens.', { view: 'keys' }, 'Games'),
    L('Key maps for any app', 'Pick any game preset for any app from the source settings or the bottom bar.', {}, 'Games'),
    L('Phone stats', 'CPU, GPU, RAM, temperatures and battery under the preview and on the Device page.', { view: 'device' }, 'Phone')
  ] }
]
export const LATEST = RELEASES[0].v

export default function WhatsNew({ go, s, set }) {
  const [up, setUp] = useState(undefined), [busy, setBusy] = useState('')
  const check = () => { setUp(undefined); api.invoke('update:check').then(setUp).catch(() => setUp(null)) }
  useEffect(() => { check(); if (s.seenNew !== LATEST) set({ seenNew: LATEST }) }, [])
  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-3 mb-4"><Sparkles size={20} className="text-orange-400" /><h1 className="flex-1 text-[20px] font-bold tracking-tight text-white">What’s new</h1>
        <span className="text-[12px] text-zinc-500">You have Meroro {VERSION}</span></div>
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#242427] p-3.5">
        <Download size={16} className="text-zinc-400" />
        <div className="flex-1 text-[12px]">{up === undefined ? 'Checking for updates…' : up ? <span className="text-white">Meroro {up.version} is available.</span> : 'Meroro is up to date.'}
          {busy && busy !== 'go' && <span className="ml-2 text-red-400">{busy}</span>}</div>
        <span className="text-[12px] text-zinc-400">Check on launch</span><Switch checked={s.autoUpdate !== false} onChange={autoUpdate => set({ autoUpdate })} />
        {up ? <Button variant="primary" className="h-8 px-4" disabled={busy === 'go'} onClick={async () => { setBusy('go'); try { await api.invoke('update:install', up) } catch (e) { setBusy(String(e.message || e)) } }}>{busy === 'go' ? <><Loader2 size={13} className="animate-spin" />Installing…</> : 'Install & restart'}</Button>
          : <Button className="h-8" onClick={check}><RefreshCw size={12} />Check</Button>}
      </div>
      {RELEASES.map(r => (
        <div key={r.v} className="mb-6">
          <div className="mb-2 flex items-center gap-2"><span className="rounded-md bg-white/10 px-2 py-0.5 text-[12px] font-bold text-white">v{r.v}</span>{r.v === LATEST && <span className="text-[11px] text-orange-300">Latest</span>}</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2">
            {r.items.map(it => (
              <button key={it.title} onClick={() => go(it.go)} className="group text-left rounded-2xl bg-[#242427] hover:bg-[#2c2c30] p-3.5 transition-colors">
                <div className="flex items-center gap-2"><span className="flex-1 text-[13px] font-semibold text-white">{it.title}</span><span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-zinc-400">{it.tag}</span></div>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{it.desc}</p>
                <span className={cx('mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 group-hover:text-white', !Object.keys(it.go).length && 'invisible')}>Open <ArrowRight size={11} /></span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
