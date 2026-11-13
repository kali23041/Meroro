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
const win = (process.argv[2] || process.platform).startsWith('win')
const cross = win !== (process.platform === 'win32')
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
  const req = createRequire(import.meta.url)
  if (cross) {
    const tag = req('ffmpeg-static/package.json')['ffmpeg-static']['binary-release-tag']
    console.log('fetching ffmpeg for', win ? 'windows' : 'mac')
    await download(`https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/ffmpeg-${win ? 'win32-x64' : 'darwin-arm64'}`, join(dir, 'ffmpeg' + exe))
  } else copyFileSync(req('ffmpeg-static'), join(dir, 'ffmpeg' + exe))
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
  const seg = (x, y, ax, ay, bx, by) => { // distance to a line segment
    const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)))
    return Math.hypot(px - dx * t, py - dy * t)
  }
  const M = [[312, 690, 312, 376], [312, 376, 512, 576], [512, 576, 712, 376], [712, 376, 712, 690]]
  const mix = (c1, c2, t) => c1.map((v, i) => v + (c2[i] - v) * t)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tile = box(x, y, 512, 512, 412, 412, 186)
    let c = mix([13, 11, 20], [255, 255, 255], 0.12 * a(Math.abs(tile + 10) - 5)) // dark tile + hairline border
    const t = Math.max(0, Math.min(1, ((x - 312) / 400 + (690 - y) / 314) / 2))
    c = mix(c, mix([139, 92, 246], [244, 114, 182], t), a(Math.min(...M.map(s => seg(x, y, ...s))) - 46))
    c = mix(c, [255, 255, 255], a(Math.hypot(x - 512, y - 356) - 50))
    const o = y * (N * 4 + 1) + 1 + x * 4
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255 * a(tile)
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
