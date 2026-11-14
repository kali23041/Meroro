import { app, BrowserWindow, ipcMain, safeStorage, shell, systemPreferences, powerSaveBlocker, dialog, desktopCapturer, globalShortcut, session as esession } from 'electron'
import { readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { spawn, execFile } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs'
import { splashWindow } from './splash'
import { BRAND } from '../shared/brand'
import { Chat } from './chat'
import { iosUsb, iosStart, iosStop, stopWatch, uxplayPath, installUxplay } from './ios'
import { adb, listDevices, listApps, foreground, deviceInfo, overlayApps, cleanOn, cleanOff, perf, appInfo, appAction, screenshot, Session, FFMPEG, ADB } from './phone'

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
    width: 1600, height: 783, minWidth: 1180, minHeight: 578, show: false, backgroundColor: '#09090b',
    titleBarStyle: 'hidden',
    ...(mac ? { trafficLightPosition: { x: 16, y: 14 } } : { titleBarOverlay: { color: '#09090b', symbolColor: '#a1a1aa', height: 44 } }),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), backgroundThrottling: false }
  })
  win.setAspectRatio(2000 / 979) // the studio layout is designed for this shape; resizing keeps it
  // splash shows the real start-up work; the studio opens once it's done (at least 1.6 s so the card can be read, at most 9 s)
  const setup = splash ? bootSteps(splash.step) : Promise.resolve()
  const loaded = new Promise(r => win.once('ready-to-show', r))
  splash?.step(3, 'run'); loaded.then(() => splash?.step(3, 'ok', 'ready'))
  Promise.race([Promise.all([setup, loaded]), new Promise(r => setTimeout(r, 9000))]).then(() => loaded)
    .then(() => setTimeout(() => { splash?.destroy(); win.show(); win.focus() }, splash ? Math.max(350, 1600 - (Date.now() - t0)) : 0))
  if (!app.isPackaged && process.env.MERORO_TEST) createRequire(__filename)(process.env.MERORO_TEST)({ win, send, app }) // dev self-test hook
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

