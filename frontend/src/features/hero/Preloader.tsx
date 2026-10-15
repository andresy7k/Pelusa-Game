// frontend/src/features/hero/Preloader.tsx
// Carga/entrada del hero: la baraja cae carta a carta sobre la mesa (tumble
// 3D, squash & stretch, polvo), la mascota pelusa aterriza encima y la carta
// 10 se roba con glow ámbar antes de que el overlay se retire. Solo GSAP
// anima transform/opacity. Saltable con clic o tecla; reduced-motion:
// instantáneo (ni se muestra).
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { CardView } from '../../components/CardView'
import { HERO, type HeroValue } from './config'
import './Preloader.css'

// Trazado de cada carta: origen fuera de pantalla (arriba), tumble 3D,
// aterrizaje imperfecto (mazo real) y factor de duración sobre deckFallMs.
interface DeckCard {
  value: HeroValue
  x0: number
  z0: number
  tiltY: number
  x1: number
  y1: number
  z1: number
  f: number
}

const CARDS: readonly DeckCard[] = [
  { value: 1, x0: -240, z0: -24, tiltY: -7, x1: -5, y1: -2, z1: -6, f: 1.0 },
  { value: 2, x0: -180, z0: 20, tiltY: 5, x1: 6, y1: 3, z1: 8, f: 1.1 },
  { value: 3, x0: -120, z0: -16, tiltY: 8, x1: -4, y1: -3, z1: -3, f: 0.94 },
  { value: 4, x0: -60, z0: 26, tiltY: -4, x1: 7, y1: 2, z1: 5, f: 1.16 },
  { value: 5, x0: 0, z0: -22, tiltY: 7, x1: -6, y1: -4, z1: -7, f: 1.04 },
  { value: 6, x0: 70, z0: 14, tiltY: -6, x1: 5, y1: 3, z1: 4, f: 1.12 },
  { value: 7, x0: 130, z0: -26, tiltY: 2, x1: -7, y1: -2, z1: -4, f: 0.92 },
  { value: 8, x0: 195, z0: 22, tiltY: -8, x1: 8, y1: 4, z1: 7, f: 1.14 },
  { value: 9, x0: 250, z0: -12, tiltY: 3, x1: 2, y1: 0, z1: 1, f: 1.2 },
  { value: 10, x0: 310, z0: -18, tiltY: -5, x1: 4, y1: 1, z1: 3, f: 0.98 },
]

