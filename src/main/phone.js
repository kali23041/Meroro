// Android side: device detection through adb, and a direct client for scrcpy-server
// (video = H.264 packets, audio = raw PCM, control = touch/keys/start-app).
import { execFile, spawn } from 'node:child_process'
import { createConnection, createServer } from 'node:net'
import { randomInt } from 'node:crypto'
import { join } from 'node:path'
import { app } from 'electron'

const SCRCPY_VERSION = '5.0.1' // must match the bundled scrcpy-server
const win = process.platform === 'win32'
const exe = win ? '.exe' : ''
const binDir = app.isPackaged ? join(process.resourcesPath, 'bin') : join(app.getAppPath(), 'bin', win ? 'win' : 'mac')
export const ADB = join(binDir, 'adb' + exe)
export const FFMPEG = join(binDir, 'ffmpeg' + exe)
const SERVER = join(binDir, 'scrcpy-server')

// scrcpy-server deletes its own jar as soon as it starts, so every launch uploads a fresh,
// uniquely named copy (which also keeps concurrent launches from racing each other).
async function serverCmd(serial, args) {
  const remote = `/data/local/tmp/meroro-${randomInt(1, 0x7fffffff).toString(16)}.jar`
  await adb(['-s', serial, 'push', SERVER, remote])
  return ['-s', serial, 'shell', `CLASSPATH=${remote}`, 'app_process', '/', 'com.genymobile.scrcpy.Server', SCRCPY_VERSION, ...args]
}

export const adb = (args, opts = {}) => new Promise((res, rej) =>
  execFile(ADB, args, { maxBuffer: 32 << 20, timeout: 30000, windowsHide: true, ...opts },
    (e, out, err) => e ? rej(new Error((err || e.message).trim())) : res(out)))

export async function listDevices() {
  const out = await adb(['devices', '-l'])
  const all = out.split('\n').slice(1).map(l => l.trim()).filter(Boolean).map(l => {
    const [serial, state, ...rest] = l.split(/\s+/)
    const kv = Object.fromEntries(rest.map(s => s.split(':')).filter(a => a.length === 2))
    return { serial, state, model: (kv.model || kv.device || serial).replace(/_/g, ' '), wifi: /:\d+$|_adb/.test(serial) }
  })
  return all.filter(d => !(d.wifi && all.some(u => !u.wifi && d.serial.includes(u.serial))))
}

export async function listApps(serial) {
  const out = await adb(await serverCmd(serial, ['list_apps=true']), { timeout: 90000 })
  const apps = []
  for (const l of out.split('\n')) {
    const m = l.match(/^\s*([*-])\s+(.+?)\s+(\S+)\s*$/)
    if (m) apps.push({ name: m[2], pkg: m[3], system: m[1] === '-' })
  }
  return apps.sort((a, b) => a.system - b.system || a.name.localeCompare(b.name))
}

// Package of the app currently in front on the phone's own screen ('' when unknown).
// Precise: the resumed activity is the app really in front; overlays (notification shade,
// quick settings, lock screen) are reported as com.android.systemui so they get covered too.
export async function foreground(serial) {
  const out = await adb(['-s', serial, 'shell',
    "dumpsys window | grep -m1 mCurrentFocus; dumpsys activity activities | grep -m1 -E 'topResumedActivity|mResumedActivity'"], { timeout: 4000 }).catch(() => '')
  const [focus = '', resumed = ''] = out.split('\n')
  if (/NotificationShade|StatusBar|Keyguard|ShadeWindow|PopupWindow:.*systemui/.test(focus)) return 'com.android.systemui'
  return resumed.match(/u0 ([^\s/}]+)/)?.[1] || focus.match(/u0 ([^\s/}]+)/)?.[1] || ''
}

