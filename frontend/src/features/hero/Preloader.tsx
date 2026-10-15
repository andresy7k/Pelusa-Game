// frontend/src/features/hero/Preloader.tsx
// Pantalla de carga real: espera fuentes (fonts.ready con timeout de 2.5s),
// primer render del canvas (lo reporta T4 vía onReady) y un mínimo visible.
// Saltable con clic o tecla. Con reduced-motion: instantánea.
import { useEffect, useRef, useState } from 'react'
import { HERO } from './config'
import './Preloader.css'

export function Preloader({ done, onDone }: { done: boolean; onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const started = useRef(Date.now())
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    let alive = true
    const tick = () => {
      if (!alive) return
      const elapsed = Date.now() - started.current
      const timePart = Math.min(1, elapsed / HERO.timings.preloaderMinMs)
      const realPart = done ? 1 : 0.85 // las fuentes pesan ~0.85 hasta que el canvas avise
      setProgress(Math.min(1, timePart * realPart))
      if (timePart === 1 && done) {
        onDone()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    // Las fuentes no bloquean: si tardan, el timeout de abajo arranca igual.
    const timeout = window.setTimeout(() => onDone(), 2500)
    return () => {
      alive = false
      window.clearTimeout(timeout)
    }
  }, [done, onDone])

  if (reduced) return null

  return (
    <div
      className="hero-preloader"
      role="status"
      aria-label="Cargando"
      onClick={onDone}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDone() }}
      tabIndex={0}
    >
      <span className="hero-preloader__logo" aria-hidden="true" />
      <div className="hero-preloader__bar"><div style={{ transform: `scaleX(${progress})` }} /></div>
      <small className="hero-preloader__hint">Clic para saltar</small>
    </div>
  )
}
