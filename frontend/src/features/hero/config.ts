// frontend/src/features/hero/config.ts
// Fuente única de verdad del hero: colores de cartas (calibrados contra la
// foto real), orden del carrusel, tiempos, easings, copy y sonido.
// T4 agrega FaceSpec (caras), el rig de luces y la escala del personaje;
// T5 agrega el bloque `monsters` (los 10 diseños con silueta, cara,
// apéndices y special).

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

/** Cara paramétrica de un monstruo (la construye faces.ts; T5 la embebe en
 *  MonsterDesign). Medidas en unidades del cuerpo (radio 1, frente z≈0.86):
 *  `size` = radio del ojo; `lookUp` = cuánto mira arriba la pupila, como
 *  fracción del radio del ojo; `sleepy` = párpado superior (0..1); `sides` =
 *  ojos afuera del cuerpo (monstruos anchos); `ring` = color del ojo (por
 *  defecto blanco); `white` = fuerza el blanco. */
export interface FaceSpec {
  eyes: { count: 1 | 2; size: number; lookUp?: number; sides?: boolean; sleepy?: number; ring?: string; white?: boolean }
  mouth: 'o' | 'tinySmile' | 'tinyOpen' | 'wideSmile' | 'bigSmile' | 'crookedTooth' | 'grinTeeth2' | 'fangs' | 'openTeeth' | 'neutral'
  tongue?: string
  mouthInner?: string
}

/** Diseño de un monstruo del carrusel (T5): semilla y proporciones del blob
 *  (van a `makeBlobGeometry`), cara paramétrica (la consume `faces.ts`),
 *  apéndices con pelaje (los monta `Character.tsx`) y el efecto `special`
 *  (lo anima T6; en T5 solo se guarda el dato). */
export interface MonsterDesign {
  seed: number
  scale: [number, number, number]
  /** Cara paramétrica (la misma interfaz FaceSpec que consume faces.ts) */
  face: FaceSpec
  appendages: Array<'tailLeft' | 'tufts' | 'horns'>
  /** Efecto del special (T6) */
  special: 'bounce' | 'puff' | 'spring' | 'roar' | 'shake' | 'laugh' | 'confetti' | 'pulse' | 'dance' | 'stars'
}

export interface HeroConfig {
  order: HeroValue[]
  cards: Record<HeroValue, CardDesign>
  /** Los 10 monstruos con silueta, cara y apéndices (T5; T6 los anima) */
  monsters: Record<HeroValue, MonsterDesign>
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
  /** Rig de luces del canvas (T4): solo lo usa el LOD `lite`; el pelaje
   *  `full` es un shader sin luces. */
  lights: {
    ambient: number
    key: { position: [number, number, number]; intensity: number }
    rim: { position: [number, number, number]; color: string; intensity: number }
  }
  /** Escala global del personaje 3D respecto del blob de radio 1 (T4): la
   *  calibra el encaje carta↔monstruo; T5 suma las proporciones por monstruo
   *  en MonsterDesign.scale. `refHeight` = alto de viewport donde se calibró
   *  `scale`: el canvas compensa (refHeight/alto) para que el monstruo
   *  mantenga su tamaño CSS pegado a la carta con cualquier zoom o ventana
   *  (la proyección perspectiva escala con el alto del viewport). */
  character: { scale: number; refHeight: number }
  copy: {
    badgeGold: string
    badgeWhite: string
    h1: string[]
    sub: string
    ctaPrimary: string
    ctaGhost: string
  }
  sound: { enabledByDefault: boolean }
}

// Colores calibrados contra las fotos reales de las cartas; la transcripción
// manda: docs/superpowers/specs/2026-10-16-monstruos-referencia.md.
export const HERO: HeroConfig = {
  order: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  cards: {
    1: { bg: '#5E8BD8', num: '#E8F4FF', monster: '#56B7F0', numTilt: -4 },
    2: { bg: '#8A63C9', num: '#3B2A8C', monster: '#38335F', numTilt: 3 },
    3: { bg: '#E08A5C', num: '#D9332F', monster: '#D93A30', numTilt: -2 },
    4: { bg: '#C96FB5', num: '#A044A8', monster: '#A83B90', numTilt: 4 },
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
  lights: {
    ambient: 0.6,
    key: { position: [-3, 6, 6], intensity: 1.2 },
    rim: { position: [4, 2, -4], color: '#C026D3', intensity: 1.4 },
  },
  character: { scale: 0.35, refHeight: 768 },
  // Los 10 monstruos calibrados contra la biblia del spec §5 (T5): semilla y
  // proporciones del blob, cara paramétrica, apéndices y special (T6).
  monsters: {
    1: { seed: 11, scale: [1.0, 1.0, 1.0], face: { eyes: { count: 1, size: 0.34, lookUp: 0.35 }, mouth: 'o' }, appendages: [], special: 'bounce' },
    2: { seed: 22, scale: [1.18, 0.72, 1.0], face: { eyes: { count: 2, size: 0.24, sleepy: 0.7, ring: '#7BC86C' }, mouth: 'wideSmile', tongue: '#F4D420' }, appendages: [], special: 'puff' },
    3: { seed: 33, scale: [1.05, 0.6, 1.0], face: { eyes: { count: 2, size: 0.2, lookUp: 0.45 }, mouth: 'tinySmile' }, appendages: ['tailLeft'], special: 'spring' },
    4: { seed: 44, scale: [0.95, 1.08, 1.0], face: { eyes: { count: 1, size: 0.36, ring: '#E8C84A' }, mouth: 'fangs' }, appendages: [], special: 'roar' },
    5: { seed: 55, scale: [1.0, 1.0, 1.0], face: { eyes: { count: 1, size: 0.34, ring: '#D7E84A' }, mouth: 'crookedTooth' }, appendages: [], special: 'shake' },
    6: { seed: 66, scale: [1.22, 0.68, 1.0], face: { eyes: { count: 2, size: 0.16, sleepy: 0.45 }, mouth: 'grinTeeth2' }, appendages: [], special: 'laugh' },
    7: { seed: 77, scale: [1.0, 1.05, 1.0], face: { eyes: { count: 2, size: 0.15, lookUp: 0.5 }, mouth: 'bigSmile', tongue: '#F06292' }, appendages: ['tufts'], special: 'confetti' },
    8: { seed: 88, scale: [1.12, 0.8, 1.0], face: { eyes: { count: 1, size: 0.4, white: true }, mouth: 'neutral' }, appendages: [], special: 'pulse' },
    9: { seed: 99, scale: [1.26, 0.62, 1.0], face: { eyes: { count: 2, size: 0.28, sides: true, ring: '#F2D33C' }, mouth: 'tinyOpen' }, appendages: [], special: 'dance' },
    10: { seed: 101, scale: [1.0, 0.9, 1.0], face: { eyes: { count: 2, size: 0.18, lookUp: 0.3 }, mouth: 'openTeeth', mouthInner: '#3E7BD6' }, appendages: ['horns'], special: 'stars' },
  },
  copy: {
    badgeGold: 'UN JUEGO DE MESA',
    badgeWhite: 'VERSIÓN DIGITAL',
    h1: ['Pelusas'],
    sub: 'Sacá cartas del mazo, guardá tus pelusas y robale al resto. Vos jugás; las reglas las decide el servidor.',
    ctaPrimary: 'Nueva partida',
    ctaGhost: 'Historial',
  },
  sound: { enabledByDefault: false },
}
