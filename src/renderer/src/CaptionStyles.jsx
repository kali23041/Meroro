// Caption styles library: animated previews of every caption preset; click one to use it in the current scene.
import { useState } from 'react'
import { Check } from 'lucide-react'
import { CAP_STYLES, drawCap } from './capfx'
import { cx } from './ui'

const SAMPLE = 'welcome back to the stream guys aaj hum naya game khelenge so lets go'.split(' ')
const draw = st => (c, w, h, t) => {
  c.fillStyle = '#17171b'; c.fillRect(0, 0, w, h)
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#26303f'); g.addColorStop(1, '#3b2a3f'); c.fillStyle = g; c.fillRect(0, 0, w, h)
  const step = 0.42, i = Math.floor(t / step) % (SAMPLE.length + 5), n = Math.min(SAMPLE.length, i + 1)
  drawCap(c, w * 0.05, h * 0.3, w * 0.9, h * 0.5, { ...st, lines: 2 }, SAMPLE.slice(0, n).join(' '), i < SAMPLE.length ? (t % step) : 9)
}

export default function CaptionStyles({ Anim, onUse, current }) {
  const [done, setDone] = useState('')
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2.5">
      {CAP_STYLES.map(st => (
        <button key={st.name} onClick={() => { onUse(st); setDone(st.name); setTimeout(() => setDone(''), 1600) }}
          className={cx('group relative rounded-xl overflow-hidden bg-[#242427] text-left ring-1 transition-all hover:-translate-y-0.5', current === st.name ? 'ring-white/60' : 'ring-white/[0.06] hover:ring-white/30')}>
          <Anim draw={draw(st)} className="w-full block" />
          <div className="flex items-center px-3 py-2 text-[12px] font-medium text-zinc-200"><span className="flex-1 truncate">{st.name}</span>
            {done === st.name ? <span className="flex items-center gap-1 text-emerald-400"><Check size={12} />Applied</span> : <span className="text-zinc-500 opacity-0 group-hover:opacity-100">Use in scene</span>}</div>
        </button>
      ))}
    </div>
  )
}
