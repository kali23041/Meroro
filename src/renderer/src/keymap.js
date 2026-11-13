// Game key mapping: turns keyboard + mouse into multi-touch on the phone.
// Positions are fractions of the phone screen (0..1), so they work at any resolution.
// Item types: tap (hold while pressed) · joystick (WASD) · look (mouse aim) · swipe (flick).
export const uidK = () => Math.random().toString(36).slice(2, 8)
const T = (label, key, x, y, o = {}) => ({ id: uidK(), type: 'tap', label, key, x, y, ...o })
const stick = (x, y, o = {}) => ({ id: uidK(), type: 'joystick', label: 'Move', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', x, y, r: 0.1, mul: 2.4, ...o })
const look = (x, y, o = {}) => ({ id: uidK(), type: 'look', label: 'Aim (mouse)', x, y, sens: 1, ...o })

// Default HUD positions for landscape games. Every game lets you move its buttons, so treat these as a
// starting point and drag the markers onto your own layout.
const shooter = extra => [
  stick(0.17, 0.72), look(0.62, 0.45),
  T('Fire', 'MouseLeft', 0.9, 0.62), T('Scope / ADS', 'MouseRight', 0.94, 0.44), T('Jump', 'Space', 0.95, 0.74),
  T('Crouch', 'KeyC', 0.87, 0.9), T('Prone', 'KeyZ', 0.94, 0.9), T('Reload', 'KeyR', 0.8, 0.9),
  T('Weapon 1', 'Digit1', 0.44, 0.92), T('Weapon 2', 'Digit2', 0.56, 0.92), T('Pick up / Use', 'KeyF', 0.68, 0.52),
  T('Map', 'KeyM', 0.94, 0.12), T('Bag', 'Tab', 0.64, 0.92), ...extra
]
export const KEYMAPS = {
  bgmi: { name: 'BGMI', pkg: 'com.pubg.imobile', items: shooter([
    T('Peek left', 'KeyQ', 0.1, 0.5), T('Peek right', 'KeyE', 0.2, 0.5), T('Grenade', 'Digit4', 0.7, 0.92), T('Heal', 'Digit5', 0.32, 0.92),
    T('Left fire', 'KeyX', 0.07, 0.36), T('Free look', 'AltLeft', 0.83, 0.3), T('Auto-run lock', 'Shift+KeyW', 0.17, 0.42), T('Mic', 'KeyV', 0.86, 0.2), T('Vehicle exit', 'KeyG', 0.9, 0.52)]) },
  freefire: { name: 'Free Fire', pkg: 'com.dts.freefiremax', items: shooter([T('Gloo wall', 'KeyQ', 0.77, 0.6), T('Skill', 'KeyE', 0.7, 0.75), T('Med kit', 'Digit4', 0.34, 0.9), T('Grenade', 'KeyG', 0.72, 0.9)]) },
  codm: { name: 'Call of Duty Mobile', pkg: 'com.activision.callofduty.shooter', items: shooter([T('Slide', 'ControlLeft', 0.87, 0.82), T('Lethal', 'KeyG', 0.76, 0.72), T('Tactical', 'KeyQ', 0.7, 0.82), T('Operator skill', 'KeyE', 0.5, 0.8), T('Scorestreak', 'Digit3', 0.5, 0.08)]) },
  fps: { name: 'Generic shooter', pkg: '', items: shooter([]) },
  racing: { name: 'Racing', pkg: '', items: [T('Steer left', 'KeyA', 0.12, 0.75), T('Steer right', 'KeyD', 0.28, 0.75), T('Gas', 'KeyW', 0.9, 0.7), T('Brake', 'KeyS', 0.76, 0.78), T('Nitro', 'Space', 0.9, 0.45), T('Drift', 'ShiftLeft', 0.78, 0.55)] },
  moba: { name: 'MOBA', pkg: '', items: [stick(0.16, 0.74, { sprint: '' }), T('Attack', 'Space', 0.88, 0.8), T('Skill 1', 'KeyQ', 0.72, 0.86), T('Skill 2', 'KeyE', 0.77, 0.66), T('Skill 3', 'KeyR', 0.9, 0.56), T('Recall', 'KeyB', 0.45, 0.92), T('Heal', 'KeyF', 0.56, 0.92)] }
}
export const newItem = type => type === 'joystick' ? stick(0.2, 0.7) : type === 'look' ? look(0.6, 0.45)
  : type === 'swipe' ? { id: uidK(), type: 'swipe', label: 'Swipe', key: '', x: 0.5, y: 0.6, dx: 0, dy: -0.25 } : T('Button', '', 0.5, 0.5)

// "Shift+KeyW" from a keyboard event (modifier keys alone are plain codes like "ShiftLeft").
export const combo = e => {
  const mod = /^(Shift|Control|Alt|Meta)/.test(e.code)
  return (!mod && e.shiftKey ? 'Shift+' : '') + (!mod && e.ctrlKey ? 'Ctrl+' : '') + (!mod && e.altKey ? 'Alt+' : '') + e.code
}
export const keyName = k => !k ? 'Unset' : k.replace(/Key|Digit|Left$/g, '').replace('Mouse', 'Mouse ').replace('Control', 'Ctrl').replace('Wheel', 'Wheel ')

export class Mapper {
  items = []; held = new Set(); active = new Map(); stickOn = null; lookAt = null
  constructor(send, size) { this.send = send; this.size = size }

  touch(a, id, x, y) {
    const z = this.size()
    if (z) this.send({ t: 'touch', a, id, x: Math.round(Math.max(0, Math.min(1, x)) * z.w), y: Math.round(Math.max(0, Math.min(1, y)) * z.h), w: z.w, h: z.h })
  }
  slot(it) { return 20 + this.items.indexOf(it) } // one finger per mapping

  // code: e.code or MouseLeft/MouseRight/MouseMiddle; full: the combo form ("Shift+KeyW")
  key(code, down, full = code) {
    if (down === this.held.has(code)) return
    down ? this.held.add(code) : this.held.delete(code)
    if (down) {
      let hits = this.items.filter(i => (i.type === 'tap' || i.type === 'swipe') && i.key === full)
      if (!hits.length) hits = this.items.filter(i => (i.type === 'tap' || i.type === 'swipe') && i.key === code)
      this.active.set(code, hits)
      for (const it of hits) {
        this.touch(0, this.slot(it), it.x, it.y)
        if (it.type === 'swipe') { for (let s = 1; s <= 4; s++) setTimeout(() => this.touch(2, this.slot(it), it.x + it.dx * s / 4, it.y + it.dy * s / 4), s * 12); setTimeout(() => this.touch(1, this.slot(it), it.x + it.dx, it.y + it.dy), 70) }
      }
    } else {
      for (const it of this.active.get(code) || []) if (it.type === 'tap') this.touch(1, this.slot(it), it.x, it.y)
      this.active.delete(code)
    }
    this.stick()
  }
  pulse(code) { this.key(code, true); setTimeout(() => this.key(code, false), 40) } // mouse wheel

  stick() {
    const j = this.items.find(i => i.type === 'joystick'), z = this.size()
    if (!j || !z) return
    const h = k => k && this.held.has(k), vx = (h(j.right) ? 1 : 0) - (h(j.left) ? 1 : 0), vy = (h(j.down) ? 1 : 0) - (h(j.up) ? 1 : 0)
    if (!vx && !vy) { if (this.stickOn) { this.touch(1, 1, ...this.stickOn); this.stickOn = null } return }
    const n = Math.hypot(vx, vy), r = j.r * (h(j.sprint) || (j.sprint === 'ShiftLeft' && this.held.has('ShiftRight')) ? j.mul : 1)
    const p = [j.x + (vx / n) * r * (z.h / z.w), j.y + (vy / n) * r] // radius is a fraction of screen height
    if (!this.stickOn) this.touch(0, 1, j.x, j.y)
    this.touch(2, 1, ...p); this.stickOn = p
  }

  look(dx, dy) {
    const l = this.items.find(i => i.type === 'look'), z = this.size()
    if (!l || !z) return
    let p = this.lookAt
    if (!p) { p = this.lookAt = [l.x, l.y]; this.touch(0, 2, ...p) }
    p[0] += (dx * l.sens * 0.6) / z.w; p[1] += (dy * l.sens * 0.6) / z.h
    if (Math.abs(p[0] - l.x) > 0.22 || Math.abs(p[1] - l.y) > 0.3) { this.touch(1, 2, ...p); this.lookAt = null; return } // ran out of room: lift and re-centre
    this.touch(2, 2, ...p)
    clearTimeout(this.lookT)
    this.lookT = setTimeout(() => { if (this.lookAt) { this.touch(1, 2, ...this.lookAt); this.lookAt = null } }, 180)
  }

  reset() { // lift every finger (focus lost, map changed)
    for (const hits of this.active.values()) for (const it of hits) this.touch(1, this.slot(it), it.x, it.y)
    if (this.stickOn) this.touch(1, 1, ...this.stickOn)
    if (this.lookAt) this.touch(1, 2, ...this.lookAt)
    this.active.clear(); this.held.clear(); this.stickOn = this.lookAt = null
  }
}
