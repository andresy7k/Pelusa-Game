// frontend/src/features/mesa3d/roomTextures.ts
// Texturas procedurales de la sala (paso 3): papel tapiz damasco, alfombra y
// los cuadros pintados de los monstruitos. Mismo enfoque que el tapete:
// CanvasTexture generada (sin assets), determinista (mulberry32).

import * as THREE from 'three'
import { HERO, type HeroValue } from '../hero/config'
import { mulberry32 } from './feltTexture'

/** Medallón damasco: 4 pétalos elípticos + centro (Path2D reutilizable). */
function medallion(s: number): Path2D {
  const p = new Path2D()
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    const cx = Math.cos(a - Math.PI / 2) * 92 * s
    const cy = Math.sin(a - Math.PI / 2) * 92 * s
    p.ellipse(cx, cy, 34 * s, 86 * s, a, 0, Math.PI * 2)
  }
  return p
}

/** Diamante decorativo (rotado 45°). */
function diamond(x: number, y: number, r: number): Path2D {
  const p = new Path2D()
  p.moveTo(x, y - r)
  p.lineTo(x + r, y)
  p.lineTo(x, y + r)
  p.lineTo(x - r, y)
  p.closePath()
  return p
}

/** Papel tapiz damasco violeta (tile 512 sin costuras). */
export function damaskTexture(): THREE.CanvasTexture {
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const g = cv.getContext('2d')!
  g.fillStyle = '#241B46'
  g.fillRect(0, 0, S, S)

  const big = medallion(0.62)
  const small = medallion(0.3)

  // Lattice escalonado; las copias fuera del tile dejan el patrón sin costura.
  const bigAt: Array<[number, number]> = [
    [S * 0.5, S * 0.25],
    [S * 1.5, S * 0.25],
    [-S * 0.5, S * 0.25],
    [0, S * 0.75],
    [S, S * 0.75],
    [S * 2, S * 0.75],
    [-S, S * 0.75],
  ]
  for (const [x, y] of bigAt) {
    // Sombra
    g.save()
    g.translate(x + 3, y + 4)
    g.fillStyle = 'rgba(9,5,20,0.55)'
    g.fill(big)
    g.restore()
    // Medallón
    g.save()
    g.translate(x, y)
    g.fillStyle = '#3A2C6E'
    g.fill(big)
    g.fillStyle = '#4A3A8C'
    g.beginPath()
    g.arc(0, 0, 24, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#241B46'
    g.beginPath()
    g.arc(0, 0, 10, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }

  // Medallones chicos en los huecos + diamantitos.
  const smallAt: Array<[number, number]> = [
    [0, S * 0.25],
    [S, S * 0.25],
    [S * 0.5, S * 0.75],
    [S * 1.5, S * 0.75],
    [-S * 0.5, S * 0.75],
  ]
  for (const [x, y] of smallAt) {
    g.save()
    g.translate(x, y)
    g.fillStyle = '#2E2358'
    g.fill(small)
    g.restore()
    g.save()
    g.translate(x, y)
    g.fillStyle = '#453584'
    g.globalAlpha = 0.85
    g.fill(diamond(0, 0, 7))
    g.restore()
  }

  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  return t
}

/** Alfombra redonda: base radiada + tejido punto a punto + anillos. */
export function carpetTexture(): THREE.CanvasTexture {
  const S = 1024
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const g = cv.getContext('2d')!
  const rnd = mulberry32(0xcafe)
  const c = S / 2

  const base = g.createRadialGradient(c, c, 0, c, c, c)
  base.addColorStop(0, '#241A42')
  base.addColorStop(0.55, '#1A1233')
  base.addColorStop(1, '#100A20')
  g.fillStyle = base
  g.fillRect(0, 0, S, S)

  // Tejido: puntitos alternados de dos tonos en todo el disco.
  for (let i = 0; i < 26000; i++) {
    const a = rnd() * Math.PI * 2
    const r = Math.sqrt(rnd()) * c * 0.985
    const x = c + Math.cos(a) * r
    const y = c + Math.sin(a) * r
    g.fillStyle = rnd() < 0.5 ? 'rgba(40,29,74,0.4)' : 'rgba(16,10,30,0.45)'
    g.fillRect(x, y, 2.4, 2.4)
  }

  // Anillos concéntricos (alfombra redonda); el exterior hace de guarda.
  for (const rr of [0.22, 0.4, 0.58, 0.76, 0.9]) {
    g.strokeStyle = 'rgba(52,38,94,0.55)'
    g.lineWidth = rr === 0.9 ? 10 : 5
    g.setLineDash(rr === 0.9 ? [] : [26, 16])
    g.beginPath()
    g.arc(c, c, c * rr, 0, Math.PI * 2)
    g.stroke()
  }
  g.setLineDash([])

  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Retrato pintado de una pelusa (cuadro de la sala). */
export function paintingTexture(v: HeroValue): THREE.CanvasTexture {
  const W = 768
  const H = 576
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  const rnd = mulberry32(0x9a1 + v * 613)
  const card = HERO.cards[v]
  const face = HERO.monsters[v].face

  // Lienzo con luz de galería.
  g.fillStyle = '#2A2050'
  g.fillRect(0, 0, W, H)
  const light = g.createRadialGradient(W / 2, H * 0.35, 40, W / 2, H * 0.45, W * 0.62)
  light.addColorStop(0, 'rgba(72,55,120,0.55)')
  light.addColorStop(1, 'rgba(10,6,20,0)')
  g.fillStyle = light
  g.fillRect(0, 0, W, H)

  // Sombra en el "piso" del cuadro.
  g.fillStyle = 'rgba(6,3,12,0.5)'
  g.beginPath()
  g.ellipse(W / 2, H * 0.82, 190, 34, 0, 0, Math.PI * 2)
  g.fill()

  // Cuerpo: blob con borde apenas ondulado (pintado a mano).
  const cx = W / 2
  const cy = H * 0.55
  const rx = 195
  const ry = 165
  g.fillStyle = card.bg
  g.beginPath()
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2
    const wob = 1 + 0.05 * Math.sin(a * 7 + rnd() * 0.4)
    const x = cx + Math.cos(a) * rx * wob
    const y = cy + Math.sin(a) * ry * wob
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  g.fill()

  // Pelusa alrededor: pelos cortos del color del monstruo.
  g.strokeStyle = card.monster
  g.lineWidth = 3
  g.lineCap = 'round'
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2
    const x = cx + Math.cos(a) * rx * 1.01
    const y = cy + Math.sin(a) * ry * 1.01
    const L = 8 + rnd() * 16
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L)
    g.stroke()
  }

  // Ojos (respeta la cantidad real del diseño: 1 o 2).
  const eyeR = 26
  const epos: Array<[number, number]> =
    face.eyes.count === 1 ? [[cx + 22, cy - 30]] : [[cx - 44, cy - 36], [cx + 46, cy - 28]]
  for (const [ex, ey] of epos) {
    g.fillStyle = face.eyes.ring ?? '#F6F1E4'
    g.beginPath()
    g.arc(ex, ey, eyeR, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1A1230'
    g.beginPath()
    g.arc(ex + 6, ey + 4, eyeR * 0.42, 0, Math.PI * 2)
    g.fill()
  }

  // Boquita.
  g.strokeStyle = '#1A1230'
  g.lineWidth = 7
  g.beginPath()
  g.arc(cx, cy + 52, 34, 0.25 * Math.PI, 0.75 * Math.PI)
  g.stroke()

  // Firmita: estrellita cosida en ámbar (misma costura del tapete).
  g.strokeStyle = HERO.cards[v].num
  g.lineWidth = 4
  const sx = W - 64
  const sy = H - 56
  for (const [dx, dy] of [[0, -18], [18, 0], [0, 18], [-18, 0]] as Array<[number, number]>) {
    g.beginPath()
    g.moveTo(sx, sy)
    g.lineTo(sx + dx, sy + dy)
    g.stroke()
  }

  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
