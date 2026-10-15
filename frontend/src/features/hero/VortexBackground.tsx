// frontend/src/features/hero/VortexBackground.tsx
// Vórtice CSS: capas gigantes desenfocadas que rotan lentísimo, con paralaje
// de mouse lerpeado. Decorativo puro (aria-hidden). El acento lo pisa el
// carrusel vía --hero-accent (color de la carta activa).
import { useEffect, useRef } from 'react'

export function VortexBackground() {
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
      x += (tx - x) * 0.06
      y += (ty - y) * 0.06
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
    <div className="hero-vortex" ref={ref} aria-hidden="true">
      <div className="hero-vortex__layer hero-vortex__layer--a" />
      <div className="hero-vortex__layer hero-vortex__layer--b" />
      <div className="hero-vortex__layer hero-vortex__layer--c" />
    </div>
  )
}