async function bootSteps(step) {
  step(0, 'run')
  const miss = [['adb', ADB], ['ffmpeg', FFMPEG]].filter(([, f]) => !existsSync(f)).map(([n]) => n)
  step(0, miss.length ? 'warn' : 'ok', miss.length ? miss.join(', ') + ' missing' : 'all found')
  step(1, 'run')
  try { await adb(['start-server']); step(1, 'ok', 'running') } catch { step(1, 'warn', 'not started') }
  step(2, 'run')
  try { const n = (await listDevices()).filter(d => d.state === 'device').length; step(2, 'ok', n ? n + (n > 1 ? ' phones' : ' phone') + ' found' : 'none plugged in') }
  catch { step(2, 'warn', 'none found') }
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
// ---- wireless adb: adb exits 0 even on failure, so the output text decides ----
const hostPort = (a, port) => { a = a.trim().replace(/^adb\s+(connect|pair)\s+/, ''); return /:\d+$/.test(a) ? a : `${a}:${port}` }
// macOS Local Network privacy: the adb server inherits the permission of whichever app started it.
// If Meroro itself can reach the phone but adb can't, restart adb from Meroro so it gets the permission.
const probe = (host, port) => new Promise(r => {
  const c = createConnection({ host, port, timeout: 3000 })
  c.on('connect', () => { c.destroy(); r('ok') }); c.on('timeout', () => { c.destroy(); r('timeout') }); c.on('error', e => r(e.code))
})
async function adbConnect(addr, timeout = 12000) {
  let out = (await adb(['connect', addr], { timeout }).catch(e => e.message)).trim()
  if (mac && /No route to host/.test(out) && !session) {
    const i = addr.lastIndexOf(':')
    if (await probe(addr.slice(0, i), +addr.slice(i + 1)) === 'ok') {
      await adb(['kill-server']).catch(() => {}); await adb(['start-server']).catch(() => {})
      out = (await adb(['connect', addr], { timeout }).catch(e => e.message)).trim()
    }
  }
  return out
}
ipcMain.handle('adb:connect', async (_, addr) => {
  const out = await adbConnect(hostPort(addr, 5555))
  if (/No route to host/.test(out) && mac) throw new Error('macOS is blocking Meroro from your local network. Open System Settings → Privacy & Security → Local Network, turn on Meroro, then restart Meroro.')
  if (!/connected to/.test(out)) throw new Error(/refused|timed out|No route/i.test(out) ? `${out}. On Android 11+ use the IP address & port shown under Wireless debugging (it is not 5555), and pair first if this Mac is new.` : out)
  return out
})
ipcMain.handle('adb:pair', async (_, addr, code) => {
  const out = (await adb(['pair', hostPort(addr, 0), String(code).trim()], { timeout: 20000 })).trim()
  if (/No route to host/.test(out) && mac) throw new Error('macOS is blocking Meroro from your local network. Open System Settings → Privacy & Security → Local Network, turn on Meroro, then restart Meroro.')
  if (!/Successfully paired/i.test(out)) throw new Error(out || 'Pairing failed. Check the code and the pairing port.')
  return out
})
ipcMain.handle('adb:mdns', async () => {
  const out = await adb(['mdns', 'services'], { timeout: 5000 }).catch(() => '')
  return out.split('\n').map(l => l.trim().split(/\s+/)).filter(p => p.length >= 3 && /_adb-tls-(connect|pairing)/.test(p[1]))
    .map(([name, type, addr]) => ({ name, addr, pair: type.includes('pairing') }))
})
ipcMain.handle('adb:wireless', async (_, serial) => { // USB phone → Wi-Fi with one click
  const ipOut = await adb(['-s', serial, 'shell', 'ip -f inet addr show wlan0'])
  const ip = ipOut.match(/inet (\d+\.\d+\.\d+\.\d+)/)?.[1]
  if (!ip) throw new Error('The phone is not on Wi-Fi. Connect it to the same network as this computer.')
  await adb(['-s', serial, 'tcpip', '5555'])
  let last = ''
  for (let i = 0; i < 20; i++) { // phones take a few seconds to restart adb in network mode
    await new Promise(r => setTimeout(r, 1000))
    const out = await adbConnect(`${ip}:5555`, 6000)
    if (/connected to/.test(out)) return `Connected over Wi-Fi (${ip}:5555). You can unplug the cable.`
    last = out
  }
  if (/No route to host/.test(last) && mac) throw new Error('macOS is blocking Meroro from your local network. Open System Settings → Privacy & Security → Local Network, turn on Meroro, then restart Meroro.')
  throw new Error(`Could not reach ${ip}:5555. Make sure this computer and the phone are on the same Wi-Fi.`)
})
ipcMain.handle('apps', (_, serial) => listApps(serial))
ipcMain.handle('focus', (_, serial) => foreground(serial))
const chat = new Chat(m => send('chat:msg', m))
ipcMain.handle('chat:start', (_, url) => chat.start(url))
ipcMain.handle('chat:stop', () => chat.stop())
ipcMain.handle('device:info', (_, serial) => deviceInfo(serial))
ipcMain.handle('device:perf', (_, serial) => perf(serial))
// iPhone / iPad: USB (Mac) and the built-in AirPlay receiver
ipcMain.handle('ios:list', () => ({ usb: iosUsb(), airplay: !!uxplayPath(), mac }))
ipcMain.handle('ios:start', (_, src) => iosStart(src, send))
ipcMain.handle('ios:stop', () => iosStop())
ipcMain.handle('airplay:install', () => installUxplay().then(() => true))
app.on('will-quit', () => { iosStop(); stopWatch() })
// ---- YouTube sign-in (for chat replies) and Studio window ----
const yt = () => esession.fromPartition('persist:youtube')
const ytWin = url => { const w = new BrowserWindow({ width: 1100, height: 780, parent: win, title: 'YouTube', webPreferences: { partition: 'persist:youtube' } }); w.loadURL(url); return w }
ipcMain.handle('yt:status', async () => !!(await yt().cookies.get({ url: 'https://www.youtube.com', name: 'SAPISID' })).length)
ipcMain.handle('yt:login', () => new Promise(res => { const w = ytWin('https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F'); w.on('closed', () => res(true)) }))
ipcMain.handle('yt:logout', () => yt().clearStorageData())
ipcMain.handle('yt:studio', (_, url) => { ytWin(url || 'https://studio.youtube.com/channel/UC/livestreaming'); return true })
ipcMain.handle('chat:send', async (_, text) => { // posts as the signed-in YouTube account
  const i = chat?.info
  if (!i?.vid) throw new Error('Connect the YouTube chat first.')
  const s = yt(), sid = (await s.cookies.get({ url: 'https://www.youtube.com', name: 'SAPISID' }))[0]?.value
  if (!sid) throw new Error('Sign in to YouTube in Meroro to send chat replies.')
  const page = await (await s.fetch(`https://www.youtube.com/live_chat?is_popout=1&v=${i.vid}`)).text()
  const params = page.match(/"sendLiveChatMessageEndpoint":\{"params":"([^"]+)"/)?.[1]
  if (!params) throw new Error('YouTube did not allow sending in this chat (chat closed, or you are not signed in).')
  const ts = Math.floor(Date.now() / 1000), hash = createRequire(__filename)('node:crypto').createHash('sha1').update(`${ts} ${sid} https://www.youtube.com`).digest('hex')
  const r = await s.fetch(`https://www.youtube.com/youtubei/v1/live_chat/send_message?key=${i.key}&prettyPrint=false`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `SAPISIDHASH ${ts}_${hash}`, 'X-Origin': 'https://www.youtube.com', Origin: 'https://www.youtube.com' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: i.ver } }, params, richMessage: { textSegments: [{ text }] } }) })
  if (!r.ok) throw new Error('YouTube refused the message (' + r.status + ')')
  return true
})

