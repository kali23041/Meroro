// Device page: phone details, live status and quick actions.
import { useEffect, useState } from 'react'
import { Smartphone, BatteryCharging, Battery, Thermometer, HardDrive, Monitor, Cpu, Camera, Home, ChevronLeft, Square, Wifi, Usb, FolderOpen, AppWindow } from 'lucide-react'
import { Button, Input, cx } from './ui'
import { AppIcon } from './Library'
import Wireless from './Wireless'
import { StatCards } from './Perf'

const api = window.api

function Stat({ icon: Icon, label, value, sub, bar, tone = 'bg-violet-400' }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500"><Icon size={13} />{label}</div>
      <div className="mt-2 text-[20px] font-semibold text-white tabular-nums">{value ?? '—'}</div>
      {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
      {bar != null && <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className={cx('h-full rounded-full', tone)} style={{ width: bar + '%' }} /></div>}
    </div>
  )
}

export default function Device({ devices, serial, setSerial, ready, focus, apps, meta, onNote }) {
  const [info, setInfo] = useState(null)
  const dev = devices.find(d => d.serial === serial)
  useEffect(() => {
    setInfo(null)
    if (!ready) return
    const load = () => api.invoke('device:info', serial).then(setInfo).catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [serial, ready])
  const front = apps?.find(a => a.pkg === focus)
  const shot = () => api.invoke('device:shot', serial).then(file => onNote({ text: 'Screenshot saved to Pictures', file })).catch(e => onNote({ text: String(e.message || e), bad: true }))

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
      <h1 className="text-[20px] font-bold tracking-tight text-white">Device</h1>
      <p className="text-[12px] text-zinc-500 mb-5">Live performance of your phone</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {devices.map(d => (
          <button key={d.serial} onClick={() => setSerial(d.serial)} className={cx('flex items-center gap-2 h-9 px-3 rounded-lg border text-[12px]', d.serial === serial ? 'bg-white/[0.14] border-white/30 text-white' : 'border-white/[0.08] text-zinc-400 hover:text-white')}>
            {d.wifi ? <Wifi size={13} /> : <Usb size={13} />}{d.model}<span className={cx('size-1.5 rounded-full', d.state === 'device' ? 'bg-emerald-400' : 'bg-amber-400')} />
          </button>
        ))}
      </div>

      <StatCards serial={serial} ready={ready} info={info} />
      {!dev && <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-zinc-500">No phone connected. Plug in over USB with USB debugging on and tap Allow, or connect by Wi-Fi from the Phone tab in Studio.</div>}
    </div>
  )
}
