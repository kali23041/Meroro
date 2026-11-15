// Stream pointers: animated cursors drawn on screen-capture sources at the real mouse position.
// drawPointer(ctx, x, y, u, st, t, ca): (x, y) = hot spot, u = size unit in px, t = seconds, ca = seconds since the last click.
export const POINTERS = [['sword', 'Sword'], ['crosshair', 'Crosshair'], ['neon', 'Neon arrow'], ['fire', 'Fire arrow'], ['wand', 'Magic wand'], ['bolt', 'Lightning'], ['ring', 'Glow ring'], ['pixel', 'Pixel arrow'], ['axe', 'Battle axe'], ['kunai', 'Kunai']]
export const PTR_DEFAULT = { on: false, style: 'sword', size: 1, color: '#7dd3fc', trail: true, click: true }
const out = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3)
const arrow = (c, u) => { c.beginPath(); c.moveTo(0, 0); c.lineTo(0, u * 1.45); c.lineTo(u * 0.38, u * 1.12); c.lineTo(u * 0.64, u * 1.7); c.lineTo(u * 0.88, u * 1.59); c.lineTo(u * 0.62, u * 1.03); c.lineTo(u * 1.07, u * 1.03); c.closePath() }
const star = (c, x, y, r, rot = 0) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, q = i % 2 ? r * 0.38 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) } c.closePath(); c.fill() }

