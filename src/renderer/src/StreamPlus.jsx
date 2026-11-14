// Stream tab extras: health graph, reconnect + adaptive bitrate, a second (vertical) output, and stream title helper.
import { Activity, ShieldCheck, RectangleVertical, Type, ExternalLink, Copy } from 'lucide-react'
import { Button, Input, Row, Section, Select, Switch } from './ui'

const api = window.api
export const titleFor = (s, game) => (s.titleTpl || '{game} live 🔴 | {date}').replace('{game}', game || 'Mobile gaming').replace('{date}', new Date().toLocaleDateString([], { day: 'numeric', month: 'short' }))

function Graph({ hist, max }) {
  const W = 290, H = 64, pt = (v, i) => `${(i / 59) * W},${H - 4 - Math.min(1, v / max) * (H - 8)}`
  const line = k => hist.map((h, i) => pt(h[k] || 0, i + 60 - hist.length)).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 rounded-lg bg-black/25">
    <polyline points={line('kbps')} fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    <polyline points={hist.map((h, i) => pt((h.speed || 0) * max * 0.9, i + 60 - hist.length)).join(' ')} fill="none" stroke="#f97316" strokeOpacity=".8" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
  </svg>
}

export default function StreamPlus({ s, set, hist, live, game, busy }) {
  const o2 = { on: false, sceneId: '', size: '1080x1920', dest: 'youtube', key: '', url: '', bitrate: 6000, ...s.out2 }, up2 = p => set({ out2: { ...o2, ...p } })
  const c = hist.at(-1), drops = c ? c.drop - (hist.at(-30)?.drop || 0) : 0, bad = c && (c.speed < 0.95 || drops > 10)
  const title = titleFor(s, game)
  return <>
    <Section icon={Activity} title="Stream health">
      {!live ? <div className="text-[11px] text-zinc-500">Shows once you are live.</div> : <>
        <Graph hist={hist} max={Math.max(1000, (s.bitrate || 4500) * 1.3)} />
        <div className="grid grid-cols-4 gap-1 text-center">{[['kbps', Math.round(c?.kbps || 0)], ['fps', c?.fps || 0], ['speed', (c?.speed || 0).toFixed(2) + '×'], ['dropped', drops]].map(([k, v]) =>
          <div key={k} className="rounded-md bg-black/25 py-1"><div className="text-[13px] font-semibold tabular-nums text-zinc-100">{v}</div><div className="text-[10px] text-zinc-500">{k}</div></div>)}</div>
        <div className={bad ? 'text-[11px] text-orange-300' : 'text-[11px] text-emerald-400'}>{bad ? 'Your upload or encoder can’t keep up — lower the bitrate or turn on auto bitrate.' : 'Healthy'}</div>
      </>}
    </Section>
    <Section icon={ShieldCheck} title="Reliability">
      <Row label="Auto-reconnect"><Switch checked={s.reconnect !== false} onChange={reconnect => set({ reconnect })} /></Row>
      <Row label="Auto bitrate"><Switch checked={!!s.autoBitrate} onChange={autoBitrate => set({ autoBitrate })} /></Row>
    </Section>
    <Section icon={RectangleVertical} title="Second output" right={<Switch checked={o2.on} onChange={on => up2({ on })} />}>
      {o2.on && <>
        <Row label="Scene"><Select className="flex-1" value={o2.sceneId} onChange={sceneId => up2({ sceneId })} options={[['', 'Choose a scene…'], ...s.scenes.map(x => [x.id, x.name])]} /></Row>
        <Row label="Size"><Select className="flex-1" disabled={busy} value={o2.size} onChange={size => up2({ size })} options={[['1080x1920', 'Vertical 1080×1920'], ['720x1280', 'Vertical 720×1280'], ['1080x1350', 'Portrait 4:5'], ['1080x1080', 'Square'], ['1920x1080', 'Horizontal 1080p']]} /></Row>
        <Row label="Send to"><Select className="flex-1" disabled={busy} value={o2.dest} onChange={dest => up2({ dest })} options={[['youtube', 'YouTube (another key)'], ['custom', 'Custom RTMP (TikTok, Instagram…)']]} /></Row>
        {o2.dest === 'custom' && <Row label="Server"><Input disabled={busy} value={o2.url} onChange={e => up2({ url: e.target.value })} placeholder="rtmp://…" /></Row>}
        <Row label="Stream key"><Input disabled={busy} type="password" value={o2.key} onChange={e => up2({ key: e.target.value })} placeholder="key for the second stream" /></Row>
        <Row label="Bitrate"><Select className="flex-1" disabled={busy} value={o2.bitrate} onChange={bitrate => up2({ bitrate: +bitrate })} options={[[3000, '3000 kbps'], [4500, '4500 kbps'], [6000, '6000 kbps']]} /></Row>
      </>}
    </Section>
    <Section icon={Type} title="Stream title">
      <Row label="Template"><Input value={s.titleTpl || '{game} live 🔴 | {date}'} onChange={e => set({ titleTpl: e.target.value })} /></Row>
      <div className="rounded-lg bg-black/25 px-2 py-1.5 text-[12px] text-zinc-200 truncate" title={title}>{title}</div>
      <Row label="Copy on game change"><Switch checked={!!s.autoTitle} onChange={autoTitle => set({ autoTitle })} /></Row>
      <div className="grid grid-cols-2 gap-1">
        <Button className="h-8" onClick={() => navigator.clipboard.writeText(title)}><Copy size={12} />Copy title</Button>
        <Button className="h-8" onClick={() => { navigator.clipboard.writeText(title); s.dest === 'custom' && /twitch/.test(s.customUrl) ? window.open('https://dashboard.twitch.tv/stream-manager') : api.invoke('yt:studio') }}><ExternalLink size={12} />Edit on {s.dest === 'custom' && /twitch/.test(s.customUrl) ? 'Twitch' : 'YouTube'}</Button>
      </div>
    </Section>
  </>
}