// ---- global hotkeys (soundboard, mute) ----
ipcMain.handle('hotkeys:set', (_, list) => {
  globalShortcut.unregisterAll()
  const acc = k => k.replace(/^(Shift|Ctrl|Alt)\+/g, m => ({ 'Shift+': 'Shift+', 'Ctrl+': 'CommandOrControl+', 'Alt+': 'Alt+' })[m]).replace(/Key([A-Z])$/, '$1').replace(/Digit(\d)$/, '$1').replace(/Numpad(\d)$/, 'num$1')
  for (const { id, key } of list) { try { if (key && !/^(Mouse|Wheel|Pad)/.test(key)) globalShortcut.register(acc(key), () => send('hotkey', id)) } catch {} }
  return true
})
app.on('will-quit', () => globalShortcut.unregisterAll())

// ---- updates from GitHub Releases ----
const REPO = 'kali23041/Meroro'
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false }
ipcMain.handle('update:check', async () => {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) })
  if (!r.ok) return null
  const j = await r.json(), v = (j.tag_name || '').replace(/^v/, '')
  const a = j.assets?.find(x => mac ? x.name.endsWith(`${process.arch}.dmg`) || x.name.endsWith('.dmg') : x.name.endsWith('.exe'))
  return v && newer(v, app.getVersion()) && a ? { version: v, notes: (j.body || '').slice(0, 600), url: a.browser_download_url, name: a.name } : null
})
ipcMain.handle('update:install', async (_, u) => { // download → install → relaunch
  const file = join(app.getPath('temp'), u.name)
  const r = await fetch(u.url); if (!r.ok) throw new Error('Download failed')
  writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  if (mac) {
    const mnt = join(app.getPath('temp'), 'meroro-update')
    await new Promise((res, rej) => execFile('hdiutil', ['attach', '-nobrowse', '-quiet', '-mountpoint', mnt, file], e => e ? rej(e) : res()))
    const dest = app.getPath('exe').replace(/\/Contents\/MacOS\/.*$/, '')
    await new Promise((res, rej) => execFile('ditto', [join(mnt, 'Meroro.app'), dest], e => e ? rej(e) : res()))
    execFile('hdiutil', ['detach', '-quiet', mnt], () => {})
    app.relaunch(); app.exit(0)
  } else { spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref(); app.exit(0) }
})

