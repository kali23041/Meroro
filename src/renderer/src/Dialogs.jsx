// Pop-up windows: source settings (with live preview), scene settings, and the floating chat window.
import { useEffect, useRef, useState } from 'react'
import { Play, RefreshCw, RotateCcw, X, Image as ImageIcon, Smartphone, MessageSquare, BellRing, Globe, Trash2, GripHorizontal, Sparkles, Gamepad2 } from 'lucide-react'
import { Button, Input, Row, Segmented, Select, Switch, Slider, cx } from './ui'
import { SIZES } from './scene'
import { FaceControls } from './Face'
import { SFX } from './sfx'
import { voiceName } from './voice'
import { CAP_STYLES, CAP_LOOKS, CAP_FONTS, CAP_HL, CAP_ANIMS } from './capfx'

const api = window.api
const Color = ({ value, onChange }) => <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="h-7 w-10 shrink-0 rounded-md bg-transparent border border-white/10 p-0.5" />
const MEDIA = ['webcam', 'screen', 'image', 'video', 'browser', 'phone', 'ios']

export function Dialog({ title, onClose, children, footer, className }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div className={cx('pop max-w-[94vw] max-h-[88vh] flex flex-col rounded-2xl border border-white/10 bg-[#1a1a1c] shadow-2xl overflow-hidden', className || 'w-[720px]')}>
        <div className="h-11 shrink-0 flex items-center px-4 border-b border-white/[0.06]">
          <span className="flex-1 text-[13px] font-semibold text-white">{title}</span>
          <Button variant="ghost" className="px-1.5" onClick={onClose}><X size={14} /></Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3">{children}</div>
        {footer && <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-t border-white/[0.06]">{footer}</div>}
      </div>
    </div>
  )
}

