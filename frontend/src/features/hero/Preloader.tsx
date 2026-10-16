// frontend/src/features/hero/Preloader.tsx
// Carga/entrada del hero (T2c): la baraja cae carta a carta sobre la mesa
// —grande y lenta— con squash & stretch, polvo y chispas; la mascota pelusa
// aterriza encima; se roba la carta 10 con destello ámbar y el nombre del
// juego aparece con entrada degradada antes del crossfade al hero.
// Solo GSAP anima transform/opacity. La secuencia corre completa (ya no se
// saltea con clic ni tecla): al final aparece el botón "Jugar" y su clic hace
// el crossfade al hero. reduced-motion: instantáneo (ni se muestra).
import { useEffect, useRef, useState } from 'react'
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

// Chispas deterministas (offsets fijos en px de la escena; el scale del CSS
// las multiplica junto al mazo). Impacto: abanico hacia arriba desde la base;
// robo: estallido alrededor de la carta 10.
const IMPACT_SPARKS: readonly { x: number; y: number }[] = [
  { x: -38, y: -22 }, { x: -20, y: -36 }, { x: 4, y: -42 },
  { x: 26, y: -32 }, { x: 40, y: -16 }, { x: -6, y: -26 },
]
const DRAW_SPARKS: readonly { x: number; y: number }[] = [
  { x: -52, y: -10 }, { x: -30, y: -38 }, { x: 2, y: -52 }, { x: 34, y: -40 },
  { x: 54, y: -8 }, { x: 30, y: 16 }, { x: -28, y: 18 }, { x: 4, y: 24 },
]

