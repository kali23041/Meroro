// Right-hand panel: Scenes, Sources, per-source properties + grading, and Stream settings.
import { useEffect, useState } from 'react'
import { Radio, Layers, Eye, EyeOff, ExternalLink, Plus, Copy, Trash2, ChevronUp, ChevronDown, SlidersHorizontal, Palette, Clapperboard, Image as ImageIcon, Zap, ArrowRight, MessageSquare, Sparkles, Settings2 } from 'lucide-react'
import { Button, Segmented, Slider, Switch, Select, Input, Row, Section, cx } from './ui'
import { GRADES, PRESETS, SIZES, grade, uid } from './scene'
import { parseCube, setLut } from './gpu'

const api = window.api
const mac = api.platform === 'darwin'
const Color = ({ value, onChange }) => <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="h-6 w-10 shrink-0 rounded bg-transparent border border-white/10 p-0.5" />
const S = ({ label, v, on, min = 0, max = 1, step = 0.01 }) => <Row label={label}><Slider value={v} onChange={on} min={min} max={max} step={step} /></Row>
const icon = 'p-1 rounded text-zinc-500 hover:text-zinc-100 hover:bg-white/10 disabled:opacity-30'

export default function Panel({ s, set, live, busy, media, sel, setSel, focus, apps, mode, part, goPresets, addSource, editScene, editSource }) {
  const [pt, setPt] = useState('move')
  const [showKey, setShowKey] = useState(false), [screens, setScreens] = useState([])
  const scene = s.scenes.find(x => x.id === s.sceneId) || s.scenes[0]
  const upScene = p => set({ scenes: s.scenes.map(x => x.id === scene.id ? { ...x, ...p } : x) })
  const layers = scene.layers, l = layers.find(x => x.id === sel)
  const up = p => upScene({ layers: layers.map(x => x.id === l.id ? { ...x, ...p } : x) })
  const upG = p => up({ grade: { ...l.grade, ...p } })
  const upF = p => up({ fx: { ...l.fx, ...p } })
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
    <aside className={mode ? 'w-full' : 'flex-1 min-h-0 overflow-y-auto p-1.5'}>


      {(part?.split(' ').includes('scene') || part?.split(' ').includes('props')) && <>
        {part?.split(' ').includes('scene') && <><Section icon={Clapperboard} title="Scenes" right={<>
          <button className={icon} title="New scene" onClick={() => editScene('new')}><Plus size={14} /></button>
        </>}>
          <div className="grid grid-cols-2 gap-1.5">
            {s.scenes.map(x => (
              <div key={x.id} className="group/sc relative">
                <button onClick={() => { set({ sceneId: x.id }); setSel('') }}
                  className={cx('w-full h-8 pl-2 pr-7 rounded-md text-left text-[12px] font-medium truncate', x.id === scene.id ? 'bg-accent text-white font-semibold' : 'bg-[#323236] text-zinc-300 hover:bg-[#3a3a3f]')}>{x.name}</button>
                <button title="Scene settings" onClick={() => editScene(x.id)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10 opacity-60 group-hover/sc:opacity-100"><Settings2 size={12} /></button>
              </div>
            ))}
          </div>
          <Button className="w-full h-8" onClick={goPresets}><Sparkles size={12} />Browse presets</Button>
        </Section>

        <Section icon={Layers} title="Sources">
          <Button variant="primary" className="w-full h-8" onClick={() => addSource()}><Plus size={13} />Add source</Button>
          <div className="rounded-lg bg-black/30 border border-white/[0.06] p-1 min-h-9">
            {layers.length === 0 && <div className="py-2 text-center text-[12px] text-zinc-600">Empty scene</div>}
            {[...layers].reverse().map(x => (
              <div key={x.id} onClick={() => setSel(x.id)} className={cx('group flex items-center gap-1 rounded-md pl-1 pr-0.5 h-7', x.id === sel ? 'bg-accent/15 text-white' : 'hover:bg-white/5')}>
                <button className={icon} onClick={e => { e.stopPropagation(); upScene({ layers: layers.map(y => y.id === x.id ? { ...y, visible: !y.visible } : y) }) }}>{x.visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                <span className={cx('flex-1 truncate text-[12px]', !x.visible && 'text-zinc-600')}>{x.name}{x.bgOnly && <span className="ml-1.5 rounded bg-white/10 px-1 text-[9px] text-zinc-400">BACKDROP</span>}</span>
                <button className={icon} onClick={e => { e.stopPropagation(); move(x.id, 1) }}><ChevronUp size={12} /></button>
                <button className={icon} onClick={e => { e.stopPropagation(); move(x.id, -1) }}><ChevronDown size={12} /></button>
                <button className={icon} title="Source settings" onClick={e => { e.stopPropagation(); editSource(x) }}><Settings2 size={12} /></button>
              </div>
            ))}
          </div>
        </Section></>}

        {part?.split(' ').includes('props') && !l && <div className="grid place-items-center p-6 text-center text-[12px] text-zinc-500">Add a source to the scene to edit it here.</div>}
        {part?.split(' ').includes('props') && l && <>
          <Section icon={SlidersHorizontal} title={l.name} right={<button className={icon} title="Source settings" onClick={() => editSource(l)}><Settings2 size={13} /></button>}>
            <Segmented value={pt} onChange={setPt} options={[['move', 'Move'], ['style', 'Style'], ['color', 'Color']]} />
            {l.type === 'lower' && <Button variant="primary" className="w-full h-8" onClick={() => window.__eng?.playLower(l.id)}>▶ Play lower third</Button>}
            {l.type === 'goal' && <div className="flex gap-1"><Button className="flex-1 h-8" onClick={() => up({ cur: Math.max(0, (l.cur || 0) - (l.auto === 'superchat' ? 100 : 1)) })}>−</Button><Button className="flex-1 h-8" onClick={() => up({ cur: (l.cur || 0) + (l.auto === 'superchat' ? 100 : 1) })}>+</Button><Button className="flex-1 h-8" onClick={() => up({ cur: 0 })}>Reset</Button></div>}
            {pt === 'move' && <>
            <div className="flex gap-1.5">
              <Button className="flex-1" onClick={() => up({ x: 0.5, y: 0.5 })}>Center</Button>
              <Button className="flex-1" onClick={() => up({ x: 0.5, y: 0.5, w: 1, h: 1, rot: 0 })}>Fill canvas</Button>
              <Button className="flex-1" onClick={() => up({ flip: !l.flip })}>Flip</Button>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {[['⇤', 'Align left', { x: l.w / 2 }], ['↔', 'Centre horizontally', { x: 0.5 }], ['⇥', 'Align right', { x: 1 - l.w / 2 }], ['⤒', 'Align top', { y: l.h / 2 }], ['↕', 'Centre vertically', { y: 0.5 }], ['⤓', 'Align bottom', { y: 1 - l.h / 2 }]].map(([t, n, p]) =>
                <Button key={n} title={n} className="h-8 px-0 text-[14px]" onClick={() => up(p)}>{t}</Button>)}
            </div>
            {l.type !== 'text' && <S label="Width" v={l.w} on={w => up({ w })} min={0.03} max={1.5} />}
            <S label="Height" v={l.h} on={h => up({ h })} min={0.02} max={1.5} />
            <S label="Position X" v={l.x} on={x => up({ x })} min={-0.2} max={1.2} />
            <S label="Position Y" v={l.y} on={y => up({ y })} min={-0.2} max={1.2} />
            <S label="Rotation" v={l.rot} on={rot => up({ rot })} min={-180} max={180} step={1} />
            </>}{pt === 'style' && <>
            <S label="Opacity" v={l.opacity} on={opacity => up({ opacity })} />
            <S label="Corner radius" v={l.radius} on={radius => up({ radius })} max={0.5} />
            <Row label="Border"><Slider value={l.border} onChange={border => up({ border })} max={24} step={1} /><Color value={l.borderColor} onChange={borderColor => up({ borderColor })} /></Row>
            <S label="Shadow" v={l.shadow} on={shadow => up({ shadow })} />
            {isMedia && ['Crop left', 'Crop top', 'Crop right', 'Crop bottom'].map((t, i) =>
              <S key={t} label={t} v={l.crop[i]} on={v => up({ crop: l.crop.map((c, j) => j === i ? v : c) })} max={0.45} />)}
            </>}
          </Section>

          {pt === 'color' && <Section icon={Palette} title="Color grading">
            <Select value="" onChange={g => up({ grade: grade(g) })} options={[['', 'Apply a look…'], ...Object.keys(GRADES).map(k => [k, k])]} />
            <S label="Brightness" v={l.grade.b} on={b => upG({ b })} min={0.5} max={1.5} />
            <S label="Contrast" v={l.grade.c} on={c => upG({ c })} min={0.5} max={1.6} />
            <S label="Saturation" v={l.grade.s} on={v => upG({ s: v })} max={2} />
            <S label="Hue" v={l.grade.hue} on={hue => upG({ hue })} min={-180} max={180} step={1} />
            <S label="Warmth" v={l.grade.sepia} on={sepia => upG({ sepia })} />
            <S label="Blur" v={l.grade.blur} on={blur => upG({ blur })} max={30} step={1} />
          </Section>}
          {pt === 'color' && isMedia && <Section icon={Palette} title="Green screen & LUT">
            <Row label="Chroma key"><input type="color" value={l.fx?.keyColor || '#00ff00'} onChange={e => upF({ keyColor: e.target.value })} className="h-7 w-10 rounded-md bg-transparent border border-white/10 p-0.5" /><Switch checked={!!l.fx?.keyOn} onChange={keyOn => upF({ keyOn })} /></Row>
            {l.fx?.keyOn && <><S label="Similarity" v={l.fx.sim ?? 0.12} on={sim => upF({ sim })} min={0.01} max={0.4} /><S label="Smoothness" v={l.fx.smooth ?? 0.08} on={smooth => upF({ smooth })} min={0} max={0.3} /></>}
            <Row label="LUT (.cube)"><span className="flex-1 truncate text-[11px] text-zinc-400">{l.fx?.lut?.split(/[\\/]/).pop() || 'None'}</span>
              {l.fx?.lut && <Button variant="ghost" className="px-1.5" onClick={() => upF({ lut: '' })}><Trash2 size={12} /></Button>}
              <Button onClick={async () => { const f = await api.invoke('file:pick', 'lut'); if (f) { try { setLut(f, parseCube(new TextDecoder().decode(await api.invoke('file:read', f)))); upF({ lut: f }) } catch (e) { alert(e.message) } } }}>Choose</Button></Row>
            {l.fx?.lut && <S label="LUT amount" v={l.fx.lutAmt ?? 1} on={lutAmt => upF({ lutAmt })} />}
          </Section>}
        </>}


      </>}

      {mode === 'auto' && <>
        <Section icon={Zap} title="Auto scene switching" right={<Switch checked={!!s.autoSwitch} onChange={autoSwitch => set({ autoSwitch })} />}>
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
          <Row label="Style"><Select className="flex-1" value={s.transType || 'fade'} onChange={transType => set({ transType })} options={[['fade', 'Fade'], ['slide', 'Slide'], ['swipe', 'Swipe / wipe'], ['zoom', 'Zoom'], ['stinger', 'Stinger video']]} /></Row>
          {s.transType === 'stinger' && <Row label="Stinger"><span className="flex-1 truncate text-[11px] text-zinc-400">{s.stinger?.split(/[\\/]/).pop() || 'None'}</span><Button onClick={async () => { const f = await api.invoke('file:pick', 'video'); if (f) set({ stinger: f, trans: s.trans || 700 }) }}>Choose</Button></Row>}
        </Section>
      </>}

      {part?.split(' ').includes('live') && (
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
