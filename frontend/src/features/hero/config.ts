// frontend/src/features/hero/config.ts
// Fuente única de verdad del hero: colores de cartas (calibrados contra la
// foto real), orden del carrusel, tiempos, easings, copy y sonido.
// Los monstruos 3D agregan su bloque `monsters` en la Task 5.

export type HeroValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export const HERO_VALUES: HeroValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export interface CardDesign {
  /** Fondo de acuarela de la carta */
  bg: string
  /** Relleno del número */
  num: string
  /** Color del monstruo (pintado y, luego, tinte 3D/glow) */
  monster: string
  /** Rotación juguetona del número en grados */
  numTilt: number
}

export interface HeroConfig {
  order: HeroValue[]
  cards: Record<HeroValue, CardDesign>
  timings: {
    autoAdvanceMs: number
    resumeAfterMs: number
    slideMs: number
    introStaggerMs: number
    preloaderMinMs: number
    deckStaggerMs: number
    deckFallMs: number
    preloaderHoldMs: number
    wordmarkMs: number
    exitFadeMs: number
  }
  easings: { slide: string; slideCss: string; pop: string }
  fur: { shells: number; rootDarken: number; tipLighten: number; thickness: number }
  camera: { fov: number; y: number }
  copy: {
    badgeGold: string
    badgeWhite: string
    h1: [string, string]
    sub: string
    ctaPrimary: string
    ctaGhost: string
  }
  sound: { enabledByDefault: boolean }
}

// Colores calibrados a ojo sobre la foto de las 10 cartas (2026-10-15).
// Se afinan en la Task 3 con comparación lado a lado.
export const HERO: HeroConfig = {
  order: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  cards: {
    1: { bg: '#5E8BD8', num: '#E8F4FF', monster: '#56B7F0', numTilt: -4 },
    2: { bg: '#8A63C9', num: '#3B2A8C', monster: '#38335F', numTilt: 3 },
    3: { bg: '#E08A5C', num: '#D9332F', monster: '#D93A30', numTilt: -2 },
    4: { bg: '#C96FB5', num: '#A044A8', monster: '#C93E9F', numTilt: 4 },
    5: { bg: '#9ACB5A', num: '#43B02A', monster: '#58BE3A', numTilt: -5 },
    6: { bg: '#EFA23F', num: '#E87830', monster: '#F08A2E', numTilt: 3 },
    7: { bg: '#F2E36B', num: '#F7E96F', monster: '#F6E34A', numTilt: -3 },
    8: { bg: '#7A79D0', num: '#33368C', monster: '#2E2E6E', numTilt: 2 },
    9: { bg: '#5BC8BE', num: '#1FA79C', monster: '#35B3A8', numTilt: -4 },
    10: { bg: '#F08FB8', num: '#E64A8D', monster: '#F0559E', numTilt: 5 },
  },
  timings: {
    autoAdvanceMs: 3200,
    resumeAfterMs: 5000,
    slideMs: 650,
    introStaggerMs: 90,
    preloaderMinMs: 600,
    deckStaggerMs: 185,
    deckFallMs: 780,
    preloaderHoldMs: 2400,
    wordmarkMs: 650,
    exitFadeMs: 850,
  },
  easings: { slide: 'expo.out', slideCss: 'cubic-bezier(0.16, 1, 0.3, 1)', pop: 'back.out(1.7)' },
  fur: { shells: 20, rootDarken: 0.12, tipLighten: 0.18, thickness: 0.06 },
  camera: { fov: 32, y: 0.4 },
  copy: {
    badgeGold: 'UN JUEGO DE MESA',
    badgeWhite: 'VERSIÓN DIGITAL',
    h1: ['Pelusas,', 'bajo la lámpara.'],
    sub: 'Sacá cartas del mazo, guardá tus pelusas y robale al resto. Vos jugás; las reglas las decide el servidor.',
    ctaPrimary: 'Nueva partida',
    ctaGhost: 'Historial',
  },
  sound: { enabledByDefault: false },
}
