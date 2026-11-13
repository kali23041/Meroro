import { X, Smartphone, AppWindow, Layers, Zap, Radio, Palette } from 'lucide-react'
import { BRAND, LOGO_SVG } from '../../shared/brand'

export const VERSION = __APP_VERSION__

export function Logo({ size = 20, className = '' }) {
  return <span className={'inline-block shrink-0 ' + className} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
}

const FEATURES = [
  [Smartphone, 'Direct Android capture', 'USB or Wi-Fi, no app on the phone'],
  [AppWindow, 'Single-app streaming', 'Only the game you pick goes live'],
  [Layers, 'Scenes & sources', 'Drag, resize, crop and grade layers'],
  [Zap, 'Auto scene switching', 'Follows the app open on your phone'],
  [Palette, 'Gaming presets', 'BGMI, vertical Shorts and more'],
  [Radio, 'YouTube Live', 'Hardware-encoded RTMPS streaming']
]

export function About({ onClose }) {
  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div className="relative w-[520px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="absolute -top-28 left-1/2 -translate-x-1/2 size-80 rounded-full bg-violet-600/30 blur-3xl" />
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"><X size={15} /></button>
        <div className="relative flex flex-col items-center pt-9 pb-6 px-8 text-center">
          <Logo size={84} className="drop-shadow-[0_10px_24px_rgba(236,72,153,.4)]" />
          <h1 className="mt-4 text-[26px] font-extrabold tracking-tight text-white">{BRAND.name}</h1>
          <p className="text-zinc-400">{BRAND.tagline} · v{VERSION}</p>
          <div className="mt-6 grid grid-cols-2 gap-2 w-full text-left">
            {FEATURES.map(([Icon, t, d]) => (
              <div key={t} className="flex gap-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
                <Icon size={15} className="text-violet-300 mt-0.5 shrink-0" />
                <div><div className="text-[12px] font-medium text-zinc-100">{t}</div><div className="text-[11px] text-zinc-500">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative border-t border-white/[0.06] px-8 py-4 flex items-center justify-between bg-white/[0.02]">
          <div>
            <div className="text-[11px] text-zinc-500">Created by</div>
            <div className="text-[14px] font-semibold bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">{BRAND.author}</div>
          </div>
          <div className="text-[11px] text-zinc-600">© 2026 {BRAND.author}</div>
        </div>
      </div>
    </div>
  )
}
