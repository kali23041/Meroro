// Full-screen, see-through annotation window: draw on top of any app. If you stream or record that screen, viewers see the ink.
import { useEffect, useRef } from 'react'
import Annotate from './Annotate'
import { newAnn, drawAnn } from './ann'

export default function ScreenOverlay() {
  const canvas = useRef(), eng = useRef({ ann: newAnn() })
  useEffect(() => {
    document.documentElement.style.background = document.body.style.background = 'transparent'
    let raf
    const loop = () => {
      const c = canvas.current, k = devicePixelRatio || 1, W = Math.round(innerWidth * k), H = Math.round(innerHeight * k)
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
      const x = c.getContext('2d'); x.clearRect(0, 0, W, H); drawAnn(x, W, H, eng.current.ann)
      raf = requestAnimationFrame(loop)
    }
    loop(); return () => cancelAnimationFrame(raf)
  }, [])
  return <div className="fixed inset-0 text-zinc-200"><canvas ref={canvas} className="absolute inset-0 w-full h-full" /><Annotate overlay eng={eng} canvas={canvas} onClose={() => window.api.send('overlay:toggle')} /></div>
}