export function Preloader({
  done,
  onReveal,
  onDone,
}: {
  done: boolean
  onReveal: () => void
  onDone: () => void
}) {
  const scopeRef = useRef<HTMLDivElement>(null)
  const finTlRef = useRef<gsap.core.Timeline | null>(null)
  const donePropRef = useRef(done)
  const onRevealRef = useRef(onReveal)
  const onDoneRef = useRef(onDone)
  const jugarRef = useRef<HTMLButtonElement>(null)
  const [listo, setListo] = useState(false)
  const salidoRef = useRef(false)
  const waitRef = useRef(0)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => { donePropRef.current = done }, [done])
  useEffect(() => { onRevealRef.current = onReveal }, [onReveal])
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    const avisarFin = (): void => {
      if (salidoRef.current) return
      salidoRef.current = true
      onDoneRef.current()
    }

    if (reduced) {
      onRevealRef.current()
      avisarFin()
      return
    }

    const t0 = Date.now()
    let revelado = false
    const revelar = (): void => {
      if (revelado) return
      revelado = true
      onRevealRef.current()
    }

    // Final: robo de la carta 10 (glow + rayos + chispas), wordmark "Pelusas"
    // con entrada degradada, beat y salida en crossfade (onReveal arranca
    // justo con el fade para que el copy suba mientras el overlay se va).
    const finalizar = (): void => {
      if (salidoRef.current || finTlRef.current !== null) return
      const overlay = scopeRef.current
      if (overlay === null) {
        revelar()
        avisarFin()
        return
      }
      const top = overlay.querySelector<HTMLElement>('.pl-card--top')
      const glow = overlay.querySelector<HTMLElement>('.pl-card__glow')
      const rays = overlay.querySelector<HTMLElement>('.pl-rays')
      const mascot = overlay.querySelector<HTMLElement>('.pl-mascot')
      const letras = gsap.utils.toArray<HTMLElement>('.pl-wordmark__l')
      const chispasRobo = gsap.utils.toArray<HTMLElement>('.pl-sparks--draw .pl-spark')

      const fin = gsap.timeline()
      finTlRef.current = fin

      // 1) Robo: la carta 10 se desliza y estalla en ámbar.
      if (top !== null) {
        fin.to(top, { x: '+=44', y: '-=14', rotation: 10, scale: 1.06, duration: 0.5, ease: 'power2.inOut' }, 0)
      }
      if (glow !== null) {
        fin.to(glow, { opacity: 0.9, duration: 0.22, ease: 'power2.out' }, 0)
          .to(glow, { opacity: 0.4, duration: 0.4 }, 0.28)
      }
      if (rays !== null) {
        fin.fromTo(rays, { opacity: 0, scale: 0.5 }, { opacity: 0.85, scale: 1.4, duration: 0.45, ease: 'power2.out' }, 0.02)
          .to(rays, { opacity: 0, duration: 0.5 }, 0.47)
      }
      chispasRobo.forEach((chispa, i) => {
        const off = DRAW_SPARKS[i % DRAW_SPARKS.length]
        if (off === undefined) return
        fin.fromTo(
          chispa,
          { x: 0, y: 4, scale: 0.4, opacity: 0.9 },
          { x: off.x, y: off.y, scale: 1.1, opacity: 0, duration: 0.6, ease: 'power2.out', immediateRender: false },
          0.03 + (i % 3) * 0.02,
        )
      })
      if (mascot !== null) {
        fin.to(mascot, { y: '-=12', duration: 0.18, ease: 'power2.out' }, 0)
          .to(mascot, { y: '+=12', duration: 0.3, ease: 'power2.in' }, 0.18)
      }

      // 2) Wordmark: letras que se abren desde el centro + fade (degradado).
      const tNombre = 0.55
      const dur = HERO.timings.wordmarkMs / 1000
      let finNombre = tNombre
      if (letras.length > 0) {
        const centro = (letras.length - 1) / 2
        fin.fromTo(
          letras,
          { x: (i) => (centro - i) * 16, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: dur,
            ease: 'power3.out',
            stagger: { each: 0.035, from: 'center' },
            immediateRender: false,
          },
          tNombre,
        )
        finNombre = tNombre + dur
      }

      // 3) Beat con el nombre y aparición del botón "Jugar": la secuencia ya
      // no se sale sola — el crossfade al hero lo dispara el clic (entrar()).
      const tSalida = finNombre + 0.45
      const jugar = overlay.querySelector<HTMLElement>('.pl-jugar')
      if (jugar !== null) {
        fin.fromTo(
          jugar,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', onStart: () => setListo(true) },
          tSalida,
        )
      }
    }

    // La secuencia marca el ritmo; done/hold solo deciden CUÁNDO sale el final.
    const maybeExit = (): void => {
      if (donePropRef.current || Date.now() - t0 >= HERO.timings.preloaderHoldMs) {
        finalizar()
        return
      }
      waitRef.current = window.setTimeout(maybeExit, 120)
    }

    // Cada letra pinta su slice del gradiente continuo: ancho total de la
    // palabra en --wm-size y offset real de cada letra en background-position.
    // Se mide al montar y de nuevo cuando terminan de cargar las fuentes.
    const cortarGradiente = (): void => {
      const p = scopeRef.current?.querySelector<HTMLElement>('.pl-wordmark') ?? null
      if (p === null) return
      const ancho = p.offsetWidth
      if (ancho === 0) return
      const spans = gsap.utils.toArray<HTMLElement>('.pl-wordmark__l')
      p.style.setProperty('--wm-size', `${ancho}px`)
      spans.forEach((span) => {
        span.style.backgroundPosition = `${-span.offsetLeft}px 0`
      })
    }
    requestAnimationFrame(cortarGradiente)
    void document.fonts.ready.then(cortarGradiente).catch(() => {})

    const ctx = gsap.context(() => {
      const overlay = scopeRef.current
      const cartas = gsap.utils.toArray<HTMLElement>('.pl-card')
      const stack = overlay?.querySelector<HTMLElement>('.pl-stack') ?? null
      const shadow = overlay?.querySelector<HTMLElement>('.pl-shadow') ?? null
      const mascot = overlay?.querySelector<HTMLElement>('.pl-mascot') ?? null
      const ojos = gsap.utils.toArray<HTMLElement>('.pl-mascot__eye')
      const letras = gsap.utils.toArray<HTMLElement>('.pl-wordmark__l')
      const chispasImpacto = gsap.utils.toArray<HTMLElement>('.pl-sparks--impact .pl-spark')
      if (overlay === null || cartas.length === 0) {
        finalizar()
        return
      }

      // La escena va escalada por CSS (--pl-scale); la caída se divide por esa
      // escala para que el recorrido visual no se acelere con el tamaño.
      const scene = overlay.querySelector<HTMLElement>('.pl-scene')
      const escala = scene === null ? 1 : parseFloat(getComputedStyle(scene).getPropertyValue('--pl-scale')) || 1
      const caidaY = (window.innerHeight + 220) / escala
      const stagger = HERO.timings.deckStaggerMs / 1000
      const fall = HERO.timings.deckFallMs / 1000
      const ultima = CARDS.length - 1

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
      if (letras.length > 0) {
        gsap.set(letras, { opacity: 0 })
      }

      const tl = gsap.timeline({ onComplete: maybeExit })

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
        const tCaida = i * stagger
        const dur = d.f * fall
        const aterriza = tCaida + dur
        const esUltima = i === ultima

        // 1) Caída con aceleración y tumble 3D.
        tl.to(
          carta,
          { x: d.x1, y: d.y1, rotation: d.z1, rotateX: 0, rotateY: d.tiltY, duration: dur, ease: 'power3.in' },
          tCaida,
        )

        // 2) Squash & stretch + micro-bote.
        tl.to(
          carta,
          {
            keyframes: [
              { scaleY: 0.9, scaleX: 1.07, duration: 0.07 },
              { scaleY: 1.04, scaleX: 0.98, duration: 0.08 },
              { scaleY: 1, scaleX: 1, duration: 0.1 },
            ],
            transformOrigin: '50% 100%',
            ease: 'none',
          },
          aterriza,
        )
        tl.to(carta, { y: d.y1 - 7, duration: 0.09, ease: 'power2.out' }, aterriza + 0.05)
          .to(carta, { y: d.y1, duration: 0.13, ease: 'power2.out' }, aterriza + 0.14)

        // 2b) Puff de polvo.
        const puff = carta.querySelector<HTMLElement>('.pl-puff')
        if (puff !== null) {
          tl.fromTo(
            puff,
            { scale: 0.3, opacity: 0.55 },
            { scale: esUltima ? 2 : 1.6, opacity: 0, duration: esUltima ? 0.4 : 0.32, ease: 'power1.out', immediateRender: false },
            aterriza,
          )
        }

        // 3) Micro-shake del mazo.
        if (stack !== null) {
          tl.to(stack, { x: 2, duration: 0.03, ease: 'none' }, aterriza)
            .to(stack, { x: -2, duration: 0.03, ease: 'none' }, aterriza + 0.03)
            .to(stack, { x: 0, duration: 0.02, ease: 'none' }, aterriza + 0.06)
        }
      })

      const tImpacto = ultima * stagger + (CARDS[ultima]?.f ?? 1) * fall

      // 4) Impacto final: screen shake + chispas del golpe.
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
      chispasImpacto.forEach((chispa, i) => {
        const off = IMPACT_SPARKS[i % IMPACT_SPARKS.length]
        if (off === undefined) return
        tl.fromTo(
          chispa,
          { x: 0, y: 0, scale: 0.5, opacity: 0.9 },
          { x: off.x, y: off.y, scale: 1, opacity: 0, duration: 0.55, ease: 'power2.out', immediateRender: false },
          tImpacto + 0.05 + (i % 3) * 0.02,
        )
      })

      // 5) Mascota: cae sobre el mazo, squash, doble bote y ojos locos.
      const tMascota = tImpacto + 0.15
      if (mascot !== null) {
        tl.to(mascot, { y: 0, x: 0, scale: 1, rotation: -4, duration: 0.6, ease: 'power2.in' }, tMascota)
          .to(
            mascot,
            {
              keyframes: [
                { scaleY: 0.8, scaleX: 1.12, duration: 0.08 },
                { scaleY: 1.06, scaleX: 0.95, duration: 0.09 },
                { scaleY: 1, scaleX: 1, duration: 0.11 },
              ],
              ease: 'none',
            },
            tMascota + 0.6,
          )
          .to(mascot, { y: -9, duration: 0.15, ease: 'power2.out' }, tMascota + 0.9)
          .to(mascot, { y: 0, duration: 0.2, ease: 'power2.in' }, tMascota + 1.05)
      }
      if (ojos.length > 0) {
        tl.to(
          ojos,
          { rotation: (i) => (i === 0 ? -8 : 8), duration: 0.11, yoyo: true, repeat: 1, ease: 'sine.inOut', stagger: 0.02 },
          tMascota + 0.66,
        ).to(ojos, { rotation: 0, duration: 0.16, ease: 'power2.out' }, tMascota + 1.0)
      }

      // 6) Anticipación: el glow de la carta 10 pulsa mientras la mascota cae.
      const glow = overlay.querySelector<HTMLElement>('.pl-card__glow')
      if (glow !== null) {
        tl.to(glow, { opacity: 0.35, duration: 0.4, ease: 'sine.inOut' }, tMascota + 0.35)
      }
    }, scopeRef)

    return () => {
      window.clearTimeout(waitRef.current)
      finTlRef.current = null
      ctx.revert()
    }
    // Intencionado: la secuencia corre una sola vez al montar; los callbacks
    // se sirven vía refs para no reiniciar la animación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Única salida del overlay: clic en "Jugar" (aparece al cerrar el wordmark).
  // Fade del overlay y reveal del hero arrancan juntos (crossfade real).
  const entrar = (): void => {
    if (salidoRef.current) return
    salidoRef.current = true
    setListo(false)
    jugarRef.current?.blur()
    const overlay = scopeRef.current
    if (overlay === null) {
      onRevealRef.current()
      onDoneRef.current()
      return
    }
    gsap
      .timeline({ onComplete: onDoneRef.current })
      .call(onRevealRef.current, undefined, 0)
      .to(overlay, { opacity: 0, scale: 0.98, duration: HERO.timings.exitFadeMs / 1000, ease: 'power2.inOut' }, 0)
  }

  if (reduced) return null

  return (
    <div ref={scopeRef} className="pl-overlay" role="status" aria-label="Cargando">
      <div className="pl-scene">
        <div className="pl-stack">
          <span className="pl-shadow" aria-hidden="true" />
          <span className="pl-rays" aria-hidden="true" />
          {CARDS.map((d, i) => (
            <div key={d.value} className={`pl-card${i === CARDS.length - 1 ? ' pl-card--top' : ''}`}>
              <CardView value={d.value} />
              <span className="pl-puff" aria-hidden="true" />
              {i === CARDS.length - 1 && <span className="pl-card__glow" aria-hidden="true" />}
            </div>
          ))}
          <span className="pl-sparks pl-sparks--impact" aria-hidden="true">
            {IMPACT_SPARKS.map((_, i) => <i key={i} className="pl-spark" />)}
          </span>
          <span className="pl-sparks pl-sparks--draw" aria-hidden="true">
            {DRAW_SPARKS.map((_, i) => <i key={i} className="pl-spark pl-spark--amber" />)}
          </span>
          <span className="pl-mascot" aria-hidden="true">
            <span className="pl-mascot__eye pl-mascot__eye--l"><i /></span>
            <span className="pl-mascot__eye pl-mascot__eye--r"><i /></span>
          </span>
        </div>
      </div>
      <p className="pl-wordmark" aria-hidden="true">
        {'Pelusas'.split('').map((letra, i) => (
          <span key={`${letra}-${i}`} className="pl-wordmark__l">{letra}</span>
        ))}
      </p>
      <button ref={jugarRef} type="button" className="pl-jugar btn-primary" disabled={!listo} onClick={entrar}>
        {HERO.copy.ctaPlay}
      </button>
    </div>
  )
}
