// Scene model: a scene is a background plus a stack of layers (bottom → top).
// Layer boxes are stored as fractions of the canvas (x,y = centre) so they survive canvas changes.
export const uid = () => Math.random().toString(36).slice(2, 9)

export const TYPES = [['phone', 'Phone'], ['webcam', 'Webcam'], ['screen', 'Screen / window'], ['image', 'Image'], ['video', 'Video file'],
  ['browser', 'Web page / alerts'], ['chat', 'YouTube chat'], ['alert', 'Alert box (Super Chat)'], ['text', 'Text'], ['clock', 'Clock'], ['color', 'Color / gradient']]

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
  ...(type === 'color' ? { color: '#7c3aed', color2: '#ec4899', fit: 'stretch' } : {}), ...o
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
