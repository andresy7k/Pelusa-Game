// frontend/src/features/hero/HeroStage.tsx
import { useCallback, useState } from 'react'
import { envFromWindow, hasWebGL, heroMode } from './mode'
import type { HeroValue } from './config'
import { Preloader } from './Preloader'
import { HeroCopy } from './HeroCopy'
import { HeroNav } from './HeroNav'
import { HeroCarousel } from './HeroCarousel'
import { MonsterCanvas } from './monsters/MonsterCanvas'
import { SmokeBackground } from './SmokeBackground'
import './HeroStage.css'

export function HeroStage() {
  const [entered, setEntered] = useState(false)
  const [revealed, setRevealed] = useState(false)
  // Carta activa del carrusel: alimenta el canvas 3D (T6 suma el tinte).
  const [activeCard, setActiveCard] = useState<HeroValue>(1)
  // Canvas montado y con el contexto listo: recién ahí se ocultan los
  // monstruos pintados (clase --has-3d) y el preloader puede cerrar.
  const [canvasReady, setCanvasReady] = useState(false)
  // Lazy: se detectan una sola vez. Ojo: hasWebGL() crea un canvas —
  // nunca llamarlo en cada render (HeroStage re-renderiza al cambiar de carta).
  const [mode] = useState(() => heroMode(window.location.search, envFromWindow()))
  const [webgl] = useState(() => hasWebGL())
  const showPreloader = !entered
  const showCanvas = mode !== 'off' && webgl

  const onReveal = useCallback(() => setRevealed(true), [])
  const onDone = useCallback(() => setEntered(true), [])
  const onActiveCard = useCallback((v: HeroValue) => setActiveCard(v), [])
  const onCanvasReady = useCallback(() => setCanvasReady(true), [])

  return (
    <section
      className={`hero-stage${revealed ? ' hero-stage--entered' : ''}${canvasReady ? ' hero-stage--has-3d' : ''}`}
      data-hero-mode={mode}
      data-webgl={webgl}
    >
      <SmokeBackground />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-content">
        <HeroNav />
        <HeroCopy />
        <HeroCarousel onActiveChange={onActiveCard} paused={!revealed} />
        {/* Canvas R3F fijo (pointer-events:none) sobre el DOM; sin WebGL o
            con `off` no se monta y quedan los monstruos pintados. */}
        {showCanvas && <MonsterCanvas mode={mode} activeValue={activeCard} onReady={onCanvasReady} />}
      </div>
      {/* El preloader cierra con el canvas listo (o de una si no hay 3D);
          sin señal, su propio hold lo suelta. */}
      {showPreloader && (
        <Preloader done={!showCanvas || canvasReady} onReveal={onReveal} onDone={onDone} />
      )}
    </section>
  )
}
