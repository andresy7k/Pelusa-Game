// frontend/src/features/hero/HeroStage.tsx
import { useCallback, useState } from 'react'
import { envFromWindow, hasWebGL, heroMode } from './mode'
import { Preloader } from './Preloader'
import { HeroCopy } from './HeroCopy'
import { HeroNav } from './HeroNav'
import { SmokeBackground } from './SmokeBackground'
import './HeroStage.css'

export function HeroStage() {
  const [entered, setEntered] = useState(false)
  const [revealed, setRevealed] = useState(false)
  // Lazy: se detectan una sola vez. Ojo: hasWebGL() crea un canvas —
  // nunca llamarlo en cada render (HeroStage re-renderiza al cambiar de carta).
  const [mode] = useState(() => heroMode(window.location.search, envFromWindow()))
  const [webgl] = useState(() => hasWebGL())
  const showPreloader = !entered

  const onReveal = useCallback(() => setRevealed(true), [])
  const onDone = useCallback(() => setEntered(true), [])

  return (
    <section className={`hero-stage${revealed ? ' hero-stage--entered' : ''}`} data-hero-mode={mode} data-webgl={webgl}>
      <SmokeBackground />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-content">
        <HeroNav />
        <HeroCopy />
        {/* T3 monta aquí <HeroCarousel />; T4, el portal del canvas */}
      </div>
      {/* T4 conecta el `done` real del canvas; T7 usa el beat del wordmark */}
      {showPreloader && <Preloader done={false} onReveal={onReveal} onDone={onDone} />}
    </section>
  )
}
