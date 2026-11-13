import { app, BrowserWindow, ipcMain, safeStorage, shell, systemPreferences, powerSaveBlocker, dialog, desktopCapturer, session as esession } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { spawn, execFile } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { splashWindow } from './splash'
import { BRAND } from '../shared/brand'
import { adb, listDevices, listApps, foreground, Session, FFMPEG } from './phone'

const mac = process.platform === 'darwin'
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

let win, session, blocker
const outs = new Map()
const send = (ch, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a) }

function createWindow() {
  const t0 = Date.now(), splash = process.env.MERORO_TEST && !process.env.MERORO_SPLASH ? null : splashWindow(app.getVersion())
  win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 1180, minHeight: 720, show: false, backgroundColor: '#09090b',
    titleBarStyle: 'hidden',
    ...(mac ? { trafficLightPosition: { x: 16, y: 14 } } : { titleBarOverlay: { color: '#09090b', symbolColor: '#a1a1aa', height: 44 } }),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), backgroundThrottling: false }
  })
  win.once('ready-to-show', () => setTimeout(() => { splash?.destroy(); win.show(); win.focus() }, splash ? Math.max(0, 1600 - (Date.now() - t0)) : 0))
  if (!app.isPackaged && process.env.MERORO_TEST) createRequire(__filename)(process.env.MERORO_TEST)({ win, send, app }) // dev self-test hook
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// ---- settings (stream key is encrypted with the OS keychain) ----
const file = () => join(app.getPath('userData'), 'settings.json')
ipcMain.handle('settings:get', () => {
  try {
    const s = JSON.parse(readFileSync(file(), 'utf8'))
    if (s.keyEnc) { s.key = safeStorage.decryptString(Buffer.from(s.keyEnc, 'base64')); delete s.keyEnc }
    return s
  } catch { return {} }
})
ipcMain.on('settings:set', (_, s) => {
  const o = { ...s }
  if (o.key && safeStorage.isEncryptionAvailable()) { o.keyEnc = safeStorage.encryptString(o.key).toString('base64'); delete o.key }
  try { writeFileSync(file(), JSON.stringify(o)) } catch {}
})

// ---- phone ----
ipcMain.handle('devices', () => listDevices())
ipcMain.handle('adb:connect', (_, addr) => adb(['connect', addr]))
ipcMain.handle('apps', (_, serial) => listApps(serial))
ipcMain.handle('focus', (_, serial) => foreground(serial))
ipcMain.handle('session:start', async (_, serial, o) => {
  session?.stop()
  const s = session = new Session(serial, o, (type, p) => {
    if (type === 'end') { if (session === s) { session = null; send('session:end', p) } } else if (session === s) send('session:' + type, p)
  })
  try { await s.start() } catch (e) { s.stop(); throw e }
})
ipcMain.handle('session:stop', () => session?.stop())
ipcMain.on('ctl', (_, m) => session?.control(m))

// ---- outputs: MediaRecorder chunks from the renderer are piped into ffmpeg ----
let rtmps
const hasRtmps = () => rtmps ??= new Promise(r => execFile(FFMPEG, ['-hide_banner', '-protocols'], (e, out) => r(/\brtmps\b/.test(out || ''))))

ipcMain.handle('out:start', async (_, id, o) => {
  if (outs.has(id)) return
  const args = ['-hide_banner', '-loglevel', 'warning', '-stats', '-stats_period', '1', '-fflags', '+genpts', '-i', 'pipe:0']
  let target, secret = ''
  if (id === 'rec') {
    target = join(app.getPath('videos'), `Meroro ${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace(/[T:]/g, '-')}.mkv`)
    args.push('-c', 'copy', target)
  } else {
    secret = o.key
    const base = o.dest === 'youtube' ? (await hasRtmps() ? 'rtmps://a.rtmps.youtube.com:443/live2' : 'rtmp://a.rtmp.youtube.com/live2') : o.url.replace(/\/$/, '')
    target = `${base}/${o.key}`
    const k = o.bitrate + 'k'
    const enc = o.encoder === 'hw' && mac
      ? ['-c:v', 'h264_videotoolbox', '-realtime', '1', '-profile:v', 'high']
      : ['-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-profile:v', 'high', '-sc_threshold', '0']
    args.push(...enc, '-b:v', k, '-maxrate', k, '-bufsize', o.bitrate * 2 + 'k', '-pix_fmt', 'yuv420p', '-r', String(o.fps), '-g', String(o.fps * 2),
      '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', '-f', 'flv', target)
  }
  const p = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true })
  let last = ''
  p.stdin.on('error', () => {})
  p.stderr.on('data', d => {
    const t = String(d)
    const m = t.match(/frame=\s*(\d+)\s+fps=\s*([\d.]+).*?time=([\d:.]+)\s+bitrate=\s*([\d.]+)kbits.*?speed=\s*([\d.]+)x/s)
    if (m) send('out:stats', id, { frames: +m[1], fps: +m[2], time: m[3], kbps: +m[4], speed: +m[5], drop: +(t.match(/drop=\s*(\d+)/)?.[1] || 0) })
    else last = (last + t).slice(-600)
  })
  p.on('error', e => { last = e.message })
  p.on('exit', code => {
    outs.delete(id)
    if (!outs.size && blocker != null) { powerSaveBlocker.stop(blocker); blocker = null }
    const error = code ? (secret ? last.split(secret).join('•••') : last).trim().split('\n').slice(-3).join('\n') || `ffmpeg exited (${code})` : null
    send('out:end', id, { error, file: id === 'rec' ? target : null })
  })
  outs.set(id, p)
  blocker ??= powerSaveBlocker.start('prevent-app-suspension')
})
ipcMain.on('out:data', (_, id, buf) => { const p = outs.get(id); if (p?.stdin.writable) p.stdin.write(Buffer.from(buf)) })
ipcMain.on('out:stop', (_, id) => {
  const p = outs.get(id)
  if (!p) return
  p.stdin.end()
  setTimeout(() => outs.get(id) === p && p.kill(), 5000)
})

