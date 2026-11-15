// Caption styles: one draw function for the stream and the library previews, plus the preset list.
const SYS = '-apple-system, "Segoe UI", "Noto Sans Devanagari", "Kohinoor Devanagari", system-ui, sans-serif'
const F = { sys: SYS, impact: 'Impact, "Arial Black", ' + SYS, black: '"Arial Black", "Segoe UI Black", ' + SYS, futura: 'Futura, "Century Gothic", ' + SYS, din: '"DIN Condensed", "Arial Narrow", ' + SYS,
  serif: 'Georgia, "Times New Roman", serif', mono: 'Menlo, Consolas, monospace', marker: '"Marker Felt", "Comic Sans MS", cursive', round: '"Arial Rounded MT Bold", "Varela Round", ' + SYS }
export const CAP_FONTS = [['sys', 'System'], ['impact', 'Impact'], ['black', 'Arial Black'], ['futura', 'Futura'], ['din', 'DIN Condensed'], ['round', 'Rounded'], ['serif', 'Serif'], ['mono', 'Mono'], ['marker', 'Marker']]
export const CAP_ANIMS = [['none', 'None'], ['pop', 'Pop'], ['fade', 'Fade in'], ['rise', 'Rise'], ['type', 'Typewriter']]
export const CAP_LOOKS = [['box', 'Box per line'], ['bar', 'Full bar'], ['outline', 'Outline'], ['glow', 'Glow'], ['shadow', 'Hard shadow'], ['plain', 'Plain']]
export const CAP_HL = [['none', 'Off'], ['color', 'Colour'], ['box', 'Box'], ['under', 'Underline']]
const P = (name, o) => ({ name, style: 'box', color: '#ffffff', bg: '#000000', hl: '#facc15', hlMode: 'none', anim: 'none', font: 'sys', upper: false, italic: false, grad: '', ...o })
export const CAP_STYLES = [
  P('Classic box'), P('Clean outline', { style: 'outline' }), P('Movie subtitle', { style: 'outline', color: '#fde047', font: 'sys' }),
  P('Bold pop', { style: 'outline', font: 'impact', upper: true, hlMode: 'color', anim: 'pop' }), P('Word box', { style: 'outline', font: 'black', upper: true, hlMode: 'box', hl: '#a855f7', anim: 'pop' }),
  P('Karaoke green', { style: 'shadow', font: 'black', hlMode: 'color', hl: '#4ade80' }), P('Neon cyan', { style: 'glow', color: '#67e8f9', bg: '#0e7490', font: 'futura' }),
  P('Neon pink', { style: 'glow', color: '#f9a8d4', bg: '#be185d', font: 'futura', italic: true }), P('Gamer red', { style: 'bar', bg: '#7f1d1d', font: 'din', upper: true, hlMode: 'color', hl: '#fca5a5' }),
  P('News bar', { style: 'bar', bg: '#1d4ed8', font: 'sys', hlMode: 'under', hl: '#ffffff' }), P('Sunset', { style: 'outline', font: 'black', color: '#fde68a', grad: '#fb7185', upper: true }),
  P('Gold', { style: 'shadow', font: 'serif', color: '#fef3c7', grad: '#d97706', bg: '#451a03' }), P('Ice', { style: 'outline', font: 'futura', color: '#ffffff', grad: '#7dd3fc', bg: '#0c4a6e' }),
  P('Fire', { style: 'glow', font: 'impact', color: '#fef08a', grad: '#ef4444', bg: '#ea580c', upper: true, anim: 'rise' }), P('Matrix', { style: 'box', font: 'mono', color: '#4ade80', bg: '#052e16', anim: 'type' }),
  P('Typewriter', { style: 'box', font: 'mono', color: '#18181b', bg: '#fafafa', anim: 'type' }), P('Comic', { style: 'shadow', font: 'marker', color: '#fde047', bg: '#1e1b4b', hlMode: 'color', hl: '#fb7185', anim: 'pop' }),
  P('Soft shadow', { style: 'plain', font: 'round' }), P('Paper', { style: 'box', color: '#111827', bg: '#ffffff', font: 'round' }),
  P('Purple pill', { style: 'box', bg: '#6d28d9', font: 'round', hlMode: 'color', hl: '#fde047', anim: 'fade' }), P('Lime punch', { style: 'outline', font: 'impact', color: '#bef264', upper: true, hlMode: 'box', hl: '#16a34a', anim: 'pop' }),
  P('Elegant', { style: 'plain', font: 'serif', italic: true, hlMode: 'under', hl: '#fbbf24', anim: 'fade' }), P('Esports', { style: 'bar', bg: '#0f172a', font: 'din', upper: true, color: '#e2e8f0', hlMode: 'box', hl: '#f97316', anim: 'rise' }),
  P('Bubble', { style: 'box', bg: '#ec4899', font: 'round', color: '#ffffff', hlMode: 'color', hl: '#fef08a', anim: 'pop' })
]
const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3)

