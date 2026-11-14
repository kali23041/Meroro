// Live phone performance strip under the preview: CPU, GPU, RAM, temperatures, battery and capture FPS, each with a sparkline.
import { useEffect, useRef, useState } from 'react'
import { Cpu, Gauge, MemoryStick, Thermometer, BatteryCharging, Battery, Film, Activity, HardDrive, Percent, Zap, Flame } from 'lucide-react'
import { cx } from './ui'

const api = window.api
const N = 30

// Striped fill bar with a thin end marker; turns orange when the value is too high.
export function Bar({ pct, warn, className }) {
  const w = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className={cx('relative h-2.5 w-full rounded-[4px] bg-white/[0.08] overflow-hidden', className)}>
      <div className={cx('stripes absolute inset-y-0 left-0 rounded-[4px] transition-[width] duration-700 ease-out', warn ? 'bg-orange-500' : 'bg-zinc-400')} style={{ width: w + '%' }} />
      <div className={cx('absolute inset-y-0 w-[2px] -ml-px transition-[left] duration-700 ease-out', warn ? 'bg-orange-300' : 'bg-zinc-200')} style={{ left: w + '%', opacity: w ? 1 : 0 }} />
    </div>
  )
}

function Tile({ icon: Icon, label, value, unit, pct, warn }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl bg-[#242427] px-2.5 py-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 whitespace-nowrap">
        <span className="flex-1 truncate">{label}</span>
        <span className={cx('text-[12px] normal-case tracking-normal font-semibold tabular-nums', warn ? 'text-orange-300' : 'text-zinc-100')}>{value ?? '—'}<span className="ml-0.5 text-[10px] font-medium text-zinc-500">{value != null && unit}</span></span>
      </div>
      <Bar pct={pct} warn={warn} />
    </div>
  )
}

// Polls the phone's performance every 1.5 s and keeps the last N readings.
export function usePerf(serial, ready, eng) {
  const [h, setH] = useState([]), last = useRef({ n: 0, t: performance.now() })
  useEffect(() => {
    setH([])
    if (!ready) return
    let on = true
    const tick = async () => {
      const p = await api.invoke('device:perf', serial).catch(() => null)
      const n = eng?.current?.nframes || 0, t = performance.now(), fps = Math.round(((n - last.current.n) * 1000) / (t - last.current.t))
      last.current = { n, t }
      if (on && p) setH(o => [...o.slice(1 - N), { ...p, fps }])
    }
    tick(); const id = setInterval(tick, 1500)
    return () => { on = false; clearInterval(id) }
  }, [serial, ready])
  return h
}

export default function Perf({ serial, ready, eng }) {
  const h = usePerf(serial, ready, eng)
  const c = h.at(-1) || {}, col = k => h.map(x => x[k] || 0)
  const r1 = v => v == null || Number.isNaN(v) ? null : Math.round(v)
  return (
    <div className="shrink-0 flex gap-1.5 p-1.5 rounded-2xl border border-white/[0.06] bg-[#1b1b1d]">
      <Tile icon={Cpu} label="CPU" value={r1(c.cpu)} unit="%" pct={c.cpu} warn={c.cpu > 85} />
      <Tile icon={Gauge} label="GPU" value={r1(c.gpu)} unit="%" pct={c.gpu} warn={c.gpu > 90} />
      <Tile icon={MemoryStick} label="RAM" value={c.ramUsed ? c.ramUsed.toFixed(1) : null} unit="GB" pct={c.ramTotal && (100 * c.ramUsed) / c.ramTotal} warn={c.ramUsed / c.ramTotal > 0.9} />
      <Tile icon={Thermometer} label="CPU°" value={r1(c.cpuTemp) || null} unit="°C" pct={(c.cpuTemp - 25) * 100 / 65} warn={c.cpuTemp > 70} />
      <Tile icon={Thermometer} label="BAT°" value={c.batTemp ? c.batTemp.toFixed(1) : null} unit="°C" pct={(c.batTemp - 20) * 100 / 30} warn={c.batTemp > 42} />
      <Tile icon={c.charging ? BatteryCharging : Battery} label="BAT" value={r1(c.battery) || null} unit="%" pct={c.battery} warn={c.battery < 15 && !c.charging} />
      <Tile icon={Film} label="FPS" value={ready && h.length ? c.fps : null} unit="fps" pct={(c.fps || 0) * 100 / 60} />
    </div>
  )
}

