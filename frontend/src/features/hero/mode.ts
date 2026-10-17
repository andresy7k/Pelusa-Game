// frontend/src/features/hero/mode.ts
// Decide cómo se renderiza el hero: full (todo), lite (sin pelaje pesado
// ni postproceso), off (sin canvas). El flag ?hero=... pisa la detección.
// Sin imports: no necesita config (tsconfig tiene noUnusedLocals activo).

export type HeroMode = 'full' | 'lite' | 'off'

export function heroMode(
  search: string,
  env: { reducedMotion: boolean; coarsePointer: boolean; width: number },
): HeroMode {
  const q = new URLSearchParams(search).get('hero')
  if (q === 'full' || q === 'lite' || q === 'off') return q
  if (env.reducedMotion) return 'lite'
  if (env.coarsePointer || env.width < 768) return 'lite'
  return 'full'
}

export function envFromWindow(): { reducedMotion: boolean; coarsePointer: boolean; width: number } {
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    width: window.innerWidth,
  }
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}
