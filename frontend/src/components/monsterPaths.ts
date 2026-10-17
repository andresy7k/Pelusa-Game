// frontend/src/components/monsterPaths.ts
// Camino `d` de cada cuerpo pintado (viewBox 0 0 100 100): fuente única de la
// silueta de los 10 monstruos. MonsterFace.tsx los dibuja (la biblia visual,
// docs/superpowers/specs/2026-10-16-monstruos-referencia.md) y la geometría 3D
// (features/hero/monsters/geometry.ts) los muestrea para que la proyección
// frontal del blob calque exactamente el contorno dibujado.

// Silueta esponjosa: óvalo con lóbulos redondeados (la "pelusa" del cuerpo).
// `ondas` = cantidad de lóbulos; `amp` = cuánto sobresale cada lóbulo.
function pelusa(cx: number, cy: number, rx: number, ry: number, ondas: number, amp: number): string {
  const pt = (i: number): [number, number] => {
    const a = (i / ondas) * Math.PI * 2 - Math.PI / 2
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]
  }
  const [x0, y0] = pt(0)
  let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`
  for (let i = 0; i < ondas; i++) {
    const a = pt(i)
    const b = pt(i + 1)
    const mx = (a[0] + b[0]) / 2
    const my = (a[1] + b[1]) / 2
    const dx = mx - cx
    const dy = my - cy
    const len = Math.hypot(dx, dy) || 1
    d += ` Q ${(mx + (dx / len) * amp).toFixed(1)} ${(my + (dy / len) * amp).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`
  }
  return `${d} Z`
}

// Silueta con picos (mango del 5, erizo del 9): radios alternados; el
// `stroke-linejoin: round` del cuerpo redondea las puntas.
function picos(cx: number, cy: number, rx: number, ry: number, puntas: number, base: number): string {
  const pt = (i: number): [number, number] => {
    const a = (i / (puntas * 2)) * Math.PI * 2 - Math.PI / 2
    const f = i % 2 === 0 ? 1 : base
    return [cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f]
  }
  const [x0, y0] = pt(0)
  let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`
  for (let i = 1; i <= puntas * 2; i++) {
    const p = pt(i)
    d += ` L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  }
  return `${d} Z`
}

/** Contorno de cada cuerpo, en unidades del viewBox 0 0 100 100. */
export const CAMINOS: Record<number, string> = {
  1: pelusa(50, 55, 38, 36, 9, 12),
  2: pelusa(50, 60, 43, 30, 8, 12),
  3: pelusa(50, 56, 36, 34, 10, 11),
  4: pelusa(50, 54, 37, 38, 13, 10),
  5: picos(50, 55, 40, 39, 9, 0.78),
  6: pelusa(50, 60, 43, 31, 9, 13),
  7: 'M 15 79 L 15 50 Q 15 18 50 18 Q 85 18 85 50 L 85 79 Q 73 71 61.5 79 Q 50 87 38.5 79 Q 27 71 15 79 Z',
  8: pelusa(50, 52, 29, 40, 10, 11),
  9: picos(50, 56, 41, 38, 10, 0.8),
  10: pelusa(50, 55, 39, 38, 13, 10),
}
