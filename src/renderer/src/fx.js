// Animated overlay graphics, all drawn in code so every preset stays editable:
// banners (bottom name bars), animated backgrounds + text for stream scenes, and alert effects.
// Every draw function takes (ctx, x, y, w, h, cfg, t) with t in seconds.
export const FONTS = [['Impact, "Arial Black", sans-serif', 'Impact'], ['"Arial Black", "Segoe UI Black", sans-serif', 'Arial Black'], ['"Avenir Next", "Segoe UI", sans-serif', 'Avenir / Segoe'],
  ['Futura, "Century Gothic", sans-serif', 'Futura'], ['"Helvetica Neue", Arial, sans-serif', 'Helvetica'], ['"Gill Sans", "Trebuchet MS", sans-serif', 'Gill Sans'],
  ['"DIN Condensed", "Arial Narrow", sans-serif', 'DIN Condensed'], ['Copperplate, "Copperplate Gothic Light", serif', 'Copperplate'], ['Didot, Georgia, serif', 'Didot'],
  ['Georgia, serif', 'Georgia'], ['"Courier New", monospace', 'Courier'], ['Menlo, Consolas, monospace', 'Menlo / Consolas'], ['"Marker Felt", "Comic Sans MS", cursive', 'Marker'],
  ['Chalkduster, "Segoe Print", cursive', 'Chalk'], ['"Bradley Hand", "Segoe Script", cursive', 'Handwriting'], ['Papyrus, fantasy', 'Papyrus']]
export const PALETTES = [['Magenta', '#ff2d95', '#7a0bc0'], ['Violet', '#a855f7', '#3b0a8f'], ['Cyan', '#22d3ee', '#0b3bd6'], ['Red', '#ff3b3b', '#7a0a0a'], ['Orange', '#ff8a1f', '#c2185b'],
  ['Lime', '#a3e635', '#0e7a4a'], ['Gold', '#ffd24a', '#b45309'], ['Ice', '#e0f2fe', '#3b82f6'], ['Mono', '#ffffff', '#52525b'], ['Sunset', '#ff5f6d', '#ffc371']]
export const ANIMS = [['pulse', 'Pulse glow'], ['sweep', 'Light sweep'], ['particles', 'Rising sparks'], ['wave', 'Wave'], ['none', 'Still']]

