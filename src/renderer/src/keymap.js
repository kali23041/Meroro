// Game key mapping: turns keyboard + mouse into multi-touch on the phone.
// Positions are fractions of the phone screen (0..1), so they work at any resolution.
// Item types: tap (hold / tap / toggle / rapid) · joystick · look · freelook · skill cast · swipe · macro.
export const uidK = () => Math.random().toString(36).slice(2, 8)
const T = (label, key, x, y, o = {}) => ({ id: uidK(), type: 'tap', label, key, x, y, ...o })
const stick = (x, y, o = {}) => ({ id: uidK(), type: 'joystick', label: 'Move', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', x, y, r: 0.1, mul: 2.4, ...o })
const look = (x, y, o = {}) => ({ id: uidK(), type: 'look', label: 'Aim (mouse)', x, y, sens: 1, ...o })

// Default HUD positions for landscape games. Every game lets you move its buttons, so treat these as a
// starting point and drag the markers onto your own layout.
const shooter = extra => [
  stick(0.17, 0.72), look(0.62, 0.45),
  T('Fire', 'MouseLeft', 0.9, 0.62, { kind: 'fire' }), T('Scope / ADS', 'MouseRight', 0.94, 0.44), T('Jump', 'Space', 0.95, 0.74),
  T('Crouch', 'KeyC', 0.87, 0.9), T('Prone', 'KeyZ', 0.94, 0.9), T('Reload', 'KeyR', 0.8, 0.9),
  T('Weapon 1', 'Digit1', 0.44, 0.92), T('Weapon 2', 'Digit2', 0.56, 0.92), T('Pick up / Use', 'KeyF', 0.68, 0.52),
  T('Map', 'KeyM', 0.94, 0.12, { cursor: true }), T('Bag', 'Tab', 0.64, 0.92, { cursor: true }), ...extra
]
export const KEYMAPS = {
  bgmi: { name: 'BGMI', pkg: 'com.pubg.imobile', items: shooter([
    T('Peek left', 'KeyQ', 0.1, 0.5), T('Peek right', 'KeyE', 0.2, 0.5), T('Grenade', 'Digit4', 0.7, 0.92), T('Heal', 'Digit5', 0.32, 0.92),
    T('Left fire', 'KeyX', 0.07, 0.36), { id: uidK(), type: 'freelook', label: 'Free look', key: 'AltLeft', x: 0.83, y: 0.3, sens: 1 }, T('Auto-run lock', 'Shift+KeyW', 0.17, 0.42), T('Mic', 'KeyV', 0.86, 0.2), T('Vehicle exit', 'KeyG', 0.9, 0.52)]) },
  freefire: { name: 'Free Fire', pkg: 'com.dts.freefiremax', items: shooter([T('Gloo wall', 'KeyQ', 0.77, 0.6), T('Skill', 'KeyE', 0.7, 0.75), T('Med kit', 'Digit4', 0.34, 0.9), T('Grenade', 'KeyG', 0.72, 0.9)]) },
  codm: { name: 'Call of Duty Mobile', pkg: 'com.activision.callofduty.shooter', items: shooter([T('Slide', 'ControlLeft', 0.87, 0.82), T('Lethal', 'KeyG', 0.76, 0.72), T('Tactical', 'KeyQ', 0.7, 0.82), T('Operator skill', 'KeyE', 0.5, 0.8), T('Scorestreak', 'Digit3', 0.5, 0.08)]) },
  fps: { name: 'Generic shooter', pkg: '', items: shooter([]) },
  racing: { name: 'Racing', pkg: '', items: [T('Steer left', 'KeyA', 0.12, 0.75), T('Steer right', 'KeyD', 0.28, 0.75), T('Gas', 'KeyW', 0.9, 0.7), T('Brake', 'KeyS', 0.76, 0.78), T('Nitro', 'Space', 0.9, 0.45), T('Drift', 'ShiftLeft', 0.78, 0.55)] },
  moba: { name: 'MOBA', pkg: '', items: [stick(0.16, 0.74, { sprint: '' }), T('Attack', 'Space', 0.88, 0.8), T('Skill 1', 'KeyQ', 0.72, 0.86), T('Skill 2', 'KeyE', 0.77, 0.66), T('Skill 3', 'KeyR', 0.9, 0.56), T('Recall', 'KeyB', 0.45, 0.92), T('Heal', 'KeyF', 0.56, 0.92)] }
}
// Control types, emulator-style. Each one is a finger the key/mouse drives.
export const KINDS = [
  ['tap', 'Tap', 'Press a key to touch a button'], ['joystick', 'Joystick', 'WASD movement with sprint'],
  ['look', 'Mouse aim', 'Mouse turns the camera'], ['fire', 'Fire', 'Left mouse fires while aiming'],
  ['repeat', 'Rapid tap', 'Taps again and again while held'], ['toggle', 'Toggle', 'Press once to hold, again to let go'],
  ['freelook', 'Free look', 'Hold a key, mouse looks around'], ['skill', 'Skill cast', 'Press, aim with the mouse, release'],
  ['swipe', 'Swipe', 'A quick flick in one direction'], ['macro', 'Macro', 'One key plays a sequence of taps']
]
export const MAP_DEFAULTS = { overlay: 0.55, hints: true, cursorKey: 'Backquote', sens: 1 }
export const newItem = type => type === 'joystick' ? stick(0.2, 0.7) : type === 'look' ? look(0.6, 0.45)
  : type === 'swipe' ? { id: uidK(), type: 'swipe', label: 'Swipe', key: '', x: 0.5, y: 0.6, dx: 0, dy: -0.25 }
  : type === 'fire' ? T('Fire', 'MouseLeft', 0.88, 0.62)
  : type === 'repeat' ? T('Rapid tap', '', 0.82, 0.62, { mode: 'repeat', rate: 90 })
  : type === 'toggle' ? T('Toggle', '', 0.8, 0.4, { mode: 'toggle' })
  : type === 'freelook' ? { id: uidK(), type: 'freelook', label: 'Free look', key: 'AltLeft', x: 0.82, y: 0.3, sens: 1 }
  : type === 'skill' ? { id: uidK(), type: 'skill', label: 'Skill', key: 'KeyQ', x: 0.78, y: 0.8, r: 0.12 }
  : type === 'macro' ? { id: uidK(), type: 'macro', label: 'Macro', key: '', x: 0.5, y: 0.2, steps: [] }
  : T('Button', '', 0.5, 0.5)
const KEYED = ['tap', 'swipe', 'freelook', 'skill', 'macro']

// "Shift+KeyW" from a keyboard event (modifier keys alone are plain codes like "ShiftLeft").
export const combo = e => {
  const mod = /^(Shift|Control|Alt|Meta)/.test(e.code)
  return (!mod && e.shiftKey ? 'Shift+' : '') + (!mod && e.ctrlKey ? 'Ctrl+' : '') + (!mod && e.altKey ? 'Alt+' : '') + e.code
}
export const PAD = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'Up', 'Down', 'Left', 'Right', 'Home']
export const keyName = k => !k ? 'Unset' : k.startsWith('Pad') ? '🎮 ' + k.slice(3) : k.replace(/Key|Digit|Left$/g, '').replace('Mouse', 'Mouse ').replace('Control', 'Ctrl').replace('Wheel', 'Wheel ')

// Screen triggers: sample a few spots of the live phone picture and compare with colours recorded when a menu was open.
let sc
export function samplePts(frame, pts) {
  sc ??= document.createElement('canvas')
  const w = 192, h = Math.max(2, Math.round((w * frame.displayHeight) / frame.displayWidth))
  if (sc.width !== w || sc.height !== h) { sc.width = w; sc.height = h }
  const c = sc.getContext('2d', { willReadFrequently: true })
  try { c.drawImage(frame, 0, 0, w, h) } catch { return null }
  return pts.map(p => {
    const x = Math.min(w - 2, Math.max(1, Math.round(p.x * w))), y = Math.min(h - 2, Math.max(1, Math.round(p.y * h))), d = c.getImageData(x - 1, y - 1, 3, 3).data
    let r = 0, g = 0, b = 0; for (let i = 0; i < 36; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
    return [r / 9, g / 9, b / 9]
  })
}
export function matchTrigger(frame, t) {
  const cs = samplePts(frame, t.points)
  return !!cs && t.points.every((p, i) => Math.hypot(p.c[0] - cs[i][0], p.c[1] - cs[i][1], p.c[2] - cs[i][2]) < (t.tol || 40))
}

export class Mapper {
  items = []; opts = MAP_DEFAULTS; held = new Set(); active = new Map(); stickOn = null; lookAt = null
  toggled = new Set(); timers = new Map(); free = null; cast = null; aim = [0, 0]
  constructor(send, size) { this.send = send; this.size = size }

  touch(a, id, x, y) {
    const z = this.size()
    if (z) this.send({ t: 'touch', a, id, x: Math.round(Math.max(0, Math.min(1, x)) * z.w), y: Math.round(Math.max(0, Math.min(1, y)) * z.h), w: z.w, h: z.h })
  }
  slot(it) { return 20 + this.items.indexOf(it) } // one finger per mapping
  tapOnce(it, x = it.x, y = it.y, hold = 40) { const s = this.slot(it); this.touch(0, s, x, y); setTimeout(() => this.touch(1, s, x, y), hold) }

  // code: e.code or MouseLeft/MouseRight/MouseMiddle; full: the combo form ("Shift+KeyW")
  key(code, down, full = code) {
    if (down === this.held.has(code)) return
    down ? this.held.add(code) : this.held.delete(code)
    if (down) {
      let hits = this.items.filter(i => KEYED.includes(i.type) && i.key === full)
      if (!hits.length) hits = this.items.filter(i => KEYED.includes(i.type) && i.key === code)
      this.active.set(code, hits)
      for (const it of hits) this.press(it)
    } else {
      for (const it of this.active.get(code) || []) this.release(it)
      this.active.delete(code)
    }
    this.stick()
  }
  press(it) {
    const s = this.slot(it)
    if (it.cursor) setTimeout(() => this.onCursor?.(it), 80) // map / bag keys also free the mouse
    if (it.type === 'swipe') { this.touch(0, s, it.x, it.y); for (let k = 1; k <= 4; k++) setTimeout(() => this.touch(2, s, it.x + it.dx * k / 4, it.y + it.dy * k / 4), k * 12); setTimeout(() => this.touch(1, s, it.x + it.dx, it.y + it.dy), 70) }
    else if (it.type === 'freelook') { this.free = { it, p: [it.x, it.y] }; this.touch(0, s, it.x, it.y) }
    else if (it.type === 'skill') { this.aim = [0, 0]; this.cast = it; this.touch(0, s, it.x, it.y) }
    else if (it.type === 'macro') { let t = 0; for (const st of it.steps || []) { const ref = this.items.find(i => i.id === st.ref); if (ref) { setTimeout(() => this.tapOnce(ref, ref.x, ref.y, st.hold || 40), t); t += (st.hold || 40) + (st.wait ?? 60) } } }
    else if (it.mode === 'toggle') { if (this.toggled.has(it.id)) { this.toggled.delete(it.id); this.touch(1, s, it.x, it.y) } else { this.toggled.add(it.id); this.touch(0, s, it.x, it.y) } }
    else if (it.mode === 'tap') this.tapOnce(it)
    else if (it.mode === 'repeat') { this.tapOnce(it, it.x, it.y, 30); this.timers.set(it.id, setInterval(() => this.tapOnce(it, it.x, it.y, 30), Math.max(40, it.rate || 90))) }
    else this.touch(0, s, it.x, it.y)
  }
  release(it) {
    const s = this.slot(it)
    if (it.type === 'freelook') { if (this.free) this.touch(1, s, ...this.free.p); this.free = null }
    else if (it.type === 'skill') { this.touch(1, s, ...this.castAt(it)); this.cast = null }
    else if (it.type === 'tap' && it.mode === 'repeat') { clearInterval(this.timers.get(it.id)); this.timers.delete(it.id) }
    else if (it.type === 'tap' && !it.mode) this.touch(1, s, it.x, it.y)
  }
  castAt(it) { const z = this.size() || { w: 1, h: 1 }; return [it.x + this.aim[0] * it.r * (z.h / z.w), it.y + this.aim[1] * it.r] }
  pulse(code) { this.key(code, true); setTimeout(() => this.key(code, false), 40) } // mouse wheel

  stick() {
    const j = this.items.find(i => i.type === 'joystick'), z = this.size()
    if (!j || !z) return
    const h = k => k && this.held.has(k), vx = (h(j.right) ? 1 : 0) - (h(j.left) ? 1 : 0), vy = (h(j.down) ? 1 : 0) - (h(j.up) ? 1 : 0)
    const pd = this.pad, an = !vx && !vy && pd && Math.hypot(pd[0], pd[1]) > 0.2 // controller left stick (analog)
    if (an) { const m = Math.min(1, Math.hypot(pd[0], pd[1])), p = [j.x + pd[0] / Math.max(1, m) * j.r * (z.h / z.w), j.y + pd[1] / Math.max(1, m) * j.r]; if (!this.stickOn) this.touch(0, 1, j.x, j.y); this.touch(2, 1, ...p); this.stickOn = p; return }
    if (!vx && !vy) { if (this.stickOn) { this.touch(1, 1, ...this.stickOn); this.stickOn = null } return }
    const walk = h(j.walk), n = Math.hypot(vx, vy), r = j.r * (h(j.sprint) || (j.sprint === 'ShiftLeft' && this.held.has('ShiftRight')) ? j.mul : walk ? 0.45 : 1)
    const p = [j.x + (vx / n) * r * (z.h / z.w), j.y + (vy / n) * r] // radius is a fraction of screen height
    if (!this.stickOn) this.touch(0, 1, j.x, j.y)
    this.touch(2, 1, ...p); this.stickOn = p
  }

  look(dx, dy) {
    const z = this.size()
    if (!z) return
    const g = this.opts.sens ?? 1
    if (this.free) { // free look: this finger follows the mouse while its key is held
      const f = this.free, k = (f.it.sens || 1) * g * 0.6
      f.p = [Math.max(0, Math.min(1, f.p[0] + (dx * k) / z.w)), Math.max(0, Math.min(1, f.p[1] + (dy * k) / z.h))]
      return this.touch(2, this.slot(f.it), ...f.p)
    }
    if (this.cast) { // skill cast: mouse sets the direction and distance
      const a = this.aim; a[0] += dx / 120; a[1] += dy / 120; const n = Math.hypot(...a); if (n > 1) { a[0] /= n; a[1] /= n }
      return this.touch(2, this.slot(this.cast), ...this.castAt(this.cast))
    }
    const l = this.items.find(i => i.type === 'look')
    if (!l) return
    let p = this.lookAt
    if (!p) { p = this.lookAt = [l.x, l.y]; this.touch(0, 2, ...p) }
    const sx = l.sens * g, sy = (l.sensY ?? l.sens) * g * (l.invert ? -1 : 1)
    const acc = l.accel ? 1 + Math.min(2, Math.hypot(dx, dy) / 40) * l.accel : 1
    p[0] += (dx * sx * acc * 0.6) / z.w; p[1] += (dy * sy * acc * 0.6) / z.h
    if (Math.abs(p[0] - l.x) > (l.range || 0.22) || Math.abs(p[1] - l.y) > (l.range || 0.22) * 1.35) { this.touch(1, 2, ...p); this.lookAt = null; return } // out of room: lift and re-centre
    this.touch(2, 2, ...p)
    clearTimeout(this.lookT)
    this.lookT = setTimeout(() => { if (this.lookAt) { this.touch(1, 2, ...this.lookAt); this.lookAt = null } }, 180)
  }

  reset() { // lift every finger (focus lost, map changed)
    for (const hits of this.active.values()) for (const it of hits) this.release(it)
    for (const id of this.toggled) { const it = this.items.find(i => i.id === id); if (it) this.touch(1, this.slot(it), it.x, it.y) }
    for (const t of this.timers.values()) clearInterval(t)
    if (this.stickOn) this.touch(1, 1, ...this.stickOn)
    if (this.lookAt) this.touch(1, 2, ...this.lookAt)
    this.active.clear(); this.held.clear(); this.toggled.clear(); this.timers.clear(); this.stickOn = this.lookAt = this.free = this.cast = null
  }
}
