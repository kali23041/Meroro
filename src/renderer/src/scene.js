// Scene model: a scene is a background plus a stack of layers (bottom → top).
// Layer boxes are stored as fractions of the canvas (x,y = centre) so they survive canvas changes.
export const uid = () => Math.random().toString(36).slice(2, 9)

export const TYPES = [['phone', 'Android phone'], ['ios', 'iPhone / iPad'], ['webcam', 'Webcam'], ['screen', 'Screen / window'], ['image', 'Image'], ['video', 'Video file'],
  ['browser', 'Web page / alerts'], ['chat', 'YouTube chat'], ['alert', 'Alert box (Super Chat)'], ['text', 'Text'], ['clock', 'Clock'], ['color', 'Color / gradient'],
  ['banner', 'Overlay banner'], ['fxbg', 'Animated background'], ['fxtext', 'Animated text'], ['lower', 'Lower third'], ['goal', 'Goal bar'], ['mask', 'Blur / mask box'], ['scene', 'Scene (nested)']]

const G0 = { b: 1, c: 1, s: 1, hue: 0, sepia: 0, blur: 0 }
export const GRADES = {
  None: {}, Vivid: { b: 1.04, c: 1.15, s: 1.35 }, Punchy: { c: 1.3, s: 1.5 }, Cinematic: { b: 0.95, c: 1.2, s: 0.85, sepia: 0.15 },
  Warm: { s: 1.25, sepia: 0.3 }, Cool: { b: 1.02, s: 1.1, hue: -15 }, 'B&W': { c: 1.15, s: 0 }, Faded: { b: 1.08, c: 0.85, s: 0.8 }
}
export const grade = name => ({ ...G0, ...GRADES[name] })

export const L = (type, o = {}) => ({
  id: uid(), type, name: TYPES.find(t => t[0] === type)[1], visible: true, x: 0.5, y: 0.5, w: 0.5, h: 0.5, fit: 'contain', rot: 0, opacity: 1,
  radius: 0, border: 0, borderColor: '#ffffff', shadow: 0, flip: false, crop: [0, 0, 0, 0], grade: { ...G0 },
  ...(type === 'text' ? { text: 'Your text', color: '#ffffff', bg: '#000000', bgOn: true, h: 0.08, radius: 0.5 } : {}),
  ...(type === 'chat' ? { x: 0.84, y: 0.6, w: 0.3, h: 0.5, radius: 0.04, fit: 'stretch' } : {}),
  ...(type === 'alert' ? { x: 0.5, y: 0.14, w: 0.5, h: 0.14, radius: 0.3, fit: 'stretch' } : {}),
  ...(type === 'color' ? { color: '#7c3aed', color2: '#ec4899', fit: 'stretch' } : {}),
  ...(type === 'lower' ? { x: 0.3, y: 0.82, w: 0.42, h: 0.12, fit: 'stretch', title: 'Your Name', sub: 'Live on YouTube', style: 'bar', color: '#f97316', hold: 6 } : {}),
  ...(type === 'goal' ? { x: 0.5, y: 0.06, w: 0.5, h: 0.06, fit: 'stretch', label: 'Super Chat goal', cur: 0, target: 1000, prefix: '₹', auto: 'superchat', color: '#f97316' } : {}),
  ...(type === 'mask' ? { x: 0.85, y: 0.1, w: 0.2, h: 0.12, fit: 'stretch', mode: 'blur', amount: 0.6, color: '#000000' } : {}),
  ...(type === 'scene' ? { x: 0.8, y: 0.75, w: 0.3, h: 0.3, src: '', fit: 'contain' } : {}), ...o
})
export const newLayer = type => type === 'clock' ? L('text', { name: 'Clock', text: '{time}', x: 0.9, y: 0.08, h: 0.06 }) : L(type)