const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` }
const grad = (c, x0, y0, x1, y1, ...stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g }
const font = (c, px, f, o = {}) => { c.font = `${o.italic ? 'italic ' : ''}${o.weight || 800} ${px}px ${f || FONTS[0][0]}` }
const rnd = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
function fit(c, text, px, f, max, o) { font(c, px, f, o); const m = c.measureText(text).width; if (m > max) font(c, px * max / m, f, o) }
function glowText(c, text, x, y, color, blur) { c.save(); c.shadowColor = color; c.shadowBlur = blur; c.fillText(text, x, y); c.restore() }

// ---------- shared animated glow layers ----------
function animate(c, x, y, w, h, b, t) {
  const g = b.glow ?? 0.7, a = b.anim || 'pulse'
  if (a === 'pulse') { const p = 0.5 + 0.5 * Math.sin(t * 2.2); c.fillStyle = grad(c, 0, y + h, 0, y + h * 0.35, rgba(b.c1, 0.55 * g * (0.5 + p * 0.5)), rgba(b.c1, 0)); c.fillRect(x, y, w, h) }
  else if (a === 'sweep') { const p = (t * 0.35) % 1.4 - 0.2, sx = x + w * p; c.fillStyle = grad(c, sx - w * 0.18, 0, sx + w * 0.18, 0, 'rgba(255,255,255,0)', `rgba(255,255,255,${0.35 * g})`, 'rgba(255,255,255,0)'); c.save(); c.transform(1, 0, -0.4, 1, 0, 0); c.fillRect(x + h * 0.4, y, w * 1.4, h); c.restore() }
  else if (a === 'particles') { for (let i = 0; i < 26; i++) { const p = (t * (0.12 + rnd(i) * 0.25) + rnd(i + 9)) % 1, px = x + rnd(i + 3) * w + Math.sin(t + i) * w * 0.01, py = y + h - p * h * 1.1, r = h * (0.012 + rnd(i + 5) * 0.03); c.fillStyle = rgba(i % 3 ? b.c1 : '#ffffff', (1 - p) * g); c.beginPath(); c.arc(px, py, r, 0, 7); c.fill() } }
  else if (a === 'wave') { c.fillStyle = rgba(b.c1, 0.35 * g); c.beginPath(); c.moveTo(x, y + h); for (let i = 0; i <= 40; i++) c.lineTo(x + w * i / 40, y + h * (0.78 + 0.1 * Math.sin(i * 0.5 + t * 2) + 0.05 * Math.sin(i * 1.3 - t * 3))); c.lineTo(x + w, y + h); c.fill() }
}
const handles = b => [b.h1, b.h2, b.h3].filter(Boolean)
function picture(c, img, x, y, w, h) { if (!img) return; const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height, k = Math.min(w / iw, h / ih); c.drawImage(img, x + (w - iw * k) / 2, y + h - ih * k, iw * k, ih * k) }

// ---------- banners ----------
const TPL = {
  neon(c, x, y, w, h, b, t, img) { // dark bar, glowing top line, big italic name, pay/handle block on the left
    const by = y + h * 0.3, bh = h * 0.7
    c.fillStyle = grad(c, x, 0, x + w, 0, '#0a0410', rgba(b.c2, 0.75), '#0a0410'); c.fillRect(x, by, w, bh)
    animate(c, x, by, w, bh, b, t)
    c.save(); c.shadowColor = b.c1; c.shadowBlur = h * 0.18 * (b.glow ?? 0.7); c.fillStyle = b.c1; c.fillRect(x, by, w, h * 0.022); c.restore()
    picture(c, img, x + w * 0.02, y, w * 0.2, h)
    const lx = x + w * (img ? 0.24 : 0.04)
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#fff'
    if (b.upi) { fit(c, b.tag || 'UPI', h * 0.22, b.font, w * 0.16, { italic: true }); c.fillText(b.tag || 'UPI', lx, by + bh * 0.36); font(c, h * 0.085, FONTS[4][0], { weight: 700 }); c.fillText(b.upi, lx, by + bh * 0.68, w * 0.2) }
    const nx = lx + (b.upi ? w * 0.22 : 0), nw = x + w - nx - w * 0.03
    c.textAlign = 'center'; fit(c, b.title, h * 0.36, b.font, nw, { italic: b.italic }); glowText(c, b.title, nx + nw / 2, by + bh * 0.4, b.c1, h * 0.14 * (b.glow ?? 0.7))
    font(c, h * 0.08, FONTS[4][0], { weight: 600 }); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillText(handles(b).join('     ●     '), nx + nw / 2, by + bh * 0.78, nw)
  },
  slant(c, x, y, w, h, b, t, img) { // slanted colour blocks
    const sk = h * 0.35, by = y + h * 0.25, bh = h * 0.75
    const para = (px, pw, py, ph, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(px + sk, py); c.lineTo(px + pw, py); c.lineTo(px + pw - sk, py + ph); c.lineTo(px, py + ph); c.fill() }
    para(x - sk, w * 0.68 + sk, by, bh * 0.66, grad(c, x, 0, x + w * 0.7, 0, b.c1, b.c2))
    para(x + w * 0.1, w * 0.62, by + bh * 0.66, bh * 0.34, '#101014')
    c.save(); c.beginPath(); c.rect(x, by, w, bh); c.clip(); animate(c, x, by, w * 0.68, bh * 0.66, { ...b, c1: '#ffffff' }, t); c.restore()
    picture(c, img, x + w * 0.72, y, w * 0.26, h)
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#fff'
    fit(c, b.title, h * 0.36, b.font, w * 0.56, { italic: b.italic }); glowText(c, b.title, x + w * 0.04, by + bh * 0.35, 'rgba(0,0,0,.5)', h * 0.06)
    font(c, h * 0.1, FONTS[4][0], { weight: 700 }); c.fillStyle = b.c1; c.fillText([b.sub, ...handles(b)].filter(Boolean).join('   ·   '), x + w * 0.13, by + bh * 0.84, w * 0.55)
  },
  split(c, x, y, w, h, b, t, img) { // accent block left, handles stacked right
    const by = y + h * 0.2, bh = h * 0.8
    c.fillStyle = '#0d0d12'; c.beginPath(); c.roundRect(x, by, w, bh, h * 0.1); c.fill()
    c.save(); c.beginPath(); c.roundRect(x, by, w, bh, h * 0.1); c.clip()
    c.fillStyle = grad(c, x, by, x + w * 0.3, by + bh, b.c1, b.c2); c.beginPath(); c.moveTo(x, by); c.lineTo(x + w * 0.3, by); c.lineTo(x + w * 0.24, by + bh); c.lineTo(x, by + bh); c.fill()
    animate(c, x, by, w, bh, b, t); c.restore()
    picture(c, img, x, y, w * 0.26, h)
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#fff'
    fit(c, b.title, h * 0.3, b.font, w * 0.42, { italic: b.italic }); glowText(c, b.title, x + w * 0.33, by + bh * 0.38, b.c1, h * 0.1 * (b.glow ?? 0.7))
    font(c, h * 0.095, FONTS[4][0], { weight: 600 }); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillText(b.sub || '', x + w * 0.33, by + bh * 0.72, w * 0.42)
    c.textAlign = 'right'; c.fillStyle = '#fff'; handles(b).forEach((s, i, a) => c.fillText(s, x + w * 0.97, by + bh * ((i + 1) / (a.length + 1)), w * 0.2))
  },
  glass(c, x, y, w, h, b, t, img) { // rounded glass pill with a moving gradient border
    const by = y + h * 0.28, bh = h * 0.62, r = bh / 2, m = w * 0.02
    c.fillStyle = 'rgba(12,12,18,.78)'; c.beginPath(); c.roundRect(x + m, by, w - m * 2, bh, r); c.fill()
    const o = (t * 0.25) % 1; c.lineWidth = h * 0.028; c.strokeStyle = grad(c, x + w * (o - 1), 0, x + w * (o + 1), 0, b.c1, b.c2, b.c1, b.c2, b.c1)
    c.save(); c.shadowColor = b.c1; c.shadowBlur = h * 0.2 * (b.glow ?? 0.7); c.beginPath(); c.roundRect(x + m, by, w - m * 2, bh, r); c.stroke(); c.restore()
    c.save(); c.beginPath(); c.roundRect(x + m, by, w - m * 2, bh, r); c.clip(); animate(c, x, by, w, bh, b, t); c.restore()
    picture(c, img, x + w * 0.03, y, w * 0.18, h * 0.92)
    c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#fff'
    fit(c, b.title, h * 0.3, b.font, w * 0.5, { italic: b.italic }); c.fillText(b.title, x + w / 2, by + bh * 0.4)
    font(c, h * 0.085, FONTS[4][0], { weight: 600 }); c.fillStyle = rgba(b.c1, 1); c.fillText([b.sub, ...handles(b)].filter(Boolean).join('   ·   '), x + w / 2, by + bh * 0.76, w * 0.7)
  },
  cyber(c, x, y, w, h, b, t, img) { // cut corners, scanlines, glitching name
    const by = y + h * 0.25, bh = h * 0.75, k = h * 0.22
    c.beginPath(); c.moveTo(x + k, by); c.lineTo(x + w, by); c.lineTo(x + w, by + bh - k); c.lineTo(x + w - k, by + bh); c.lineTo(x, by + bh); c.lineTo(x, by + k); c.closePath()
    c.save(); c.fillStyle = '#07070c'; c.fill(); c.clip()
    c.fillStyle = grad(c, x, 0, x + w, 0, rgba(b.c1, 0.35), 'rgba(0,0,0,0)', rgba(b.c2, 0.45)); c.fillRect(x, by, w, bh)
    c.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < bh; i += 4) c.fillRect(x, by + ((i + t * 20) % bh), w, 1)
    animate(c, x, by, w, bh, b, t); c.restore()
    c.lineWidth = h * 0.02; c.strokeStyle = b.c1; c.save(); c.shadowColor = b.c1; c.shadowBlur = h * 0.15 * (b.glow ?? 0.7); c.stroke(); c.restore()
    picture(c, img, x + w * 0.74, y, w * 0.24, h)
    c.textBaseline = 'middle'; c.textAlign = 'left'
    fit(c, b.title, h * 0.36, b.font, w * 0.62, { italic: b.italic })
    const gl = Math.sin(t * 9) > 0.86 ? h * 0.03 : 0
    c.fillStyle = rgba(b.c2, 0.9); c.fillText(b.title, x + w * 0.05 - gl - h * 0.012, by + bh * 0.42); c.fillStyle = rgba(b.c1, 0.9); c.fillText(b.title, x + w * 0.05 + gl + h * 0.012, by + bh * 0.42)
    c.fillStyle = '#fff'; c.fillText(b.title, x + w * 0.05, by + bh * 0.42)
    font(c, h * 0.09, FONTS[11][0], { weight: 600 }); c.fillStyle = b.c1; c.fillText('> ' + [b.sub, ...handles(b)].filter(Boolean).join('  //  '), x + w * 0.05, by + bh * 0.8, w * 0.65)
  },
  minimal(c, x, y, w, h, b, t, img) { // thin glowing line, clean type
    const ly = y + h * 0.62
    c.save(); c.shadowColor = b.c1; c.shadowBlur = h * 0.25 * (b.glow ?? 0.7); c.fillStyle = grad(c, x, 0, x + w, 0, rgba(b.c1, 0), b.c1, b.c2, rgba(b.c2, 0)); c.fillRect(x, ly, w, h * 0.018); c.restore()
    const p = (t * 0.3) % 1; c.fillStyle = '#fff'; c.beginPath(); c.arc(x + w * p, ly + h * 0.009, h * 0.03, 0, 7); c.fill()
    picture(c, img, x + w * 0.02, y, w * 0.16, h * 0.62)
    c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#fff'
    fit(c, b.title, h * 0.4, b.font, w * 0.7, { italic: b.italic }); glowText(c, b.title, x + w / 2, y + h * 0.34, 'rgba(0,0,0,.7)', h * 0.1)
    font(c, h * 0.1, FONTS[4][0], { weight: 600 }); c.fillStyle = 'rgba(255,255,255,.85)'; glowText(c, [b.sub, ...handles(b)].filter(Boolean).join('     '), x + w / 2, y + h * 0.84, 'rgba(0,0,0,.8)', h * 0.08)
  },
  esports(c, x, y, w, h, b, t, img) { // two bars with moving chevrons
    const by = y + h * 0.3, bh = h * 0.46
    c.fillStyle = '#101016'; c.fillRect(x, by, w, bh); c.fillStyle = grad(c, x, 0, x + w, 0, b.c1, b.c2); c.fillRect(x, by + bh, w, h * 0.24)
    c.save(); c.beginPath(); c.rect(x, by, w, bh); c.clip(); c.strokeStyle = rgba(b.c1, 0.5); c.lineWidth = h * 0.03
    for (let i = -2; i < 16; i++) { const cx = x + ((i * w * 0.07 + t * w * 0.05) % (w * 1.1)); c.beginPath(); c.moveTo(cx, by); c.lineTo(cx + bh * 0.4, by + bh / 2); c.lineTo(cx, by + bh); c.stroke() }
    c.fillStyle = grad(c, x, 0, x + w, 0, '#101016', 'rgba(16,16,22,.2)', '#101016'); c.fillRect(x, by, w, bh); c.restore()
    c.save(); c.beginPath(); c.rect(x, by, w, h * 0.7); c.clip(); animate(c, x, by, w, h * 0.7, { ...b, c1: '#ffffff', glow: (b.glow ?? 0.7) * 0.6 }, t); c.restore()
    picture(c, img, x + w * 0.02, y, w * 0.2, h)
    c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#fff'
    fit(c, b.title, h * 0.32, b.font, w * 0.6, { italic: b.italic }); glowText(c, b.title, x + w / 2, by + bh * 0.52, b.c1, h * 0.12 * (b.glow ?? 0.7))
    font(c, h * 0.1, FONTS[4][0], { weight: 800 }); c.fillStyle = '#0b0b0f'; c.fillText([b.sub, ...handles(b)].filter(Boolean).join('   ◆   '), x + w / 2, by + bh + h * 0.125, w * 0.9)
  },
  blaze(c, x, y, w, h, b, t, img) { // flame-like waves rising behind the name
    const by = y + h * 0.3, bh = h * 0.7
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip()
    c.fillStyle = grad(c, 0, by, 0, y + h, 'rgba(0,0,0,0)', 'rgba(5,5,8,.92)'); c.fillRect(x, y, w, h)
    for (let l = 0; l < 3; l++) { c.fillStyle = rgba(l ? b.c1 : b.c2, 0.3 + l * 0.12); c.beginPath(); c.moveTo(x, y + h); for (let i = 0; i <= 60; i++) c.lineTo(x + w * i / 60, y + h - bh * (0.25 + l * 0.08) * (0.6 + 0.4 * Math.sin(i * (0.4 + l * 0.2) + t * (2 + l)) * Math.sin(i * 0.13 - t))); c.lineTo(x + w, y + h); c.fill() }
    animate(c, x, by, w, bh, { ...b, anim: b.anim === 'wave' ? 'particles' : b.anim }, t); c.restore()
    picture(c, img, x + w * 0.76, y, w * 0.22, h)
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#fff'
    fit(c, b.title, h * 0.38, b.font, w * 0.68, { italic: b.italic }); glowText(c, b.title, x + w * 0.04, by + bh * 0.4, b.c1, h * 0.2 * (b.glow ?? 0.7))
    font(c, h * 0.095, FONTS[4][0], { weight: 700 }); c.fillText([b.sub, ...handles(b)].filter(Boolean).join('   ·   '), x + w * 0.045, by + bh * 0.8, w * 0.68)
  }
}
export const TPL_NAMES = { neon: 'Neon bar', slant: 'Slant', split: 'Split card', glass: 'Glass pill', cyber: 'Cyber', minimal: 'Minimal line', esports: 'Esports', blaze: 'Blaze' }
export function drawBanner(c, x, y, w, h, b, t, img) { c.save(); (TPL[b.tpl] || TPL.neon)(c, x, y, w, h, b, t, img); c.restore() }
const B0 = { title: 'YOUR NAME', sub: 'BGMI LIVE', tag: 'UPI', upi: 'yourname@upi', h1: 'IG @yourname', h2: 'YT /yourname', h3: '', italic: true, glow: 0.7 }
export const BANNERS = Object.keys(TPL).flatMap((tpl, i) => [0, 1, 2, 3, 4, 5, 6].map(j => { const p = PALETTES[(i + j * 3) % PALETTES.length]
  return { name: `${TPL_NAMES[tpl]} · ${p[0]}`, b: { ...B0, tpl, c1: p[1], c2: p[2], font: FONTS[(i * 2 + j) % 7][0], anim: ANIMS[(i + j) % 4][0], upi: tpl === 'neon' ? B0.upi : '' } } }))

// ---------- animated backgrounds ----------
const BG = {
  grid(c, x, y, w, h, o, t) { c.strokeStyle = rgba(o.c1, 0.5); c.lineWidth = 1.5; const hz = y + h * 0.55; for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(x + w / 2 + i * w * 0.02, hz); c.lineTo(x + w / 2 + i * w * 0.14, y + h); c.stroke() } for (let i = 0; i < 12; i++) { const p = ((i + t * 0.6) % 12) / 12, yy = hz + (h * 0.45) * p * p; c.globalAlpha = p; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke() } c.globalAlpha = 1; c.fillStyle = grad(c, 0, y, 0, hz, 'rgba(0,0,0,0)', rgba(o.c1, 0.35)); c.fillRect(x, y, w, hz - y) },
  rays(c, x, y, w, h, o, t) { c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(t * 0.08); for (let i = 0; i < 18; i++) { c.rotate(Math.PI / 9); c.fillStyle = rgba(i % 2 ? o.c1 : '#ffffff', 0.09); c.beginPath(); c.moveTo(0, 0); c.lineTo(w, -w * 0.09); c.lineTo(w, w * 0.09); c.fill() } c.restore() },
  orbs(c, x, y, w, h, o, t) { for (let i = 0; i < 22; i++) { const r = h * (0.03 + rnd(i) * 0.12), px = x + w * ((rnd(i + 1) + t * 0.02 * (rnd(i + 2) - 0.5)) % 1), py = y + h * ((rnd(i + 3) + 1 - t * 0.03 * (0.3 + rnd(i + 4))) % 1); const g = c.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(i % 2 ? o.c1 : '#ffffff', 0.35)); g.addColorStop(1, rgba(o.c1, 0)); c.fillStyle = g; c.fillRect(px - r, py - r, r * 2, r * 2) } },
  waves(c, x, y, w, h, o, t) { for (let l = 0; l < 4; l++) { c.fillStyle = rgba(l % 2 ? '#ffffff' : o.c1, 0.1 + l * 0.05); c.beginPath(); c.moveTo(x, y + h); for (let i = 0; i <= 60; i++) c.lineTo(x + w * i / 60, y + h * (0.55 + l * 0.1 + 0.06 * Math.sin(i * 0.25 + t * (0.8 + l * 0.3) + l))); c.lineTo(x + w, y + h); c.fill() } },
  stripes(c, x, y, w, h, o, t) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = rgba('#ffffff', 0.07); const s = h * 0.16, off = (t * 40) % (s * 2); for (let i = -4; i < w / s + 4; i += 2) { c.beginPath(); c.moveTo(x + i * s + off, y + h); c.lineTo(x + (i + 1) * s + off, y + h); c.lineTo(x + (i + 1) * s + off + h * 0.6, y); c.lineTo(x + i * s + off + h * 0.6, y); c.fill() } c.restore() },
  aurora(c, x, y, w, h, o, t) { for (let i = 0; i < 4; i++) { const px = x + w * (0.5 + 0.4 * Math.sin(t * 0.3 + i * 1.7)), py = y + h * (0.5 + 0.35 * Math.cos(t * 0.24 + i * 2.3)), r = h * 0.7; const g = c.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(i % 2 ? o.c1 : '#ffffff', i % 2 ? 0.5 : 0.18)); g.addColorStop(1, rgba(o.c1, 0)); c.fillStyle = g; c.fillRect(x, y, w, h) } },
  stars(c, x, y, w, h, o, t) { for (let i = 0; i < 90; i++) { const z = ((rnd(i) + t * 0.12) % 1), a = rnd(i + 7) * 6.28, d = z * z * w * 0.7; c.fillStyle = rgba(i % 4 ? '#ffffff' : o.c1, z); c.beginPath(); c.arc(x + w / 2 + Math.cos(a) * d, y + h / 2 + Math.sin(a) * d * 0.6, 0.6 + z * h * 0.006, 0, 7); c.fill() } },
  bars(c, x, y, w, h, o, t) { for (let i = 0; i < 14; i++) { const bh = h * (0.02 + rnd(i) * 0.06), by = y + ((rnd(i + 2) * h + t * 30 * (rnd(i + 5) - 0.5)) % h + h) % h, bw = w * (0.2 + rnd(i + 3) * 0.6), bx = x + ((rnd(i + 4) * w + t * 60 * (i % 2 ? 1 : -1)) % (w + bw) + w + bw) % (w + bw) - bw; c.fillStyle = rgba(i % 3 ? o.c1 : '#ffffff', 0.12); c.fillRect(bx, by, bw, bh) } },
  dots(c, x, y, w, h, o, t) { const s = h * 0.06; for (let j = 0; j < h / s; j++) for (let i = 0; i < w / s; i++) { const k = 0.5 + 0.5 * Math.sin(i * 0.35 + j * 0.35 - t * 1.6); c.fillStyle = rgba('#ffffff', 0.05 + k * 0.12); c.beginPath(); c.arc(x + i * s + s / 2, y + j * s + s / 2, s * 0.08 + s * 0.24 * k, 0, 7); c.fill() } },
  tunnel(c, x, y, w, h, o, t) { c.lineWidth = 2; for (let i = 0; i < 10; i++) { const p = ((i + t * 0.5) % 10) / 10, s = p * p; c.strokeStyle = rgba(i % 2 ? o.c1 : '#ffffff', 0.5 * (1 - p) + 0.1); c.strokeRect(x + w / 2 - w * s * 0.6, y + h / 2 - h * s * 0.6, w * s * 1.2, h * s * 1.2) } }
}
export const BG_NAMES = { grid: 'Neon grid', rays: 'Sun rays', orbs: 'Floating orbs', waves: 'Waves', stripes: 'Moving stripes', aurora: 'Aurora', stars: 'Warp stars', bars: 'Glitch bars', dots: 'Halftone', tunnel: 'Tunnel' }
export function drawBg(c, x, y, w, h, o, t) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip()
  c.fillStyle = grad(c, x, y, x + w, y + h, o.c2, '#08080c', rgba(o.c1, 0.55)); c.fillRect(x, y, w, h); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, y, w, h)
  ;(BG[o.style] || BG.orbs)(c, x, y, w, h, o, t)
  const v = c.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = v; c.fillRect(x, y, w, h)
  c.restore()
}

// ---------- animated text ----------
export const TX_NAMES = { stack: 'Outline stack', glow: 'Neon glow', glitch: 'Glitch', float: 'Floating letters', wave: 'Wave', type: 'Typewriter', slide: 'Slide in', outline: 'Outline pulse' }
export function drawText(c, x, y, w, h, o, t) {
  const s = o.style || 'glow', text = (o.text || '').replace('{time}', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), cx = x + w / 2, cy = y + h / 2
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'
  const px = h * (s === 'stack' ? 0.34 : 0.62); fit(c, text, px, o.font, w * 0.96, { italic: o.italic })
  const size = parseFloat(c.font.match(/([\d.]+)px/)[1]), col = o.color || '#ffffff'
  const letters = fn => { const tw = c.measureText(text).width; let lx = cx - tw / 2; c.textAlign = 'left'; [...text].forEach((ch, i) => { const cw = c.measureText(ch).width; fn(ch, lx, i); lx += cw }) }
  if (s === 'stack') { c.lineWidth = size * 0.035; c.strokeStyle = rgba(col, 0.9); const d = size * 0.86, o2 = Math.sin(t * 1.2) * size * 0.05; c.strokeText(text, cx - o2, cy - d); c.strokeText(text, cx + o2, cy + d); c.fillStyle = col; glowText(c, text, cx, cy, o.c1, size * 0.25) }
  else if (s === 'glow') { const p = 0.6 + 0.4 * Math.sin(t * 2.4); c.fillStyle = col; glowText(c, text, cx, cy, o.c1, size * 0.5 * p); glowText(c, text, cx, cy, o.c1, size * 0.15) }
  else if (s === 'glitch') { const g = Math.sin(t * 11) > 0.8 ? size * 0.06 : size * 0.012; c.fillStyle = rgba(o.c1, 0.9); c.fillText(text, cx - g, cy); c.fillStyle = 'rgba(0,255,255,.8)'; c.fillText(text, cx + g, cy + g * 0.3); c.fillStyle = col; c.fillText(text, cx, cy); if (g > size * 0.03) { c.fillStyle = col; c.fillRect(x + w * 0.1, cy + size * (rnd(Math.floor(t * 11)) - 0.5) * 0.6, w * 0.8, size * 0.03) } }
  else if (s === 'float') { c.fillStyle = col; c.shadowColor = o.c1; c.shadowBlur = size * 0.25; letters((ch, lx, i) => c.fillText(ch, lx, cy + Math.sin(t * 2 + i * 0.7) * size * 0.14)) }
  else if (s === 'wave') { letters((ch, lx, i) => { const k = 0.5 + 0.5 * Math.sin(t * 3 - i * 0.5); c.fillStyle = k > 0.5 ? col : o.c1; c.save(); c.translate(lx, cy); c.scale(1, 0.85 + k * 0.3); c.fillText(ch, 0, 0); c.restore() }) }
  else if (s === 'type') { const n = Math.floor((t * 6) % (text.length + 14)); c.fillStyle = col; const sh = text.slice(0, Math.min(text.length, n)); glowText(c, sh + (Math.floor(t * 2) % 2 ? '▌' : ' '), cx, cy, o.c1, size * 0.2) }
  else if (s === 'slide') { const p = Math.min(1, (t % 6) / 0.7), e = 1 - (1 - p) ** 3; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.globalAlpha = e; c.fillStyle = col; glowText(c, text, cx + (1 - e) * w * 0.3, cy, o.c1, size * 0.2); c.restore(); c.fillStyle = o.c1; c.fillRect(cx - w * 0.2 * e, cy + size * 0.62, w * 0.4 * e, size * 0.06) }
  else { c.lineWidth = size * 0.04; c.strokeStyle = col; c.shadowColor = o.c1; c.shadowBlur = size * (0.2 + 0.2 * Math.sin(t * 3)); c.strokeText(text, cx, cy); c.fillStyle = rgba(o.c1, 0.25 + 0.2 * Math.sin(t * 3)); c.fillText(text, cx, cy) }
  c.restore()
}

// ---------- stream scenes (Starting soon / Ending / Be right back) ----------
const BGS = Object.keys(BG), TXS = Object.keys(TX_NAMES)
export const SCENE_KINDS = { start: ['Starting soon', 'STARTING SOON', 'Stream begins in a moment'], end: ['Ending', 'STREAM ENDING', 'Thanks for watching · until next time'], brb: ['Be right back', 'BE RIGHT BACK', 'Grab a snack, back in a minute'] }
export const SCENES = Object.entries(SCENE_KINDS).flatMap(([kind, [label, title, sub]], k) => Array.from({ length: 20 }, (_, i) => { const p = PALETTES[(i * 3 + k + (i > 9 ? 5 : 0)) % PALETTES.length], bg = BGS[(i + k * 3) % BGS.length], tx = TXS[(i + k) % TXS.length]
  return { kind, name: `${label} ${i + 1} · ${BG_NAMES[bg]} · ${p[0]}`, bg: { style: bg, c1: p[1], c2: p[2] }, title: { text: title, style: tx, font: FONTS[(i + k * 2) % 9][0], italic: i % 2 === 0, c1: p[1], color: '#ffffff' },
    sub: { text: sub, style: 'float', font: FONTS[4][0], c1: p[1], color: '#ffffff' }, clock: kind === 'start' } }))
export function drawScenePreview(c, w, h, s, t) { drawBg(c, 0, 0, w, h, s.bg, t); drawText(c, w * 0.1, h * 0.26, w * 0.8, h * (s.title.style === 'stack' ? 0.5 : 0.3), s.title, t); drawText(c, w * 0.2, h * 0.68, w * 0.6, h * 0.09, s.sub, t); if (s.clock) drawText(c, w * 0.4, h * 0.82, w * 0.2, h * 0.09, { text: '{time}', style: 'glow', font: FONTS[11][0], c1: s.bg.c1 }, t) }

// ---------- alert effects ----------
export const AFX_NAMES = { pop: 'Pop card', slide: 'Slide banner', neon: 'Neon frame', confetti: 'Confetti', coins: 'Coin rain', hearts: 'Hearts', ribbon: 'Ribbon', glitch: 'Glitch', burst: 'Star burst', ticket: 'Ticket' }
export function drawAlertFx(c, x, y, w, h, f, a, t) { // t = seconds since the alert appeared
  const s = f.style || 'pop', inn = Math.min(1, t / 0.45), e = 1 - (1 - inn) ** 3, bounce = 1 + 0.12 * Math.sin(Math.min(1, t / 0.6) * Math.PI), cx = x + w / 2, cy = y + h / 2
  c.save()
  const texts = (col = '#fff', ax = cx, align = 'center') => { c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; fit(c, a.title, h * 0.3, f.font, w * 0.86, { italic: f.italic }); glowText(c, a.title, ax, y + h * (a.sub ? 0.38 : 0.5), 'rgba(0,0,0,.45)', h * 0.06); if (a.sub) { font(c, h * 0.17, FONTS[4][0], { weight: 600 }); c.fillText(a.sub, ax, y + h * 0.73, w * 0.86) } }
  const bits = (draw, n = 26) => { for (let i = 0; i < n; i++) { const p = (t * (0.35 + rnd(i) * 0.5) + rnd(i + 2)) % 1; draw(x + rnd(i + 4) * w, y - h * 0.4 + p * h * 1.9, i, p) } }
  if (s === 'pop' || s === 'confetti' || s === 'coins' || s === 'hearts' || s === 'burst') {
    if (s === 'burst') { c.save(); c.translate(cx, cy); c.rotate(t * 0.6); for (let i = 0; i < 14; i++) { c.rotate(Math.PI / 7); c.fillStyle = rgba(f.c1, 0.35 * e); c.beginPath(); c.moveTo(0, 0); c.lineTo(w * 0.6 * e, -h * 0.12); c.lineTo(w * 0.6 * e, h * 0.12); c.fill() } c.restore() }
    c.translate(cx, cy); c.scale(e * bounce, e * bounce); c.translate(-cx, -cy)
    c.shadowColor = f.c1; c.shadowBlur = h * 0.3; c.fillStyle = grad(c, x, y, x + w, y + h, f.c1, f.c2); c.beginPath(); c.roundRect(x + w * 0.04, y + h * 0.08, w * 0.92, h * 0.84, h * 0.2); c.fill(); c.shadowBlur = 0
    texts()
    c.setTransform(c.getTransform()) // particles on top, unscaled look is fine
    if (s === 'confetti') bits((px, py, i) => { c.fillStyle = ['#fff', f.c1, '#ffd24a', '#22d3ee'][i % 4]; c.save(); c.translate(px, py); c.rotate(t * 4 + i); c.fillRect(-h * 0.03, -h * 0.015, h * 0.06, h * 0.03); c.restore() }, 34)
    if (s === 'coins') bits((px, py, i) => { c.fillStyle = '#ffd24a'; c.beginPath(); c.ellipse(px, py, h * 0.05 * Math.abs(Math.cos(t * 5 + i)) + 1, h * 0.05, 0, 0, 7); c.fill(); c.strokeStyle = '#b45309'; c.lineWidth = 1; c.stroke() })
    if (s === 'hearts') bits((px, py, i, p) => { const r = h * 0.05, hy = y + h * 1.3 - p * h * 1.9; c.fillStyle = rgba(i % 2 ? '#ff4d6d' : '#ffffff', 1 - p); c.beginPath(); c.moveTo(px, hy + r); c.bezierCurveTo(px - r * 2, hy - r * 0.5, px - r * 0.6, hy - r * 1.6, px, hy - r * 0.4); c.bezierCurveTo(px + r * 0.6, hy - r * 1.6, px + r * 2, hy - r * 0.5, px, hy + r); c.fill() })
  } else if (s === 'slide' || s === 'ribbon') {
    c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(-(1 - e) * w, 0)
    if (s === 'ribbon') { c.fillStyle = f.c2; c.beginPath(); c.moveTo(x, y + h * 0.2); c.lineTo(x + w, y + h * 0.2); c.lineTo(x + w - h * 0.25, y + h / 2); c.lineTo(x + w, y + h * 0.8); c.lineTo(x, y + h * 0.8); c.fill(); c.fillStyle = f.c1; c.fillRect(x, y + h * 0.12, w * 0.9, h * 0.6); texts('#fff', x + w * 0.45) }
    else { c.fillStyle = '#0d0d12'; c.fillRect(x, y + h * 0.1, w, h * 0.8); c.fillStyle = grad(c, x, 0, x + w * 0.3, 0, f.c1, f.c2); c.fillRect(x, y + h * 0.1, w * 0.035, h * 0.8); const p = (t * 0.6) % 1.4; c.fillStyle = grad(c, x + w * (p - 0.2), 0, x + w * p, 0, 'rgba(255,255,255,0)', rgba(f.c1, 0.35), 'rgba(255,255,255,0)'); c.fillRect(x, y + h * 0.1, w, h * 0.8); texts('#fff', x + w * 0.08, 'left') }
  } else if (s === 'neon') {
    c.globalAlpha = e * (Math.sin(t * 30) > -0.9 || t > 0.6 ? 1 : 0.3); c.fillStyle = 'rgba(8,8,14,.85)'; c.beginPath(); c.roundRect(x + w * 0.03, y + h * 0.1, w * 0.94, h * 0.8, h * 0.12); c.fill()
    c.lineWidth = h * 0.04; c.strokeStyle = f.c1; c.shadowColor = f.c1; c.shadowBlur = h * (0.3 + 0.15 * Math.sin(t * 4)); c.stroke(); c.shadowBlur = 0; texts(f.c1 === '#ffffff' ? '#fff' : '#fff')
  } else if (s === 'glitch') {
    const g = t < 0.5 || Math.sin(t * 9) > 0.85 ? h * 0.06 : 0; c.globalAlpha = e
    c.fillStyle = rgba(f.c1, 0.9); c.fillRect(x + w * 0.04 - g, y + h * 0.14, w * 0.92, h * 0.72); c.fillStyle = 'rgba(0,255,255,.7)'; c.fillRect(x + w * 0.04 + g, y + h * 0.18, w * 0.92, h * 0.72); c.fillStyle = '#0b0b10'; c.fillRect(x + w * 0.04, y + h * 0.16, w * 0.92, h * 0.72); texts()
  } else { // ticket
    c.translate(cx, cy); c.rotate((1 - e) * -0.3); c.scale(e, e); c.translate(-cx, -cy)
    c.fillStyle = grad(c, x, y, x + w, y, f.c1, f.c2); c.beginPath(); c.roundRect(x + w * 0.05, y + h * 0.1, w * 0.9, h * 0.8, h * 0.1); c.fill()
    c.globalCompositeOperation = 'destination-out'; for (const px of [x + w * 0.05, x + w * 0.95]) { c.beginPath(); c.arc(px, cy, h * 0.12, 0, 7); c.fill() } c.globalCompositeOperation = 'source-over'
    c.setLineDash([h * 0.05, h * 0.05]); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + w * 0.22, y + h * 0.16); c.lineTo(x + w * 0.22, y + h * 0.84); c.stroke(); c.setLineDash([]); texts('#fff', x + w * 0.58)
  }
  c.restore()
}
const AFX = Object.keys(AFX_NAMES)
export const ALERT_KINDS = { superchat: ['Super Chat', '{name} sent {amount}!', '{text}'], member: ['New member', 'Welcome {name}!', 'Just became a member'], subscribe: ['Subscribe reminder', 'SUBSCRIBE', 'Hit the bell so you never miss a stream'], chat: ['Chat message', '{name}', '{text}'], live: ['Stream started', 'WE ARE LIVE', 'Welcome to the stream'] }
export const ALERTS = Array.from({ length: 20 }, (_, i) => { const p = PALETTES[(i * 3 + 1 + (i > 9 ? 5 : 0)) % PALETTES.length], st = AFX[i % AFX.length]; return { name: `${AFX_NAMES[st]} · ${p[0]}`, f: { style: st, c1: p[1], c2: p[2], font: FONTS[(i * 2) % 7][0], italic: i % 3 === 0 } } })
