// What's new: every feature added to Meroro, newest first, each with a button that takes you to it.
import { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, Download, RefreshCw, Loader2 } from 'lucide-react'
import { Button, Switch, cx } from './ui'
import { VERSION } from './Brand'

const api = window.api
const L = (title, desc, go, tag) => ({ title, desc, go, tag })
export const RELEASES = [
  { v: '1.12.0', items: [
    L('Voice changer', '42 voices (female, male, kids, characters, robots, places) plus your own custom voices, live on your mic. Record a 4-second test and preview any voice before using it.', {}, 'Audio'),
    L('Multiple microphones', 'Add as many mics as you like. The mic slot splits into 2 or 3 faders, with “View all” for more; each mic has its own settings inside its fader.', {}, 'Audio'),
    L('Smarter mixer', 'Phone, mic, music and effects stay greyed out until something feeds them, with a button that adds it.', {}, 'Audio'),
    L('Record in 2K and 4K', 'Recording settings (gear on Record): record the studio, one frame or only one scene, at 1080p, 2K or 4K, in standard, high or maximum quality.', {}, 'Recording'),
    L('Higher capture quality', 'Phone up to native resolution, 120 fps and 40 Mbps; webcams up to 4K/60; screens and windows up to 4K/60.', {}, 'Sources'),
    L('Video sound & loop', 'Video file sources can play their sound into the stream and choose whether to loop.', {}, 'Sources'),
    L('Natural voice changer', 'New voice engine (Signalsmith Stretch) keeps the shape of your voice while changing its pitch, so voices sound human instead of robotic.', {}, 'Audio'),
    L('AI voice changer apps', 'Voice changer → AI apps: use w-okada (RVC), Voicemod and others through a virtual microphone.', {}, 'Audio'),
    L('Mic fixes', 'Microphones are found again by name when their ID changes, and the mic no longer goes silent when live captions start.', {}, 'Audio'),
    L('Landscape lock', 'Phone sources can switch to a scene of your choice (e.g. Be right back) or hide the phone when it turns upright, and come back when it turns sideways.', { rtab: 'props' }, 'Sources'),
    L('Undo & redo', 'Cmd/Ctrl+Z undoes your last change anywhere in the studio; Cmd/Ctrl+Shift+Z or Ctrl+Y redoes it.', {}, 'App'),
    L('Zoom inside a source', 'Zoom in or out of what a source shows (e.g. into BGMI) without changing the source’s size, and pick where to look.', { rtab: 'props' }, 'Sources'),
    L('Effects mixer', 'The Effects fader is the master; its settings list every sound effect with its own volume, play and on/off.', {}, 'Audio'),
    L('Reset everything', 'One button in Settings puts Meroro back to first-launch state (with a warning). Recordings are kept.', { view: 'settings' }, 'App'),
    L('Sound effects', '16 built-in sound effects. Overlays and alert effects bring their own sound, nested under them in Sources, and play it when added.', {}, 'Sources')
  ] },
  { v: '1.11.0', items: [
    L('Frames', 'A new level above scenes: each frame has its own size and shape (Desktop, Phone/Shorts, Instagram, Square, TikTok…) and its own scenes.', {}, 'Scenes'),
    L('Stream frames together', 'Send each platform its own frame, e.g. vertical to Shorts and horizontal to YouTube, live at the same time. Use the same camera in as many frames as you like.', { rtab: 'live' }, 'Stream'),
    L('Linked frames', 'Make a frame the child of another: sources you add to the parent (like your camera) appear in the child too, each with its own position, size and style. Set it in the frame’s settings.', {}, 'Scenes'),
    L('Frames side by side', 'See every frame live next to each other in one window, and click one to edit it.', {}, 'Scenes')
  ] },
  { v: '1.10.0', items: [
    L('Advanced mixer', 'Phone, mic, music, effects and master faders with live meters, dB readouts, clip lights and mute buttons in the bottom bar.', {}, 'Audio'),
    L('Channel effects', 'Per channel: pan, bass/mids/treble EQ, compressor, low cut, sync delay and monitoring, with presets like Clear voice and Radio voice.', {}, 'Audio'),
    L('Mic noise gate', 'Cuts room noise between your words, on top of AI noise removal.', {}, 'Audio')
  ] },
  { v: '1.9.0', items: [
    L('Annotate on screen', 'Draw over any app, not just inside Meroro: a see-through layer on top of your whole screen with every annotation tool. Monitor button in the header, or Ctrl/Cmd+Shift+D.', {}, 'Studio'),
    L('Animated stream pointers', 'Swap the mouse cursor on your Screen sources for a sword, crosshair, neon or fire arrow, wand, lightning and more, with trails and click effects.', { view: 'settings' }, 'Stream')
  ] },
  { v: '1.8.0', items: [
    L('Annotation tools', 'Draw on your stream for teaching: pen, highlighter, shapes, arrows, text, numbered steps, laser pointer, spotlight, boards, disappearing ink, undo and redo. Pen button in the header.', {}, 'Studio'),
    L('Record & edit', 'One button records and then opens the editor, with your pointer movements saved for automatic zooms.', {}, 'Recording'),
    L('Recording editor', 'Automatic and manual zooms, cuts, speed changes, text, arrows, boxes, images and extra audio on a drag-and-drop timeline.', { view: 'edit' }, 'Recording'),
    L('Styled frames', 'Wallpapers, gradients, your own image or a blurred background, with padding, round corners, shadow, crop and shape presets.', { view: 'edit' }, 'Recording'),
    L('Pointer & webcam bubble', 'A drawn pointer with smoothing, click bounce, sway and motion blur, plus a webcam bubble you can place, round and mirror.', { view: 'edit' }, 'Recording'),
    L('MP4 & GIF export', 'Export with quality, size and frame-rate choices, and save your edit as a project to reopen later.', { view: 'edit' }, 'Recording')
  ] },
  { v: '1.7.0', items: [
    L('Caption styles library', '24 caption styles with animated previews: pop, karaoke highlight, neon, bars, typewriter and more. Click one to use it.', { view: 'fx' }, 'Overlays'),
    L('Hindi & Hinglish captions', 'Captions in Hindi (हिन्दी), or Hinglish: Hindi written in English letters. Gujarati and Telugu too.', { rtab: 'sounds' }, 'Audio'),
    L('Live captions', 'Your voice becomes text on the stream, done on this computer: free, no account, and no internet after the first 40 MB download. Box, outline or glow style.', { rtab: 'sounds' }, 'Audio')
  ] },
  { v: '1.6.0', items: [
    L('More platforms', 'Twitch, Kick, Facebook, Instagram, TikTok, X, Trovo, Rumble, Loco, DLive, LinkedIn, Vimeo or any RTMP server, besides YouTube.', { rtab: 'live' }, 'Stream'),
    L('Simultaneous streams', 'Go live on several platforms at once. Add as many destinations as you like; they start and stop with the main stream.', { rtab: 'live' }, 'Stream'),
    L('Several YouTube accounts', 'Add YouTube again with another channel’s key to stream to both at the same time.', { rtab: 'live' }, 'Stream'),
    L('Scene, size and quality per stream', 'Each destination can follow the main scene or show its own, in its own shape (horizontal, vertical, square) with its own bitrate and frame rate.', { rtab: 'live' }, 'Stream'),
    L('Per-stream status', 'Every destination shows live, reconnecting or failed with its bitrate. If one drops, the others keep going and it reconnects by itself.', { rtab: 'live' }, 'Stream')
  ] },
  { v: '1.5.0', items: [
    L('Face tracking', 'Webcams follow your face and keep it centred, with zoom, auto zoom to face size, head room and follow speed. In Properties → Face.', { rtab: 'props' }, 'Webcam'),
    L('Zoom when talking', 'The webcam zooms in on your face while you talk and eases back out when you stop.', { rtab: 'props' }, 'Webcam'),
    L('Face blur & away hide', 'Blur your face for privacy, or fade the camera out when you leave the desk.', { rtab: 'props' }, 'Webcam'),
    L('Edge fade', 'Fade any video source into the scene from the left, right, top or bottom. In Properties → Style.', { rtab: 'props' }, 'Sources'),
    L('Side cam layout', 'Webcam down the right side, full height and 30% wide, fading out to the left. In every game preset.', {}, 'Presets'),
    L('GTA VI presets', 'Capture-card presets for GTA VI: Vice sunset side cam, cinematic bars and a vertical face-top layout.', {}, 'Presets'),
    L('Switch scene when talking', 'Go to a facecam scene while you talk and back to gameplay after a few quiet seconds.', { rtab: 'auto' }, 'Automation'),
    L('Scene hotkeys', 'Give every scene its own key, plus next and previous scene. Works while you are in a game.', { view: 'settings' }, 'Settings'),
    L('Profiles & backup', 'Save all your settings as named profiles, export them to a backup file and import them on any computer.', { view: 'settings' }, 'Settings'),
    L('Header quick controls', 'Phone and mic sliders, scene switcher and quick buttons in the title bar. The gear chooses which ones show.', {}, 'Studio'),
    L('Setup splash', 'The launch card shows real start-up progress: tools, ADB, phones and the studio.', {}, 'App')
  ] },
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
