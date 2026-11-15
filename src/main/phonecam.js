// Phones as webcams, and QR-code pairing for wireless debugging.
// - Android camera: scrcpy-server in camera mode (Android 12+) over USB or Wi-Fi adb.
// - Any phone (iPhone or Android) over Wi-Fi: Meroro serves a small HTTPS page; the phone opens it from a QR code
//   and sends its camera with WebRTC straight to Meroro on the local network. No app to install, nothing leaves the network.
import { createServer } from 'node:https'
import { networkInterfaces, hostname } from 'node:os'
import { randomBytes, X509Certificate } from 'node:crypto'
import { createSecureContext } from 'node:tls'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import selfsigned from 'selfsigned'
import QRCode from 'qrcode'
import { adb, Session } from './phone'

const qr = text => QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: '#000000', light: '#ffffff' } })
const lanIps = () => Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal && !/^169\.254\./.test(i.address)).map(i => i.address)
const sleep = ms => new Promise(r => setTimeout(r, ms))

export function setupPhoneCams(send) {
  // ---------- Wireless debugging pairing with a QR code (Android 11+) ----------
  // The phone scans WIFI:T:ADB;S:<name>;P:<password>;; then advertises _adb-tls-pairing._tcp under <name>.
  let pairing = null
  const services = async () => (await adb(['mdns', 'services'], { timeout: 5000 }).catch(() => '')).split('\n').map(l => l.trim().split(/\s+/)).filter(p => p.length >= 3)
  ipcMain.handle('adb:qr', async () => {
    const name = 'meroro-' + randomBytes(3).toString('hex'), pass = randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8)
    pairing = { name, pass }
    return { name, img: await qr(`WIFI:T:ADB;S:${name};P:${pass};;`) }
  })
  ipcMain.handle('adb:qr:cancel', () => { pairing = null })
  ipcMain.handle('adb:qr:wait', async (_, name) => {
    const me = pairing
    if (!me || me.name !== name) throw new Error('Make a new QR code and try again.')
    const before = new Set((await services()).filter(p => /_adb-tls-connect/.test(p[1])).map(p => p[2]))
    for (let i = 0; i < 180 && pairing === me; i++) { // up to 3 minutes for the phone to scan
      const hit = (await services()).find(p => p[0] === name && /_adb-tls-pairing/.test(p[1]))
      if (hit) {
        const out = (await adb(['pair', hit[2], me.pass], { timeout: 20000 }).catch(e => e.message)).trim()
        if (!/Successfully paired/i.test(out)) throw new Error(/No route/.test(out) && process.platform === 'darwin' ? 'macOS is blocking Meroro from your local network. Turn Meroro on in System Settings → Privacy & Security → Local Network.' : out || 'Pairing failed. Try again.')
        pairing = null
        // after pairing the phone advertises its connect address; adb usually connects by itself, otherwise we do
        const ip = hit[2].split(':')[0]
        for (let j = 0; j < 15; j++) {
          const c = (await services()).find(p => /_adb-tls-connect/.test(p[1]) && p[2].startsWith(ip + ':')) || (await services()).find(p => /_adb-tls-connect/.test(p[1]) && !before.has(p[2]))
          if (c) { const r = await adb(['connect', c[2]], { timeout: 10000 }).catch(e => e.message); if (/connected to/.test(r)) return 'Paired and connected over Wi-Fi.' }
          await sleep(1000)
        }
        return 'Paired. If the phone does not appear, tap Connect next to it below.'
      }
      await sleep(1000)
    }
    if (pairing === me) { pairing = null; throw new Error('No phone scanned the code. Make a new one and try again.') }
    return ''
  })

  // ---------- Android camera through scrcpy ----------
  const cams = new Map()
  ipcMain.handle('acam:start', async (_, id, serial, o) => {
    cams.get(id)?.stop()
    const s = new Session(serial, { camera: o.facing || 'back', maxSize: o.maxSize || 1920, fps: o.fps || 30, bitrate: o.bitrate || 10, rot: o.rot || 0 }, (type, p) => {
      if (cams.get(id) !== s) return
      if (type === 'video') send('acam:video', id, p)
      else if (type === 'end') { cams.delete(id); send('acam:end', id, p) }
    })
    cams.set(id, s)
    try { await s.start() } catch (e) { s.stop(); throw e }
  })
  ipcMain.handle('acam:stop', (_, id) => { const s = cams.get(id); cams.delete(id); s?.stop() })
  app.on('before-quit', () => cams.forEach(s => s.stop()))

  // ---------- Any phone over Wi-Fi (browser + WebRTC) ----------
  const store = join(app.getPath('userData'), 'phonecam.json')
  let cfg = null, server = null, port = 0
  const pending = new Map() // phone id → resolve(answer)
  const conf = async () => {
    if (cfg) return cfg
    try { cfg = JSON.parse(readFileSync(store, 'utf8')) } catch {}
    if (!cfg?.cert) {
      const pem = await selfsigned.generate([{ name: 'commonName', value: 'Meroro camera' }], { days: 3650, keySize: 2048, algorithm: 'sha256' })
      cfg = { cert: pem.cert, key: pem.private, token: randomBytes(9).toString('base64url') }
      writeFileSync(store, JSON.stringify(cfg))
    }
    return cfg
  }
  // A real, trusted certificate for <ip-with-dashes>.local-ip.sh (a public wildcard DNS name that resolves to that LAN IP).
  // Phones only allow the camera on a trusted HTTPS page; iPhone Safari refuses it on a self-signed one.
  const lipStore = join(app.getPath('userData'), 'localip-cert.json')
  let lip = null
  const lipOk = c => { try { return new Date(new X509Certificate(c.cert).validTo) - Date.now() > 3 * 864e5 } catch { return false } }
  const lipLoad = async () => {
    let c = null
    try { c = JSON.parse(readFileSync(lipStore, 'utf8')) } catch {}
    if (!c || !lipOk(c) || Date.now() - (c.at || 0) > 7 * 864e5) {
      try {
        const get = f => fetch('https://local-ip.sh/' + f, { signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.text() : Promise.reject(new Error(r.status)))
        const [cert, key] = await Promise.all([get('server.pem'), get('server.key')])
        if (lipOk({ cert })) { c = { cert, key, at: Date.now() }; writeFileSync(lipStore, JSON.stringify(c)) }
      } catch {}
    }
    if (c && lipOk(c)) lip = { ...c, ctx: createSecureContext({ cert: c.cert, key: c.key }) }
  }
  const body = req => new Promise((res, rej) => { let b = ''; req.on('data', d => { b += d; if (b.length > 2e5) req.destroy() }); req.on('end', () => res(b)); req.on('error', rej) })
  const start = async () => {
    if (server) return
    const c = await conf()
    await lipLoad()
    server = createServer({ cert: c.cert, key: c.key, SNICallback: (n, cb) => cb(null, lip && /\.local-ip\.sh$/i.test(n) ? lip.ctx : undefined) }, async (req, res) => {
      const u = new URL(req.url, 'https://x'), ok = u.searchParams.get('t') === c.token
      res.setHeader('Cache-Control', 'no-store')
      if (!ok) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Scan the QR code in Meroro again.') }
      if (req.method === 'GET' && u.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE) }
      if (req.method === 'POST' && u.pathname === '/offer') {
        try {
          const m = JSON.parse(await body(req)), id = String(m.id || '').replace(/[^\w-]/g, '').slice(0, 40)
          if (!id || !m.sdp) throw new Error('bad offer')
          const answer = await new Promise((resolve, reject) => {
            pending.get(id)?.reject(new Error('replaced'))
            const t = setTimeout(() => { pending.delete(id); reject(new Error('Meroro did not answer. Is it open?')) }, 15000)
            pending.set(id, { resolve: a => { clearTimeout(t); pending.delete(id); resolve(a) }, reject })
            send('wcam:offer', { id, name: String(m.name || 'Phone').slice(0, 40), sdp: m.sdp })
          })
          res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ sdp: answer }))
        } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })) }
      }
      if (req.method === 'POST' && u.pathname === '/chunk') { // fallback when WebRTC can't get through: recorded chunks over this HTTPS connection
        const parts = []; req.on('data', d => parts.push(d))
        req.on('end', () => {
          const q = k => u.searchParams.get(k) || ''
          send('wcam:chunk', { id: q('id').replace(/[^\w-]/g, '').slice(0, 40), name: q('name').slice(0, 40) || 'Phone camera', sid: q('s'), n: +q('n'), mime: q('m').slice(0, 120), data: new Uint8Array(Buffer.concat(parts)) })
          res.writeHead(200); res.end('ok')
        })
        return
      }
      res.writeHead(404); res.end()
    })
    await new Promise((resolve, reject) => {
      server.once('error', e => e.code === 'EADDRINUSE' ? server.listen(0, '0.0.0.0', resolve) : reject(e))
      server.listen(47820, '0.0.0.0', resolve)
    })
    port = server.address().port
  }
  ipcMain.handle('wcam:info', async () => {
    await start()
    if (!lip) await lipLoad()
    const ips = lanIps(), c = await conf()
    const backups = ips.map(ip => `https://${ip}:${port}/?t=${c.token}`)
    const urls = lip ? ips.map(ip => `https://${ip.replace(/\./g, '-')}.local-ip.sh:${port}/?t=${c.token}`) : backups
    return { urls, backups, ips, trusted: !!lip, host: hostname() }
  })
  ipcMain.handle('wcam:qr', (_, url) => qr(url))
  ipcMain.on('wcam:answer', (_, id, sdp) => pending.get(id)?.resolve(sdp))
}

