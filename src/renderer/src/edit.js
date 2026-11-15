// Recording editor core: the project model, automatic zooms from pointer activity, and the frame renderer
// (background, framed video, zooms, cursor overlay, notes, webcam bubble) shared by the preview and the export.
export const uid = () => Math.random().toString(36).slice(2, 9)
export const WALLS = [['Aurora', '#0f172a', '#7c3aed', '#22d3ee'], ['Sunset', '#fb7185', '#f97316', '#fde047'], ['Ocean', '#0ea5e9', '#2563eb', '#1e1b4b'], ['Mint', '#34d399', '#06b6d4', '#0f766e'],
  ['Grape', '#a855f7', '#ec4899', '#4c1d95'], ['Peach', '#fed7aa', '#fda4af', '#f0abfc'], ['Midnight', '#020617', '#1e293b', '#334155'], ['Ember', '#7f1d1d', '#ea580c', '#facc15'],
  ['Forest', '#052e16', '#166534', '#84cc16'], ['Ice', '#e0f2fe', '#bae6fd', '#a5b4fc'], ['Candy', '#f472b6', '#c084fc', '#60a5fa'], ['Slate', '#e2e8f0', '#94a3b8', '#475569']]
export const ASPECTS = [['native', 'Original'], ['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1'], ['4:3', '4:3'], ['4:5', '4:5'], ['21:9', '21:9']]
export const newProject = (video, track = []) => ({
  v: 1, video, track, splits: [], trims: [], zooms: [], speeds: [], notes: [], audios: [], crop: [0, 0, 0, 0],
  bg: { type: 'wall', wall: 0, color: '#18181b', c2: '#3f3f46', src: '', blur: 0.5 }, pad: 0.06, radius: 0.025, shadow: 0.6, aspect: 'native',
  cursor: { show: true, size: 1, smooth: 0.5, bounce: true, sway: true, blur: true, loop: false },
  cam: { file: '', on: true, mirror: false, size: 0.24, pos: 'br', x: 0.85, y: 0.8, margin: 0.035, round: 1, shadow: 0.5, react: true },
  exp: { fmt: 'mp4', quality: 'high', fps: 60, height: 1080, gifFps: 15, gifLoop: true, gifSize: 720 }
})
const ease = k => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k) }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Zoom suggestions: clicks close together in time become one zoom that follows the pointer; with no clicks, places where the pointer lingered.
export function autoZooms(track, dur) {
  const out = [], clicks = track.filter(p => p.d === 1)
  let pts = clicks
  if (!pts.length) { // dwell points
    pts = []
    for (let i = 0, j = 0; i < track.length; i = Math.max(j, i + 1)) {
      j = i; while (j + 1 < track.length && Math.hypot(track[j + 1].x - track[i].x, track[j + 1].y - track[i].y) < 0.04) j++
      if (track[j].t - track[i].t > 1.2) pts.push(track[i])
    }
  }
  for (const c of pts) {
    const last = out.at(-1)
    if (last && c.t - last.b < 1.2) { last.b = Math.min(dur, c.t + 1.8); last.n++; last.x += (c.x - last.x) / last.n; last.y += (c.y - last.y) / last.n }
    else out.push({ id: uid(), a: Math.max(0, c.t - 0.5), b: Math.min(dur, c.t + 1.8), x: c.x, y: c.y, z: 1.8, follow: true, n: 1 })
  }
  return out.filter(z => z.b - z.a > 0.8).map(({ n, ...z }) => z)
}
export function outSize(p, vw, vh, H) {
  const c = p.crop, cw = vw * (1 - c[0] - c[2]), ch = vh * (1 - c[1] - c[3])
  const [a, b] = p.aspect === 'native' ? [cw, ch] : p.aspect.split(':').map(Number)
  return [Math.round(H * a / b / 2) * 2, Math.round(H / 2) * 2]
}
// Pointer at time t: position averaged over a small window (smoothing), speed, and how long ago the last click was.
export function cursorAt(track, t, smooth = 0.5) {
  if (!track.length) return null
  let lo = 0, hi = track.length - 1
  while (lo < hi) { const m = (lo + hi + 1) >> 1; track[m].t <= t ? lo = m : hi = m - 1 }
  const at = tt => { let i = lo; while (i > 0 && track[i].t > tt) i--; while (i < track.length - 1 && track[i + 1].t <= tt) i++
    const p = track[i], q = track[Math.min(track.length - 1, i + 1)], k = q.t > p.t ? clamp((tt - p.t) / (q.t - p.t), 0, 1) : 0; return [p.x + (q.x - p.x) * k, p.y + (q.y - p.y) * k] }
  const win = smooth * 0.3, n = win ? 7 : 1; let x = 0, y = 0
  for (let i = 0; i < n; i++) { const [px, py] = at(t - win / 2 + (n > 1 ? win * i / (n - 1) : 0)); x += px / n; y += py / n }
  const [bx, by] = at(t - 0.05); let click = 9
  for (let i = lo; i >= 0 && t - track[i].t < 0.6; i--) if (track[i].d === 1) { click = t - track[i].t; break }
  return { x, y, vx: (x - bx) / 0.05, vy: (y - by) / 0.05, click }
}
export function zoomAt(p, t) {
  let best = null
  for (const z of p.zooms) if (t >= z.a && t <= z.b) { const k = ease(Math.min((t - z.a) / 0.5, (z.b - t) / 0.5, 1)); if (!best || k > best.k) best = { k, z } }
  return best
}
function cursorShape(ctx, s) { // classic arrow pointer
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16 * s); ctx.lineTo(4.2 * s, 12.3 * s); ctx.lineTo(7 * s, 18.6 * s); ctx.lineTo(9.6 * s, 17.4 * s); ctx.lineTo(6.8 * s, 11.4 * s); ctx.lineTo(11.8 * s, 11.4 * s); ctx.closePath()
  ctx.fillStyle = '#111'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.stroke()
}