// What the source will look like, shown next to its settings.
function Preview({ d, eng, thumb }) {
  const v = useRef(), cv = useRef(), [url, setUrl] = useState('')
  useEffect(() => { // camera
    if (d.type !== 'webcam') return
    let st, on = true
    if (/^(droid|wifi):/.test(d.src || '')) { // phone cameras: show the studio's own live feed
      const E = eng?.current || eng || window.__eng
      const t = setInterval(() => { const x = E?.res?.[d.id]?.el?.srcObject || (d.src.startsWith('wifi:') && E?.wcams?.[d.src.slice(5)]?.stream); if (x && v.current && v.current.srcObject !== x) v.current.srcObject = x }, 400)
      return () => clearInterval(t)
    }
    navigator.mediaDevices.getUserMedia({ video: d.src && d.src !== 'default' ? { deviceId: { exact: d.src } } : true })
      .then(x => { st = x; if (on && v.current) v.current.srcObject = x; else x.getTracks().forEach(t => t.stop()) }).catch(() => {})
    return () => { on = false; st?.getTracks().forEach(t => t.stop()) }
  }, [d.type, d.src])
  useEffect(() => { // image / video file
    if (!['image', 'video'].includes(d.type) || !d.src) return setUrl('')
    let u
    api.invoke('file:read', d.src).then(b => { u = URL.createObjectURL(new Blob([b])); setUrl(u) }).catch(() => {})
    return () => u && URL.revokeObjectURL(u)
  }, [d.type, d.src])
  useEffect(() => { // phone: live frame
    if (d.type !== 'phone' && d.type !== 'ios') return
    const t = setInterval(() => { const f = d.type === 'ios' ? eng.current?.ios.frame : eng.current?.frame, c = cv.current; if (!f || !c) return; c.width = 480; c.height = 480 * f.displayHeight / f.displayWidth; try { c.getContext('2d').drawImage(f, 0, 0, c.width, c.height) } catch {} }, 200)
    return () => clearInterval(t)
  }, [d.type])
  const fit = { contain: 'object-contain', cover: 'object-cover', stretch: 'object-fill' }[d.fit] || 'object-contain'
  const Ic = { phone: Smartphone, ios: Smartphone, chat: MessageSquare, alert: BellRing, browser: Globe }[d.type]
  return (
    <div className="relative aspect-video w-full rounded-xl bg-black overflow-hidden grid place-items-center ring-1 ring-white/10">
      {d.type === 'webcam' && <video ref={v} autoPlay muted playsInline className={cx('absolute inset-0 w-full h-full', fit)} />}
      {d.type === 'screen' && thumb && <img src={thumb} className={cx('absolute inset-0 w-full h-full', fit)} draggable={false} />}
      {d.type === 'image' && url && <img src={url} className={cx('absolute inset-0 w-full h-full', fit)} draggable={false} />}
      {d.type === 'video' && url && <video src={url} autoPlay muted loop className={cx('absolute inset-0 w-full h-full', fit)} />}
      {(d.type === 'phone' || d.type === 'ios') && <canvas ref={cv} className={cx('absolute inset-0 w-full h-full', fit)} />}
      {d.type === 'goal' && <div className="w-[80%] h-8 rounded-full bg-black/60 overflow-hidden relative"><div className="stripes absolute inset-y-0 left-0" style={{ width: Math.min(100, (100 * d.cur) / (d.target || 1)) + '%', background: d.color }} /><span className="absolute inset-0 flex items-center justify-between px-3 text-[12px] font-bold text-white"><span>{d.label}</span><span>{d.prefix}{d.cur} / {d.prefix}{d.target}</span></span></div>}
      {d.type === 'lower' && <div className="absolute left-4 bottom-6 flex items-stretch"><span className="w-1.5" style={{ background: d.color }} /><span className="bg-zinc-900/90 px-3 py-1.5"><span className="block text-[15px] font-extrabold text-white">{d.title}</span><span className="block text-[11px] text-zinc-300">{d.sub}</span></span></div>}
      {d.type === 'mask' && <div className="w-1/2 h-1/3 rounded-lg grid place-items-center text-[11px] text-white/70" style={{ background: d.mode === 'solid' ? d.color : 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)' }}>Hidden on stream</div>}
      {d.type === 'color' && <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${d.color},${d.color2 || d.color})` }} />}
      {d.type === 'text' && <span className="px-4 py-1.5 rounded-full text-[20px] font-bold" style={{ color: d.color, background: d.bgOn ? d.bg : 'transparent' }}>{(d.text || '').replace('{time}', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span>}
      {Ic && <span className="flex flex-col items-center gap-2 text-[12px] text-zinc-500"><Ic size={26} />{d.type === 'phone' ? 'Shows once capture is running' : d.type === 'ios' ? 'Shows once the iPhone is connected' : d.type === 'browser' ? d.src || 'No URL yet' : d.name}</span>}
      {['image', 'video', 'screen', 'webcam'].includes(d.type) && !url && !thumb && d.type !== 'webcam' && <span className="text-[12px] text-zinc-500">Nothing chosen yet</span>}
    </div>
  )
}

// Every setting of a source, used by the source window and, live, by the Props panel.
// Microphone source: the device, level, mute, voice and monitoring live with the mic itself (shared by every scene that shows it).
function MicFields({ d, sx, setx, micList = [] }) {
  const main = d.micId === 'main', m = main ? { device: sx.mic, vol: sx.micVol, mute: sx.micMute, mon: sx.mix?.mic?.mon, voice: sx.voice } : sx.mics?.find(x => x.id === d.micId) || {}
  const up = o => main ? setx({ ...(o.device !== undefined ? { mic: o.device } : {}), ...(o.vol !== undefined ? { micVol: o.vol } : {}), ...(o.mute !== undefined ? { micMute: o.mute } : {}), ...(o.mon !== undefined ? { mix: { ...sx.mix, mic: { ...sx.mix?.mic, mon: o.mon } } } : {}) })
    : setx({ mics: sx.mics.map(x => x.id === d.micId ? { ...x, ...o } : x) })
  return <>
    <Row label="Device"><Select className="flex-1" value={m.device || 'default'} onChange={device => up({ device })} options={[['default', 'System default'], ...micList]} /></Row>
    <Row label="Volume"><Slider value={m.vol ?? 1} onChange={vol => up({ vol })} max={1.5} /></Row>
    <Row label="Muted"><span className="flex-1" /><Switch checked={!!m.mute} onChange={mute => up({ mute })} /></Row>
    <Row label="Voice"><span className="flex-1 truncate text-[12px] text-zinc-300">{voiceName(sx, m.voice)}</span><Button className="h-8" onClick={() => dispatchEvent(new CustomEvent('meroro:voice', { detail: d.micId }))}>Voice changer</Button></Row>
    <Row label="Hear it"><span className="flex-1 text-[11px] text-zinc-500">Use headphones</span><Switch checked={!!m.mon} onChange={mon => up({ mon })} /></Row>
  </>
}

// Which directions the picture can actually move right now (it needs spare room in its box, or a trimmed edge to reveal).
function MoveRoom({ id }) {
  const [r, setR] = useState(null)
  useEffect(() => { const t = setInterval(() => { const g = window.__eng?.geo?.[id]; if (g) setR(o => o && o.x === !!g.canX && o.y === !!g.canY ? o : { x: !!g.canX, y: !!g.canY }) }, 400); return () => clearInterval(t) }, [id])
  if (!r || (r.x && r.y)) return null
  return <p className="text-[10.5px] leading-snug text-amber-300/90">{!r.x && !r.y ? 'The picture fills its box exactly, so there is nothing to move. Zoom in, or use Fit.' : !r.x ? 'Left / right: no room — the picture already fills the width. Up / down works.' : 'Up / down: no room — the picture already fills the height. Left / right works.'}</p>
}

export function SourceFields({ d, up, inline, cams = [], maps = {}, app, front, scenes = [], cap, ready, onRestart, onRefresh, onUseApp, onKeymap, sx, setx, micList, onCapture }) {
  const [shots, setShots] = useState([]), [iosList, setIosList] = useState(null)
  useEffect(() => { if (d.type === 'screen') api.invoke('screen:thumbs').then(setShots).catch(() => {}) }, [d.type])
  useEffect(() => { if (d.type === 'ios') api.invoke('ios:list').then(setIosList).catch(() => {}) }, [d.type])
  return <>
          <Row label="Name"><Input autoFocus={!inline} value={d.name} onChange={e => up({ name: e.target.value })} /></Row>
          {d.type === 'ios' && <Row label="Connection"><Select className="flex-1" value={d.src} onChange={src => up({ src })}
            options={[...(iosList?.usb || []).map(x => ['usb:' + x.id, x.name + ' · USB']), ['airplay', 'AirPlay (wireless)'], ...(d.src?.startsWith('usb:') && !iosList?.usb.some(x => 'usb:' + x.id === d.src) ? [[d.src, d.name + ' · USB (not plugged in)']] : [])]} /></Row>}
          {d.type === 'webcam' && (d.src || '').startsWith('droid:') ? <>
            <Row label="Camera"><Select className="flex-1" value={d.src.split(':')[1]} onChange={f => up({ src: 'droid:' + f + ':' + d.src.split(':').slice(2).join(':') })} options={[['back', 'Back camera'], ['front', 'Front camera'], ['external', 'External camera']]} /></Row>
            <Row label="Rotate"><Select className="flex-1" value={String(d.camRot || 0)} onChange={r => up({ camRot: +r })} options={[['0', 'Landscape (phone on its side)'], ['90', '90°'], ['180', '180°'], ['270', '270°']]} /></Row>
          </> : d.type === 'webcam' && (d.src || '').startsWith('wifi:') ? <Row label="Camera"><span className="flex-1 text-[11px] text-zinc-400">Phone over Wi-Fi. Flip cameras and quality on the phone.</span></Row>
          : d.type === 'webcam' && <Row label="Camera"><Select className="flex-1" value={d.src || 'default'} onChange={src => up({ src })} options={[['default', 'System default'], ...cams]} /></Row>}
          {d.type === 'webcam' && <FaceControls l={d} up={up} />}
          {d.type === 'screen' && <Row label="Capture"><Select className="flex-1" value={d.src || ''} onChange={src => up({ src, name: shots.find(x => x.id === src)?.name || d.name })}
            options={[['', 'Choose screen or window…'], ...shots.map(x => [x.id, x.name]), ...(d.src && !shots.some(x => x.id === d.src) ? [[d.src, d.name]] : [])]} /></Row>}
          {(d.type === 'image' || d.type === 'video') && <Row label="File">
            <span className="flex-1 truncate text-[12px] text-zinc-400">{d.src?.split(/[\\/]/).pop() || 'None'}</span>
            <Button onClick={async () => { const src = await api.invoke('file:pick', d.type); if (src) up({ src }) }}><ImageIcon size={12} />Choose</Button>
          </Row>}
          {d.type === 'browser' && <Row label="URL"><Input value={d.src || ''} onChange={e => up({ src: e.target.value.trim() })} placeholder="https://… (alerts, widgets)" /></Row>}
          {d.type === 'text' && <>
            <Row label="Text"><Input value={d.text} onChange={e => up({ text: e.target.value })} placeholder="{time} shows the clock" /></Row>
            <Row label="Text color"><Color value={d.color} onChange={color => up({ color })} /></Row>
            <Row label="Pill"><Color value={d.bg} onChange={bg => up({ bg })} /><Switch checked={d.bgOn} onChange={bgOn => up({ bgOn })} /></Row>
          </>}
          {d.type === 'color' && <Row label="Colors"><Color value={d.color} onChange={color => up({ color })} /><Color value={d.color2} onChange={color2 => up({ color2 })} /></Row>}
          {d.type === 'phone' && <>
            <Row label="Landscape lock"><span className="flex-1 text-[11px] text-zinc-500">When the phone turns upright</span><Switch checked={!!d.landLock} onChange={landLock => up({ landLock })} /></Row>
            {d.landLock && <>
              <Row label="Then show"><Select className="flex-1" value={d.landScene || ''} onChange={landScene => up({ landScene })}
                options={[['', 'Hide the phone screen (cover)'], ...scenes.filter(x => !x.layers?.some(l => l.id === d.id)).map(x => [x.id, 'Scene: ' + x.name])]} /></Row>
              <p className="text-[11px] leading-relaxed text-zinc-500">Goes back by itself when the phone turns sideways again. Tip: a “Be right back” scene from Browse presets → Studio works well here.</p>
            </>}
          </>}
          {d.type === 'phone' && sx && onCapture && <>
            <Row label="Capture quality"><Select className="flex-1" value={String(sx.maxSize)} onChange={v => onCapture({ maxSize: +v })} options={[[0, 'Native (sharpest)'], [2560, '1440p / 2K'], [1920, '1080p'], [1600, '900p'], [1280, '720p']].map(([v, n]) => [String(v), n])} /></Row>
            <Row label="Capture fps"><Select className="flex-1" value={String(sx.capFps)} onChange={v => onCapture({ capFps: +v })} options={[[120, '120 fps'], [90, '90 fps'], [60, '60 fps'], [30, '30 fps']].map(([v, n]) => [String(v), n])} /></Row>
            <Row label="Capture bitrate"><Select className="flex-1" value={String(sx.capBitrate)} onChange={v => onCapture({ capBitrate: +v })} options={[[4, '4 Mbps'], [8, '8 Mbps'], [12, '12 Mbps'], [16, '16 Mbps'], [24, '24 Mbps'], [32, '32 Mbps'], [40, '40 Mbps']].map(([v, n]) => [String(v), n])} /></Row>
          </>}
          {(d.type === 'webcam' && !(d.src || '').startsWith('wifi:') || d.type === 'screen') && <>
            <Row label={d.type === 'webcam' ? 'Camera quality' : 'Max resolution'}><Select className="flex-1" value={d.res || (d.type === 'webcam' ? '720' : '')} onChange={res => up({ res })}
              options={d.type === 'webcam' ? [['720', '720p'], ['1080', '1080p'], ['1440', '1440p / 2K'], ['2160', '4K']] : [['', 'Native (sharpest)'], ['2160', '4K'], ['1440', '1440p / 2K'], ['1080', '1080p']]} /></Row>
            <Row label="Frame rate"><Select className="flex-1" value={String(d.capFps || 30)} onChange={v => up({ capFps: +v })} options={[['30', '30 fps'], ['60', '60 fps']]} /></Row>
          </>}
          {d.type === 'video' && <>
            <Row label="Play its sound"><span className="flex-1 text-[11px] text-zinc-500">Into the stream and your speakers</span><Switch checked={!!d.sound} onChange={sound => up({ sound })} /></Row>
            {d.sound && <Row label="Sound volume"><Slider value={d.vol ?? 1} onChange={vol => up({ vol })} max={1.5} /></Row>}
            <Row label="Loop"><span className="flex-1" /><Switch checked={d.loop !== false} onChange={loop => up({ loop })} /></Row>
          </>}
          {MEDIA.includes(d.type) && <>
            <Row label="Zoom"><Slider value={d.zoom ?? 1} onChange={zoom => up({ zoom })} min={0.5} max={3} step={0.01} format={v => v.toFixed(2) + '×'} />
              <Button className="h-8 px-2" disabled={(d.zoom ?? 1) === 1} title="Back to 1×" onClick={() => up({ zoom: 1, zx: 0.5, zy: 0.5 })}><RotateCcw size={12} /></Button></Row>
            <Row label="Move inside"><div className="flex-1 flex items-center gap-1.5">
              <div className="grid grid-cols-3 gap-0.5">{[['', 0, 0], ['↑', 0, -1], ['', 0, 0], ['←', -1, 0], ['•', 0, 0], ['→', 1, 0], ['', 0, 0], ['↓', 0, 1], ['', 0, 0]].map(([t, x, y], i) => t
                ? <button key={i} title={t === '•' ? 'Centre' : 'Move ' + { '↑': 'up', '↓': 'down', '←': 'left', '→': 'right' }[t]} onClick={() => up(t === '•' ? { zx: 0.5, zy: 0.5 } : { zx: Math.min(1, Math.max(0, (d.zx ?? 0.5) + x * 0.05)), zy: Math.min(1, Math.max(0, (d.zy ?? 0.5) + y * 0.05)) })}
                  className="size-7 grid place-items-center rounded-md bg-[#323236] text-[12px] text-zinc-200 hover:bg-[#3e3e43]">{t}</button> : <span key={i} />)}</div>
              <div className="flex-1 min-w-0 space-y-1"><MoveRoom id={d.id} /><Slider value={d.zx ?? 0.5} onChange={zx => up({ zx })} format={v => v < 0.48 ? 'Left ' + Math.round((0.5 - v) * 200) : v > 0.52 ? 'Right ' + Math.round((v - 0.5) * 200) : 'Centre'} />
                <Slider value={d.zy ?? 0.5} onChange={zy => up({ zy })} format={v => v < 0.48 ? 'Up ' + Math.round((0.5 - v) * 200) : v > 0.52 ? 'Down ' + Math.round((v - 0.5) * 200) : 'Centre'} /></div>
            </div></Row>
            <p className="-mt-0.5 text-[10.5px] text-zinc-500">Zoomed in: picks which part shows. Picture smaller than its box (Fit, or zoomed out): moves it inside the box.</p>
          </>}
          {MEDIA.includes(d.type) && <Row label="Fit"><div className="flex-1"><Segmented value={d.fit} onChange={fit => up({ fit })} options={[['contain', 'Fit'], ['cover', 'Fill'], ['stretch', 'Stretch']]} /></div></Row>}
          {d.type === 'lower' && <>
            <Row label="Title"><Input value={d.title} onChange={e => up({ title: e.target.value })} /></Row>
            <Row label="Second line"><Input value={d.sub} onChange={e => up({ sub: e.target.value })} placeholder="@handle · Live now" /></Row>
            <Row label="Style"><div className="flex-1"><Segmented value={d.style} onChange={style => up({ style })} options={[['bar', 'Bar'], ['pill', 'Pill'], ['clean', 'Clean']]} /></div></Row>
            <Row label="Colour"><Color value={d.color} onChange={color => up({ color })} /></Row>
            <Row label="Stays for"><Select className="flex-1" value={String(d.hold)} onChange={v => up({ hold: +v })} options={[['4', '4 s'], ['6', '6 s'], ['10', '10 s'], ['20', '20 s'], ['0', 'Until hidden']]} /></Row>
          </>}
          {d.type === 'caption' && <>
            <Row label="Style preset"><Select className="flex-1" value={d.preset || ''} onChange={v => { const st = CAP_STYLES.find(x => x.name === v); if (st) { const { name, ...look } = st; up({ ...look, preset: name }) } }} options={[['', 'Custom'], ...CAP_STYLES.map(x => [x.name, x.name])]} /></Row>
            <Row label="Look"><Select className="flex-1" value={d.style} onChange={style => up({ style, preset: '' })} options={CAP_LOOKS} /></Row>
            <Row label="Font"><Select className="flex-1" value={d.font || 'sys'} onChange={font => up({ font, preset: '' })} options={CAP_FONTS} /></Row>
            <Row label="Text / back"><Color value={d.color} onChange={color => up({ color, preset: '' })} /><Color value={d.bg} onChange={bg => up({ bg, preset: '' })} /></Row>
            <Row label="New word"><Select className="flex-1" value={d.hlMode || 'none'} onChange={hlMode => up({ hlMode, preset: '' })} options={CAP_HL} /><Color value={d.hl || '#facc15'} onChange={hl => up({ hl, preset: '' })} /></Row>
            <Row label="Animation"><Select className="flex-1" value={d.anim || 'none'} onChange={anim => up({ anim, preset: '' })} options={CAP_ANIMS} /></Row>
            <Row label="Lines"><div className="flex-1"><Segmented value={String(d.lines)} onChange={v => up({ lines: +v })} options={[['1', '1'], ['2', '2'], ['3', '3']]} /></div></Row>
            <Row label="CAPITALS"><span className="flex-1" /><Switch checked={!!d.upper} onChange={upper => up({ upper })} /></Row>
            <Row label="Clears after"><Select className="flex-1" value={String(d.hold)} onChange={v => up({ hold: +v })} options={[['2', '2 s of silence'], ['4', '4 s of silence'], ['8', '8 s of silence']]} /></Row>
          </>}
          {d.type === 'goal' && <>
            <Row label="Label"><Input value={d.label} onChange={e => up({ label: e.target.value })} /></Row>
            <Row label="Counts"><Select className="flex-1" value={d.auto} onChange={auto => up({ auto })} options={[['superchat', 'Super Chat amount'], ['member', 'New members'], ['chat', 'Chat messages'], ['manual', 'Manual']]} /></Row>
            <Row label="Now / target"><Input type="number" value={d.cur} onChange={e => up({ cur: +e.target.value })} /><span className="text-zinc-500">/</span><Input type="number" value={d.target} onChange={e => up({ target: +e.target.value })} /></Row>
            <Row label="Prefix"><Input value={d.prefix} onChange={e => up({ prefix: e.target.value })} placeholder="₹" /></Row>
            <Row label="Colour"><Color value={d.color} onChange={color => up({ color })} /></Row>
          </>}
          {d.type === 'mask' && <>
            <Row label="Hide with"><div className="flex-1"><Segmented value={d.mode} onChange={mode => up({ mode })} options={[['blur', 'Blur'], ['pixel', 'Pixelate'], ['solid', 'Solid']]} /></div></Row>
            {d.mode === 'solid' ? <Row label="Colour"><Color value={d.color} onChange={color => up({ color })} /></Row>
              : <Row label="Strength"><Slider value={d.amount} onChange={amount => up({ amount })} /></Row>}
          </>}
          {d.type === 'scene' && <Row label="Scene"><Select className="flex-1" value={d.src} onChange={src => up({ src, name: scenes.find(x => x.id === src)?.name || d.name })} options={[['', 'Choose a scene…'], ...scenes.map(x => [x.id, x.name])]} /></Row>}
          {d.type === 'chat' && <>
            <Row label="Style"><div className="flex-1"><Segmented value={d.chatStyle || 'classic'} onChange={chatStyle => up({ chatStyle })} options={[['classic', 'Classic'], ['bubble', 'Bubble'], ['minimal', 'Minimal'], ['game', 'Game']]} /></div></Row>
            <Row label="Fade out"><Select className="flex-1" value={String(d.chatFade || 0)} onChange={v => up({ chatFade: +v })} options={[['0', 'Never'], ['10', 'After 10 s'], ['20', 'After 20 s'], ['45', 'After 45 s']]} /></Row>
          </>}
          {d.type === 'mic' && sx && <MicFields d={d} sx={sx} setx={setx} micList={micList} onCapture={onCapture} />}
          {d.type === 'sound' && <>
            <Row label="Sound"><Select className="flex-1" value={d.sfx} onChange={sfx => { up({ sfx }); window.__eng?.playSfx(sfx, d.vol ?? 1) }} options={SFX} />
              <Button className="h-8" onClick={() => window.__eng?.playSfx(d.sfx, d.vol ?? 1)}><Play size={12} />Play</Button></Row>
            <Row label="Volume"><Slider value={d.vol ?? 1} onChange={vol => up({ vol })} max={1.5} /></Row>
            <p className="text-[11px] text-zinc-500">Plays on the Effects channel whenever the effect it belongs to plays.</p>
          </>}
          <Row label="Visible"><Switch checked={d.visible} onChange={visible => up({ visible })} /></Row>
          {d.type === 'phone' && <Row label="Capture"><span className={cx('flex-1 flex items-center gap-1.5 text-[12px]', cap === 'on' ? 'text-emerald-400' : ready ? 'text-zinc-400' : 'text-amber-300')}>
            <span className={cx('size-1.5 rounded-full', cap === 'on' ? 'bg-emerald-400' : cap === 'starting' ? 'bg-amber-400 animate-pulse' : 'bg-zinc-500')} />{!ready ? 'No phone connected' : cap === 'on' ? 'Running' : cap === 'starting' ? 'Starting…' : 'Stopped'}</span>
            <Button className="h-8" onClick={onRefresh} title="Look for the phone and reload its apps"><RefreshCw size={12} />Refresh</Button>
            <Button className="h-8" disabled={!ready} onClick={onRestart} title="Stop and start capture again"><RotateCcw size={12} />Restart</Button></Row>}
          {d.type === 'phone' && <Row label="App"><span className="flex-1 min-w-0 truncate text-[12px] text-zinc-300">{d.pkg ? d.name : 'Whole phone screen'}</span>
            <Button className="h-8" disabled={!front || front.pkg === d.pkg} title={front ? 'Switch this source to ' + front.name : 'Open an app on the phone first'} onClick={() => { up({ pkg: front.pkg, name: front.name }); onUseApp?.(front.pkg) }}>
              <Smartphone size={12} />{front ? 'Use ' + front.name : 'No app open'}</Button></Row>}
          {d.type === 'phone' && <>
            <div className="pt-2 flex items-center gap-1.5 text-[12px] font-semibold text-white"><Gamepad2 size={13} />Game controls</div>
            <Row label={`For ${d.pkg ? d.name : app?.name || 'this app'}`}><Select className="flex-1 min-w-0" value={d.keymap || ''} onChange={keymap => onKeymap ? onKeymap(keymap) : up({ keymap })}
              options={[['', 'Off · no key mapping'], ...Object.entries(maps).map(([k, m]) => [k, m.name + ' preset'])]} /></Row>
          </>}
  </>
}

export function SourceDialog({ layer, isNew, cams, eng, onSave, onDelete, onClose, maps, app, mapFor, scenes = [], cap, ready, onRestart, onRefresh, front, onUseApp, sx, setx, micList, onCapture }) {
  const [d, setD] = useState({ ...layer, keymap: layer.type === 'phone' ? mapFor(layer.pkg || app?.pkg) : undefined }), [shots, setShots] = useState([])
  const up = p => setD(o => ({ ...o, ...p }))
  useEffect(() => { if (d.type === 'screen') api.invoke('screen:thumbs').then(setShots).catch(() => {}) }, [])
  const thumb = shots.find(x => x.id === d.src)?.thumb
  const [iosList, setIosList] = useState(null)
  useEffect(() => { if (d.type === 'ios') api.invoke('ios:list').then(setIosList).catch(() => {}) }, [])
  return (
    <Dialog title={isNew ? `Add ${d.name.toLowerCase()}` : `${d.name} settings`} onClose={onClose}
      footer={<>
        {!isNew && <Button variant="ghost" className="text-red-400" onClick={() => { onDelete(d.id); onClose() }}><Trash2 size={13} />Remove</Button>}
        <div className="flex-1" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" className="px-4" onClick={() => { onSave(d); onClose() }}>{isNew ? 'Add source' : 'Save'}</Button>
      </>}>
      <div className="flex gap-3">
        <div className="w-[340px] shrink-0"><Preview d={d} eng={eng} thumb={thumb} /></div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <SourceFields d={d} up={up} cams={cams} maps={maps} app={app} front={front} scenes={scenes} cap={cap} ready={ready} onRestart={onRestart} onRefresh={onRefresh} onUseApp={onUseApp} sx={sx} setx={setx} micList={micList} />
        </div>
      </div>
    </Dialog>
  )
}

export function SceneDialog({ scene, isNew, canvas, canDelete, onSave, onDelete, onClose, pickBg, current, onPreset, onSize, count, busy }) {
  const [d, setD] = useState(scene), [from, setFrom] = useState('empty'), [size, setSize] = useState(canvas), [ask, setAsk] = useState(false)
  const up = p => setD(o => ({ ...o, ...p }))
  const [w, h] = size.split('x').map(Number), others = count - (isNew ? 0 : 1)
  const srcs = (from === 'copy' ? current.layers : d.layers).filter(x => MEDIA.includes(x.type) && x.type !== 'phone')
  const save = () => { if (size !== canvas && others > 0 && !ask) return setAsk(true); if (size !== canvas) onSize(size); onSave(isNew && from === 'copy' ? { ...d, layers: current.layers.map(x => ({ ...x, id: Math.random().toString(36).slice(2, 9) })) } : d); onClose() }
  return (
    <Dialog title={isNew ? 'New scene' : `${d.name} settings`} onClose={onClose} className="w-[680px]"
      footer={<>
        {isNew && <Button onClick={() => { onClose(); onPreset() }}><Sparkles size={13} />Use a preset…</Button>}
        {!isNew && <Button variant="ghost" className="text-red-400" disabled={!canDelete} onClick={() => { onDelete(d.id); onClose() }}><Trash2 size={13} />Delete scene</Button>}
        <div className="flex-1" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" className="px-4" onClick={save}>{isNew ? 'Create scene' : 'Save'}</Button>
      </>}>
      <div className="flex gap-3">
        <div className="w-[300px] shrink-0">
          <div className="w-full rounded-xl ring-1 ring-white/10 grid place-items-center overflow-hidden" style={{ aspectRatio: w / h, maxHeight: 300, background: d.bg2 ? `linear-gradient(135deg,${d.bg},${d.bg2})` : d.bg }}>
            <span className="text-[13px] font-semibold text-white/80">{d.name}</span>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-zinc-500">Frame size {w}×{h}</p>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <Row label="Name"><Input autoFocus value={d.name} onChange={e => up({ name: e.target.value })} /></Row>
          {isNew && <Row label="Start from"><div className="flex-1"><Segmented value={from} onChange={setFrom} options={[['empty', 'Empty'], ['copy', `Copy “${current.name}”`]]} /></div></Row>}
          <Row label="Background"><Color value={d.bg} onChange={bg => up({ bg })} /></Row>
          <Row label="Gradient"><Color value={d.bg2 || d.bg} onChange={bg2 => up({ bg2 })} /><Switch checked={!!d.bg2} onChange={v => up({ bg2: v ? '#3f3f46' : '' })} /></Row>
          <Row label="Blurred backdrop"><Switch checked={!!d.bgBlur} onChange={bgBlur => up({ bgBlur })} /></Row>
          {d.bgBlur && <Row label="Blur from"><Select className="flex-1" value={srcs.some(x => x.id === d.bgSrc) ? d.bgSrc : ''} onChange={v => v === '__pick' ? (onClose(), pickBg()) : up({ bgSrc: v })}
            options={[['', 'Phone'], ...srcs.map(x => [x.id, x.name]), ...(isNew ? [] : [['__pick', 'Choose a screen or window…']])]} /></Row>}
        </div>
      </div>
      {ask && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50" onPointerDown={e => e.target === e.currentTarget && setAsk(false)}>
        <div className="pop w-[380px] rounded-2xl border border-white/10 bg-[#1a1a1c] p-4 shadow-2xl">
          <div className="text-[14px] font-semibold text-white">Change the size of every scene?</div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">All scenes share one size. Switching to {w}×{h} also changes {others} other scene{others > 1 ? 's' : ''}.</p>
          <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setAsk(false)}>Cancel</Button><Button variant="primary" className="px-4" onClick={save}>Yes, change all</Button></div>
        </div>
      </div>}
    </Dialog>
  )
}

// YouTube chat in its own small window that floats over the studio and can be dragged anywhere.
export function FloatChat({ pos, onMove, onClose, children }) {
  const [p, setP] = useState(pos || { x: innerWidth - 400, y: 90 }), drag = useRef()
  return (
    <div className="pop fixed z-40 w-[340px] rounded-2xl border border-white/10 bg-[#1a1a1c]/95 backdrop-blur-xl shadow-2xl overflow-hidden" style={{ left: p.x, top: p.y }}>
      <div className="h-9 flex items-center gap-2 px-3 border-b border-white/[0.06] cursor-grab active:cursor-grabbing"
        onPointerDown={e => { if (e.target.closest('button')) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = [e.clientX - p.x, e.clientY - p.y] }}
        onPointerMove={e => drag.current && setP({ x: Math.max(0, Math.min(innerWidth - 340, e.clientX - drag.current[0])), y: Math.max(0, Math.min(innerHeight - 60, e.clientY - drag.current[1])) })}
        onPointerUp={() => { if (drag.current) { drag.current = null; onMove(p) } }}>
        <GripHorizontal size={13} className="text-zinc-500" /><span className="flex-1 text-[12px] font-semibold text-white">YouTube chat</span>
        <button onClick={onClose} className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10"><X size={12} /></button>
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}
