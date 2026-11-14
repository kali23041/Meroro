// Launch window: a black setup card with a segmented progress bar and one tile per real start-up step.
// main/index.js calls `step(i, state, detail)`; the bar eases towards the share of finished work.
import { BrowserWindow } from 'electron'
import { BRAND, LOGO_SVG } from '../shared/brand'

export const STEPS = [['Tools', 'adb · ffmpeg'], ['ADB', 'phone bridge'], ['Phones', 'looking…'], ['Studio', 'loading UI']]
const ICONS = [
  '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  '<path d="M12 2v6M8 5h8M6 8h12v5a6 6 0 0 1-12 0zM12 19v3"/>',
  '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/>'
]

export function splashWindow(version) {
  const tiles = STEPS.map(([t, d], i) => `<div class="tile" id="t${i}"><div class="ic"><svg viewBox="0 0 24 24">${ICONS[i]}</svg></div>
    <b>${t}</b><span id="d${i}">${d}</span><i class="st"></i></div>`).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden;font-family:-apple-system,"Segoe UI",system-ui,sans-serif;-webkit-user-select:none;cursor:default;color:#fff}
  .card{position:absolute;inset:14px;border-radius:30px;background:#000;border:1px solid #ffffff14;box-shadow:0 24px 60px #000c;padding:22px 24px;box-sizing:border-box;
    display:flex;flex-direction:column;animation:pop .5s cubic-bezier(.2,1.3,.4,1) both}
  .head{display:flex;align-items:center;gap:12px}
  .logo{width:30px;height:30px}
  h1{flex:1;margin:0;font-size:21px;font-weight:500;letter-spacing:-.01em}h1 em{font-style:normal;color:#6b6b70}
  .v{font-size:11px;color:#55555a}
  .pct{margin:18px 0 9px;font-size:15px}.pct b{font-size:19px;font-weight:500;font-variant-numeric:tabular-nums}.pct span{color:#d4d4d8;font-size:13px}
  .bar{position:relative;height:30px;border-radius:9px;background:#3a3a3d;overflow:hidden}
  .fill{position:absolute;inset:0 auto 0 0;width:0;border-radius:9px;background:linear-gradient(90deg,#8ef59a,#4ade55);box-shadow:0 0 18px #4ade5555}
  .fill:after{content:"";position:absolute;right:7px;top:9px;bottom:9px;width:2px;border-radius:2px;background:#ffffffcc}
  .fill:before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,#ffffff40 50%,transparent 70%);background-size:220% 100%;animation:sh 1.6s linear infinite}
  .seg{position:absolute;top:8px;bottom:8px;width:1px;background:#ffffff26}
  .tiles{margin-top:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .tile{position:relative;border-radius:16px;background:#161618;padding:10px 10px 9px;display:flex;flex-direction:column;gap:1px;transition:background .3s}
  .tile .ic{width:26px;height:26px;border-radius:8px;background:#ffffff0f;display:grid;place-items:center;margin-bottom:6px;color:#8e8e93;transition:.3s}
  .tile svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .tile b{font-size:12px;font-weight:600}.tile span{font-size:10.5px;color:#7a7a80;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .st{position:absolute;top:11px;right:10px;width:7px;height:7px;border-radius:50%;background:#3a3a3d}
  .run .st{background:#facc15;box-shadow:0 0 8px #facc15;animation:bl .8s ease-in-out infinite}.run .ic{color:#fff}
  .ok .st{background:#4ade55;box-shadow:0 0 8px #4ade55}.ok .ic{background:#4ade5522;color:#7cf08a}
  .warn .st{background:#fb923c}.warn .ic{color:#fdba74}
  .by{margin-top:auto;display:flex;justify-content:space-between;font-size:10.5px;color:#55555a}.by b{color:#a1a1aa;font-weight:600}
  @keyframes pop{from{transform:scale(.94);opacity:0}}@keyframes sh{from{background-position:120% 0}to{background-position:-100% 0}}@keyframes bl{50%{opacity:.35}}
  </style><div class="card">
  <div class="head"><div class="logo">${LOGO_SVG}</div><h1>${BRAND.name} <em id="msg">Starting up</em></h1><span class="v">v${version}</span></div>
  <div class="pct"><b id="p">0%</b> <span>complete</span></div>
  <div class="bar"><div class="fill" id="f"></div><i class="seg" style="left:25%"></i><i class="seg" style="left:50%"></i><i class="seg" style="left:75%"></i></div>
  <div class="tiles">${tiles}</div>
  <div class="by"><span>Created by <b>${BRAND.author}</b></span><span id="note"></span></div></div>
  <script>
  const st = ${JSON.stringify(STEPS.map(() => 0))}; let shown = 0, target = 0
  window.step = (i, s, d) => { const t = document.getElementById('t' + i); t.className = 'tile ' + s; if (d) document.getElementById('d' + i).textContent = d
    st[i] = s === 'run' ? .5 : s === 'ok' || s === 'warn' ? 1 : 0; target = st.reduce((a, b) => a + b, 0) / st.length * 100
    const r = st.findIndex(x => x < 1); document.getElementById('msg').textContent = r < 0 ? 'Ready' : 'Setting up ' + ${JSON.stringify(STEPS.map(s => s[0]))}[r].toLowerCase() }
  ;(function tick() { shown += (target - shown) * .12 + (shown < target ? .15 : 0); if (shown > target) shown = target
    document.getElementById('f').style.width = shown + '%'; document.getElementById('p').textContent = Math.round(shown) + '%'; requestAnimationFrame(tick) })()
  </script>`
  const w = new BrowserWindow({ width: 500, height: 300, frame: false, transparent: true, resizable: false, movable: false, alwaysOnTop: true, skipTaskbar: true, show: false, center: true, hasShadow: false })
  w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  w.once('ready-to-show', () => w.show())
  const queue = []
  let ready = false
  w.webContents.once('did-finish-load', () => { ready = true; queue.splice(0).forEach(run) })
  const run = js => !w.isDestroyed() && w.webContents.executeJavaScript(js).catch(() => {})
  w.step = (i, s, d) => { const js = `step(${i},${JSON.stringify(s)},${JSON.stringify(d || '')})`; ready ? run(js) : queue.push(js) }
  return w
}
