// iPhone / iPad sources: USB capture on Mac (bin/ioscap, Swift helper) and a built-in AirPlay receiver (UxPlay).
// Both end up as the same packets Android uses: { config } then { key, data } H.264 Annex B, plus s16le 48 kHz stereo PCM.
import { spawn, execFile } from 'node:child_process'
import { createSocket } from 'node:dgram'
import { existsSync, rmSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { app } from 'electron'

const win = process.platform === 'win32', mac = process.platform === 'darwin'
const binDir = app.isPackaged ? join(process.resourcesPath, 'bin') : join(app.getAppPath(), 'bin', win ? 'win' : 'mac')
const IOSCAP = join(binDir, 'ioscap')
const UX = [join(binDir, 'uxplay' + (win ? '.exe' : '')), '/opt/homebrew/bin/uxplay', '/usr/local/bin/uxplay', 'C:\\msys64\\ucrt64\\bin\\uxplay.exe']
export const uxplayPath = () => [join(app.getPath('userData'), 'uxplay', 'uxplay'), ...UX].find(p => existsSync(p)) || ''

// ---- USB device list (kept fresh by a long-running `ioscap watch`) ----
let usb = [], watcher = null
export function iosUsb() {
  if (mac && !watcher && existsSync(IOSCAP)) {
    watcher = spawn(IOSCAP, ['watch'])
    let buf = ''
    watcher.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { try { usb = JSON.parse(buf.slice(0, i)) } catch {} buf = buf.slice(i + 1) } })
    watcher.on('exit', () => { watcher = null; usb = [] })
  }
  return usb
}
export const stopWatch = () => watcher?.kill()

// ---- running feed ----
let feed = null
export function iosStop() { if (!feed) return; feed.stop(); feed = null }

export function iosStart(src, send) {
  iosStop()
  let done = false
  const end = err => { if (done) return; done = true; send('ios:end', err || '') }
  if (src.startsWith('usb:')) {
    if (!mac) throw new Error('USB iPhone capture works on Mac. On Windows use AirPlay.')
    const p = spawn(IOSCAP, src === 'usb:test' ? ['testpattern'] : ['capture', src.slice(4)])
    let buf = Buffer.alloc(0)
    p.stdout.on('data', d => {
      buf = buf.length ? Buffer.concat([buf, d]) : d
      while (buf.length >= 6) {
        const n = buf.readUInt32BE(2)
        if (buf.length < 6 + n) break
        const t = buf[0], f = buf[1], body = buf.subarray(6, 6 + n)
        if (t === 1) send('ios:video', { config: true, data: Buffer.from(body) })
        else if (t === 2) send('ios:video', { key: !!(f & 1), data: Buffer.from(body) })
        else if (t === 3) send('ios:audio', Buffer.from(body))
        buf = buf.subarray(6 + n)
      }
    })
    p.stderr.on('data', d => { console.log('[ioscap]', String(d).trim()); send('ios:log', String(d).trim()) })
    p.on('exit', code => end(code === 3 ? 'Meroro needs Camera permission to capture an iPhone over USB: System Settings → Privacy & Security → Camera.' : code ? 'The iPhone capture stopped. Unlock the iPhone, tap Trust, and check the cable.' : ''))
    feed = { stop: () => { done = true; p.kill() } }
    return 'usb'
  }
  if (src === 'airplay') {
    const bin = uxplayPath()
    if (!bin) throw new Error('The AirPlay receiver is not installed yet.')
    const vs = createSocket('udp4'), as = createSocket('udp4')
    const h264 = rtpH264((cfg, key, data) => cfg ? send('ios:video', { config: true, data: cfg }) : send('ios:video', { key, data }))
    const pcm = l16To48k(b => send('ios:audio', b))
    vs.on('message', h264); as.on('message', pcm)
    let p
    const go = () => {
      const vp = vs.address().port, ap = as.address().port
      p = spawn(bin, ['-n', 'Meroro', '-nh', '-p', '7130', '-nohold', '-vsync', 'no', '-fps', '60', '-s', '1920x1080',
        '-vrtp', `config-interval=1 ! udpsink host=127.0.0.1 port=${vp}`, '-artp', `pt=96 ! udpsink host=127.0.0.1 port=${ap}`])
      const log = d => send('ios:log', String(d).trim())
      p.stdout.on('data', log); p.stderr.on('data', log)
      p.on('exit', code => end(code ? 'The AirPlay receiver stopped (another AirPlay receiver may be using the port).' : ''))
    }
    let ready = 0
    const both = () => ++ready === 2 && go()
    vs.bind(0, '127.0.0.1', both); as.bind(0, '127.0.0.1', both)
    feed = { stop: () => { done = true; p?.kill(); vs.close(); as.close() } }
    return 'airplay'
  }
  throw new Error('Unknown iPhone source')
}

