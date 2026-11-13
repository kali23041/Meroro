// Device page: phone details, live status and quick actions.
import { useEffect, useState } from 'react'
import { Smartphone, BatteryCharging, Battery, Thermometer, HardDrive, Monitor, Cpu, Camera, Home, ChevronLeft, Square, Wifi, Usb, FolderOpen, AppWindow } from 'lucide-react'
import { Button, Input, cx } from './ui'
import { AppIcon } from './Library'
import Wireless from './Wireless'

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
      <p className="text-[12px] text-zinc-500 mb-5">Your phone's details and quick actions</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {devices.map(d => (
          <button key={d.serial} onClick={() => setSerial(d.serial)} className={cx('flex items-center gap-2 h-9 px-3 rounded-lg border text-[12px]', d.serial === serial ? 'bg-white/[0.14] border-white/30 text-white' : 'border-white/[0.08] text-zinc-400 hover:text-white')}>
            {d.wifi ? <Wifi size={13} /> : <Usb size={13} />}{d.model}<span className={cx('size-1.5 rounded-full', d.state === 'device' ? 'bg-emerald-400' : 'bg-amber-400')} />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-4 items-start">
      <div className="min-w-0">
      {!dev ? <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-zinc-500">No phone connected. Plug in over USB with USB debugging on and tap Allow, or connect wirelessly on the right.</div> : <>
        <div className="flex items-center gap-4 rounded-xl bg-gradient-to-br from-violet-500/15 to-pink-500/10 border border-white/[0.08] p-5 mb-4">
          <div className="size-14 rounded-2xl bg-white/10 grid place-items-center"><Smartphone size={26} /></div>
          <div className="flex-1">
            <div className="text-[18px] font-semibold text-white">{info?.maker ? `${info.maker[0].toUpperCase() + info.maker.slice(1)} ${dev.model}` : dev.model}</div>
            <div className="text-[12px] text-zinc-400">{info ? `Android ${info.android} · API ${info.sdk} · ${dev.wifi ? 'Wi-Fi' : 'USB'}` : ready ? 'Reading device…' : 'Tap “Allow” on the phone'}</div>
          </div>
          {front && <div className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2">
            <AppIcon app={front} meta={meta} size={28} />
            <div><div className="text-[10px] uppercase tracking-wider text-zinc-500">Open now</div><div className="text-[12px] font-medium">{front.name}</div></div>
          </div>}
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          <Stat icon={info?.charging ? BatteryCharging : Battery} label="Battery" value={info && info.battery + '%'} sub={info?.charging ? 'Charging' : 'On battery'} bar={info?.battery} tone={info?.battery < 20 ? 'bg-red-400' : 'bg-emerald-400'} />
          <Stat icon={Thermometer} label="Temperature" value={info && info.temp.toFixed(1) + '°C'} sub={info?.temp > 42 ? 'Hot — streaming may throttle' : 'Normal'} />
          <Stat icon={HardDrive} label="Storage" value={info?.storage.free && info.storage.free + ' free'} sub={info?.storage.size && `${info.storage.used} of ${info.storage.size} used`} bar={info?.storage.pct} />
          <Stat icon={Monitor} label="Screen" value={info?.screen?.replace('x', ' × ')} sub={info?.abi && <span className="inline-flex items-center gap-1"><Cpu size={11} />{info.abi}</span>} />
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">Quick actions</div>
          <div className="flex flex-wrap gap-2">
            <Button className="h-9" disabled={!ready} onClick={shot}><Camera size={14} />Save screenshot</Button>
            <Button className="h-9" disabled={!ready} onClick={() => api.send('ctl', { t: 'key', code: 3 })}><Home size={14} />Home</Button>
            <Button className="h-9" disabled={!ready} onClick={() => api.send('ctl', { t: 'key', code: 4 })}><ChevronLeft size={14} />Back</Button>
            <Button className="h-9" disabled={!ready} onClick={() => api.send('ctl', { t: 'key', code: 187 })}><Square size={12} />Recent apps</Button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">Home, Back and Recent apps work while capture is running.</p>
        </div>
      </>}
      </div>
      <Wireless serial={serial} usbReady={ready && !dev?.wifi} />
      </div>
    </div>
  )
}
