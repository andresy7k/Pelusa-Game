// frontend/src/features/hero/HeroStage.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { envFromWindow, hasWebGL, heroMode } from './mode'
import { HERO, type HeroValue } from './config'
import { Preloader } from './Preloader'
import { HeroCopy } from './HeroCopy'
import { HeroNav } from './HeroNav'
import { HeroCarousel, type HeroCarouselHandle } from './HeroCarousel'
import { MonsterCanvas } from './monsters/MonsterCanvas'
import { SmokeBackground } from './SmokeBackground'
import { Cursor } from './Cursor'
import { play } from './sound'
import { playIntro } from './intro'
import './HeroStage.css'

// Retardo Enter → /setup: el special de celebración se ve ~600 ms.
const ENTER_NAV_MS = 600

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
  // T9: contexto WebGL perdido (GPU): se desmonta el canvas y vuelven los
  // pintados (una sola vía, sin restauración).
  const [webglLost, setWebglLost] = useState(false)
  const webglWarned = useRef(false)
  // Fuentes listas: el `done` del preloader las espera (con tope de 2.5 s
  // para no colgar con fuentes bloqueadas; el hold del preloader es el otro
  // resguardo).
  const [fontsReady, setFontsReady] = useState(false)
  // La intro corre entre el entrar y su complete/skip: el carrusel se pausa
  // para no pelear con los tweens de las ranuras.
  const [introPlaying, setIntroPlaying] = useState(false)
  // Disparo único del pop de monstruos sobre la cola de la intro (lo consume
  // MonsterCanvas vía la prop `intro`).
  const [introPop, setIntroPop] = useState(false)
  // Lazy: se detectan una sola vez. Ojo: hasWebGL() crea un canvas —
  // nunca llamarlo en cada render (HeroStage re-renderiza al cambiar de carta).
  const [mode] = useState(() => heroMode(window.location.search, envFromWindow()))
  const [webgl] = useState(() => hasWebGL())
  // Reduced-motion: sin preloader (ya retorna null) y sin timeline — los
  // estados finales son los defaults del CSS.
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const showPreloader = !entered
  const showCanvas = mode !== 'off' && webgl && !webglLost
  const has3d = canvasReady && !webglLost

  const onReveal = useCallback(() => setRevealed(true), [])
  const onDone = useCallback(() => setEntered(true), [])
  const onActiveCard = useCallback((v: HeroValue) => setActiveCard(v), [])
  const onHoverCard = useCallback((v: HeroValue | null) => setHoveredCard(v), [])
  const onCanvasReady = useCallback(() => setCanvasReady(true), [])
  // T9: al perder el contexto se degrada a pintados (aviso único en consola).
  const onContextLost = useCallback(() => {
    if (webglWarned.current) {
      setWebglLost(true)
      return
    }
    webglWarned.current = true
    console.warn('[hero] WebGL perdido: modo sin 3D')
    setWebglLost(true)
  }, [])
  // T8: el sonido sigue a cada special (al llegar la carta y al celebrar con
  // Enter). Estable para no reiniciar el timer de llegada de MonsterCanvas.
  const onSpecialSound = useCallback(() => play('special'), [])
  const navigate = useNavigate()

  useEffect(() => {
    let vivo = true
    const listo = (): void => { if (vivo) setFontsReady(true) }
    void document.fonts.ready.then(listo).catch(listo)
    const t = window.setTimeout(listo, 2500)
    return () => {
      vivo = false
      window.clearTimeout(t)
    }
  }, [])

  // Intro (T7): se construye pausada al revelar —los `from` aplican el estado
  // oculto bajo el overlay todavía opaco— y corre al entrar. Construirla
  // recién al entrar mostraría el hero final durante el fade y pegaría un
  // salto atrás.
  const stageRef = useRef<HTMLElement | null>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  useEffect(() => {
    if (!revealed || reduced) return
    const ctx = gsap.context(() => {
      const tl = playIntro()
      tl.pause()
      tlRef.current = tl
    }, stageRef)
    return () => {
      tlRef.current = null
      ctx.revert()
    }
  }, [revealed, reduced])

  // Al entrar corre la intro; skip con clic o cualquier tecla → tl.progress(1)
  // (los callbacks se suprimen: el pop de monstruos no dispara al saltear).
  useEffect(() => {
    if (!entered || reduced) return
    const timeline = tlRef.current ?? playIntro()
    tlRef.current = timeline
    if (timeline.progress() === 1) {
      setIntroPlaying(false)
      return
    }
    // Pop de monstruos sobre la cola de las cartas (mismo '-=0.4' del brief).
    timeline.add(() => setIntroPop(true), '-=0.4')
    function terminar(): void {
      window.removeEventListener('click', saltar)
      window.removeEventListener('keydown', saltar)
      setIntroPlaying(false)
    }
    function saltar(): void {
      terminar()
      timeline.progress(1)
    }
    timeline.eventCallback('onComplete', terminar)
    window.addEventListener('click', saltar)
    window.addEventListener('keydown', saltar)
    setIntroPlaying(true)
    timeline.play()
    return () => {
      window.removeEventListener('click', saltar)
      window.removeEventListener('keydown', saltar)
    }
  }, [entered, reduced])

  // Tinte (T6): --hero-accent sigue al color de la carta activa. Las vars
  // CSS no transicionan solas: se interpola en JS (~0.8 s) para que el humo
  // vire suave; con reduced-motion el cambio es instantáneo.
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

  // Teclado final (T8): HeroStage es el ÚNICO dueño del `keydown` (el
  // carrusel ya no escucha teclas). Activo solo con foco dentro del hero:
  // afuera, las teclas hacen lo nativo (las flechas siguen scrolleando la
  // página, p. ej. sobre "cómo se juega").
  const carouselRef = useRef<HeroCarouselHandle | null>(null)
  // Celebración del Enter: la asigna quien posee `chars` (MonsterCanvas).
  const celebrateRef = useRef<((v: HeroValue) => void) | null>(null)
  // Espejo de la activa para el listener de ventana (estable entre renders).
  const activeRef = useRef(activeCard)
  useEffect(() => {
    activeRef.current = activeCard
  }, [activeCard])
  // Viaje del Enter a /setup (se limpia al desmontar).
  const enterTimerRef = useRef<number | null>(null)
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Con el preloader o la intro, las teclas son del skip, no del hero.
      if (!entered || introPlaying) return
      const stage = stageRef.current
      if (!stage || !stage.contains(document.activeElement)) return
      const t = e.target as Element | null
      const interactivo =
        !!t && typeof t.closest === 'function' && t.closest('a, button') !== null
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          carouselRef.current?.step(-1)
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          carouselRef.current?.step(1)
          break
        case 'Home':
          e.preventDefault()
          carouselRef.current?.first()
          break
        case 'End':
          e.preventDefault()
          carouselRef.current?.last()
          break
        case 'Enter':
        case ' ':
          // Sobre links/botones manda lo nativo: si no, doble acción (la
          // activación nativa + esta navegación).
          if (interactivo) return
          e.preventDefault()
          play('select')
          // Con reduced-motion se navega directo: sin delay ni special.
          if (reduced) {
            navigate('/setup')
            return
          }
          celebrateRef.current?.(activeRef.current)
          if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current)
          enterTimerRef.current = window.setTimeout(() => navigate('/setup'), ENTER_NAV_MS)
          break
      }
    }
    window.addEventListener('keydown', alTecla)
    return () => {
      window.removeEventListener('keydown', alTecla)
      if (enterTimerRef.current !== null) {
        window.clearTimeout(enterTimerRef.current)
        enterTimerRef.current = null
      }
    }
  }, [entered, introPlaying, navigate, reduced])

  return (
    <section
      ref={stageRef}
      className={`hero-stage${has3d ? ' hero-stage--has-3d' : ''}`}
      data-hero-mode={mode}
      data-webgl={webgl}
      style={{ ['--hero-accent' as string]: HERO.cards[1].monster }}
    >
      <SmokeBackground />
      <Cursor />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-content">
        <HeroNav />
        <HeroCopy />
        <HeroCarousel onActiveChange={onActiveCard} onHoverChange={onHoverCard} paused={!entered || introPlaying} handleRef={carouselRef} />
        {/* Canvas R3F fijo (pointer-events:none) sobre el DOM; sin WebGL o
            con `off` no se monta y quedan los monstruos pintados. */}
        {showCanvas && (
          <MonsterCanvas mode={mode} activeValue={activeCard} accent={accent} hoveredValue={hoveredCard} intro={introPop} onSpecial={onSpecialSound} celebrateRef={celebrateRef} onReady={onCanvasReady} onContextLost={onContextLost} />
        )}
      </div>
      {/* El preloader cierra con el canvas listo (o de una si no hay 3D) y las
          fuentes; sin señal, su propio hold lo suelta. */}
      {showPreloader && (
        <Preloader done={(!showCanvas || canvasReady) && fontsReady} onReveal={onReveal} onDone={onDone} />
      )}
    </section>
  )
}