// Install UxPlay on Mac: it isn't in Homebrew, so build it from source (deps from Homebrew) into Meroro's own folder.
// Windows: the user installs it (MSYS2) and Meroro finds it.
const UXDIR = () => join(app.getPath('userData'), 'uxplay')
const run = (cmd, args, opts = {}) => new Promise((res, rej) => execFile(cmd, args, { timeout: 30 * 60000, maxBuffer: 64 << 20, ...opts }, (e, o, er) =>
  e ? rej(new Error(String(er || e.message).split('\n').filter(l => /error|fatal|not found/i.test(l)).slice(-2).join(' ') || e.message)) : res(o)))
export async function installUxplay(progress = () => {}) {
  if (!mac) throw new Error('On Windows, install UxPlay with MSYS2 (see github.com/FDH2/UxPlay) and restart Meroro.')
  const brew = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'].find(existsSync)
  if (!brew) throw new Error('Homebrew is needed to build the AirPlay receiver. Get it from brew.sh, then try again.')
  const prefix = dirname(dirname(brew)), env = { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_INSTALL_CLEANUP: '1', PATH: `${prefix}/bin:/usr/bin:/bin:/usr/sbin:/sbin`, PKG_CONFIG_PATH: `${prefix}/opt/openssl@3/lib/pkgconfig:${prefix}/lib/pkgconfig` }
  progress('Installing build tools and GStreamer with Homebrew…')
  await run(brew, ['install', 'cmake', 'pkgconf', 'libplist', 'openssl@3', 'gstreamer'], { env })
  const dir = UXDIR(), src = join(dir, 'src')
  rmSync(src, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  progress('Downloading UxPlay…')
  await run('/usr/bin/git', ['clone', '--depth', '1', 'https://github.com/FDH2/UxPlay', src], { env })
  progress('Building UxPlay (a minute or two)…')
  await run(`${prefix}/bin/cmake`, ['-S', src, '-B', join(src, 'build'), '-DCMAKE_BUILD_TYPE=Release'], { env })
  await run(`${prefix}/bin/cmake`, ['--build', join(src, 'build'), '-j', '8'], { env })
  copyFileSync(join(src, 'build', 'uxplay'), join(dir, 'uxplay')); chmodSync(join(dir, 'uxplay'), 0o755)
  progress('')
  return join(dir, 'uxplay')
}

// ---- RTP H.264 → access units (single NAL, STAP-A, FU-A) ----
function rtpH264(onAU) {
  let nals = [], ts = null, fu = null, lastCfg = ''
  const flush = () => {
    if (!nals.length) return
    const sc = Buffer.from([0, 0, 0, 1]), cfg = [], rest = []
    let key = false
    for (const n of nals) { const t = n[0] & 31; if (t === 7 || t === 8) cfg.push(sc, n); else if (t !== 9) { rest.push(sc, n); if (t === 5) key = true } }
    if (cfg.length) { const c = Buffer.concat(cfg), h = c.toString('base64'); if (h !== lastCfg) { lastCfg = h; onAU(c) } }
    if (rest.length) onAU(null, key, Buffer.concat(rest))
    nals = []
  }
  return m => {
    if (m.length < 13) return
    const cc = m[0] & 15, marker = m[1] & 128, t = m.readUInt32BE(4)
    let off = 12 + cc * 4
    if (m[0] & 16) off += 4 + m.readUInt16BE(off + 2) * 4
    const p = m.subarray(off), type = p[0] & 31
    if (ts !== null && t !== ts) flush()
    ts = t
    if (type >= 1 && type <= 23) nals.push(Buffer.from(p))
    else if (type === 24) { let i = 1; while (i + 2 <= p.length) { const n = p.readUInt16BE(i); i += 2; nals.push(Buffer.from(p.subarray(i, i + n))); i += n } }
    else if (type === 28) {
      const s = p[1] & 128, e = p[1] & 64
      if (s) fu = [Buffer.from([(p[0] & 0xe0) | (p[1] & 31)]), Buffer.from(p.subarray(2))]; else if (fu) fu.push(Buffer.from(p.subarray(2)))
      if (e && fu) { nals.push(Buffer.concat(fu)); fu = null }
    }
    if (marker) { flush(); ts = null }
  }
}

// ---- RTP L16 (44.1 kHz stereo, big-endian) → 48 kHz little-endian ----
function l16To48k(onPcm) {
  let pos = 0, last = [0, 0]
  const step = 44100 / 48000
  return m => {
    if (m.length < 13) return
    const cc = m[0] & 15, p = m.subarray(12 + cc * 4), n = p.length >> 2
    if (!n) return
    const get = (i, c) => i < 0 ? last[c] : p.readInt16BE(i * 4 + c * 2)
    const out = []
    while (pos < n - 1) { const i = Math.floor(pos), f = pos - i; for (let c = 0; c < 2; c++) out.push(Math.round(get(i, c) * (1 - f) + get(i + 1, c) * f)); pos += step }
    pos -= n; last = [get(n - 1, 0), get(n - 1, 1)]
    const b = Buffer.alloc(out.length * 2); out.forEach((v, i) => b.writeInt16LE(v, i * 2)); onPcm(b)
  }
}
