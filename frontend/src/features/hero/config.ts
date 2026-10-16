// frontend/src/features/hero/config.ts
// Fuente única de verdad del hero: colores de cartas (calibrados contra la
// foto real), orden del carrusel, tiempos, easings, copy y sonido.
// T4 agrega FaceSpec (caras), el rig de luces y la escala del personaje;
// los monstruos 3D agregan su bloque `monsters` en la Task 5.

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
  /** Rig de luces del canvas (T4): solo lo usa el LOD `lite`; el pelaje
   *  `full` es un shader sin luces. */
  lights: {
    ambient: number
    key: { position: [number, number, number]; intensity: number }
    rim: { position: [number, number, number]; color: string; intensity: number }
  }
  /** Escala global del personaje 3D respecto del blob de radio 1 (T4): la
   *  calibra el encaje carta↔monstruo; T5 suma las proporciones por monstruo
   *  en MonsterDesign.scale. */
  character: { scale: number }
  copy: {
    badgeGold: string
    badgeWhite: string
    h1: string[]
    sub: string
    ctaPrimary: string
    ctaGhost: string
    ctaPlay: string
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
  lights: {
    ambient: 0.6,
    key: { position: [-3, 6, 6], intensity: 1.2 },
    rim: { position: [4, 2, -4], color: '#C026D3', intensity: 1.4 },
  },
  character: { scale: 0.35 },
  copy: {
    badgeGold: 'UN JUEGO DE MESA',
    badgeWhite: 'VERSIÓN DIGITAL',
    h1: ['Pelusas'],
    sub: 'Sacá cartas del mazo, guardá tus pelusas y robale al resto. Vos jugás; las reglas las decide el servidor.',
    ctaPrimary: 'Nueva partida',
    ctaGhost: 'Historial',
    ctaPlay: 'Jugar',
  },
  sound: { enabledByDefault: false },
}

// Cara final de la Pelusa 1 (T4), espejo de la biblia de cartas §5: bola
// esponjosa, UN ojo grande mirando arriba y boca "o". T5 la mueve dentro de
// `monsters` junto con las otras nueve.
export const FACE_1: FaceSpec = { eyes: { count: 1, size: 0.34, lookUp: 0.35 }, mouth: 'o' }

// Cara provisoria de las vecinas visibles (|off| <= 2) hasta que T5 defina
// cada monstruo contra la foto.
export const FACE_DEFAULT: FaceSpec = { eyes: { count: 2, size: 0.2 }, mouth: 'tinySmile' }