// The page the phone opens. Kept tiny and dependency-free so it loads instantly on any phone browser.
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#000"><title>Meroro camera</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;height:100%;background:#000;color:#fff;font:15px -apple-system,system-ui,sans-serif;overflow:hidden}
video{position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
.bar{position:fixed;left:50%;transform:translateX(-50%);display:flex;gap:8px;padding:6px;border-radius:999px;background:rgba(24,24,27,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12)}
.top{top:max(14px,env(safe-area-inset-top))}.bottom{bottom:max(18px,env(safe-area-inset-bottom))}
button,select{height:40px;border:0;border-radius:999px;padding:0 16px;background:rgba(255,255,255,.1);color:#fff;font:600 14px -apple-system,system-ui,sans-serif}
button.on{background:#fff;color:#000}.dot{width:8px;height:8px;border-radius:50%;background:#71717a;display:inline-block;margin-right:8px}
.live .dot{background:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.25)}#st{display:flex;align-items:center;padding:0 14px;font-weight:600;font-size:13px;white-space:nowrap}
#start{position:fixed;inset:0;display:grid;place-items:center;text-align:center;padding:24px;background:#09090b}#start h1{font-size:22px;margin:0 0 6px}#start p{color:#a1a1aa;margin:0 0 22px;line-height:1.5}
#go{height:52px;padding:0 28px;background:#fff;color:#000;font-size:16px}
</style></head><body>
<video id="v" playsinline autoplay muted></video>
<div class="bar top" id="tb"><span id="st"><i class="dot"></i>Connecting…</span></div>
<div class="bar bottom"><button id="flip">Flip camera</button><select id="q"><option value="720">720p</option><option value="1080" selected>1080p</option><option value="2160">4K</option></select><button id="mir">Mirror</button></div>
<div id="start"><div><h1>Meroro camera</h1><p>Use this phone as a webcam in Meroro.<br>Keep this page open while you stream.</p><button id="go">Start camera</button></div></div>
<script>
const $=id=>document.getElementById(id),v=$('v'),st=$('st'),tb=$('tb');let facing='user',pc,stream,lock,mir=false,tries=0,mode='rtc',rec,sid,timer
const id=localStorage.mcid||(localStorage.mcid='p'+Math.random().toString(36).slice(2,10))
const name=/iPhone/.test(navigator.userAgent)?'iPhone camera':/iPad/.test(navigator.userAgent)?'iPad camera':/Android/.test(navigator.userAgent)?'Android camera':'Phone camera'
const say=(t,live)=>{st.innerHTML='<i class="dot"></i>'+t;tb.className='bar top'+(live?' live':'')}
const size=()=>({720:[1280,720],1080:[1920,1080],2160:[3840,2160]})[$('q').value]
async function cam(){if(!navigator.mediaDevices?.getUserMedia)throw new Error('this browser blocks the camera on this link. Open the link from the QR code in Meroro again (Safari or Chrome)')
 const [w,h]=size();stream?.getTracks().forEach(t=>t.stop());stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:facing,width:{ideal:w},height:{ideal:h},frameRate:{ideal:30}}});v.srcObject=stream;v.style.transform=mir?'scaleX(-1)':''
 if(mode==='relay')return relay();const s=pc?.getSenders().find(s=>s.track?.kind==='video');if(s)await s.replaceTrack(stream.getVideoTracks()[0])}
