// frontend/src/features/hero/intro.ts
// Intro cinematográfica post-preloader (T7): el nav entra con fade, el copy
// sube escalonado (el h1 con rebote) y las cartas se levantan una por una;
// el pop de los monstruos lo dispara HeroStage al final (prop `intro` de
// MonsterCanvas). Solo transform/opacity: sin saltos de layout (CLS ~0).
// Con reduced-motion HeroStage ni la construye (los estados finales son los
// defaults del CSS) y el preloader ya retorna null.
import gsap from 'gsap'

// Duración real de la intro construida (la fija playIntro al crearla; T8 la
// consume para coordinar). El valor inicial es estimado hasta el primer
// playIntro().
export let INTRO_DURATION_S = 2.6

// Construye la intro. Sin argumentos y sin scope propio: HeroStage la crea
// dentro de un gsap.context(stageRef) que acota los selectores planos, y T8
// recibe el timeline + INTRO_DURATION_S como interfaz.
export function playIntro(): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
  // Las ranuras transicionan por CSS (650 ms): se suprimen durante la intro
  // para que no peleen con los tweens; al final se devuelven con clearProps.
  tl.set('.hc-slot', { transition: 'none' }, 0)
  // El nav entra primero con fade (el brief arranca en el badge; sin esto el
  // nav aparece de golpe).
  tl.from('.hero-nav', { y: -10, autoAlpha: 0, duration: 0.4 }, 0)
    .from('.hero-badge', { y: 14, autoAlpha: 0, duration: 0.4 }, '-=0.2')
    .from('.hero-h1__w', { y: 44, autoAlpha: 0, duration: 0.6, stagger: 0.09, ease: 'back.out(1.7)' }, '-=0.1')
    .from('.hero-sub', { y: 16, autoAlpha: 0, duration: 0.45 }, '-=0.25')
    .from('.hero-ctas > *', { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.07 }, '-=0.2')
    .from('.hc-slot', { y: 90, autoAlpha: 0, duration: 0.7, stagger: 0.06 }, '-=0.3')
  // Cierre: se devuelve el DOM a su CSS. Los `from` dejan transform/opacity
  // inline y eso congelaría el carrusel (sus ranuras viven de vars CSS).
  tl.set(
    '.hero-nav, .hero-badge, .hero-h1__w, .hero-sub, .hero-ctas > *, .hc-slot',
    { clearProps: 'transform,opacity,visibility,transition' },
    '>',
  )
  INTRO_DURATION_S = tl.duration()
  return tl
}