// ---------- big stat cards for the Device page ----------
function Wave({ data, max, label }) {
  if (data.length < 2) return <div className="w-[96px] h-[44px]" />
  const W = 96, H = 34, p = data.map((v, i) => [(i / (data.length - 1)) * W, 4 + (H - 8) * (1 - Math.min(v, max) / max)])
  const d = p.map(([x, y], i) => i ? `S${(x + p[i - 1][0]) / 2},${y} ${x},${y}` : `M${x},${y}`).join(' '), [lx, ly] = p.at(-1)
  return (
    <div className="relative w-[96px] h-[44px]">
      <svg width={W} height={H} className="overflow-visible">
        <defs><linearGradient id="wv" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity=".7" /></linearGradient></defs>
        <path d={d} fill="none" stroke="url(#wv)" strokeWidth="1.75" strokeLinecap="round" className="transition-all duration-700" />
        <circle cx={lx} cy={ly} r="3.5" className="fill-[#1b1b1d] stroke-white transition-all duration-700" strokeWidth="1.75" />
      </svg>
      <span className="absolute right-0 bottom-0 text-[11px] font-semibold tabular-nums text-zinc-200">{label}</span>
    </div>
  )
}

function Mini({ icon: Icon, value, unit }) {
  return (
    <div className="flex-1 min-w-0 flex items-center justify-center gap-2 px-2">
      <Icon size={15} className="shrink-0 text-zinc-500" />
      <div className="leading-tight min-w-0"><div className="text-[13px] font-semibold tabular-nums text-zinc-100 truncate">{value ?? '—'}</div><div className="text-[10px] text-zinc-500 truncate">{unit}</div></div>
    </div>
  )
}

function StatCard({ icon: Icon, title, sub, big, unit, pct, warn, wave, waveMax, waveLabel, minis }) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#1b1b1d] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-full bg-white/[0.07] grid place-items-center"><Icon size={19} /></span>
        <div className="flex-1 min-w-0"><div className="text-[15px] font-semibold text-white">{title}</div><div className="text-[11px] text-zinc-500 truncate">{sub}</div></div>
        <span className={cx('text-[11px] font-medium', warn ? 'text-orange-300' : 'text-zinc-400')}>{warn ? 'High' : 'Normal'}</span>
      </div>
      <Bar pct={pct} warn={warn} className="h-9 rounded-lg" />
      <div className="flex items-end gap-2">
        <span className="text-[38px] leading-none font-bold tracking-tight tabular-nums text-white">{big ?? '—'}</span>
        <span className="mb-1 text-[12px] text-zinc-500">{unit}</span>
        <div className="flex-1" />
        <Wave data={wave} max={waveMax} label={waveLabel} />
      </div>
      <div className="flex items-center divide-x divide-white/[0.07] rounded-2xl bg-white/[0.04] py-2.5">{minis.map((m, i) => <Mini key={i} {...m} />)}</div>
    </div>
  )
}

export function StatCards({ serial, ready, info }) {
  const h = usePerf(serial, ready), c = h.at(-1) || {}, col = k => h.map(x => x[k] || 0), r = v => v == null || Number.isNaN(v) ? null : Math.round(v)
  if (!ready) return null
  const ramPct = c.ramTotal ? (100 * c.ramUsed) / c.ramTotal : 0
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3 mb-4">
      <StatCard icon={Cpu} title="Processor" sub={info?.abi || 'CPU load'} big={r(c.cpu)} unit="% load" pct={c.cpu} warn={c.cpu > 85}
        wave={col('cpuTemp')} waveMax={90} waveLabel={c.cpuTemp ? `${r(c.cpuTemp)}°C` : ''}
        minis={[{ icon: Thermometer, value: r(c.cpuTemp), unit: '°C temp' }, { icon: Gauge, value: r(c.gpu), unit: '% GPU' }, { icon: Activity, value: info?.android, unit: "Android" }]} />
      <StatCard icon={MemoryStick} title="Memory" sub="RAM in use" big={c.ramUsed?.toFixed(1)} unit={`of ${r(c.ramTotal) || '—'} GB`} pct={ramPct} warn={ramPct > 90}
        wave={col('ramUsed')} waveMax={c.ramTotal || 1} waveLabel={`${r(ramPct)}%`}
        minis={[{ icon: MemoryStick, value: c.ramTotal ? (c.ramTotal - c.ramUsed).toFixed(1) : null, unit: 'GB free' }, { icon: HardDrive, value: info?.storage?.free, unit: 'storage free' }, { icon: Percent, value: r(ramPct), unit: '% used' }]} />
      <StatCard icon={c.charging ? BatteryCharging : Battery} title="Battery" sub={c.charging ? 'Charging' : 'On battery'} big={r(c.battery)} unit="%" pct={c.battery} warn={c.battery < 15 && !c.charging}
        wave={col('batTemp')} waveMax={50} waveLabel={c.batTemp ? `${c.batTemp.toFixed(1)}°C` : ''}
        minis={[{ icon: Thermometer, value: c.batTemp?.toFixed(1), unit: '°C temp' }, { icon: Zap, value: c.charging ? 'Yes' : 'No', unit: 'charging' }, { icon: Flame, value: r(c.gpuTemp) || null, unit: '°C GPU' }]} />
    </div>
  )
}
