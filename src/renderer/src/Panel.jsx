// Right-hand panel: Scenes, Sources, per-source properties + grading, and Stream settings.
import { useEffect, useState } from 'react'
import { Radio, Layers, Eye, EyeOff, ExternalLink, Plus, Copy, Trash2, ChevronUp, ChevronDown, SlidersHorizontal, Palette, Clapperboard, Image as ImageIcon, Zap, ArrowRight } from 'lucide-react'
import { Button, Segmented, Slider, Switch, Select, Input, Row, Section, cx } from './ui'
import { TYPES, GRADES, PRESETS, grade, newLayer, uid } from './scene'

const api = window.api
const mac = api.platform === 'darwin'
const Color = ({ value, onChange }) => <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="h-6 w-10 shrink-0 rounded bg-transparent border border-white/10 p-0.5" />
const S = ({ label, v, on, min = 0, max = 1, step = 0.01 }) => <Row label={label}><Slider value={v} onChange={on} min={min} max={max} step={step} /></Row>
const icon = 'p-1 rounded text-zinc-500 hover:text-zinc-100 hover:bg-white/10 disabled:opacity-30'

export default function Panel({ s, set, live, busy, media, sel, setSel, focus, apps }) {
  const [tab, setTab] = useState('scene'), [showKey, setShowKey] = useState(false), [screens, setScreens] = useState([])
  const scene = s.scenes.find(x => x.id === s.sceneId) || s.scenes[0]
  const upScene = p => set({ scenes: s.scenes.map(x => x.id === scene.id ? { ...x, ...p } : x) })
  const layers = scene.layers, l = layers.find(x => x.id === sel)
  const up = p => upScene({ layers: layers.map(x => x.id === l.id ? { ...x, ...p } : x) })
  const upG = p => up({ grade: { ...l.grade, ...p } })
  const move = (id, d) => { // d = +1 towards the top
    const i = layers.findIndex(x => x.id === id), j = i + d
    if (j < 0 || j >= layers.length) return
    const n = [...layers]; [n[i], n[j]] = [n[j], n[i]]
    upScene({ layers: n })
  }
  const addScene = sc => set({ scenes: [...s.scenes, sc], sceneId: sc.id })
  const preset = name => { const r = PRESETS[name](); set({ scenes: [...s.scenes, r.scene], sceneId: r.scene.id, ...(busy ? {} : r.set) }) }
  const isMedia = l && !['text', 'color'].includes(l.type)
  useEffect(() => { if (l?.type === 'screen') api.invoke('screen:list').then(setScreens).catch(() => {}) }, [l?.id])

  return (
    <aside className="w-[310px] shrink-0 border-l border-white/[0.06] overflow-y-auto bg-zinc-900/40">
      <div className="p-3 pb-0"><Segmented value={tab} onChange={setTab} options={[['scene', 'Scene', Layers], ['auto', 'Auto', Zap], ['stream', 'Stream', Radio]]} /></div>

      {tab === 'scene' && <>
        <Section icon={Clapperboard} title="Scenes" right={<>
          <button className={icon} title="New scene" onClick={() => addScene({ id: uid(), name: 'Scene ' + (s.scenes.length + 1), bg: '#0b0b0f', bg2: '', bgBlur: false, layers: [] })}><Plus size={13} /></button>
          <button className={icon} title="Duplicate" onClick={() => addScene({ ...scene, id: uid(), name: scene.name + ' copy', layers: layers.map(x => ({ ...x, id: uid() })) })}><Copy size={12} /></button>
          <button className={icon} title="Delete" disabled={s.scenes.length < 2} onClick={() => { const n = s.scenes.filter(x => x.id !== scene.id); set({ scenes: n, sceneId: n[0].id }) }}><Trash2 size={12} /></button>
        </>}>
          <div className="grid grid-cols-2 gap-1.5">
            {s.scenes.map(x => (
              <button key={x.id} onClick={() => { set({ sceneId: x.id }); setSel('') }}
                className={cx('h-8 px-2 rounded-md text-[12px] font-medium truncate border', x.id === scene.id ? 'bg-violet-500/20 border-violet-400/50 text-white' : 'bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:text-zinc-100')}>{x.name}</button>
            ))}
          </div>
          <Row label="Name"><Input value={scene.name} onChange={e => upScene({ name: e.target.value })} /></Row>
          <Select value="" onChange={preset} options={[['', 'Add scene from preset…'], ...Object.keys(PRESETS).map(k => [k, k])]} />
        </Section>

        <Section icon={Layers} title="Sources">
          <Select value="" onChange={t => { const n = newLayer(t); upScene({ layers: [...layers, n] }); setSel(n.id) }} options={[['', 'Add source…'], ...TYPES]} />
          <div className="rounded-lg bg-black/30 border border-white/[0.06] p-1 min-h-9">
            {layers.length === 0 && <div className="py-2 text-center text-[12px] text-zinc-600">Empty scene</div>}
            {[...layers].reverse().map(x => (
              <div key={x.id} onClick={() => setSel(x.id)} className={cx('group flex items-center gap-1 rounded-md pl-1 pr-0.5 h-7', x.id === sel ? 'bg-violet-500/20' : 'hover:bg-white/5')}>
                <button className={icon} onClick={e => { e.stopPropagation(); upScene({ layers: layers.map(y => y.id === x.id ? { ...y, visible: !y.visible } : y) }) }}>{x.visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                <span className={cx('flex-1 truncate text-[12px]', !x.visible && 'text-zinc-600')}>{x.name}</span>
                <button className={icon} onClick={e => { e.stopPropagation(); move(x.id, 1) }}><ChevronUp size={12} /></button>
                <button className={icon} onClick={e => { e.stopPropagation(); move(x.id, -1) }}><ChevronDown size={12} /></button>
                <button className={icon} onClick={e => { e.stopPropagation(); upScene({ layers: layers.filter(y => y.id !== x.id) }) }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500">Drag a source on the preview to move it, drag a corner to resize, scroll to scale.</p>
        </Section>

        {l && <>
          <Section icon={SlidersHorizontal} title={`${l.name} · properties`}>
            <Row label="Name"><Input value={l.name} onChange={e => up({ name: e.target.value })} /></Row>
            {l.type === 'webcam' && <Row label="Camera"><Select className="flex-1" value={l.src || ''} onChange={src => up({ src })} options={[['', 'Choose…'], ['default', 'System default'], ...media.cams]} /></Row>}
            {l.type === 'screen' && <Row label="Capture"><Select className="flex-1" value={l.src || ''} onChange={src => up({ src })} options={[['', 'Choose screen or window…'], ...screens]} /></Row>}
            {(l.type === 'image' || l.type === 'video') && <Row label="File">
              <span className="flex-1 truncate text-[11px] text-zinc-500">{l.src?.split(/[\\/]/).pop() || 'None'}</span>
              <Button onClick={async () => { const src = await api.invoke('file:pick', l.type); if (src) up({ src }) }}><ImageIcon size={12} />Choose</Button>
            </Row>}
            {l.type === 'browser' && <Row label="URL"><Input defaultValue={l.src} placeholder="https://… (alerts, chat, widgets)" onKeyDown={e => e.key === 'Enter' && up({ src: e.target.value.trim() })} onBlur={e => up({ src: e.target.value.trim() })} /></Row>}
            {l.type === 'text' && <>
              <Row label="Text"><Input value={l.text} onChange={e => up({ text: e.target.value })} placeholder="{time} shows the clock" /></Row>
              <Row label="Text color"><Color value={l.color} onChange={color => up({ color })} /></Row>
              <Row label="Pill"><Color value={l.bg} onChange={bg => up({ bg })} /><Switch checked={l.bgOn} onChange={bgOn => up({ bgOn })} /></Row>
            </>}
            {l.type === 'color' && <Row label="Colors"><Color value={l.color} onChange={color => up({ color })} /><Color value={l.color2} onChange={color2 => up({ color2 })} /></Row>}
            {isMedia && <Row label="Fit"><div className="flex-1"><Segmented value={l.fit} onChange={fit => up({ fit })} options={[['contain', 'Fit'], ['cover', 'Fill'], ['stretch', 'Stretch']]} /></div></Row>}
            <div className="flex gap-1.5">
              <Button className="flex-1" onClick={() => up({ x: 0.5, y: 0.5 })}>Center</Button>
              <Button className="flex-1" onClick={() => up({ x: 0.5, y: 0.5, w: 1, h: 1, rot: 0 })}>Fill canvas</Button>
              <Button className="flex-1" onClick={() => up({ flip: !l.flip })}>Flip</Button>
            </div>
            {l.type !== 'text' && <S label="Width" v={l.w} on={w => up({ w })} min={0.03} max={1.5} />}
            <S label="Height" v={l.h} on={h => up({ h })} min={0.02} max={1.5} />
            <S label="Position X" v={l.x} on={x => up({ x })} min={-0.2} max={1.2} />
            <S label="Position Y" v={l.y} on={y => up({ y })} min={-0.2} max={1.2} />
            <S label="Rotation" v={l.rot} on={rot => up({ rot })} min={-180} max={180} step={1} />
            <S label="Opacity" v={l.opacity} on={opacity => up({ opacity })} />
            <S label="Corner radius" v={l.radius} on={radius => up({ radius })} max={0.5} />
            <Row label="Border"><Slider value={l.border} onChange={border => up({ border })} max={24} step={1} /><Color value={l.borderColor} onChange={borderColor => up({ borderColor })} /></Row>
            <S label="Shadow" v={l.shadow} on={shadow => up({ shadow })} />
            {isMedia && ['Crop left', 'Crop top', 'Crop right', 'Crop bottom'].map((t, i) =>
              <S key={t} label={t} v={l.crop[i]} on={v => up({ crop: l.crop.map((c, j) => j === i ? v : c) })} max={0.45} />)}
          </Section>

          <Section icon={Palette} title="Color grading">
            <Select value="" onChange={g => up({ grade: grade(g) })} options={[['', 'Apply a look…'], ...Object.keys(GRADES).map(k => [k, k])]} />
            <S label="Brightness" v={l.grade.b} on={b => upG({ b })} min={0.5} max={1.5} />
            <S label="Contrast" v={l.grade.c} on={c => upG({ c })} min={0.5} max={1.6} />
            <S label="Saturation" v={l.grade.s} on={v => upG({ s: v })} max={2} />
            <S label="Hue" v={l.grade.hue} on={hue => upG({ hue })} min={-180} max={180} step={1} />
            <S label="Warmth" v={l.grade.sepia} on={sepia => upG({ sepia })} />
            <S label="Blur" v={l.grade.blur} on={blur => upG({ blur })} max={30} step={1} />
          </Section>
        </>}

        <Section icon={Palette} title="Background">
          <Row label="Color"><Color value={scene.bg} onChange={bg => upScene({ bg })} /></Row>
          <Row label="Gradient to"><Color value={scene.bg2 || scene.bg} onChange={bg2 => upScene({ bg2 })} /><Switch checked={!!scene.bg2} onChange={v => upScene({ bg2: v ? '#7c3aed' : '' })} /></Row>
          <Row label="Blurred phone"><Switch checked={scene.bgBlur} onChange={bgBlur => upScene({ bgBlur })} /></Row>
        </Section>
      </>}

      {tab === 'auto' && <>
        <Section icon={Zap} title="Auto scene switching" right={<Switch checked={!!s.autoSwitch} onChange={autoSwitch => set({ autoSwitch })} />}>
          <p className="text-[11px] leading-relaxed text-zinc-500">When you switch apps on the phone, Meroro switches to the matching scene by itself.</p>
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 h-8">
            <span className={cx('size-2 rounded-full', focus ? 'bg-emerald-400 live-dot' : 'bg-zinc-600')} />
            <span className="text-[11px] text-zinc-500">On phone:</span>
            <span className="truncate text-[12px] font-medium">{!focus ? 'No phone' : /launcher/i.test(focus) ? 'Home screen' : apps?.find(a => a.pkg === focus)?.name || focus}</span>
          </div>
          {(s.rules || []).map(r => (
            <div key={r.id} className="flex items-center gap-1">
              <Select className="flex-1 min-w-0" value={r.pkg} onChange={pkg => set({ rules: s.rules.map(x => x.id === r.id ? { ...x, pkg } : x) })}
                options={[['', 'App…'], ['__home', 'Home screen'], ...(apps || []).filter(a => !a.system || a.pkg === r.pkg).map(a => [a.pkg, a.name]),
                  ...(r.pkg && r.pkg !== '__home' && !apps?.some(a => a.pkg === r.pkg) ? [[r.pkg, r.pkg]] : [])]} />
              <ArrowRight size={12} className="text-zinc-500 shrink-0" />
              <Select className="flex-1 min-w-0" value={r.sceneId} onChange={sceneId => set({ rules: s.rules.map(x => x.id === r.id ? { ...x, sceneId } : x) })}
                options={[['', 'Scene…'], ...s.scenes.map(x => [x.id, x.name])]} />
              <button className={icon} onClick={() => set({ rules: s.rules.filter(x => x.id !== r.id) })}><Trash2 size={12} /></button>
            </div>
          ))}
          <Button className="w-full" onClick={() => set({ rules: [...(s.rules || []), { id: uid(), pkg: focus && !/launcher/i.test(focus) ? focus : focus ? '__home' : '', sceneId: scene.id }] })}>
            <Plus size={12} />{focus ? 'Add rule for what’s on the phone now' : 'Add rule'}
          </Button>
          <Row label="Anything else"><Select className="flex-1" value={s.fallbackScene || ''} onChange={fallbackScene => set({ fallbackScene })}
            options={[['', 'Keep current scene'], ...s.scenes.map(x => [x.id, x.name])]} /></Row>
        </Section>
        <Section icon={Clapperboard} title="Transitions & hotkeys">
          <Row label="Transition"><Select className="flex-1" value={s.trans} onChange={trans => set({ trans: +trans })}
            options={[[0, 'Cut'], [300, 'Fade · fast'], [700, 'Fade · smooth'], [1200, 'Fade · slow']]} /></Row>
          <p className="text-[11px] text-zinc-500">{mac ? '⌘' : 'Ctrl+'}1 – {mac ? '⌘' : 'Ctrl+'}9 switch scenes. {mac ? '⌘' : 'Ctrl+'}R starts/stops recording.</p>
        </Section>
      </>}

      {tab === 'stream' && (
        <Section icon={Radio} title="Stream">
          <Row label="Destination"><Select className="flex-1" disabled={!!live} value={s.dest} onChange={dest => set({ dest })} options={[['youtube', 'YouTube Live'], ['custom', 'Custom RTMP']]} /></Row>
          {s.dest === 'custom' && <Row label="Server"><Input disabled={!!live} value={s.customUrl} onChange={e => set({ customUrl: e.target.value })} placeholder="rtmp://live.example.com/app" /></Row>}
          <Row label="Stream key">
            <Input disabled={!!live} type={showKey ? 'text' : 'password'} value={s.key} onChange={e => set({ key: e.target.value })} placeholder="xxxx-xxxx-xxxx-xxxx" />
            <Button variant="ghost" className="px-1.5" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={13} /> : <Eye size={13} />}</Button>
          </Row>
          {s.dest === 'youtube' && (
            <button onClick={() => window.open('https://www.youtube.com/live_dashboard')} className="flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200">
              <ExternalLink size={11} />Get your key in YouTube Studio
            </button>
          )}
          <Row label="Canvas"><Select className="flex-1" disabled={busy} value={s.canvas} onChange={c => set({ canvas: c })}
            options={[['1920x1080', 'Landscape 1080p'], ['1280x720', 'Landscape 720p'], ['1080x1920', 'Vertical 1080×1920']]} /></Row>
          <Row label="Bitrate"><Select className="flex-1" disabled={!!live} value={s.bitrate} onChange={bitrate => set({ bitrate })}
            options={[[2500, '2500 kbps · 720p'], [4500, '4500 kbps · 1080p'], [6000, '6000 kbps · 1080p'], [9000, '9000 kbps · 1080p60']]} /></Row>
          <Row label="Frame rate"><Select className="flex-1" disabled={busy} value={s.fps} onChange={fps => set({ fps: +fps })} options={[[30, '30 fps'], [60, '60 fps']]} /></Row>
          <Row label="Encoder"><Select className="flex-1" disabled={!!live} value={s.encoder} onChange={encoder => set({ encoder })}
            options={[...(mac ? [['hw', 'Hardware (VideoToolbox)']] : []), ['x264', 'Software (x264)']]} /></Row>
        </Section>
      )}
    </aside>
  )
}
