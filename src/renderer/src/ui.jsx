// Small control kit: Tailwind + Radix primitives (shadcn-style), tuned to feel like a desktop tool.
import { useEffect, useRef } from 'react'
import * as RSlider from '@radix-ui/react-slider'
import * as RSwitch from '@radix-ui/react-switch'
import { ChevronDown } from 'lucide-react'

export const cx = (...a) => a.filter(Boolean).join(' ')

const variants = {
  default: 'bg-[#323236] hover:bg-[#3a3a3f] text-zinc-200',
  primary: 'bg-accent hover:brightness-125 text-white font-semibold',
  live: 'bg-red-500 hover:bg-red-400 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)]',
  ghost: 'hover:bg-white/[0.07] text-zinc-400 hover:text-zinc-100'
}
export function Button({ variant = 'default', className, ...p }) {
  return <button {...p} className={cx('no-drag inline-flex items-center justify-center gap-1.5 rounded-lg px-3 h-7 text-[12px] font-medium transition-all duration-150 outline-none focus-visible:ring-2 ring-violet-400/60 disabled:opacity-40 disabled:pointer-events-none active:translate-y-px', variants[variant], className)} />
}

export function Segmented({ value, onChange, options, disabled }) {
  return (
    <div className={cx('flex gap-1', disabled && 'opacity-40 pointer-events-none')}>
      {options.map(([v, label, Icon]) => (
        <button key={v} onClick={() => onChange(v)}
          className={cx('flex-1 h-8 rounded-lg text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-all duration-200 outline-none whitespace-nowrap px-2',
            v === value ? 'bg-accent text-white font-semibold' : 'bg-[#323236] text-zinc-300 hover:bg-[#3a3a3f]')}>
          {Icon && <Icon size={13} />}{label}
        </button>
      ))}
    </div>
  )
}

// Glass fill slider: the label sits inside the bar, the value on the right, and the fill ends in a thin handle.
export function Slider({ value, onChange, min = 0, max = 1, step = 0.01, className, label, format, level, right }) {
  const v = value ?? min, lv = useRef()
  useEffect(() => { // live audio level bouncing inside the bar
    if (!level) return
    let id; const tick = () => { if (lv.current) lv.current.style.transform = `scaleX(${Math.min(1, level())})`; id = requestAnimationFrame(tick) }
    tick(); return () => cancelAnimationFrame(id)
  }, [!level])
  const text = format ? format(v) : step >= 1 ? Math.round(v) : max - min <= 2 ? Math.round(v * 100) + '%' : (+v).toFixed(1)
  return (
    <RSlider.Root value={[v]} onValueChange={x => onChange(x[0])} min={min} max={max} step={step}
      className={cx('glass-slider group relative flex items-center flex-1 min-w-0 h-8 touch-none overflow-hidden transition-colors', label ? 'rounded-xl bg-white/[0.06] hover:bg-white/[0.08]' : 'rounded-lg bg-[#323236]', className)}>
      <RSlider.Track className="relative h-full flex-1">
        <RSlider.Range className={cx('absolute h-full overflow-hidden transition-colors', label ? 'rounded-xl bg-white/[0.13] group-hover:bg-white/[0.18] group-active:bg-white/[0.22]' : 'rounded-lg bg-accent group-hover:brightness-110')}>
          {level && <span ref={lv} className="absolute inset-y-0 left-0 w-full origin-left bg-gradient-to-r from-emerald-400/30 to-lime-300/40 pointer-events-none transition-transform duration-75" style={{ transform: 'scaleX(0)' }} />}
        </RSlider.Range>
      </RSlider.Track>
      <RSlider.Thumb className={cx('block w-[3px] h-4 -ml-2 rounded-full outline-none transition-all duration-150 group-hover:h-5 group-hover:bg-white group-active:h-6 group-active:w-1 focus-visible:bg-white', 'bg-white/70')} />
      {label && <span className="absolute left-3 text-[12px] text-zinc-300 pointer-events-none">{label}</span>}
      {right && <span className="absolute right-12 flex items-center">{right}</span>}
      <span className={cx('absolute right-3 text-[12px] tabular-nums pointer-events-none', 'font-medium text-zinc-100')}>{text}</span>
    </RSlider.Root>
  )
}

export function Switch({ checked, onChange, disabled }) {
  return (
    <RSwitch.Root checked={checked} onCheckedChange={onChange} disabled={disabled}
      className="w-8 h-[18px] shrink-0 rounded-full bg-white/15 data-[state=checked]:bg-accent transition-colors outline-none focus-visible:ring-2 ring-violet-400/60 disabled:opacity-40">
      <RSwitch.Thumb className="block size-3.5 rounded-full bg-white shadow translate-x-0.5 data-[state=checked]:translate-x-4 transition-transform" />
    </RSwitch.Root>
  )
}

const field = 'no-drag w-full h-8 rounded-lg bg-[#323236] border border-transparent px-2 text-[12px] text-zinc-100 outline-none focus:border-violet-400/70 placeholder:text-zinc-600 disabled:opacity-40'

// Native <select>: opens the real OS menu, which is what a desktop tool should do.
export function Select({ value, onChange, options, disabled, className }) {
  return (
    <div className={cx('relative', className)}>
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={cx(field, 'appearance-none pr-6')}>
        {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-[9px] text-zinc-500 pointer-events-none" />
    </div>
  )
}

export function Input({ className, ...p }) { return <input spellCheck={false} {...p} className={cx(field, className)} /> }

export function Row({ label, icon: Icon, children }) {
  return (
    <div className="flex items-center gap-3 min-h-7">
      <span className="w-[100px] shrink-0 whitespace-nowrap text-[12px] text-zinc-300 flex items-center gap-2">{Icon && <Icon size={13} className="text-zinc-500" />}{label}</span>
      <div className="flex-1 min-w-0 flex items-center justify-end gap-2">{children}</div>
    </div>
  )
}

export function Section({ icon: Icon, title, right, children }) {
  return (
    <section className="mb-1.5 last:mb-0 rounded-xl bg-[#242427] p-2.5">
      <div className="flex items-center gap-1.5 mb-2 h-5">
        <h2 className="text-[12px] font-semibold text-white flex-1">{title}</h2>
        {right}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

// Rounded glass card used for every panel.
export function Card({ className, children }) { return <div className={cx('card rounded-2xl border border-white/[0.06] bg-[#1a1a1c] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] overflow-hidden', className)}>{children}</div> }

// Small pill tabs for the top of a card.
export function Tabs({ value, onChange, options, className }) {
  return (
    <div className={cx('flex items-center gap-1 overflow-x-auto', className)}>
      {options.map(([v, label, Icon]) => (
        <button key={v} onClick={() => onChange(v)} className={cx('no-drag shrink-0 h-7 px-3 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5 transition-all duration-200',
          v === value ? 'bg-white/[0.14] text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]')}>{Icon && <Icon size={13} />}{label}</button>
      ))}
    </div>
  )
}
