// Downloads the runtime binaries Meroro bundles: adb, scrcpy-server, ffmpeg.
// Runs on `npm install` for the host platform (mac or win).
import { mkdirSync, existsSync, copyFileSync, chmodSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { deflateSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRCPY = '5.0.1' // keep in sync with src/main/phone.js
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const win = process.platform === 'win32'
const dir = join(root, 'bin', win ? 'win' : 'mac')
const exe = win ? '.exe' : ''
mkdirSync(dir, { recursive: true })

const download = async (url, to) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  writeFileSync(to, Buffer.from(await r.arrayBuffer()))
}

if (!existsSync(join(dir, 'scrcpy-server'))) {
  console.log('fetching scrcpy-server', SCRCPY)
  await download(`https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY}/scrcpy-server-v${SCRCPY}`, join(dir, 'scrcpy-server'))
}

if (!existsSync(join(dir, 'adb' + exe))) {
  console.log('fetching Android platform-tools (adb)')
  const zip = join(dir, 'pt.zip')
  await download(`https://dl.google.com/android/repository/platform-tools-latest-${win ? 'windows' : 'darwin'}.zip`, zip)
  execFileSync('tar', ['-xf', zip, '-C', dir])
  for (const f of win ? ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll'] : ['adb']) copyFileSync(join(dir, 'platform-tools', f), join(dir, f))
  rmSync(join(dir, 'platform-tools'), { recursive: true, force: true })
  rmSync(zip)
  if (!win) chmodSync(join(dir, 'adb'), 0o755)
}

if (!existsSync(join(dir, 'ffmpeg' + exe))) {
  const src = createRequire(import.meta.url)('ffmpeg-static')
  copyFileSync(src, join(dir, 'ffmpeg' + exe))
  if (!win) chmodSync(join(dir, 'ffmpeg'), 0o755)
}

// App icon (1024px PNG drawn procedurally; mirrors LOGO_SVG in src/shared/brand.js)
const icon = join(root, 'build', 'icon.png')
if (!existsSync(icon)) {
  mkdirSync(dirname(icon), { recursive: true })
  const N = 1024, px = Buffer.alloc(N * (N * 4 + 1))
  const box = (x, y, cx, cy, hw, hh, r) => { // signed distance to a rounded box
    const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  }
  const a = d => Math.min(1, Math.max(0, 0.5 - d))
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = (x + y) / (2 * N)
    let c = [124 + 112 * t, 58 + 14 * t, 237 - 84 * t] // violet → pink
    const phone = a(box(x, y, 512, 512, 170, 300, 56)) * (1 - a(box(x, y, 512, 512, 138, 268, 30)))
    const dot = a(Math.hypot(x - 512, y - 512) - 62)
    const dx = x - 512, dy = y - 512, R = Math.hypot(dx, dy)
    const arcs = Math.abs(Math.atan2(dy, Math.abs(dx))) < 0.698 ? Math.max(a(Math.abs(R - 100) - 9), a(Math.abs(R - 128) - 9)) : 0
    const w = Math.max(phone, dot, arcs)
    c = c.map(v => v + (255 - v) * w)
    const o = y * (N * 4 + 1) + 1 + x * 4
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255 * a(box(x, y, 512, 512, 412, 412, 186))
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0 })
  const crc = b => { let c = ~0; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0 }
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length)
    b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8)
    b.writeUInt32BE(crc(b.subarray(4, 8 + data.length)), 8 + data.length)
    return b
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6
  writeFileSync(icon, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]))
}
console.log('binaries ready in', dir)