export async function deviceInfo(serial) {
  const out = await adb(['-s', serial, 'shell', [
    'getprop ro.product.manufacturer', 'getprop ro.product.model', 'getprop ro.build.version.release', 'getprop ro.build.version.sdk',
    'wm size | tail -1', 'dumpsys battery | grep -E "^  (level|temperature|status|AC powered|USB powered):"', 'df -h /data | tail -1', 'getprop ro.product.cpu.abi'
  ].join(';')], { timeout: 8000 })
  const l = out.split('\n').map(x => x.trim())
  const bat = k => out.match(new RegExp(k + ': (\\S+)'))?.[1]
  const df = (l.find(x => /\d+%/.test(x)) || '').split(/\s+/)
  return {
    maker: l[0], model: l[1], android: l[2], sdk: l[3], screen: (out.match(/size: (\d+x\d+)/) || [])[1],
    battery: +bat('level') || 0, temp: (+bat('temperature') || 0) / 10, charging: bat('AC powered') === 'true' || bat('USB powered') === 'true',
    storage: { size: df[1], used: df[2], free: df[3], pct: parseInt(df[4]) || 0 }, abi: l.filter(Boolean).at(-1)
  }
}

export async function appInfo(serial, pkg) {
  const out = await adb(['-s', serial, 'shell', `dumpsys package ${pkg} | grep -m6 -E 'versionName|firstInstallTime|lastUpdateTime|targetSdk'`], { timeout: 8000 }).catch(() => '')
  const g = k => out.match(new RegExp(k + '=([^\\n]+?)(\\s+\\w+=|$)', 'm'))?.[1]?.trim()
  return { version: g('versionName'), installed: g('firstInstallTime'), updated: g('lastUpdateTime') }
}

export const appAction = (serial, pkg, act) => act === 'stop'
  ? adb(['-s', serial, 'shell', 'am', 'force-stop', pkg])
  : adb(['-s', serial, 'shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1'])

export const screenshot = serial => new Promise((res, rej) =>
  execFile(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 64 << 20, timeout: 15000 }, (e, out) => e ? rej(e) : res(out)))

const freePort = () => new Promise((res, rej) => {
  const s = createServer().once('error', rej).listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)) })
})
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Splits a scrcpy stream into packets. Stream = 4-byte codec id, then 12-byte headers + payload.
function reader(onCodec, onPacket, onSession) {
  let buf = Buffer.alloc(0), started = false
  return chunk => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk
    if (!started) {
      if (buf.length < 4) return
      onCodec(buf.readUInt32BE(0)); buf = buf.subarray(4); started = true
    }
    while (buf.length >= 12) {
      const hi = buf.readUInt32BE(0)
      if (hi & 0x80000000) { onSession?.(buf.readUInt32BE(4), buf.readUInt32BE(8)); buf = buf.subarray(12); continue }
      const size = buf.readUInt32BE(8)
      if (buf.length < 12 + size) break
      onPacket({ config: !!(hi & 0x40000000), key: !!(hi & 0x20000000), data: new Uint8Array(buf.subarray(12, 12 + size)) }) // copy → exact-size IPC payload
      buf = buf.subarray(12 + size)
    }
  }
}

export class Session {
  // emit(type, payload): 'video' | 'audio' | 'size' | 'log' | 'focus' | 'end'
  constructor(serial, o, emit) { Object.assign(this, { serial, o, emit, socks: [] }) }