const S = (name, layers, o = {}) => ({ id: uid(), name, bg: '#0b0b0f', bg2: '', bgBlur: false, layers, ...o })
const full = (g, o) => L('phone', { w: 1, h: 1, fit: 'cover', grade: grade(g), ...o })
const cam = o => L('webcam', { src: 'default', fit: 'cover', ...o })
const text = (t, o) => L('text', { text: t, name: t, ...o })
const V = { canvas: '1080x1920' }
const GAME = { canvas: '1920x1080', capFps: 60, maxSize: 1920, capBitrate: 12, fps: 60, bitrate: 9000 }
const BGMI = { ...GAME, mode: 'app', appMode: 'guard', pkg: 'com.pubg.imobile' }

// Each preset returns a new scene, and optionally capture/stream settings to apply with it.
export const PRESETS = {
  'Phone · blurred backdrop': () => ({ scene: S('Phone', [L('phone', { w: 0.96, h: 0.94, radius: 0.04, shadow: 0.5 })], { bgBlur: true }) }),
  'BGMI · Fullscreen + facecam': () => ({ set: BGMI, scene: S('BGMI', [full('Vivid'), cam({ x: 0.1, y: 0.8, w: 0.17, h: 0.302, radius: 0.5, border: 5 })]) }),
  'BGMI · Clean gameplay': () => ({ set: BGMI, scene: S('BGMI clean', [full('Punchy')]) }),
  'BGMI · Facecam frame + title': () => ({ set: BGMI, scene: S('BGMI pro', [full('Vivid'),
    cam({ x: 0.13, y: 0.2, w: 0.22, h: 0.3, radius: 0.08, border: 5, borderColor: '#a78bfa', shadow: 0.5 }),
    text('BGMI LIVE · RANK PUSH', { x: 0.5, y: 0.94, h: 0.055, bg: '#7c3aed' })]) }),
  'BGMI · Shorts vertical': () => ({ set: { ...BGMI, canvas: '1080x1920' }, scene: S('BGMI shorts', [
    L('phone', { x: 0.5, y: 0.3, w: 1, h: 0.3, grade: grade('Vivid') }), cam({ x: 0.5, y: 0.72, w: 0.9, h: 0.4, radius: 0.06, border: 5 }),
    text('BGMI LIVE', { x: 0.5, y: 0.08, h: 0.04, bg: '#7c3aed' })], { bgBlur: true }) }),
  'Free Fire / COD · Fullscreen + facecam': () => ({ set: GAME, scene: S('Gameplay', [full('Punchy'), cam({ x: 0.9, y: 0.8, w: 0.17, h: 0.302, radius: 0.5, border: 5 })]) }),
  'Portrait game · centered + facecam': () => ({ set: GAME, scene: S('Portrait game', [L('phone', { w: 0.5, h: 0.96, radius: 0.04, shadow: 0.5, grade: grade('Vivid') }),
    cam({ x: 0.84, y: 0.74, w: 0.26, h: 0.4, radius: 0.08, border: 4 })], { bgBlur: true }) }),
  'Vertical · Phone fullscreen': () => ({ set: V, scene: S('Vertical phone', [L('phone', { w: 1, h: 1, fit: 'cover' })]) }),
  'Vertical · Phone framed + facecam': () => ({ set: V, scene: S('Vertical framed', [L('phone', { y: 0.45, w: 0.86, h: 0.84, radius: 0.05, shadow: 0.5 }),
    cam({ x: 0.8, y: 0.88, w: 0.3, h: 0.169, radius: 0.5, border: 5 })], { bgBlur: true }) }),
  'Vertical · BGMI zoomed + facecam': () => ({ set: { ...BGMI, ...V }, scene: S('Vertical BGMI', [full('Vivid'),
    cam({ x: 0.5, y: 0.82, w: 0.36, h: 0.2025, radius: 0.5, border: 6 }), text('BGMI LIVE', { x: 0.5, y: 0.06, h: 0.035, bg: '#dc2626' })]) }),
  'Vertical · Game top, cam bottom': () => ({ set: { ...GAME, ...V }, scene: S('Vertical split', [L('phone', { x: 0.5, y: 0.25, w: 1, h: 0.5, fit: 'cover', grade: grade('Vivid') }),
    cam({ x: 0.5, y: 0.75, w: 1, h: 0.5 })]) }),
  'Vertical · Game + chat/alerts': () => ({ set: { ...GAME, ...V }, scene: S('Vertical + chat', [L('phone', { x: 0.5, y: 0.22, w: 1, h: 0.32, grade: grade('Vivid') }),
    L('browser', { name: 'Chat / alerts', x: 0.5, y: 0.66, w: 0.92, h: 0.5, radius: 0.04 }), cam({ x: 0.84, y: 0.06, w: 0.24, h: 0.135, radius: 0.5, border: 4 })], { bgBlur: true }) }),
  'Vertical · Just chatting': () => ({ set: V, scene: S('Vertical chatting', [cam({ w: 1, h: 1 }), L('phone', { x: 0.78, y: 0.72, w: 0.36, h: 0.4, radius: 0.06, shadow: 0.6 })]) }),
  'Just chatting · cam + phone': () => ({ scene: S('Chatting', [cam({ w: 1, h: 1 }), L('phone', { x: 0.84, y: 0.5, w: 0.28, h: 0.9, radius: 0.05, shadow: 0.6 })]) }),
  'Starting soon': () => ({ scene: S('Starting soon', [text('STARTING SOON', { y: 0.46, h: 0.13, bgOn: false }), text('{time}', { name: 'Clock', y: 0.6, h: 0.06, bgOn: false })], { bg: '#7c3aed', bg2: '#ec4899' }) }),
  'Be right back': () => ({ scene: S('BRB', [text('BE RIGHT BACK', { h: 0.13, bgOn: false })], { bg: '#0f172a', bg2: '#7c3aed' }) })
}

