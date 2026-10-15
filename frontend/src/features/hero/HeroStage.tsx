// frontend/src/features/hero/HeroStage.tsx
import { useCallback, useState } from 'react'
import { envFromWindow, hasWebGL, heroMode } from './mode'
import type { HeroValue } from './config'
import { Preloader } from './Preloader'
import { HeroCopy } from './HeroCopy'
import { HeroNav } from './HeroNav'
import { HeroCarousel } from './HeroCarousel'
import { SmokeBackground } from './SmokeBackground'
import './HeroStage.css'

export function HeroStage() {
  const [entered, setEntered] = useState(false)
  const [revealed, setRevealed] = useState(false)
  // Carta activa del carrusel: por ahora solo se guarda el estado (T4 lo usa
  // para el canvas 3D y T6 para el tinte del vórtice).
  const [, setActiveCard] = useState<HeroValue>(1)
  // Lazy: se detectan una sola vez. Ojo: hasWebGL() crea un canvas —
  // nunca llamarlo en cada render (HeroStage re-renderiza al cambiar de carta).
  const [mode] = useState(() => heroMode(window.location.search, envFromWindow()))
  const [webgl] = useState(() => hasWebGL())
  const showPreloader = !entered

  const onReveal = useCallback(() => setRevealed(true), [])
  const onDone = useCallback(() => setEntered(true), [])
  const onActiveCard = useCallback((v: HeroValue) => setActiveCard(v), [])

  return (
    <section className={`hero-stage${revealed ? ' hero-stage--entered' : ''}`} data-hero-mode={mode} data-webgl={webgl}>
      <SmokeBackground />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-content">
        <HeroNav />
        <HeroCopy />
        <HeroCarousel onActiveChange={onActiveCard} />
        {/* T4 monta aquí el portal del canvas */}
      </div>
      {/* T4 conecta el `done` real del canvas; T7 usa el beat del wordmark */}
      {showPreloader && <Preloader done={false} onReveal={onReveal} onDone={onDone} />}
    </section>
  )
}
