// frontend/src/features/hero/HeroStage.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { envFromWindow, hasWebGL, heroMode } from './mode'
import { HERO, type HeroValue } from './config'
import { Preloader } from './Preloader'
import { HeroCopy } from './HeroCopy'
import { HeroNav } from './HeroNav'
import { HeroCarousel } from './HeroCarousel'
import { MonsterCanvas } from './monsters/MonsterCanvas'
import { SmokeBackground } from './SmokeBackground'
import './HeroStage.css'

// Hex (#rrggbb) a canales 0-255 para interpolar el acento en JS.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function HeroStage() {
  const [entered, setEntered] = useState(false)
  const [revealed, setRevealed] = useState(false)
  // Carta activa del carrusel: alimenta el canvas 3D (T6 suma el tinte).
  const [activeCard, setActiveCard] = useState<HeroValue>(1)
  // Carta con el cursor encima (distinta de la activa): su monstruo hace el
  // gesto hover (T6; la activa gana si coinciden).
  const [hoveredCard, setHoveredCard] = useState<HeroValue | null>(null)
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
  const onHoverCard = useCallback((v: HeroValue | null) => setHoveredCard(v), [])
  const onCanvasReady = useCallback(() => setCanvasReady(true), [])

  // Tinte (T6): --hero-accent sigue al color de la carta activa. Las vars
  // CSS no transicionan solas: se interpola en JS (~0.8 s) para que el humo
  // vire suave; con reduced-motion el cambio es instantáneo.
  const stageRef = useRef<HTMLElement | null>(null)
  const tintRef = useRef(hexToRgb(HERO.cards[1].monster))
  const accent = HERO.cards[activeCard].monster
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const apply = () => {
      const { r, g, b } = tintRef.current
      el.style.setProperty('--hero-accent', `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tintRef.current = hexToRgb(accent)
      apply()
      return
    }
    gsap.to(tintRef.current, {
      ...hexToRgb(accent),
      duration: 0.8,
      ease: 'power2.out',
      overwrite: 'auto',
      onUpdate: apply,
    })
  }, [accent])

  return (
    <section
      ref={stageRef}
      className={`hero-stage${revealed ? ' hero-stage--entered' : ''}${canvasReady ? ' hero-stage--has-3d' : ''}`}
      data-hero-mode={mode}
      data-webgl={webgl}
      style={{ ['--hero-accent' as string]: HERO.cards[1].monster }}
    >
      <SmokeBackground />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-content">
        <HeroNav />
        <HeroCopy />
        <HeroCarousel onActiveChange={onActiveCard} onHoverChange={onHoverCard} paused={!revealed} />
        {/* Canvas R3F fijo (pointer-events:none) sobre el DOM; sin WebGL o
            con `off` no se monta y quedan los monstruos pintados. */}
        {showCanvas && (
          <MonsterCanvas mode={mode} activeValue={activeCard} accent={accent} hoveredValue={hoveredCard} onReady={onCanvasReady} />
        )}
      </div>
      {/* El preloader cierra con el canvas listo (o de una si no hay 3D);
          sin señal, su propio hold lo suelta. */}
      {showPreloader && (
        <Preloader done={!showCanvas || canvasReady} onReveal={onReveal} onDone={onDone} />
      )}
    </section>
  )
}