export const patchLayer = (s, id, p) => ({
  scenes: s.scenes.map(sc => sc.id !== s.sceneId ? sc : { ...sc, layers: sc.layers.map(l => l.id === id ? { ...l, ...p } : l) })
})

// Canvas (whole scene) sizes for each platform.
export const SIZES = [
  ['1920x1080', 'YouTube / Twitch', '16:9 · 1080p'], ['1280x720', 'YouTube 720p', '16:9 · 720p'], ['2560x1440', 'YouTube 1440p', '16:9 · 2K'],
  ['1080x1920', 'Shorts · TikTok · Reels', '9:16 vertical'], ['720x1280', 'Vertical 720p', '9:16 · light'], ['1080x1350', 'Instagram portrait', '4:5 feed'],
  ['1080x1080', 'Instagram square', '1:1'], ['1080x2400', 'Phone (tall)', '9:20 portrait'], ['2400x1080', 'Phone (wide)', '20:9 landscape'], ['1440x1080', 'Classic', '4:3']
]

// ---------- game presets: pick a game, then a layout (horizontal 16:9 or vertical 9:16) ----------
export const GAMES = [
  { id: 'bgmi', name: 'BGMI', pkg: 'com.pubg.imobile' }, { id: 'ff', name: 'Free Fire MAX', pkg: 'com.dts.freefiremax' },
  { id: 'codm', name: 'Call of Duty: Mobile', pkg: 'com.activision.callofduty.shooter' }, { id: 'mlbb', name: 'Mobile Legends', pkg: 'com.mobile.legends' },
  { id: 'genshin', name: 'Genshin Impact', pkg: 'com.miHoYo.GenshinImpact' }, { id: 'mcpe', name: 'Minecraft', pkg: 'com.mojang.minecraftpe' },
  { id: 'asphalt', name: 'Asphalt Legends', pkg: 'com.gameloft.android.ANMP.GloftA9HM' },
  { id: 'cr', name: 'Clash Royale', pkg: 'com.supercell.clashroyale', portrait: true }, { id: 'pogo', name: 'Pokémon GO', pkg: 'com.nianticlabs.pokemongo', portrait: true },
  { id: 'cs2', name: 'Counter-Strike 2', steam: 730, pc: true }, { id: 'gta', name: 'GTA V', steam: 271590, pc: true }, { id: 'pubgpc', name: 'PUBG: Battlegrounds', steam: 578080, pc: true },
  { id: 'apex', name: 'Apex Legends', steam: 1172470, pc: true }, { id: 'dota', name: 'Dota 2', steam: 570, pc: true }, { id: 'cyber', name: 'Cyberpunk 2077', steam: 1091500, pc: true },
  { id: 'rust', name: 'Rust', steam: 252490, pc: true }, { id: 'elden', name: 'Elden Ring', steam: 1245620, pc: true }
]
export const steamArt = id => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/capsule_231x87.jpg`

const H = { canvas: '1920x1080' }
export const LAYOUTS = [
  { id: 'full', name: 'Fullscreen + facecam', v: false, make: b => [b({ w: 1, h: 1, fit: 'cover' }), cam({ x: 0.1, y: 0.8, w: 0.17, h: 0.302, radius: 0.5, border: 5 })] },
  { id: 'clean', name: 'Clean gameplay', v: false, make: b => [b({ w: 1, h: 1, fit: 'cover' })] },
  { id: 'pro', name: 'Facecam frame + title', v: false, make: (b, g) => [b({ w: 1, h: 1, fit: 'cover' }),
    cam({ x: 0.13, y: 0.2, w: 0.22, h: 0.3, radius: 0.08, border: 5, borderColor: '#e4e4e7', shadow: 0.5 }), text(`${g.name.toUpperCase()} LIVE`, { x: 0.5, y: 0.94, h: 0.055, bg: '#18181b' })] },
  { id: 'side', name: 'Game + cam side panel', v: false, make: b => [b({ x: 0.36, y: 0.5, w: 0.7, h: 0.7, radius: 0.03, shadow: 0.5 }),
    cam({ x: 0.85, y: 0.32, w: 0.26, h: 0.36, radius: 0.06 }), L('chat', { x: 0.85, y: 0.74, w: 0.26, h: 0.4 })], bg: true },
  { id: 'vsplit', name: 'Game top, cam bottom', v: true, make: b => [b({ x: 0.5, y: 0.25, w: 1, h: 0.5, fit: 'cover' }), cam({ x: 0.5, y: 0.75, w: 1, h: 0.5 })] },
  { id: 'vzoom', name: 'Zoomed + facecam', v: true, make: (b, g) => [b({ w: 1, h: 1, fit: 'cover' }), cam({ x: 0.5, y: 0.82, w: 0.36, h: 0.2025, radius: 0.5, border: 6 }),
    text(`${g.name.toUpperCase()} LIVE`, { x: 0.5, y: 0.06, h: 0.035, bg: '#18181b' })] },
  { id: 'vchat', name: 'Game + chat', v: true, make: b => [b({ x: 0.5, y: 0.22, w: 1, h: 0.32 }), L('chat', { x: 0.5, y: 0.66, w: 0.92, h: 0.5, radius: 0.04 }),
    cam({ x: 0.84, y: 0.06, w: 0.24, h: 0.135, radius: 0.5, border: 4 })], bg: true }
]
export function gamePreset(g, lay) {
  const base = o => L(g.pc ? 'screen' : 'phone', { name: g.name, grade: grade('Vivid'), ...o, ...(g.portrait && !lay.v ? { x: 0.5, y: 0.5, w: 0.5, h: 0.96, fit: 'contain', radius: 0.04 } : {}) })
  const set = { ...(lay.v ? V : H), fps: 60, bitrate: 9000, ...(g.pc ? {} : { capFps: 60, maxSize: 1920, capBitrate: 12, mode: 'app', appMode: 'guard', pkg: g.pkg }) }
  return { set, scene: S(`${g.name} · ${lay.name}`, lay.make(base, g), { bgBlur: lay.bg || (g.portrait && !lay.v) }) }
}
export const STUDIO = ['Phone · blurred backdrop', 'Just chatting · cam + phone', 'Starting soon', 'Be right back', 'Vertical · Phone fullscreen', 'Vertical · Phone framed + facecam', 'Vertical · Just chatting']
