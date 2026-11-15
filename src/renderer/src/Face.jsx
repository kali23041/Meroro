// Webcam face features (face tracking, zoom, talk zoom, blur, away-hide) and edge fade — shared by Properties and source settings.
import { Row, Segmented, Slider, Switch } from './ui'
import { FACE_ON } from './scene'
const ok = typeof FaceDetector !== 'undefined'

export function FaceControls({ l, up }) {
  const f = l.face || {}, set = p => up({ face: { ...FACE_ON, ...f, ...p } })
  return <>
    <Row label="Face tracking"><span className="flex-1 text-[11px] text-zinc-500">{ok ? 'Follows your face' : 'Not available on this computer'}</span><Switch checked={!!f.on} onChange={on => set({ on })} /></Row>
    {f.on && <>
      <Row label="Keep centered"><span className="flex-1" /><Switch checked={f.center !== false} onChange={center => set({ center })} /></Row>
      <Row label="Zoom"><Slider value={f.zoom ?? 1} onChange={zoom => set({ zoom })} min={1} max={3} format={v => v.toFixed(2) + '×'} /></Row>
      <Row label="Auto zoom to face"><span className="flex-1" /><Switch checked={!!f.auto} onChange={auto => set({ auto })} /></Row>
      {f.auto && <Row label="Face size"><Slider value={f.size ?? 0.42} onChange={size => set({ size })} min={0.2} max={0.8} /></Row>}
      <Row label="Zoom when talking"><div className="flex-1"><Segmented value={String(f.talk || 0)} onChange={v => set({ talk: +v })} options={[['0', 'Off'], ['1.15', 'Soft'], ['1.3', 'Medium'], ['1.5', 'Strong']]} /></div></Row>
      <Row label="Head room"><Slider value={f.head ?? 0.12} onChange={head => set({ head })} min={-0.3} max={0.5} /></Row>
      <Row label="Follow speed"><Slider value={f.smooth ?? 0.08} onChange={smooth => set({ smooth })} min={0.02} max={0.3} /></Row>
      <Row label="Blur my face"><span className="flex-1 text-[11px] text-zinc-500">Privacy</span><Switch checked={!!f.blur} onChange={blur => set({ blur })} /></Row>
      <Row label="Hide when away"><span className="flex-1 text-[11px] text-zinc-500">Fades out with no face for 3 s</span><Switch checked={!!f.hide} onChange={hide => set({ hide })} /></Row>
    </>}
  </>
}

export function FadeControls({ l, up }) {
  const fd = l.fade || [0, 0, 0, 0]
  return ['Fade left', 'Fade right', 'Fade top', 'Fade bottom'].map((t, i) =>
    <Row key={t} label={t}><Slider value={fd[i]} onChange={v => up({ fade: fd.map((c, j) => j === i ? v : c) })} max={0.8} /></Row>)
}