export function drawPointer(c, x, y, u, st, t, ca = 9) {
  const col = st.color || '#7dd3fc', hit = st.click !== false && ca < 0.35, k = hit ? out(ca / 0.35) : 1
  c.save(); c.translate(x, y); c.lineJoin = c.lineCap = 'round'
  if (hit && st.style !== 'sword' && st.style !== 'axe') { c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = u * 0.12; c.beginPath(); c.arc(0, 0, u * (0.3 + 1.6 * k), 0, 7); c.stroke(); c.globalAlpha = 1 }
  const s = st.style
  if (s === 'sword' || s === 'kunai' || s === 'axe') {
    const swing = hit ? -1.0 + 1.5 * k : Math.sin(t * 2.2) * 0.06
    if (hit) { c.strokeStyle = '#fff'; c.globalAlpha = 0.85 * (1 - k); c.lineWidth = u * 0.16; c.shadowColor = col; c.shadowBlur = u * 0.5; c.beginPath(); c.arc(u * 0.9, u * 0.9, u * 1.9, -2.6, -2.6 + 1.7 * k); c.stroke(); c.globalAlpha = 1; c.shadowBlur = 0 }
    c.translate(u * 0.9, u * 0.9); c.rotate(swing); c.translate(-u * 0.9, -u * 0.9); c.rotate(-Math.PI / 4) // blade points up-left, tip on the hot spot
    c.shadowColor = col; c.shadowBlur = u * 0.35
    if (s === 'sword') {
      const g = c.createLinearGradient(-u * 0.16, 0, u * 0.16, 0); g.addColorStop(0, '#e5e7eb'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#9ca3af')
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(u * 0.17, u * 0.3); c.lineTo(u * 0.15, u * 1.75); c.lineTo(-u * 0.15, u * 1.75); c.lineTo(-u * 0.17, u * 0.3); c.closePath(); c.fill()
      c.shadowBlur = 0; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = u * 0.03; c.beginPath(); c.moveTo(0, u * 0.12); c.lineTo(0, u * 1.7); c.stroke()
      c.fillStyle = col; c.beginPath(); c.roundRect(-u * 0.5, u * 1.72, u, u * 0.17, u * 0.08); c.fill()
      c.fillStyle = '#3f2d20'; c.beginPath(); c.roundRect(-u * 0.1, u * 1.88, u * 0.2, u * 0.55, u * 0.06); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(0, u * 2.5, u * 0.13, 0, 7); c.fill()
    } else if (s === 'kunai') {
      c.fillStyle = '#d4d4d8'; c.beginPath(); c.moveTo(0, 0); c.lineTo(u * 0.3, u * 0.85); c.lineTo(0, u * 1.25); c.lineTo(-u * 0.3, u * 0.85); c.closePath(); c.fill()
      c.shadowBlur = 0; c.fillStyle = '#27272a'; c.fillRect(-u * 0.07, u * 1.2, u * 0.14, u * 0.75); c.strokeStyle = col; c.lineWidth = u * 0.09; c.beginPath(); c.arc(0, u * 2.12, u * 0.17, 0, 7); c.stroke()
    } else {
      c.fillStyle = '#5b3a1f'; c.fillRect(-u * 0.07, u * 0.1, u * 0.14, u * 2.3)
      c.fillStyle = '#e5e7eb'; c.beginPath(); c.moveTo(u * 0.07, u * 0.15); c.quadraticCurveTo(u * 1.0, u * 0.1, u * 0.95, u * 0.95); c.quadraticCurveTo(u * 0.5, u * 0.7, u * 0.07, u * 0.85); c.closePath(); c.fill()
      c.fillStyle = col; c.beginPath(); c.arc(0, u * 0.08, u * 0.13, 0, 7); c.fill()
    }
  } else if (s === 'crosshair') {
    const r = u * (0.75 - (hit ? 0.25 * (1 - k) : 0)), rot = t * 0.9
    c.shadowColor = col; c.shadowBlur = u * 0.4; c.strokeStyle = col; c.lineWidth = u * 0.1; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke()
    c.rotate(rot); for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(r * 0.55, 0); c.lineTo(r * 1.45, 0); c.stroke() }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, u * 0.09, 0, 7); c.fill()
  } else if (s === 'neon' || s === 'fire') {
    if (s === 'fire') for (let i = 0; i < 7; i++) { const p = (t * 1.6 + i / 7) % 1; c.globalAlpha = (1 - p) * 0.8; c.fillStyle = ['#fde047', '#fb923c', '#ef4444'][i % 3]
      c.beginPath(); c.arc(u * (0.45 + Math.sin(i * 2.4 + t * 3) * 0.3), u * (1.0 - p * 1.5), u * 0.2 * (1 - p), 0, 7); c.fill() }
    c.globalAlpha = 1; c.shadowColor = s === 'fire' ? '#f97316' : col; c.shadowBlur = u * (0.55 + Math.sin(t * 5) * 0.15)
    arrow(c, u * (hit ? 0.85 + 0.15 * k : 1)); c.fillStyle = s === 'fire' ? '#fff7ed' : '#0b1020'; c.fill(); c.lineWidth = u * 0.11; c.strokeStyle = s === 'fire' ? '#fb923c' : col; c.stroke()
  } else if (s === 'wand') {
    c.rotate(-Math.PI / 4); c.strokeStyle = '#27272a'; c.lineWidth = u * 0.16; c.beginPath(); c.moveTo(0, u * 0.2); c.lineTo(0, u * 2.1); c.stroke(); c.strokeStyle = '#fafafa'; c.beginPath(); c.moveTo(0, u * 0.2); c.lineTo(0, u * 0.6); c.stroke()
    c.shadowColor = col; c.shadowBlur = u * 0.6; c.fillStyle = '#fff'; star(c, 0, 0, u * (0.42 + Math.sin(t * 6) * 0.06), t)
    c.fillStyle = col; for (let i = 0; i < 4; i++) { const a = t * 2.2 + i * 1.57, r = u * (0.75 + Math.sin(t * 3 + i) * 0.15); star(c, Math.cos(a) * r, Math.sin(a) * r, u * 0.14, a) }
  } else if (s === 'bolt') {
    c.shadowColor = col; c.shadowBlur = u * (0.4 + (Math.sin(t * 23) > 0.3 ? 0.5 : 0)); c.fillStyle = '#fef9c3'; c.strokeStyle = col; c.lineWidth = u * 0.08
    c.beginPath(); c.moveTo(0, 0); c.lineTo(u * 0.75, u * 0.75); c.lineTo(u * 0.42, u * 0.85); c.lineTo(u * 1.0, u * 1.75); c.lineTo(u * 0.22, u * 1.0); c.lineTo(u * 0.5, u * 0.9); c.closePath(); c.fill(); c.stroke()
  } else if (s === 'ring') {
    const r = u * (0.95 + Math.sin(t * 3) * 0.08), g = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.5); g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.5, 0, 7); c.fill()
    c.strokeStyle = col; c.lineWidth = u * 0.12; c.shadowColor = col; c.shadowBlur = u * 0.4; c.beginPath(); c.arc(0, 0, r * (hit ? 0.7 + 0.3 * k : 1), 0, 7); c.stroke()
  } else { // pixel arrow
    const px = u * 0.2, rows = ['1', '11', '121', '1221', '12221', '122221', '1222221', '12222111', '12212', '1211221', '11 1221', '    11']
    rows.forEach((r, j) => [...r].forEach((v, i) => { if (v !== ' ') { c.fillStyle = v === '1' ? '#111' : col; c.fillRect(i * px, j * px, px + 0.5, px + 0.5) } }))
  }
  c.restore()
}
// Fading trail behind the pointer; pts = [[x, y, time]] in px.
export function drawTrail(c, pts, u, col, now) {
  c.save(); c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = u * 0.3
  for (let i = 1; i < pts.length; i++) { const k = 1 - (now - pts[i][2]) / 450; if (k <= 0) continue
    c.strokeStyle = col; c.globalAlpha = k * 0.6; c.lineWidth = u * 0.22 * k; c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke() }
  c.restore()
}