  async start() {
    const { serial, o } = this
    const scid = randomInt(1, 0x7fffffff).toString(16).padStart(8, '0')
    this.port = await freePort()
    await adb(['-s', serial, 'forward', `tcp:${this.port}`, `localabstract:scrcpy_${scid}`])
    const args = [`scid=${scid}`, 'log_level=info', 'tunnel_forward=true', 'send_device_meta=false', 'control=true',
      `audio=${!!o.audio}`, 'audio_codec=raw', ...(o.audio && o.dup ? ['audio_source=playback', 'audio_dup=true'] : []), // dup: keep sound on the phone too (Android 13+)
      'video_codec=h264', `max_size=${o.maxSize || 0}`,
      `video_bit_rate=${(o.bitrate || 8) * 1e6}`, `max_fps=${o.fps || 60}`, 'stay_awake=true']
    if (o.virtual) args.push(`new_display=${o.display || ''}`, 'vd_destroy_content=false')
    this.proc = spawn(ADB, await serverCmd(serial, args), { windowsHide: true })
    let log = ''
    const onLog = d => { log = (log + d).slice(-2000); for (const l of String(d).split('\n')) if (l.trim()) this.emit('log', l.trim()) }
    this.proc.stdout.on('data', onLog); this.proc.stderr.on('data', onLog)
    this.proc.on('exit', () => this.stop(log.match(/ERROR: (.*)/)?.[1]))

    // First socket: retry until the server is listening (it answers with one dummy byte).
    let first
    for (let i = 0; i < 100 && !first && !this.dead; i++) {
      first = await this.connect(true).catch(() => null)
      if (!first) await sleep(100)
    }
    if (!first) throw new Error(log.match(/ERROR: (.*)/)?.[1] || 'Could not reach the phone. Unlock it and try again.')
    const video = reader(() => {}, p => this.emit('video', p), (w, h) => this.emit('size', { w, h }))
    first.s.on('data', video)
    if (first.rest.length) video(first.rest)
    if (o.audio) {
      const a = await this.connect()
      a.s.on('data', reader(id => id < 2 && this.emit('log', 'Phone audio is unavailable (needs Android 11+)'), p => this.emit('audio', p.data)))
    }
    this.ctrl = (await this.connect()).s
    this.ctrl.on('data', () => {})
    if (o.pkg) this.startApp(o.pkg)
  }

  connect(first) {
    return new Promise((res, rej) => {
      const s = createConnection({ port: this.port, host: '127.0.0.1' })
      s.setNoDelay(true)
      s.on('error', rej)
      s.once('close', () => rej(new Error('closed')))
      if (first) s.once('data', d => { this.socks.push(s); res({ s, rest: d.subarray(1) }) })
      else s.once('connect', () => { this.socks.push(s); res({ s }) })
    })
  }

  write(b) { if (this.ctrl?.writable) this.ctrl.write(b) }
  startApp(pkg) { const n = Buffer.from(pkg); this.write(Buffer.concat([Buffer.from([16, n.length]), n])) }
  control(m) {
    if (m.t === 'touch') { // a: 0 down, 1 up, 2 move
      const b = Buffer.alloc(32)
      b[0] = 2; b[1] = m.a
      b.writeBigUInt64BE(m.id != null ? BigInt(m.id) : 0xfffffffffffffffen, 2) // key-mapping finger, or the generic finger
      b.writeInt32BE(m.x, 10); b.writeInt32BE(m.y, 14); b.writeUInt16BE(m.w, 18); b.writeUInt16BE(m.h, 20)
      b.writeUInt16BE(m.a === 1 ? 0 : 0xffff, 22)
      b.writeInt32BE(m.a === 2 ? 0 : 1, 24); b.writeInt32BE(m.a === 1 ? 0 : 1, 28)
      this.write(b)
    } else if (m.t === 'scroll') {
      const b = Buffer.alloc(21), fp = v => Math.max(-32768, Math.min(32767, Math.round(v / 16 * 32768)))
      b[0] = 3
      b.writeInt32BE(m.x, 1); b.writeInt32BE(m.y, 5); b.writeUInt16BE(m.w, 9); b.writeUInt16BE(m.h, 11)
      b.writeInt16BE(fp(m.dx), 13); b.writeInt16BE(fp(m.dy), 15)
      this.write(b)
    } else if (m.t === 'key') { // press + release an Android keycode
      for (const action of [0, 1]) {
        const b = Buffer.alloc(14)
        b[1] = action; b.writeInt32BE(m.code, 2)
        this.write(b)
      }
    } else if (m.t === 'text') {
      const s = Buffer.from(m.text), b = Buffer.alloc(5)
      b[0] = 1; b.writeUInt32BE(s.length, 1)
      this.write(Buffer.concat([b, s]))
    } else if (m.t === 'app') this.startApp(m.pkg)
  }

  stop(error) {
    if (this.dead) return
    this.dead = true
    for (const s of this.socks) s.destroy()
    this.proc?.kill()
    adb(['-s', this.serial, 'forward', '--remove', `tcp:${this.port}`]).catch(() => {})
    this.emit('end', error || null)
  }
}
