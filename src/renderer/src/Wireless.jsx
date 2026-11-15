// Wireless debugging: discovered phones, pairing (Android 11+), manual connect, and USB → Wi-Fi.
import { useEffect, useRef, useState } from 'react'
import { Wifi, Link2, KeyRound, Check, AlertTriangle, Loader2, QrCode, RefreshCw } from 'lucide-react'
import { Button, Input, Segmented, cx } from './ui'

const api = window.api
const clean = e => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export default function Wireless({ serial, usbReady, compact }) {
  const [tab, setTab] = useState(usbReady ? 'connect' : 'qr'), [addr, setAddr] = useState(''), [pairAddr, setPairAddr] = useState(''), [code, setCode] = useState('')
  const [st, setSt] = useState(null), [found, setFound] = useState([])
  useEffect(() => {
    let on = true
    const scan = () => api.invoke('adb:mdns').then(f => on && setFound(f)).catch(() => {})
    scan()
    const t = setInterval(scan, 3000)
    return () => { on = false; clearInterval(t) }
  }, [])
  const run = async (fn, ...a) => {
    setSt({ busy: true, text: 'Working…' })
    try { setSt({ ok: true, text: await api.invoke(fn, ...a) }); return true } catch (e) { setSt({ bad: true, text: clean(e) }); return false }
  }
  const pair = async () => { if (await run('adb:pair', pairAddr, code)) { setTab('connect'); setCode('') } }

  return (
    <div className={cx('space-y-2', !compact && 'rounded-xl bg-white/[0.03] border border-white/[0.06] p-4')}>
      {!compact && <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500"><Wifi size={13} />Wireless connection</div>}
      {usbReady && <Button className="w-full h-8" disabled={st?.busy} onClick={() => run('adb:wireless', serial)}><Wifi size={13} />Switch this phone to Wi-Fi</Button>}
      {found.filter(f => !f.pair).map(f => (
        <div key={f.addr} className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-2 h-8">
          <Wifi size={12} className="text-emerald-300 shrink-0" /><span className="flex-1 min-w-0 truncate text-[11px]">{f.name.replace(/^adb-|-\w+$/g, '')} · {f.addr}</span>
          <Button className="h-6 px-2" disabled={st?.busy} onClick={() => run('adb:connect', f.addr)}>Connect</Button>
        </div>
      ))}
      <Segmented value={tab} onChange={setTab} options={[['qr', 'QR code', QrCode], ['pair', 'Pair code', KeyRound], ['connect', 'Connect', Link2]]} />
      {tab === 'qr' ? <QrPair /> : tab === 'connect' ? <div className="flex gap-1.5">
        <Input value={addr} onChange={e => setAddr(e.target.value)} onKeyDown={e => e.key === 'Enter' && addr && run('adb:connect', addr)} placeholder="192.168.1.20:37415" />
        <Button disabled={!addr || st?.busy} onClick={() => run('adb:connect', addr)}>Connect</Button>
      </div> : <>
        <div className="flex gap-1.5">
          <Input value={pairAddr} onChange={e => setPairAddr(e.target.value)} placeholder="Pairing IP:port" />
          <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Code" className="w-[84px]" />
        </div>
        <Button className="w-full" disabled={!pairAddr || code.length < 6 || st?.busy} onClick={pair}><KeyRound size={12} />Pair</Button>
        {found.filter(f => f.pair).map(f => <button key={f.addr} onClick={() => setPairAddr(f.addr)} className="block text-[11px] text-violet-300 hover:text-violet-200">Use discovered pairing address {f.addr}</button>)}
      </>}
      {st && <div className={cx('flex gap-1.5 text-[11px] leading-snug', st.bad ? 'text-red-400' : st.ok ? 'text-emerald-400' : 'text-zinc-400')}>
        {st.busy ? <Loader2 size={12} className="animate-spin shrink-0 mt-px" /> : st.bad ? <AlertTriangle size={12} className="shrink-0 mt-px" /> : <Check size={12} className="shrink-0 mt-px" />}<span>{st.text}</span>
      </div>}
      {st?.bad && /Local Network/.test(st.text) && <Button className="w-full" onClick={() => api.invoke('perm:open', 'network')}>Open Local Network settings</Button>}
    </div>
  )
}

// Pair with a QR code, like Android Studio: Wireless debugging → Pair device with QR code.
export function QrPair() {
  const [q, setQ] = useState(null), [st, setSt] = useState(null), cur = useRef('')
  const make = async () => {
    setSt(null); setQ(null)
    try {
      const r = await api.invoke('adb:qr'); cur.current = r.name; setQ(r)
      const text = await api.invoke('adb:qr:wait', r.name)
      if (cur.current === r.name) setSt({ ok: true, text })
    } catch (e) { if (cur.current) setSt({ bad: true, text: clean(e) }) }
  }
  useEffect(() => { make(); return () => { cur.current = ''; api.invoke('adb:qr:cancel') } }, [])
  return <div className="flex gap-3 items-start">
    <div className="relative size-[132px] shrink-0 rounded-xl bg-white p-1.5">
      {q ? <img src={q.img} className={cx('size-full', st?.ok && 'opacity-20')} draggable={false} /> : <Loader2 size={18} className="absolute inset-0 m-auto animate-spin text-zinc-400" />}
      {st?.ok && <Check size={40} className="absolute inset-0 m-auto text-emerald-500" />}
    </div>
    <div className="min-w-0 flex-1 space-y-1.5 text-[11px] leading-snug text-zinc-400">
      <ol className="list-decimal pl-4 space-y-0.5">
        <li>Phone and computer on the same Wi-Fi.</li>
        <li>On the phone: <b className="text-zinc-200">Developer options → Wireless debugging → Pair device with QR code</b>.</li>
        <li>Scan this code. Meroro pairs and connects by itself.</li>
      </ol>
      {!st ? q && <div className="flex items-center gap-1.5 text-zinc-300"><Loader2 size={11} className="animate-spin" />Waiting for the phone…</div>
        : <div className={cx('flex gap-1.5', st.bad ? 'text-red-400' : 'text-emerald-400')}>{st.bad ? <AlertTriangle size={12} className="shrink-0 mt-px" /> : <Check size={12} className="shrink-0 mt-px" />}<span>{st.text}</span></div>}
      <button onClick={make} className="flex items-center gap-1 text-zinc-300 hover:text-white"><RefreshCw size={11} />New code</button>
    </div>
  </div>
}
