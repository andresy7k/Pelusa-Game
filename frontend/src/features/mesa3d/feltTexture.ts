// frontend/src/features/mesa3d/feltTexture.ts
// El tapete creativo (paso 2): la superficie de juego es la PIEL DE UNA
// PELUSA gigante. Pelaje peinado en remolino hacia el centro (ahí vivirá el
// mazo), "nidos" aplastados y cosidos donde se sienta cada jugador, un
// dobladillo de hilo alrededor del ojo del remolino y la etiqueta de tela
// cosida del juguete ("PELUSAS — SACÁ · GUARDÁ · ROBÁ"). Todo procedural
// (CanvasTexture): sin assets nuevos.
import * as THREE from 'three'
import { MESA3D, seatPoint } from './config'

/** PRNG determinista: la textura sale igual en cada carga. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mezcla lineal de dos hex (t 0..1). */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const l = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${l(r1, r2)},${l(g1, g2)},${l(b1, b2)})`
}

/** Coordenada de mundo x → píxel de la textura. */
const ux = (x: number, w: number) => (x / (MESA3D.table.rx * 2) + 0.5) * w
/** Coordenada de mundo z → píxel (flipY: el borde lejano cae arriba). */
const vz = (z: number, h: number) => ((z + MESA3D.table.ry) / (MESA3D.table.ry * 2)) * h

/** Puntada: círculo de hilo (sombra desplazada + trazo discontinuo). */
function stitchCircle(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  w: number,
  dash: number[],
  alpha = 1,
): void {
  g.save()
  g.globalAlpha = alpha * 0.45
  g.setLineDash(dash)
  g.lineWidth = w + 2
  g.strokeStyle = 'rgba(5,3,14,1)'
  g.beginPath()
  g.arc(x, y + 2.5, r, 0, Math.PI * 2)
  g.stroke()
  g.globalAlpha = alpha
  g.lineWidth = w
  g.strokeStyle = color
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.stroke()
  g.restore()
}

/** Estrella de 4 puntas (bordado ✦) centrada en (0,0). */
function starPath(g: CanvasRenderingContext2D, s: number): void {
  const k = 0.24
  g.beginPath()
  g.moveTo(0, -s)
  g.quadraticCurveTo(s * k, -s * k, s, 0)
  g.quadraticCurveTo(s * k, s * k, 0, s)
  g.quadraticCurveTo(-s * k, s * k, -s, 0)
  g.quadraticCurveTo(-s * k, -s * k, 0, -s)
  g.closePath()
}

function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

const cache = new Map<number, THREE.Texture>()

/** Construye (o reusa) la textura del tapete para `seatCount` jugadores. */
export async function buildFeltTexture(seatCount: number): Promise<THREE.Texture> {
  const hit = cache.get(seatCount)
  if (hit) return hit

  // Fuentes del juego (si aún no cargaron, el canvas usa su fallback).
  try {
    await Promise.all([
      document.fonts.load('160px "Bowlby One"'),
      document.fonts.load('700 66px "Baloo 2"'),
      document.fonts.ready,
    ])
  } catch {
    /* sin fuentes: fallback del canvas */
  }

  const [W, H] = MESA3D.felt.size
  const rx = MESA3D.table.rx
  const ry = MESA3D.table.ry
  const c = MESA3D.colors
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  const rnd = mulberry32(0x51ce ^ (seatCount * 7919))
  const cx = W / 2
  const cy = H / 2
  const pxPerUnit = W / (rx * 2)

  // 1) Base: degradado elíptico (borde profundo → centro lila bajo la lámpara).
  g.save()
  g.translate(cx, cy)
  g.scale(1, H / W)
  const base = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.5)
  base.addColorStop(0, c.feltLit)
  base.addColorStop(0.55, c.feltMid)
  base.addColorStop(1, c.feltEdge)
  g.fillStyle = base
  g.fillRect(-W / 2, -W / 2, W, W)
  g.restore()

  // 2) Pelaje: hebras cortas peinadas en remolino hacia el ojo del centro.
  const N = MESA3D.felt.strands
  for (let i = 0; i < N; i++) {
    let ex: number
    let ez: number
    let d2: number
    do {
      ex = rnd() * 2 - 1
      ez = rnd() * 2 - 1
      d2 = ex * ex + ez * ez
    } while (d2 > 1)
    const x = ex * rx
    const z = ez * ry
    const r = Math.sqrt(d2) // 0 = centro, 1 = borde
    const phi = Math.atan2(z / ry, x / rx)
    const ang = phi + Math.PI / 2 + 1.15 * Math.pow(1 - r, 1.6) // tangente + torsión
    const px = ux(x, W)
    const py = vz(z, H)
    const len = 8 + rnd() * 12
    const bend = (rnd() - 0.5) * len * 0.6
    const midX = px + Math.cos(ang) * len * 0.5 - Math.sin(ang) * bend * 0.4
    const midY = py + Math.sin(ang) * len * 0.5 + Math.cos(ang) * bend * 0.4
    const endX = px + Math.cos(ang) * len - Math.sin(ang) * bend
    const endY = py + Math.sin(ang) * len + Math.cos(ang) * bend
    const light = Math.pow(1 - r, 1.25) * (0.35 + rnd() * 0.65)
    g.strokeStyle = mix(c.strandDark, c.strandLight, light)
    g.globalAlpha = 0.09 + rnd() * 0.17
    g.lineWidth = 1.1 + rnd() * 1.3
    g.beginPath()
    g.moveTo(px, py)
    g.quadraticCurveTo(midX, midY, endX, endY)
    g.stroke()
  }
  g.globalAlpha = 1

  // 3) Ojo del remolino: pelo apretado y más claro + pozo oscuro (ahí el mazo).
  const eyePx = MESA3D.felt.whorlEye * pxPerUnit
  for (let i = 0; i < 9000; i++) {
    const a = rnd() * Math.PI * 2
    const rr = eyePx * (0.35 + rnd() * 1.35)
    const px = cx + Math.cos(a) * rr
    const py = cy + Math.sin(a) * rr
    const ang = a + Math.PI / 2 + 1.35
    const len = 4 + rnd() * 6
    g.strokeStyle = mix(c.feltMid, c.strandLight, 0.35 + rnd() * 0.65)
    g.globalAlpha = 0.08 + rnd() * 0.14
    g.lineWidth = 1 + rnd() * 1.1
    g.beginPath()
    g.moveTo(px, py)
    g.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len)
    g.stroke()
  }
  g.globalAlpha = 1
  const eye = g.createRadialGradient(cx, cy, 0, cx, cy, eyePx * 1.15)
  eye.addColorStop(0, 'rgba(8,5,20,0.95)')
  eye.addColorStop(0.55, 'rgba(15,10,32,0.55)')
  eye.addColorStop(1, 'rgba(15,10,32,0)')
  g.fillStyle = eye
  g.beginPath()
  g.arc(cx, cy, eyePx * 1.15, 0, Math.PI * 2)
  g.fill()

  // 4) Dobladillo cosido alrededor del ojo (doble puntada de hilo lila).
  const hemPx = MESA3D.felt.hemRadius * pxPerUnit
  stitchCircle(g, cx, cy, hemPx, c.thread, 7, [26, 15], 0.9)
  stitchCircle(g, cx, cy, hemPx * 0.9, c.thread, 4, [14, 12], 0.55)

  // 5) Nidos por jugador: pelo aplastado + aro cosido + botón cosido afuera.
  const nidoPx = MESA3D.seats.nido * pxPerUnit
  for (let i = 0; i < seatCount; i++) {
    const p = seatPoint(i, seatCount)
    const px = ux(p.x, W)
    const py = vz(p.z, H)
    const flat = g.createRadialGradient(px, py, 0, px, py, nidoPx)
    flat.addColorStop(0, 'rgba(10,7,26,0.5)')
    flat.addColorStop(0.78, 'rgba(10,7,26,0.28)')
    flat.addColorStop(1, 'rgba(10,7,26,0)')
    g.fillStyle = flat
    g.beginPath()
    g.arc(px, py, nidoPx, 0, Math.PI * 2)
    g.fill()
    stitchCircle(g, px, py, nidoPx, c.thread, 6, [22, 14], 0.85)
    // Botón cosido en el borde externo del nido (hacia afuera de la mesa).
    const dx = px - cx
    const dy = py - cy
    const dl = Math.hypot(dx, dy) || 1
    const bx = px + (dx / dl) * nidoPx * 0.88
    const by = py + (dy / dl) * nidoPx * 0.88
    g.fillStyle = '#3B2E63'
    g.beginPath()
    g.arc(bx, by, 26, 0, Math.PI * 2)
    g.fill()
    stitchCircle(g, bx, by, 30, c.thread, 3.5, [8, 7], 0.7)
    g.fillStyle = 'rgba(8,5,20,0.9)'
    for (const [hx, hy] of [
      [-8, -8],
      [8, -8],
      [-8, 8],
      [8, 8],
    ] as const) {
      g.beginPath()
      g.arc(bx + hx, by + hy, 3.6, 0, Math.PI * 2)
      g.fill()
    }
  }

  // 6) Chispas bordadas (✦): hilo lila y algún acento ámbar.
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2
    const rr = 0.42 + rnd() * 0.42
    const sx = cx + Math.cos(a) * rr * (W / 2) * 0.96
    const sy = cy + Math.sin(a) * rr * (H / 2) * 0.96
    g.save()
    g.translate(sx, sy)
    g.rotate(rnd() * Math.PI)
    g.globalAlpha = 0.4 + rnd() * 0.3
    g.strokeStyle = rnd() < 0.25 ? c.threadAmber : c.thread
    g.lineWidth = 4
    g.setLineDash([10, 7])
    starPath(g, 22 + rnd() * 30)
    g.stroke()
    g.restore()
  }

  // 7) Etiqueta de tela cosida (lado lejano, como la de un peluche).
  const L = MESA3D.label
  g.save()
  g.translate(ux(L.x, W), vz(L.z, H))
  g.rotate(L.rot)
  const lw = 900
  const lh = 350
  g.globalAlpha = 0.94
  roundRectPath(g, -lw / 2, -lh / 2, lw, lh, 40)
  g.fillStyle = '#241B3E'
  g.fill()
  g.globalAlpha = 1
  g.save()
  g.setLineDash([24, 15])
  g.lineWidth = 9
  g.strokeStyle = 'rgba(5,3,14,0.5)'
  roundRectPath(g, -lw / 2 + 3, -lh / 2 + 5, lw, lh, 38)
  g.stroke()
  g.lineWidth = 6
  g.strokeStyle = c.thread
  roundRectPath(g, -lw / 2 + 14, -lh / 2 + 14, lw - 28, lh - 28, 30)
  g.stroke()
  g.restore()
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillStyle = c.parchment
  g.font = '400 148px "Bowlby One", "Baloo 2", sans-serif'
  g.fillText('PELUSAS', 0, -34)
  g.fillStyle = c.thread
  g.font = '700 58px "Baloo 2", "Inter Tight", sans-serif'
  g.fillText('SACÁ · GUARDÁ · ROBÁ', 0, 86)
  g.globalAlpha = 0.85
  g.strokeStyle = c.threadAmber
  g.lineWidth = 5
  g.setLineDash([])
  g.beginPath()
  g.moveTo(-300, 118)
  g.lineTo(300, 118)
  g.stroke()
  g.restore()

  // 8) Viñeta perimetral: el fieltro se hunde bajo la cenefa.
  g.save()
  g.translate(cx, cy)
  g.scale(1, H / W)
  const edge = g.createRadialGradient(0, 0, W * 0.5 * 0.82, 0, 0, W * 0.5)
  edge.addColorStop(0, 'rgba(0,0,0,0)')
  edge.addColorStop(0.55, 'rgba(0,0,0,0.22)')
  edge.addColorStop(1, 'rgba(0,0,0,0.55)')
  g.fillStyle = edge
  g.fillRect(-W / 2, -W / 2, W, W)
  g.restore()

  // UVs: ShapeGeometry usa las coords de mundo como UV; repeat/offset llevan
  // [-rx..rx, -ry..ry] a [0..1] (flipY: el borde lejano cae arriba del canvas).
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set(1 / (rx * 2), 1 / (ry * 2))
  tex.offset.set(0.5, 0.5)
  tex.anisotropy = 8
  tex.needsUpdate = true
  cache.set(seatCount, tex)
  return tex
}
