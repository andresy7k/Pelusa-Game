// frontend/src/features/hero/HeroCarousel.tsx
// Carrusel 1→10 del hero: las diez cartas en anillo, la activa al frente
// (grande, elevada, con glow y anillos), las vecinas atenuadas y las lejanas
// ocultas. Auto-avance pausable (hover/foco/drag) y navegación completa:
// teclado, rueda, drag, clic en carta lateral y dots.
// `ringOffset` es pura y la reusa T4 para saber qué monstruos son visibles.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { HERO, type HeroValue } from './config'
import { CardFace } from './CardFace'
import { attachAnchor, measureAllAnchors, trackAnchorsFor } from './monsters/anchors'
import './HeroCarousel.css'

// Offset circular del anillo: rango -n/2 < off <= n/2 (con n=10: -4..5).
// Los saltos del anillo (4 -> -5) siempre caen en |off| >= 3, donde la
// ranura está oculta: por eso el loop no se ve "saltar".
export function ringOffset(i: number, center: number, n: number): number {
  const raw = ((i - center) % n + n) % n
  return raw > n / 2 ? raw - n : raw
}

// Cuánto hay que girar la rueda / arrastrar para pasar de carta.
const WHEEL_STEP_PX = 60
const DRAG_STEP_PX = 40