export function Preloader({ done, onDone }: { done: boolean; onDone: () => void }) {
  const scopeRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const donePropRef = useRef(done)
  const onDoneRef = useRef(onDone)
  const skipRef = useRef(false)
  const salidoRef = useRef(false)
  const waitRef = useRef(0)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => { donePropRef.current = done }, [done])
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    const avisarFin = (): void => {
      if (salidoRef.current) return
      salidoRef.current = true
      onDoneRef.current()
    }

    if (reduced) {
      avisarFin()
      return
    }

    const t0 = Date.now()
    let exitTl: gsap.core.Timeline | null = null

    // Salida: robo de la carta 10 (glow ámbar), saltito de la mascota y fade
    // del overlay. Se dispara cuando la secuencia terminó Y (el canvas avisó
    // O pasó el hold). El orden de las animaciones lo fija el timeline del ctx.
    const exitNow = (): void => {
      if (salidoRef.current || exitTl !== null) return
      const overlay = scopeRef.current
      if (overlay === null) {
        avisarFin()
        return
      }
      const top = overlay.querySelector<HTMLElement>('.pl-card--top')
      const glow = overlay.querySelector<HTMLElement>('.pl-card__glow')
      const mascot = overlay.querySelector<HTMLElement>('.pl-mascot')
      exitTl = gsap.timeline({ onComplete: avisarFin })
      if (top !== null) {
        exitTl.to(top, { x: '+=36', y: '-=12', rotation: 10, scale: 1.05, duration: 0.35, ease: 'power2.inOut' }, 0)
      }
      if (glow !== null) {
        exitTl
          .fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out' }, 0.05)
          .to(glow, { opacity: 0, duration: 0.3 }, 0.32)
      }
      if (mascot !== null) {
        exitTl
          .to(mascot, { y: '-=10', duration: 0.16, ease: 'power2.out' }, 0)
          .to(mascot, { y: '+=10', duration: 0.26, ease: 'power2.in' }, 0.16)
      }
      exitTl.to(overlay, { opacity: 0, scale: 0.97, duration: 0.45, ease: 'power2.inOut' }, 0.45)
    }

    // La secuencia marca el ritmo; done/hold solo deciden CUÁNDO sale.
    const maybeExit = (): void => {
      if (donePropRef.current || skipRef.current || Date.now() - t0 >= HERO.timings.preloaderHoldMs) {
        exitNow()
        return
      }
      waitRef.current = window.setTimeout(maybeExit, 120)
    }

    const ctx = gsap.context(() => {
      const overlay = scopeRef.current
      const cartas = gsap.utils.toArray<HTMLElement>('.pl-card')
      const stack = overlay?.querySelector<HTMLElement>('.pl-stack') ?? null
      const shadow = overlay?.querySelector<HTMLElement>('.pl-shadow') ?? null
      const mascot = overlay?.querySelector<HTMLElement>('.pl-mascot') ?? null
      const ojos = gsap.utils.toArray<HTMLElement>('.pl-mascot__eye')
      if (overlay === null || cartas.length === 0) {
        exitNow()
        return
      }

      const caidaY = window.innerHeight + 220
      const stagger = HERO.timings.deckStaggerMs / 1000
      const fall = HERO.timings.deckFallMs / 1000
      const ultima = CARDS.length - 1

      // Estado inicial: cartas arriba fuera de pantalla, mazo sombreado a
      // medio crecer y la mascota esperando (la perspectiva va por carta
      // para que el apilado siga pintándose en orden de documento).
      cartas.forEach((carta, i) => {
        const d = CARDS[i]
        if (d === undefined) return
        gsap.set(carta, {
          x: d.x0,
          y: -caidaY,
          rotation: d.z0,
          rotateX: -40,
          rotateY: d.tiltY * -2,
          transformPerspective: 900,
        })
      })
      if (mascot !== null) {
        gsap.set(mascot, { y: -460, x: 4, scale: 0.92, rotation: 6, transformOrigin: '50% 100%' })
      }

      const tl = gsap.timeline({ onComplete: maybeExit })
      tlRef.current = tl

      if (shadow !== null) {
        tl.fromTo(
          shadow,
          { scale: 0.85, opacity: 0.35 },
          { scale: 1.35, opacity: 0.6, duration: ultima * stagger + fall, ease: 'none' },
          0,
        )
      }

      cartas.forEach((carta, i) => {
        const d = CARDS[i]
        if (d === undefined) return
        const t0caida = i * stagger
        const dur = d.f * fall
        const aterriza = t0caida + dur
        const esUltima = i === ultima

        // 1) Caída con aceleración y tumble 3D (rotateX -40° -> 0°).
        tl.to(
          carta,
          { x: d.x1, y: d.y1, rotation: d.z1, rotateX: 0, rotateY: d.tiltY, duration: dur, ease: 'power3.in' },
          t0caida,
        )

        // 2) Squash & stretch al aterrizar + micro-bote (0.18s).
        tl.to(
          carta,
          {
            keyframes: [
              { scaleY: 0.9, scaleX: 1.07, duration: 0.06 },
              { scaleY: 1.04, scaleX: 0.98, duration: 0.07 },
              { scaleY: 1, scaleX: 1, duration: 0.08 },
            ],
            transformOrigin: '50% 100%',
            ease: 'none',
          },
          aterriza,
        )
        tl.to(carta, { y: d.y1 - 7, duration: 0.07, ease: 'power2.out' }, aterriza + 0.04)
          .to(carta, { y: d.y1, duration: 0.11, ease: 'power2.out' }, aterriza + 0.11)

        // 2b) Puff de polvo justo con el impacto; el de la última es más grande.
        const puff = carta.querySelector<HTMLElement>('.pl-puff')
        if (puff !== null) {
          tl.fromTo(
            puff,
            { scale: 0.3, opacity: 0.55 },
            { scale: esUltima ? 2 : 1.6, opacity: 0, duration: esUltima ? 0.35 : 0.28, ease: 'power1.out', immediateRender: false },
            aterriza,
          )
        }

        // 3) Micro-shake del mazo con cada impacto (x ±2px).
        if (stack !== null) {
          tl.to(stack, { x: 2, duration: 0.03, ease: 'none' }, aterriza)
            .to(stack, { x: -2, duration: 0.03, ease: 'none' }, aterriza + 0.03)
            .to(stack, { x: 0, duration: 0.02, ease: 'none' }, aterriza + 0.06)
        }
      })

      const tImpacto = ultima * stagger + (CARDS[ultima]?.f ?? 1) * fall

      // 4) Screen shake de la última carta (3 oscilaciones, ±4px).
      tl.to(
        overlay,
        {
          keyframes: [
            { x: -4, y: 2, duration: 0.035 },
            { x: 4, y: -2, duration: 0.035 },
            { x: -3, y: 2, duration: 0.035 },
            { x: 3, y: -2, duration: 0.035 },
            { x: -2, y: 1, duration: 0.03 },
            { x: 2, y: -1, duration: 0.03 },
            { x: 0, y: 0, duration: 0.05 },
          ],
          ease: 'none',
        },
        tImpacto,
      )

      // 5) La mascota cae sobre el mazo: squash, doble bote y ojos locos.
      const tMascota = tImpacto + 0.12
      if (mascot !== null) {
        tl.to(mascot, { y: 0, x: 0, scale: 1, rotation: -4, duration: 0.46, ease: 'power2.in' }, tMascota)
          .to(
            mascot,
            {
              keyframes: [
                { scaleY: 0.8, scaleX: 1.12, duration: 0.07 },
                { scaleY: 1.06, scaleX: 0.95, duration: 0.08 },
                { scaleY: 1, scaleX: 1, duration: 0.09 },
              ],
              ease: 'none',
            },
            tMascota + 0.46,
          )
          .to(mascot, { y: -9, duration: 0.12, ease: 'power2.out' }, tMascota + 0.72)
          .to(mascot, { y: 0, duration: 0.16, ease: 'power2.in' }, tMascota + 0.84)
      }
      if (ojos.length > 0) {
        tl.to(
          ojos,
          { rotation: (i) => (i === 0 ? -8 : 8), duration: 0.09, yoyo: true, repeat: 1, ease: 'sine.inOut', stagger: 0.02 },
          tMascota + 0.52,
        ).to(ojos, { rotation: 0, duration: 0.14, ease: 'power2.out' }, tMascota + 0.82)
      }
    }, scopeRef)

    return () => {
      window.clearTimeout(waitRef.current)
      tlRef.current = null
      ctx.revert()
    }
    // Intencionado: la secuencia corre una sola vez al montar; onDone se
    // sirve vía ref para no reiniciar la animación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clic/tecla: acelera la secuencia; si ya está esperando (hold o done), sale ya.
  const saltar = (): void => {
    if (salidoRef.current) return
    skipRef.current = true
    tlRef.current?.timeScale(5)
  }

  if (reduced) return null

  return (
    <div
      ref={scopeRef}
      className="pl-overlay"
      role="status"
      aria-label="Cargando"
      tabIndex={0}
      onClick={saltar}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') saltar() }}
    >
      <div className="pl-stack">
        <span className="pl-shadow" aria-hidden="true" />
        {CARDS.map((d, i) => (
          <div key={d.value} className={`pl-card${i === CARDS.length - 1 ? ' pl-card--top' : ''}`}>
            <CardView value={d.value} />
            <span className="pl-puff" aria-hidden="true" />
            {i === CARDS.length - 1 && <span className="pl-card__glow" aria-hidden="true" />}
          </div>
        ))}
        <span className="pl-mascot" aria-hidden="true">
          <span className="pl-mascot__eye pl-mascot__eye--l"><i /></span>
          <span className="pl-mascot__eye pl-mascot__eye--r"><i /></span>
        </span>
      </div>
      <small className="pl-hint">Clic para saltar</small>
    </div>
  )
}
