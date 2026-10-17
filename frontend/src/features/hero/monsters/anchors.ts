// frontend/src/features/hero/monsters/anchors.ts
// Publica el rect CSS de cada carta y lo lee el canvas. Política: medir
// solo cuando algo se mueve (montaje, resize, transición) — nunca en idle.
import { HERO_VALUES, type HeroValue } from '../config'

export interface AnchorRect { x: number; y: number; w: number; h: number }

const els = new Map<HeroValue, HTMLElement>()
const rects = new Map<HeroValue, AnchorRect>()

export function attachAnchor(v: HeroValue, el: HTMLElement | null): void {
  if (el) els.set(v, el)
  else els.delete(v)
  measureAnchor(v)
}

export function measureAnchor(v: HeroValue): void {
  const el = els.get(v)
  if (!el) return
  const r = el.getBoundingClientRect()
  rects.set(v, { x: r.left, y: r.top, w: r.width, h: r.height })
}

export function measureAllAnchors(): void {
  HERO_VALUES.forEach(measureAnchor)
}

export function readAnchor(v: HeroValue): AnchorRect | undefined {
  return rects.get(v)
}

// Rastreo temporal durante transiciones del carrusel (rAF durante `ms`).
let trackingUntil = 0
let trackRaf = 0
export function trackAnchorsFor(ms: number): void {
  trackingUntil = Math.max(trackingUntil, performance.now() + ms)
  if (trackRaf) return
  const loop = () => {
    measureAllAnchors()
    if (performance.now() < trackingUntil) trackRaf = requestAnimationFrame(loop)
    else trackRaf = 0
  }
  trackRaf = requestAnimationFrame(loop)
}
