// frontend/src/features/hero/SmokeBackground.tsx
// Humo violeta en deriva lenta sobre negro: capas suaves que derivan solas
// (CSS en el blob hijo) y se desplazan con el mouse lerpeado (parallax en el
// layer padre, sin pelear por el mismo transform). Decorativo (aria-hidden).
// El acento lo pisa el carrusel vía --hero-accent.
import { useEffect, useRef } from 'react'
import './SmokeBackground.css'

export function SmokeBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const loop = () => {
      x += (tx - x) * 0.055
      y += (ty - y) * 0.055
      ref.current?.style.setProperty('--px', x.toFixed(4))
      ref.current?.style.setProperty('--py', y.toFixed(4))
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="hero-smoke" ref={ref} aria-hidden="true">
      <div className="hero-smoke__layer hero-smoke__layer--c">
        <div className="hero-smoke__blob hero-smoke__blob--c" />
      </div>
      <div className="hero-smoke__layer hero-smoke__layer--a">
        <div className="hero-smoke__blob hero-smoke__blob--a" />
      </div>
      <div className="hero-smoke__layer hero-smoke__layer--b">
        <div className="hero-smoke__blob hero-smoke__blob--b" />
      </div>
      <div className="hero-smoke__layer hero-smoke__layer--d">
        <div className="hero-smoke__blob hero-smoke__blob--d" />
      </div>
      <div className="hero-smoke__noise" aria-hidden="true" />
    </div>
  )
}