async function connect(){if(mode==='relay')return;clearTimeout(timer);try{pc?.close();pc=new RTCPeerConnection();const snd=pc.addTrack(stream.getVideoTracks()[0],stream)
 pc.onconnectionstatechange=()=>{const c=pc.connectionState;if(c==='connected'){clearTimeout(timer);tries=0;say('Live in Meroro',1)}else if(c==='failed')relay()}
 await pc.setLocalDescription(await pc.createOffer());await new Promise(r=>{if(pc.iceGatheringState==='complete')return r();pc.onicegatheringstatechange=()=>pc.iceGatheringState==='complete'&&r();setTimeout(r,2500)})
 const p=snd.getParameters();p.encodings=p.encodings&&p.encodings.length?p.encodings:[{}];p.encodings[0].maxBitrate=12e6;p.degradationPreference='maintain-resolution';snd.setParameters(p).catch(()=>{})
 say('Waiting for Meroro…');const r=await fetch('offer'+location.search,{method:'POST',body:JSON.stringify({id,name,sdp:pc.localDescription.sdp})}).then(r=>r.json());if(r.error)throw new Error(r.error)
 await pc.setRemoteDescription({type:'answer',sdp:r.sdp});say('Connecting…');timer=setTimeout(()=>pc.connectionState!=='connected'&&relay(),6000)}catch(e){say(e.message||'Retrying…');setTimeout(connect,Math.min(8000,1500*++tries))}}