// res: { bg: Image, cam: HTMLVideoElement, imgs: { noteId: Image } }
export function render(ctx, W, H, p, t, vid, res = {}) {
  const vw = vid.videoWidth, vh = vid.videoHeight, b = p.bg
  // ---- background ----
  if (b.type === 'color') { ctx.fillStyle = b.color; ctx.fillRect(0, 0, W, H) }
  else if (b.type === 'image' && res.bg) { const k = Math.max(W / res.bg.width, H / res.bg.height); ctx.drawImage(res.bg, (W - res.bg.width * k) / 2, (H - res.bg.height * k) / 2, res.bg.width * k, res.bg.height * k) }
  else if (b.type === 'blur' && vw) { const k = Math.max(W / vw, H / vh) * 1.15; ctx.filter = `blur(${Math.round(H * 0.06 * (b.blur ?? 0.5) + 2)}px) brightness(.8)`; ctx.drawImage(vid, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k); ctx.filter = 'none' }
  else { const w = b.type === 'grad' ? [0, b.color, b.c2] : WALLS[b.wall] || WALLS[0], g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, w[1]); if (w[3]) g.addColorStop(0.55, w[2]); g.addColorStop(1, w[3] || w[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    const r = ctx.createRadialGradient(W * 0.25, H * 0.15, 0, W * 0.25, H * 0.15, W * 0.7); r.addColorStop(0, 'rgba(255,255,255,.16)'); r.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H) }
  if (!vw) return
  // ---- framed video ----
  const c = p.crop, sx = c[0] * vw, sy = c[1] * vh, sw = vw * (1 - c[0] - c[2]), sh = vh * (1 - c[1] - c[3])
  const pad = p.pad * Math.min(W, H), k0 = Math.min((W - pad * 2) / sw, (H - pad * 2) / sh), fw = sw * k0, fh = sh * k0, fx = (W - fw) / 2, fy = (H - fh) / 2, rad = p.radius * Math.min(fw, fh)
  const frame = () => { ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, rad) }
  if (p.shadow) { ctx.save(); frame(); ctx.shadowColor = `rgba(0,0,0,${0.75 * p.shadow})`; ctx.shadowBlur = H * 0.07 * p.shadow; ctx.shadowOffsetY = H * 0.025 * p.shadow; ctx.fillStyle = '#000'; ctx.fill(); ctx.restore() }
  const cur = p.track.length ? cursorAt(p.track, t, p.cursor.smooth) : null
  const norm = pt => [(pt.x - c[0]) / (1 - c[0] - c[2]), (pt.y - c[1]) / (1 - c[1] - c[3])] // canvas-normalized → cropped-frame-normalized
  const zm = zoomAt(p, t), kz = zm ? zm.k : 0, s = zm ? 1 + (zm.z.z - 1) * kz : 1
  let [zx, zy] = zm ? (zm.z.follow && cur ? norm(cur) : norm(zm.z)) : [0.5, 0.5]
  if (zm?.z.follow && cur) { const st = zm.z._f ??= { x: zx, y: zy }; st.x += (zx - st.x) * 0.08; st.y += (zy - st.y) * 0.08; zx = st.x; zy = st.y } // glide after the pointer
  const ox = clamp(fx + fw / 2 - (0.5 + (zx - 0.5) * kz) * fw * s, fx + fw - fw * s, fx), oy = clamp(fy + fh / 2 - (0.5 + (zy - 0.5) * kz) * fh * s, fy + fh - fh * s, fy)
  ctx.save(); frame(); ctx.clip()
  ctx.drawImage(vid, sx, sy, sw, sh, ox, oy, fw * s, fh * s)
  if (cur && p.cursor.show) { // rendered pointer
    const [nx, ny] = norm(cur), px = ox + nx * fw * s, py = oy + ny * fh * s, cs = fh * s / 520 * p.cursor.size
    const bounce = p.cursor.bounce && cur.click < 0.3 ? 1 - 0.28 * Math.sin(Math.PI * cur.click / 0.3) : 1, sp = Math.hypot(cur.vx, cur.vy)
    if (cur.click < 0.45) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - cur.click / 0.45)})`; ctx.lineWidth = 2 * cs; ctx.beginPath(); ctx.arc(px, py, cs * (6 + 40 * cur.click), 0, 7); ctx.stroke() }
    const ghosts = p.cursor.blur && sp > 0.5 ? 3 : 0
    for (let g = ghosts; g >= 0; g--) {
      ctx.save(); ctx.globalAlpha = g ? 0.16 : 1
      ctx.translate(px - cur.vx * fw * s * 0.012 * g, py - cur.vy * fh * s * 0.012 * g)
      if (p.cursor.sway) ctx.rotate(clamp(cur.vx * 0.12, -0.35, 0.35))
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 4 * cs; ctx.shadowOffsetY = 1.5 * cs
      cursorShape(ctx, cs * bounce); ctx.restore()
    }
  }
  ctx.restore()
  // ---- notes ----
  for (const n of p.notes) {
    if (t < n.a || t > n.b) continue
    ctx.save(); ctx.globalAlpha = Math.min(1, (t - n.a) / 0.2, (n.b - t) / 0.2)
    const x = n.x * W, y = n.y * H, w = (n.w || 0.2) * W, h = (n.h || 0.1) * H
    if (n.kind === 'text') { const fs = (n.size || 0.05) * H; ctx.font = `700 ${fs}px -apple-system, "Segoe UI", system-ui, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
      const tw = ctx.measureText(n.text).width; if (n.box !== false) { ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.beginPath(); ctx.roundRect(x - tw / 2 - fs * 0.5, y - fs * 0.75, tw + fs, fs * 1.5, fs * 0.35); ctx.fill() }
      ctx.fillStyle = n.color || '#fff'; ctx.fillText(n.text, x, y) }
    else if (n.kind === 'rect') { ctx.strokeStyle = n.color || '#f43f5e'; ctx.lineWidth = H * 0.006; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, H * 0.012); ctx.stroke() }
    else if (n.kind === 'arrow') { const x1 = x + w, y1 = y + h, an = Math.atan2(h, w), hd = H * 0.035; ctx.strokeStyle = ctx.fillStyle = n.color || '#f43f5e'; ctx.lineWidth = H * 0.008; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(an - 0.45), y1 - hd * Math.sin(an - 0.45)); ctx.lineTo(x1 - hd * Math.cos(an + 0.45), y1 - hd * Math.sin(an + 0.45)); ctx.closePath(); ctx.fill() }
    else if (n.kind === 'image' && res.imgs?.[n.id]) { const im = res.imgs[n.id], hh = w * im.height / im.width; ctx.drawImage(im, x - w / 2, y - hh / 2, w, hh) }
    ctx.restore()
  }
  // ---- webcam bubble ----
  const cm = p.cam, cv = res.cam
  if (cm.on && cv?.videoWidth) {
    const d = cm.size * H * (cm.react ? 1 - 0.28 * kz : 1), m = cm.margin * H
    const [bx, by] = cm.pos === 'custom' ? [cm.x * W - d / 2, cm.y * H - d / 2] : [cm.pos[1] === 'l' ? m : W - d - m, cm.pos[0] === 't' ? m : H - d - m]
    const path = () => { ctx.beginPath(); ctx.roundRect(bx, by, d, d, cm.round * d / 2) }
    if (cm.shadow) { ctx.save(); path(); ctx.shadowColor = `rgba(0,0,0,${0.7 * cm.shadow})`; ctx.shadowBlur = H * 0.04; ctx.shadowOffsetY = H * 0.012; ctx.fill(); ctx.restore() }
    ctx.save(); path(); ctx.clip()
    const k = Math.max(d / cv.videoWidth, d / cv.videoHeight), dw = cv.videoWidth * k, dh = cv.videoHeight * k
    if (cm.mirror) { ctx.translate(bx * 2 + d, 0); ctx.scale(-1, 1) }
    ctx.drawImage(cv, bx + (d - dw) / 2, by + (d - dh) / 2, dw, dh); ctx.restore()
  }
}