// x, y, w, h: caption box. text: full caption. age: seconds since the newest word arrived (drives the word animation).
export function drawCap(ctx, x, y, w, h, l, text, age = 9) {
  if (!text) return
  if (l.upper) text = text.toUpperCase()
  const n = l.lines || 2, lh = h / n, fs = lh * 0.6, look = l.style || 'box', an = l.anim || 'none'
  ctx.save()
  ctx.font = `${l.italic ? 'italic ' : ''}${l.font === 'serif' || l.font === 'mono' ? 700 : 800} ${fs}px ${F[l.font] || SYS}`
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  const sp = ctx.measureText(' ').width, rows = [[]]; let rw = 0
  for (const word of text.split(/\s+/)) {
    const ww = ctx.measureText(word).width
    if (rows.at(-1).length && rw + sp + ww > w - fs) { rows.push([]); rw = 0 }
    rows.at(-1).push([word, ww]); rw += (rows.at(-1).length > 1 ? sp : 0) + ww
  }
  const show = rows.slice(-n), y0 = y + h - show.length * lh, cx = x + w / 2, k = ease(age / 0.22)
  show.forEach((row, ri) => {
    const tw = row.reduce((a, [, ww], i) => a + ww + (i ? sp : 0), 0), cy = y0 + lh * (ri + 0.5), lastRow = ri === show.length - 1
    if (look === 'box') { ctx.fillStyle = l.bg + 'd9'; ctx.beginPath(); ctx.roundRect(cx - tw / 2 - fs * 0.45, cy - lh * 0.46, tw + fs * 0.9, lh * 0.92, fs * 0.28); ctx.fill() }
    else if (look === 'bar') { ctx.fillStyle = l.bg + 'e6'; ctx.fillRect(x, cy - lh * 0.5, w, lh + 0.5); if (ri === 0) { ctx.fillStyle = l.hl || l.color; ctx.fillRect(x, cy - lh * 0.5, fs * 0.16, lh * show.length) } }
    let px = cx - tw / 2
    row.forEach(([word, ww], wi) => {
      const newest = lastRow && wi === row.length - 1, hl = newest && l.hlMode && l.hlMode !== 'none'
      ctx.save()
      ctx.translate(px + ww / 2, cy)
      if (newest && an === 'pop') { const s = 1 + 0.4 * (1 - k); ctx.scale(s, s) }
      if (newest && an === 'fade') ctx.globalAlpha *= k
      if (newest && an === 'rise') { ctx.translate(0, lh * 0.5 * (1 - k)); ctx.globalAlpha *= k }
      let shown = word
      if (newest && an === 'type') shown = word.slice(0, Math.ceil(word.length * Math.min(1, age / 0.25)))
      if (hl && l.hlMode === 'box') { ctx.fillStyle = l.hl; ctx.beginPath(); ctx.roundRect(-ww / 2 - fs * 0.16, -lh * 0.4, ww + fs * 0.32, lh * 0.8, fs * 0.2); ctx.fill() }
      if (look === 'outline' || look === 'glow') { ctx.lineWidth = fs * (look === 'outline' ? 0.22 : 0.1); ctx.strokeStyle = l.bg; ctx.strokeText(shown, -ww / 2, 0) }
      if (look === 'shadow') { ctx.fillStyle = l.bg; ctx.fillText(shown, -ww / 2 + fs * 0.07, fs * 0.08) }
      if (look === 'plain') { ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = fs * 0.3; ctx.shadowOffsetY = fs * 0.05 }
      if (look === 'glow') { ctx.shadowColor = l.bg; ctx.shadowBlur = fs * 0.7 }
      let fill = hl && l.hlMode === 'color' ? l.hl : l.color
      if (l.grad && !(hl && l.hlMode === 'color')) { const g = ctx.createLinearGradient(0, -fs * 0.5, 0, fs * 0.5); g.addColorStop(0, l.color); g.addColorStop(1, l.grad); fill = g }
      ctx.fillStyle = fill; ctx.fillText(shown, -ww / 2, 0)
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
      if (hl && l.hlMode === 'under') { ctx.fillStyle = l.hl; ctx.fillRect(-ww / 2, fs * 0.5, ww * k, fs * 0.11) }
      ctx.restore()
      px += ww + sp
    })
  })
  ctx.restore()
}