export function HeroCarousel({
  onActiveChange,
  paused: autoPaused = false,
}: {
  onActiveChange: (v: HeroValue) => void
  /** Pausa externa: con el preloader arriba, HeroStage la activa. */
  paused?: boolean
}) {
  const n = HERO.order.length
  const [center, setCenter] = useState(0) // índice 0..n-1 dentro de HERO.order
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const navigate = useNavigate()

  const stageRef = useRef<HTMLDivElement | null>(null)
  const resumeRef = useRef<number | null>(null)
  const wheelAccRef = useRef(0)
  const hoverRef = useRef(false)
  const focusRef = useRef(false)
  const dragRef = useRef<{ x: number; done: boolean; down: boolean } | null>(null)

  // prefers-reduced-motion reactivo: sin auto-avance (el CSS quita las
  // transiciones, así que los cambios de carta son instantáneos).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Pausa del auto-avance (hover, foco o drag) con reanudación diferida.
  const pause = useCallback(() => {
    if (resumeRef.current !== null) {
      window.clearTimeout(resumeRef.current)
      resumeRef.current = null
    }
    setPaused(true)
  }, [])

  const resumeLater = useCallback(() => {
    if (resumeRef.current !== null) window.clearTimeout(resumeRef.current)
    resumeRef.current = window.setTimeout(() => {
      resumeRef.current = null
      // Si el usuario sigue encima (hover/foco/drag), la pausa continúa.
      if (hoverRef.current || focusRef.current || dragRef.current?.down) return
      setPaused(false)
    }, HERO.timings.resumeAfterMs)
  }, [])

  useEffect(() => () => {
    if (resumeRef.current !== null) window.clearTimeout(resumeRef.current)
  }, [])

  // Auto-avance en loop: setInterval (no rAF) a propósito — en segundo plano
  // sigue corriendo (throttled) y el estado siempre queda alineado al volver
  // (Review Focus #2: sin saltos raros tras 30 s oculto). `autoPaused` viene
  // de HeroStage: mientras el preloader cubre el hero no avanza, así al
  // revelarse se ve la carta 1 al centro.
  useEffect(() => {
    if (reduced || autoPaused || paused) return
    const id = window.setInterval(() => setCenter((c) => (c + 1) % n), HERO.timings.autoAdvanceMs)
    return () => window.clearInterval(id)
  }, [reduced, autoPaused, paused, n])

  // Publica el valor activo hacia arriba (T4/T6 lo consumen) y re-mide las
  // anclas durante el slide: el canvas sigue a su carta con rect fresco.
  useEffect(() => {
    onActiveChange(HERO.order[center])
    trackAnchorsFor(HERO.timings.slideMs + 120)
  }, [center, onActiveChange])

  // Anclas del canvas 3D: medida inicial, en cada resize (zoom incluido), al
  // scrollear (el carrusel se mueve con la página y el canvas es fijo) y
  // cuando terminan de cargar las fuentes (el copy de arriba puede reflowear
  // y correr el carrusel). Nunca se mide en idle.
  useEffect(() => {
    measureAllAnchors()
    const ro = new ResizeObserver(() => measureAllAnchors())
    if (stageRef.current) ro.observe(stageRef.current)
    window.addEventListener('resize', measureAllAnchors)
    window.addEventListener('scroll', measureAllAnchors, { passive: true })
    void document.fonts.ready.then(() => measureAllAnchors()).catch(() => {})
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measureAllAnchors)
      window.removeEventListener('scroll', measureAllAnchors)
    }
  }, [])

  const step = useCallback((dir: 1 | -1) => {
    setCenter((c) => (c + dir + n) % n)
  }, [n])

  // Teclado: flechas / A-D cambian de carta; Home/End van a 1/10; Enter y
  // Espacio en la carta activa abren /setup (como el CTA primario).
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          step(-1)
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          step(1)
          break
        case 'Home':
          e.preventDefault()
          setCenter(0)
          break
        case 'End':
          e.preventDefault()
          setCenter(n - 1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          navigate('/setup')
          break
      }
    },
    [n, navigate, step],
  )

  // Rueda no pasiva: acumula deltaY y pasa de carta cada 60px.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      wheelAccRef.current += e.deltaY
      if (Math.abs(wheelAccRef.current) >= WHEEL_STEP_PX) {
        step(wheelAccRef.current > 0 ? 1 : -1)
        wheelAccRef.current = 0
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [step])

  // Drag/swipe horizontal (umbral 40px); `done` suprime el click posterior.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: e.clientX, done: false, down: true }
    pause()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag?.down) return
    const dx = e.clientX - drag.x
    if (Math.abs(dx) >= DRAG_STEP_PX) {
      step(dx < 0 ? 1 : -1)
      drag.done = true
      drag.x = e.clientX
    }
  }

  const endDrag = () => {
    if (dragRef.current) dragRef.current.down = false
    resumeLater()
  }

  const onCardClick = (i: number, active: boolean) => {
    if (dragRef.current?.done) {
      dragRef.current.done = false
      return
    }
    if (active) navigate('/setup')
    else setCenter(i)
  }

  return (
    <div
      className="hero-carousel"
      style={{
        ['--hc-slide' as string]: `${HERO.timings.slideMs}ms`,
        ['--hc-ease' as string]: HERO.easings.slideCss,
      }}
      onPointerEnter={() => {
        hoverRef.current = true
        pause()
      }}
      onPointerLeave={() => {
        hoverRef.current = false
        if (dragRef.current) dragRef.current.down = false
        resumeLater()
      }}
      onFocus={(e) => {
        // Solo el foco de teclado pausa: el clic de mouse también enfoca el
        // stage (tabIndex=0) y sin blur posterior la pausa quedaría pegada.
        // `:focus-visible` distingue teclado de puntero.
        let kb = true
        try {
          kb = (e.target as Element).matches(':focus-visible')
        } catch {
          // target sin `matches` (no debería pasar): pausa conservadora.
        }
        focusRef.current = kb
        if (kb) pause()
      }}
      onBlur={(e) => {
        // Si el foco se movió dentro del carrusel, sigue siendo suyo.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        focusRef.current = false
        resumeLater()
      }}
    >
      <div
        ref={stageRef}
        className="hc-stage"
        role="listbox"
        aria-label="Pelusas"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {HERO.order.map((v, i) => {
          const off = ringOffset(i, center, n)
          const abs = Math.abs(off)
          // 1.15 activa · 1 vecinas · 0.82 a ±2 · 0.6 lejanas
          const scale = off === 0 ? 1.15 : abs === 1 ? 1 : abs === 2 ? 0.82 : 0.6
          const lift = off === 0 ? -40 : 0 // elevación en px de la activa
          const rot = abs === 1 ? Math.sign(off) * 3 : abs === 2 ? Math.sign(off) * 6 : 0
          const op = off === 0 ? 1 : abs === 1 ? 0.8 : abs === 2 ? 0.38 : 0
          const active = off === 0
          return (
            <div
              key={v}
              className={`hc-slot${abs >= 3 ? ' hc-slot--far' : ''}`}
              role="option"
              aria-selected={active}
              tabIndex={-1}
              style={{
                ['--hc-tx' as string]: off,
                ['--hc-scale' as string]: scale,
                ['--hc-lift' as string]: lift,
                ['--hc-rot' as string]: rot,
                ['--hc-op' as string]: op,
                ['--hc-z' as string]: 100 - abs,
              }}
              onClick={() => onCardClick(i, active)}
            >
              <CardFace ref={(el) => attachAnchor(v, el)} value={v} active={active} />
            </div>
          )
        })}
      </div>

      {/* Dots: el punto accesible principal del carrusel (foco real). */}
      <div className="hc-dots" role="group" aria-label="Elegir pelusa">
        {HERO.order.map((v, i) => (
          <button
            key={v}
            type="button"
            className={`hc-dot${center === i ? ' hc-dot--active' : ''}`}
            aria-label={`Ver pelusa ${v}`}
            aria-current={center === i ? 'true' : undefined}
            onClick={() => setCenter(i)}
          />
        ))}
      </div>
    </div>
  )
}