// Fallback: if a direct (WebRTC) link can't get through the network, send short recorded chunks over this page's own connection.
function relay(){mode='relay';clearTimeout(timer);try{pc?.close()}catch{}pc=null;try{rec?.stop()}catch{}
 const mt=['video/webm;codecs=vp8','video/webm;codecs=vp9','video/mp4;codecs=avc1','video/mp4','video/webm'].find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t));if(!mt)return say('This browser cannot send video. Try Safari or Chrome.')
 rec=new MediaRecorder(stream,{mimeType:mt,videoBitsPerSecond:6e6,videoKeyFrameIntervalDuration:1000});const s=sid=Date.now().toString(36);let n=0,q=Promise.resolve(),bad=0
 rec.ondataavailable=e=>{if(!e.data.size||s!==sid)return;const k=n++;q=q.then(()=>fetch('chunk'+location.search+'&id='+id+'&s='+s+'&n='+k+'&name='+encodeURIComponent(name)+'&m='+encodeURIComponent(rec.mimeType||mt),{method:'POST',body:e.data}))
  .then(r=>{if(!r.ok)throw 0;bad=0;say('Live in Meroro · Wi-Fi relay',1)}).catch(()=>{if(++bad===3){say('Lost Meroro, retrying…');setTimeout(relay,2000)}})}
 say('Switching to Wi-Fi relay…');rec.start(200)}
async function wake(){try{lock=await navigator.wakeLock?.request('screen')}catch{}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){wake();if(mode==='relay')relay();else if(pc?.connectionState!=='connected')connect()}})
$('go').onclick=async()=>{try{await cam();$('start').remove();wake();connect()}catch(e){$('start').querySelector('p').textContent='Camera not available: '+(e.message||e)+'. Allow camera access for this page and try again.'}}
$('flip').onclick=async()=>{facing=facing==='user'?'environment':'user';await cam()}
$('q').onchange=()=>cam()
$('mir').onclick=()=>{mir=!mir;$('mir').className=mir?'on':'';v.style.transform=mir?'scaleX(-1)':''}
</script></body></html>`
