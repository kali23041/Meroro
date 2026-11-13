import { BrowserWindow } from 'electron'
import { BRAND, LOGO_SVG } from '../shared/brand'

export function splashWindow(version) {
  const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden;font-family:-apple-system,"Segoe UI",system-ui,sans-serif;-webkit-user-select:none;cursor:default}
  .card{position:absolute;inset:10px;border-radius:22px;background:radial-gradient(120% 90% at 50% 0%,#2a1748 0%,#0c0a12 62%);border:1px solid #ffffff1a;
    box-shadow:0 20px 50px #0009;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;overflow:hidden}
  .glow{position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(${BRAND.from}55,transparent 65%);top:-60px;filter:blur(10px);animation:g 3s ease-in-out infinite}
  .logo{width:92px;height:92px;filter:drop-shadow(0 10px 24px ${BRAND.to}66);animation:pop .7s cubic-bezier(.2,1.4,.4,1) both}
  h1{margin:18px 0 2px;font-size:30px;font-weight:800;letter-spacing:-.02em;animation:up .6s .15s both}
  p{margin:0;font-size:13px;color:#a1a1aa;animation:up .6s .25s both}
  .bar{margin-top:26px;width:180px;height:3px;border-radius:3px;background:#ffffff14;overflow:hidden}
  .bar i{display:block;height:100%;width:40%;border-radius:3px;background:linear-gradient(90deg,${BRAND.from},${BRAND.to});animation:load 1.1s ease-in-out infinite}
  .by{position:absolute;bottom:18px;font-size:11px;color:#71717a}.by b{color:#e4e4e7;font-weight:600}
  .v{position:absolute;top:16px;right:20px;font-size:10px;color:#52525b}
  @keyframes pop{from{transform:scale(.6);opacity:0}}@keyframes up{from{transform:translateY(8px);opacity:0}}
  @keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}@keyframes g{50%{transform:scale(1.15);opacity:.7}}
  </style><div class="card"><div class="glow"></div><span class="v">v${version}</span>
  <div class="logo">${LOGO_SVG}</div><h1>${BRAND.name}</h1><p>${BRAND.tagline}</p><div class="bar"><i></i></div>
  <div class="by">Created by <b>${BRAND.author}</b></div></div>`
  const w = new BrowserWindow({ width: 440, height: 320, frame: false, transparent: true, resizable: false, movable: false, alwaysOnTop: true, skipTaskbar: true, show: false, center: true, hasShadow: false })
  w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  w.once('ready-to-show', () => w.show())
  return w
}
