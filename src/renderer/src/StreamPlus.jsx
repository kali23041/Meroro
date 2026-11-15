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

export default function StreamPlus({ s, set, hist, live, game, busy, xst = {} }) {
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
    <Section icon={Type} title="Stream title">
      <Row label="Template"><Input value={s.titleTpl || '{game} live 🔴 | {date}'} onChange={e => set({ titleTpl: e.target.value })} /></Row>
      <div className="rounded-lg bg-black/25 px-2 py-1.5 text-[12px] text-zinc-200 truncate" title={title}>{title}</div>
      <Row label="Copy on game change"><Switch checked={!!s.autoTitle} onChange={autoTitle => set({ autoTitle })} /></Row>
      <div className="grid grid-cols-2 gap-1">
        <Button className="h-8" onClick={() => navigator.clipboard.writeText(title)}><Copy size={12} />Copy title</Button>
        <Button className="h-8" onClick={() => { navigator.clipboard.writeText(title); s.dest === 'twitch' ? window.open('https://dashboard.twitch.tv/stream-manager') : api.invoke('yt:studio') }}><ExternalLink size={12} />Edit on {s.dest === 'twitch' ? 'Twitch' : 'YouTube'}</Button>
      </div>
    </Section>
  </>
}