// ---- scene sources: files, screen/window capture, offscreen web pages ----
ipcMain.handle('file:pick', async (_, kind) => {
  const filters = [kind === 'image' ? { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] } : { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'm4v'] }]
  return (await dialog.showOpenDialog(win, { properties: ['openFile'], filters })).filePaths[0] || ''
})
ipcMain.handle('file:read', (_, p) => readFile(p))
let pickId = ''
ipcMain.handle('screen:list', async () => (await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })).map(x => [x.id, x.name]))
ipcMain.handle('screen:pick', (_, id) => { pickId = id })
const pages = new Map()
ipcMain.handle('browser:open', (_, id, url) => {
  pages.get(id)?.destroy()
  const b = new BrowserWindow({ show: false, width: 1280, height: 720, transparent: true, frame: false, webPreferences: { offscreen: true } })
  b.webContents.setFrameRate(20)
  b.webContents.setAudioMuted(true)
  b.webContents.on('paint', (e, dirty, img) => { const z = img.getSize(); send('browser:frame', id, z.width, z.height, img.toBitmap()) })
  b.loadURL(/^https?:\/\//.test(url) ? url : 'https://' + url).catch(() => {})
  pages.set(id, b)
})
ipcMain.on('browser:close', (_, id) => { pages.get(id)?.destroy(); pages.delete(id) })

// ---- permissions ----
const PANE = { camera: 'Camera', microphone: 'Microphone', screen: 'ScreenCapture' }
ipcMain.handle('perm:status', () => Object.fromEntries(Object.keys(PANE).map(k => [k, mac || k !== 'screen' ? systemPreferences.getMediaAccessStatus(k) : 'granted'])))
ipcMain.handle('perm:ask', async (_, k) => {
  if (k === 'screen') { await desktopCapturer.getSources({ types: ['screen'] }); return true } // triggers the macOS prompt
  return mac ? systemPreferences.askForMediaAccess(k) : true
})
ipcMain.handle('perm:open', (_, k) => shell.openExternal(mac ? `x-apple.systempreferences:com.apple.preference.security?Privacy_${PANE[k]}` : `ms-settings:privacy-${k === 'camera' ? 'webcam' : 'microphone'}`))
ipcMain.handle('app:relaunch', () => { app.relaunch(); app.exit(0) })
ipcMain.handle('screen:thumbs', async () => (await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } }))
  .filter(x => x.name && !/^Meroro$/.test(x.name)).map(x => ({ id: x.id, name: x.name, thumb: x.thumbnail.toDataURL() })))

// ---- misc ----
ipcMain.handle('media:ask', (_, kind) => mac ? systemPreferences.askForMediaAccess(kind) : true)
ipcMain.on('reveal', (_, p) => shell.showItemInFolder(p))

app.setName(BRAND.name)
app.setAboutPanelOptions({ applicationName: BRAND.name, applicationVersion: app.getVersion(), copyright: `© 2026 ${BRAND.author}`, credits: `Created by ${BRAND.author}`, authors: [BRAND.author] })
app.whenReady().then(() => {
  if (mac && !app.isPackaged) app.dock?.setIcon(join(app.getAppPath(), 'build', 'icon.png'))
  esession.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
    const src = await desktopCapturer.getSources({ types: ['screen', 'window'] })
    cb({ video: src.find(x => x.id === pickId) || src[0] })
  })
  createWindow()
  win.on('closed', () => app.quit()) // offscreen web-page windows must not keep the app alive
})
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { session?.stop(); for (const p of outs.values()) p.kill() })
