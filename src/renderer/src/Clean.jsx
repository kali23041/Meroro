// Clean screen: hide notifications, Game Booster pop-ups and apps drawn on top of the phone screen while streaming.
import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, Settings2, Check } from 'lucide-react'
import { Button, Row, Switch, cx } from './ui'
import { Dialog } from './Dialogs'
import { AppIcon } from './Library'

const api = window.api
const DEF = { dnd: true, headsUp: true, overlays: true, samsung: true, keep: [], auto: false }

export default function CleanScreen({ serial, ready, s, set, apps, meta, live }) {
  const o = { ...DEF, ...s.clean }, [on, setOn] = useState(false), [busy, setBusy] = useState(false), [open, setOpen] = useState(false), [list, setList] = useState(null), auto = useRef(false)
  const up = p => set({ clean: { ...o, ...p } })
  useEffect(() => { setOn(false); if (ready) api.invoke('clean:status', serial).then(setOn).catch(() => {}) }, [serial, ready])
  const toggle = async (want = !on, opts = o) => {
    setBusy(true)
    try { setOn(await api.invoke('clean:set', serial, want, opts)) } catch {} // the streamed app is hidden too unless it's set to stay on top
    setBusy(false)
  }
  useEffect(() => { // optional: turn on when going live, back off when the stream ends
    if (!o.auto || !ready) return
    if (live === 'on' && !on) { auto.current = true; toggle(true) } else if (!live && auto.current && on) { auto.current = false; toggle(false) }
  }, [live])
  useEffect(() => { if (open && ready) { setList(null); api.invoke('clean:apps', serial).then(setList).catch(() => setList([])) } }, [open])
  const name = p => apps?.find(a => a.pkg === p)?.name || p

  return <>
    <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04]">
      <Button variant="ghost" disabled={!ready || busy} title={on ? 'Clean screen is on: notifications, pop-ups and overlays are hidden' : 'Hide notifications, pop-ups and overlays on the phone'}
        className={cx('px-2', on && 'text-white bg-white/10')} onClick={() => toggle()}><ShieldCheck size={14} className={on ? 'text-emerald-400' : ''} />{busy ? '…' : on ? 'Clean' : 'Clean'}</Button>
      <Button variant="ghost" className="px-1.5" title="Clean screen settings" onClick={() => setOpen(true)}><Settings2 size={13} /></Button>
    </div>
    {open && <Dialog title="Clean screen while streaming" onClose={() => setOpen(false)} className="w-[560px]"
      footer={<><span className={cx('flex items-center gap-1.5 text-[12px]', on ? 'text-emerald-400' : 'text-zinc-500')}>{on ? <><Check size={13} />On now</> : 'Off'}</span><div className="flex-1" />
        {on && <Button onClick={() => toggle(true)} disabled={busy}>Re-apply</Button>}
        <Button variant="primary" className="px-4" disabled={!ready || busy} onClick={() => toggle()}>{busy ? 'Working…' : on ? 'Turn off' : 'Turn on'}</Button></>}>
      <div className="space-y-1.5">
        <Row label="Do Not Disturb"><Switch checked={o.dnd} onChange={dnd => up({ dnd })} /></Row>
        <Row label="Pop-up notifications off"><Switch checked={o.headsUp} onChange={headsUp => up({ headsUp })} /></Row>
        <Row label="Samsung game mode"><span className="text-[11px] text-zinc-500 truncate">No interruptions, no Game Booster icon, Bixby and edge blocked</span><Switch checked={o.samsung} onChange={samsung => up({ samsung })} /></Row>
        <Row label="Block apps on top"><span className="text-[11px] text-zinc-500 truncate">Bubbles, floating windows, “Allow display over other apps”</span><Switch checked={o.overlays} onChange={overlays => up({ overlays })} /></Row>
        <Row label="Auto when live"><span className="text-[11px] text-zinc-500 truncate">Turn on with Go Live, off when the stream ends</span><Switch checked={o.auto} onChange={auto => up({ auto })} /></Row>
        {o.overlays && <div className="pt-2">
          <div className="mb-1.5 text-[12px] font-semibold text-white">Apps allowed on top of the screen</div>
          <div className="max-h-[220px] overflow-y-auto rounded-xl bg-[#242427] p-1">
            {list === null ? <div className="p-4 text-center text-[12px] text-zinc-500">Reading the phone…</div>
              : !list.length ? <div className="p-4 text-center text-[12px] text-zinc-500">No app is allowed to draw on top.</div>
              : list.map(p => { const keep = o.keep.includes(p); return (
                <div key={p} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                  <AppIcon app={{ pkg: p, name: name(p) }} meta={meta} size={28} />
                  <span className="flex-1 min-w-0"><span className="block truncate text-[12px] text-zinc-100">{name(p)}</span><span className="block truncate text-[10px] text-zinc-500">{keep ? 'Stays on top' : 'Hidden while clean'}{p === s.pkg ? ' · streaming now' : ''}</span></span>
                  <Switch checked={!keep} onChange={hide => up({ keep: hide ? o.keep.filter(x => x !== p) : [...o.keep, p] })} />
                </div>) })}
          </div>
        </div>}
      </div>
    </Dialog>}
  </>
}
