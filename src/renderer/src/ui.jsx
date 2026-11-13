// Small control kit: Tailwind + Radix primitives (shadcn-style), tuned to feel like a desktop tool.
import * as RSlider from '@radix-ui/react-slider'
import * as RSwitch from '@radix-ui/react-switch'
import { ChevronDown } from 'lucide-react'

export const cx = (...a) => a.filter(Boolean).join(' ')

const variants = {
  default: 'bg-white/[0.06] hover:bg-white/10 text-zinc-200 border border-white/[0.08]',
  primary: 'bg-violet-500 hover:bg-violet-400 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)]',
  live: 'bg-red-500 hover:bg-red-400 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)]',
  ghost: 'hover:bg-white/[0.07] text-zinc-400 hover:text-zinc-100'
}
export function Button({ variant = 'default', className, ...p }) {
  return <button {...p} className={cx('no-drag inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 h-7 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 ring-violet-400/60 disabled:opacity-40 disabled:pointer-events-none active:translate-y-px', variants[variant], className)} />
}

export function Segmented({ value, onChange, options, disabled }) {
  return (
    <div className={cx('flex p-0.5 rounded-lg bg-black/40 border border-white/[0.06]', disabled && 'opacity-40 pointer-events-none')}>
      {options.map(([v, label, Icon]) => (
        <button key={v} onClick={() => onChange(v)}
          className={cx('flex-1 h-7 rounded-md text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors outline-none',
            v === value ? 'bg-white/[0.12] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200')}>
          {Icon && <Icon size={13} />}{label}
        </button>
      ))}
    </div>
  )
}

export function Slider({ value, onChange, min = 0, max = 1, step = 0.01, className }) {
  return (
    <RSlider.Root value={[value]} onValueChange={v => onChange(v[0])} min={min} max={max} step={step}
      className={cx('relative flex items-center h-5 flex-1 touch-none', className)}>
      <RSlider.Track className="relative h-1 flex-1 rounded-full bg-white/10">
        <RSlider.Range className="absolute h-full rounded-full bg-violet-400" />
      </RSlider.Track>
      <RSlider.Thumb className="block size-3.5 rounded-full bg-white shadow-md outline-none focus-visible:ring-4 ring-violet-400/40" />
    </RSlider.Root>
  )
}

export function Switch({ checked, onChange, disabled }) {
  return (
    <RSwitch.Root checked={checked} onCheckedChange={onChange} disabled={disabled}
      className="w-8 h-[18px] shrink-0 rounded-full bg-white/15 data-[state=checked]:bg-violet-500 transition-colors outline-none focus-visible:ring-2 ring-violet-400/60 disabled:opacity-40">
      <RSwitch.Thumb className="block size-3.5 rounded-full bg-white shadow translate-x-0.5 data-[state=checked]:translate-x-4 transition-transform" />
    </RSwitch.Root>
  )
}

const field = 'no-drag w-full h-7 rounded-md bg-black/40 border border-white/[0.08] px-2 text-[12px] text-zinc-100 outline-none focus:border-violet-400/70 placeholder:text-zinc-600 disabled:opacity-40'

// Native <select>: opens the real OS menu, which is what a desktop tool should do.
export function Select({ value, onChange, options, disabled, className }) {
  return (
    <div className={cx('relative', className)}>
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={cx(field, 'appearance-none pr-6')}>
        {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-1.5 top-[7px] text-zinc-500 pointer-events-none" />
    </div>
  )
}

export function Input({ className, ...p }) { return <input spellCheck={false} {...p} className={cx(field, className)} /> }

export function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-7">
      <span className="w-[84px] shrink-0 text-[12px] text-zinc-400">{label}</span>
      <div className="flex-1 min-w-0 flex items-center justify-end gap-2">{children}</div>
    </div>
  )
}

export function Section({ icon: Icon, title, right, children }) {
  return (
    <section className="px-3 py-3 border-b border-white/[0.06]">
      <div className="flex items-center gap-1.5 mb-2.5 h-5">
        {Icon && <Icon size={13} className="text-zinc-500" />}
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex-1">{title}</h2>
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
