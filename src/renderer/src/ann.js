// Annotation ink for teaching streams: drawn by the engine on top of the scene, so viewers see it.
// All coordinates are 0..1 of the canvas, so ink survives a size change.
export const newAnn = () => ({ items: [], redo: [], live: null, laser: [], spot: null, board: 'none', n: 1 })
export const BOARDS = [['none', 'No board'], ['white', 'Whiteboard'], ['black', 'Blackboard'], ['green', 'Chalkboard'], ['grid', 'Grid paper'], ['lines', 'Ruled paper']]
const BG = { white: '#fafafa', black: '#0d0d10', green: '#1f4d3a', grid: '#fbfbf7', lines: '#fbfbf7' }

function stroke(ctx, pts, W, H) { // smooth freehand: quadratic curves through midpoints
  ctx.beginPath(); ctx.moveTo(pts[0][0] * W, pts[0][1] * H)
  if (pts.length < 3) { const p = pts.at(-1); ctx.lineTo(p[0] * W + 0.01, p[1] * H) }
  for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i], [nx, ny] = pts[i + 1]; ctx.quadraticCurveTo(x * W, y * H, (x + nx) / 2 * W, (y + ny) / 2 * H) }
  if (pts.length > 2) { const p = pts.at(-1); ctx.lineTo(p[0] * W, p[1] * H) }
  ctx.stroke()
}
function item(ctx, it, W, H) {
  const lw = it.w * H, [ax, ay] = it.a || [0, 0], [bx, by] = it.b || [0, 0], x0 = ax * W, y0 = ay * H, x1 = bx * W, y1 = by * H
  ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = ctx.fillStyle = it.c; ctx.lineWidth = lw
  if (it.k === 'pen') stroke(ctx, it.pts, W, H)
  else if (it.k === 'hl') { ctx.globalAlpha *= 0.38; ctx.lineWidth = lw * 5; ctx.lineCap = 'butt'; stroke(ctx, it.pts, W, H) }
  else if (it.k === 'line' || it.k === 'arrow') {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
    if (it.k === 'arrow') { const an = Math.atan2(y1 - y0, x1 - x0), h = Math.max(lw * 4, H * 0.018)
      ctx.beginPath(); ctx.moveTo(x1 + Math.cos(an) * lw, y1 + Math.sin(an) * lw); ctx.lineTo(x1 - h * Math.cos(an - 0.45), y1 - h * Math.sin(an - 0.45)); ctx.lineTo(x1 - h * Math.cos(an + 0.45), y1 - h * Math.sin(an + 0.45)); ctx.closePath(); ctx.fill() }
  } else if (it.k === 'rect' || it.k === 'ellipse') {
    ctx.beginPath()
    if (it.k === 'rect') ctx.roundRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), lw)
    else ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 7)
    if (it.fill) { ctx.save(); ctx.globalAlpha *= 0.25; ctx.fill(); ctx.restore() }
    ctx.stroke()
  } else if (it.k === 'text') {
    const fs = it.w * H * 7; ctx.font = `700 ${fs}px -apple-system, "Segoe UI", system-ui, sans-serif`; ctx.textBaseline = 'top'
    ctx.lineWidth = fs * 0.16; ctx.strokeStyle = 'rgba(0,0,0,.55)'
    it.text.split('\n').forEach((ln, i) => { ctx.strokeText(ln, x0, y0 + i * fs * 1.2); ctx.fillText(ln, x0, y0 + i * fs * 1.2) })
  } else if (it.k === 'step') {
    const r = it.w * H * 4.2; ctx.beginPath(); ctx.arc(x0, y0, r, 0, 7); ctx.fill(); ctx.lineWidth = r * 0.14; ctx.strokeStyle = '#fff'; ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `800 ${r * 1.15}px -apple-system, "Segoe UI", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(it.n), x0, y0 + r * 0.06)
  }
}
export function drawAnn(ctx, W, H, a, now = performance.now()) {
  if (a.board !== 'none') {
    ctx.fillStyle = BG[a.board]; ctx.fillRect(0, 0, W, H)
    if (a.board === 'grid' || a.board === 'lines') { ctx.strokeStyle = 'rgba(60,90,160,.22)'; ctx.lineWidth = 1; ctx.beginPath(); const g = H / 22
      for (let y = g; y < H; y += g) { ctx.moveTo(0, y); ctx.lineTo(W, y) }
      if (a.board === 'grid') for (let x = g; x < W; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, H) }
      ctx.stroke() }
  }
  if (a.items.some(it => it.fade && now - it.t > it.fade * 1000)) a.items = a.items.filter(it => !it.fade || now - it.t <= it.fade * 1000)
  for (const it of a.live ? [...a.items, a.live] : a.items) {
    ctx.save(); if (it.fade) ctx.globalAlpha = Math.min(1, (it.fade * 1000 - (now - it.t)) / 600)
    item(ctx, it, W, H); ctx.restore()
  }
  if (a.spot) { // spotlight: dim everything except a circle around the pointer
    const [x, y] = a.spot, r = H * (a.spotR || 0.16)
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(x * W, y * H, r, 0, 7, true); ctx.fill('evenodd')
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x * W, y * H, r, 0, 7); ctx.stroke(); ctx.restore()
  }
  a.laser = a.laser.filter(p => now - p[2] < 900)
  if (a.laser.length) { // laser pointer: glowing trail that fades by itself
    ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = a.laserC || '#ff2d2d'; ctx.shadowBlur = H * 0.02
    for (let i = 1; i < a.laser.length; i++) { const p = a.laser[i - 1], q = a.laser[i], k = 1 - (now - q[2]) / 900
      ctx.strokeStyle = a.laserC || '#ff2d2d'; ctx.globalAlpha = k; ctx.lineWidth = H * 0.008 * k + 1; ctx.beginPath(); ctx.moveTo(p[0] * W, p[1] * H); ctx.lineTo(q[0] * W, q[1] * H); ctx.stroke() }
    const p = a.laser.at(-1); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0] * W, p[1] * H, H * 0.006, 0, 7); ctx.fill(); ctx.restore()
  }
}
// Stroke eraser: is point (x, y) on this item? `asp` = W / H so distances are even in both directions.
export function hit(it, x, y, asp, r = 0.02) {
  const d = (px, py) => Math.hypot((px - x) * asp, py - y), seg = (a, b) => { const vx = (b[0] - a[0]) * asp, vy = b[1] - a[1], wx = (x - a[0]) * asp, wy = y - a[1], t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(wx - t * vx, wy - t * vy) }
  if (it.pts) return it.pts.some((p, i) => i ? seg(it.pts[i - 1], p) < r : d(p[0], p[1]) < r)
  if (it.k === 'line' || it.k === 'arrow') return seg(it.a, it.b) < r
  if (it.k === 'step' || it.k === 'text') return d(it.a[0], it.a[1]) < r * 3
  const [x0, x1] = [it.a[0], it.b[0]].sort((p, q) => p - q), [y0, y1] = [it.a[1], it.b[1]].sort((p, q) => p - q)
  return x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r && (it.fill || !(x > x0 + r && x < x1 - r && y > y0 + r && y < y1 - r))
}