// Clean screen: the record of what was changed lives on disk, so it can be undone even after a crash or restart
const cleanFile = serial => join(app.getPath('userData'), `clean-${serial.replace(/\W/g, '_')}.json`)
const cleanSaved = serial => { try { return JSON.parse(readFileSync(cleanFile(serial), 'utf8')) } catch { return null } }
ipcMain.handle('clean:status', (_, serial) => !!cleanSaved(serial))
ipcMain.handle('clean:apps', (_, serial) => overlayApps(serial).then(a => [...new Set([...a, ...(cleanSaved(serial)?.denied || [])])]))
ipcMain.handle('clean:set', async (_, serial, on, o) => {
  const old = cleanSaved(serial)
  if (old) { await cleanOff(serial, old); try { unlinkSync(cleanFile(serial)) } catch {} }
  if (on) writeFileSync(cleanFile(serial), JSON.stringify(await cleanOn(serial, o)))
  return on
})
ipcMain.handle('app:info', (_, serial, pkg) => appInfo(serial, pkg))
ipcMain.handle('app:action', (_, serial, pkg, act) => appAction(serial, pkg, act))
ipcMain.handle('device:shot', async (_, serial) => {
  const f = join(app.getPath('pictures'), `Meroro ${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`)
  writeFileSync(f, await screenshot(serial))
  return f
})

// App icons + category from the Google Play listing, cached on disk (system apps simply have none).
const metaDir = () => join(app.getPath('userData'), 'appmeta')
ipcMain.handle('app:meta', async (_, pkg) => {
  if (!/^[\w.]+$/.test(pkg)) return {}
  const f = join(metaDir(), pkg + '.json')
  try { return JSON.parse(readFileSync(f, 'utf8')) } catch {}
  let meta = {}
  try {
    const r = await fetch(`https://play.google.com/store/apps/details?id=${pkg}&hl=en`, { signal: AbortSignal.timeout(8000) })
    if (r.ok) {
      const html = await r.text(), img = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
      meta.cat = html.match(/"applicationCategory":"([A-Z_]+)"/)?.[1] || ''
      if (img) { const i = await fetch(img.replace(/=[^=/]*$/, '') + '=w96-h96', { signal: AbortSignal.timeout(8000) }); if (i.ok) meta.icon = 'data:image/png;base64,' + Buffer.from(await i.arrayBuffer()).toString('base64') }
    } else if (r.status !== 404) return {} // transient: don't cache
  } catch { return {} }
  try { mkdirSync(metaDir(), { recursive: true }); writeFileSync(f, JSON.stringify(meta)) } catch {}
  return meta
})
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
ipcMain.handle('file:pick', async (_, kind, many) => {
  const filters = [kind === 'lut' ? { name: 'LUT', extensions: ['cube'] } : kind === 'image' ? { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] } : kind === 'audio' ? { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] } : { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'm4v'] }]
  const r = (await dialog.showOpenDialog(win, { properties: many ? ['openFile', 'multiSelections'] : ['openFile'], filters })).filePaths
  return many ? r : r[0] || ''
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
const PANE = { camera: 'Camera', microphone: 'Microphone', screen: 'ScreenCapture', network: 'LocalNetwork' }
ipcMain.handle('perm:status', () => Object.fromEntries(['camera', 'microphone', 'screen'].map(k => [k, mac || k !== 'screen' ? systemPreferences.getMediaAccessStatus(k) : 'granted'])))
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
