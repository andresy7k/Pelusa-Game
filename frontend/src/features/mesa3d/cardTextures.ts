// frontend/src/features/mesa3d/cardTextures.ts
// Texturas procedurales de las cartas 3D (paso 5): un frente por valor
// (1..10) y un dorso peluche, calquados del diseño 2D actual — la paleta de
// card.css (.card[data-v]), el número sticker con contorno blanco, la costura
// punteada y el monstruo de MonsterFace.tsx sobre la MISMA silueta de
// monsterPaths.ts (CAMINOS). CanvasTexture cacheadas: sin assets nuevos.
import * as THREE from 'three'
import { CAMINOS } from '../../components/monsterPaths'
import { MESA3D } from './config'

const TAU = Math.PI * 2
const TINTA = '#26303A'
const LENGUA = '#E9819C'

/** Paleta por valor (espejo exacto de card.css .card[data-v]). */
const CARD_PALETTE: Record<number, { bg: string; bg2: string; accent: string; monster: string }> = {
  1: { bg: '#a9d6f5', bg2: '#8fc6ec', accent: '#1f6fb8', monster: '#6fb4e8' },
  2: { bg: '#474c87', bg2: '#3a3f75', accent: '#1e2150', monster: '#5a5fa0' },
  3: { bg: '#e08a5c', bg2: '#d07a4c', accent: '#d9332f', monster: '#d93a30' },
  4: { bg: '#b78fd0', bg2: '#a97cc4', accent: '#7a3e9e', monster: '#a83b90' },
  5: { bg: '#9ed37a', bg2: '#8cc468', accent: '#2f8e44', monster: '#6fbc57' },
  6: { bg: '#efa23f', bg2: '#df9432', accent: '#e87830', monster: '#f08a2e' },
  7: { bg: '#f2e06e', bg2: '#e8d45a', accent: '#c9a61e', monster: '#e8c84a' },
  8: { bg: '#7a79d0', bg2: '#6a69b8', accent: '#33368c', monster: '#2e2e6e' },
  9: { bg: '#7ed4cb', bg2: '#6ac4ba', accent: '#25857a', monster: '#46b4a6' },
  10: { bg: '#f291c4', bg2: '#e87fb6', accent: '#be2f7a', monster: '#e0559e' },
}

/** Lienzo 5:7 con holgura sobre el mínimo 512×720 del brief de visibilidad. */
export const CARD_TEX_SIZE: [number, number] = [512, 716]

// ---------------------------------------------------------------------------
// Monstruo (espacio unitario 0..100 = el viewBox del SVG)
// ---------------------------------------------------------------------------

function eye(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, dx = 0, dy = 0, inkRing = false) {
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(cx, cy, r, 0, TAU)
  g.fill()
  if (inkRing) {
    g.strokeStyle = TINTA
    g.lineWidth = 1.5
    g.stroke()
  }
  g.fillStyle = TINTA
  g.beginPath()
  g.arc(cx + dx, cy + dy, r * 0.44, 0, TAU)
  g.fill()
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(cx + dx + r * 0.2, cy + dy - r * 0.24, r * 0.16, 0, TAU)
  g.fill()
}

function eyeDormido(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, inkRing = false) {
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI) // media luna inferior
  g.fill()
  if (inkRing) {
    g.strokeStyle = TINTA
    g.lineWidth = 1.5
    g.stroke()
  }
  g.fillStyle = TINTA
  g.beginPath()
  g.arc(cx + r * 0.1, cy + r * 0.34, r * 0.38, 0, TAU)
  g.fill()
}

function inkStroke(g: CanvasRenderingContext2D, d: string, w: number) {
  g.strokeStyle = TINTA
  g.lineWidth = w
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.stroke(new Path2D(d))
}

function inkFill(g: CanvasRenderingContext2D, d: string) {
  g.fillStyle = TINTA
  g.fill(new Path2D(d))
}

function tongue(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color = LENGUA) {
  g.fillStyle = color
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU)
  g.fill()
}

function fang(g: CanvasRenderingContext2D, d: string) {
  g.fillStyle = '#fff'
  g.fill(new Path2D(d))
}

/** La cara de cada valor: ojos y boca calcados de MonsterFace.tsx. */
const FACES: Record<number, (g: CanvasRenderingContext2D, inkRing: boolean) => void> = {
  1: (g, k) => {
    eye(g, 50, 47, 16, 2.5, 2, k)
    inkStroke(g, 'M 41 68 Q 50 76 59 68', 4.5)
  },
  2: (g, k) => {
    eyeDormido(g, 42, 52, 8.5, k)
    eyeDormido(g, 58, 52, 8.5, k)
    inkFill(g, 'M 32 65 Q 50 61 68 65 Q 66 79 50 79 Q 34 79 32 65 Z')
    tongue(g, 50, 75.5, 8, 4, '#F4D420')
  },
  3: (g, k) => {
    eye(g, 38, 47, 11, 1.5, 1.5, k)
    eye(g, 62, 47, 11, -1.5, 1.5, k)
    inkStroke(g, 'M 42 68 Q 50 75 58 68', 4.5)
  },
  4: (g, k) => {
    eye(g, 50, 46, 15.5, 2, 1, k)
    inkStroke(g, 'M 40 66 Q 52 75 63 63', 4.5)
  },
  5: (g, k) => {
    eye(g, 47, 43, 15, 2, 2, k)
    inkFill(g, 'M 33 61 Q 50 56 67 61 Q 65 80 50 80 Q 35 80 33 61 Z')
    tongue(g, 50, 76, 9, 4.5)
  },
  6: (g, k) => {
    eyeDormido(g, 40, 51, 9, k)
    eyeDormido(g, 60, 51, 9, k)
    inkFill(g, 'M 27 64 Q 50 59 73 64 Q 71 81 50 81 Q 29 81 27 64 Z')
    fang(g, 'M 40 62.5 L 46 62.5 L 43 71 Z')
    fang(g, 'M 54 62.5 L 60 62.5 L 57 71 Z')
  },
  7: (g, k) => {
    eye(g, 40, 43, 6.5, 1, 1, k)
    eye(g, 60, 43, 6.5, -1, 1, k)
    inkFill(g, 'M 37 56 Q 50 51 63 56 Q 61 75 50 75 Q 39 75 37 56 Z')
    tongue(g, 50, 71, 8, 4)
  },
  8: (g, k) => {
    eye(g, 50, 44, 14, 0, 1, k)
    inkStroke(g, 'M 39 68 Q 50 71 61 68', 4.5)
  },
  9: (g, k) => {
    eye(g, 38, 47, 10.5, 1.5, 1.5, k)
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(63, 49, 8, 0, TAU)
    g.fill()
    if (k) {
      g.strokeStyle = TINTA
      g.lineWidth = 1.5
      g.stroke()
    }
    g.fillStyle = TINTA
    g.beginPath()
    g.arc(64, 50, 3.4, 0, TAU)
    g.fill()
    g.strokeStyle = '#F2D33C'
    g.lineWidth = 2.6
    g.beginPath()
    g.arc(64, 50, 5.2, 0, TAU)
    g.stroke()
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(65.5, 48, 1.3, 0, TAU)
    g.fill()
    inkStroke(g, 'M 35 67 Q 50 76 65 67', 4.5)
    fang(g, 'M 44 70 L 50 70 L 47 79 Z')
  },
  10: (g, k) => {
    eye(g, 39, 35, 9, 1.5, 2, k)
    eye(g, 61, 35, 9, -1.5, 2, k)
    inkFill(g, 'M 26 53 Q 50 45 74 53 Q 78 73 50 87 Q 22 73 26 53 Z')
    tongue(g, 50, 80, 11, 4.5)
  },
}

/** Cuerpo + cara en espacio unitario (la transformación del canvas escala). */
function drawMonster(
  g: CanvasRenderingContext2D,
  value: number,
  opts: { fill: string; outline: string; inkRing: boolean },
) {
  const face = FACES[value]
  if (!face) return
  const body = new Path2D(CAMINOS[value])
  const spec = FACE_SPECS[value]

  // Brillo y sombra recortados al cuerpo (como el clipPath del SVG).
  g.save()
  g.clip(body)
  g.globalAlpha = 0.06
  g.fillStyle = '#000'
  g.beginPath()
  g.ellipse(spec.shade[0], spec.shade[1], spec.shade[2], spec.shade[3], 0, 0, TAU)
  g.fill()
  g.globalAlpha = 0.3
  g.fillStyle = '#fff'
  g.save()
  g.translate(spec.gloss[0], spec.gloss[1])
  g.rotate((-24 * Math.PI) / 180)
  g.beginPath()
  g.ellipse(0, 0, spec.gloss[2], spec.gloss[3], 0, 0, TAU)
  g.fill()
  g.restore()
  g.restore()

  // Contorno sticker + relleno (en el dorso: relleno blanco y contorno tinta).
  g.globalAlpha = 1
  g.lineJoin = 'round'
  g.lineWidth = 6
  g.strokeStyle = opts.outline
  g.fillStyle = opts.fill
  g.stroke(body)
  g.fill(body)

  face(g, opts.inkRing)
}

/** Gloss/shade de cada valor (coords del viewBox, espejo de MonsterFace). */
const FACE_SPECS: Record<number, { gloss: [number, number, number, number]; shade: [number, number, number, number] }> = {
  1: { gloss: [35, 26, 15, 5], shade: [50, 87, 30, 9] },
  2: { gloss: [31, 35, 14, 4.5], shade: [50, 84.5, 34, 8] },
  3: { gloss: [33, 28, 14, 4.5], shade: [50, 85, 30, 9] },
  4: { gloss: [34, 24, 14, 4.5], shade: [50, 86, 28, 9] },
  5: { gloss: [33, 26, 12, 4], shade: [50, 86, 27, 8] },
  6: { gloss: [31, 34, 14, 4.5], shade: [50, 85, 34, 8] },
  7: { gloss: [36, 29, 14, 4.5], shade: [50, 80, 30, 7] },
  8: { gloss: [40, 24, 10, 4], shade: [50, 88, 22, 7] },
  9: { gloss: [32, 27, 12, 4], shade: [50, 87, 27, 8] },
  10: { gloss: [34, 24, 14, 4.5], shade: [50, 86, 30, 9] },
}

// ---------------------------------------------------------------------------
// Lienzo de carta: base acuarela + costura + número sticker + monstruo
// ---------------------------------------------------------------------------

function watercolorBase(g: CanvasRenderingContext2D, W: number, H: number, bg: string, bg2: string) {
  const base = g.createLinearGradient(W * 0.32, 0, W * 0.68, H) // ≈160deg
  base.addColorStop(0, bg)
  base.addColorStop(1, bg2)
  g.fillStyle = base
  g.fillRect(0, 0, W, H)
  const hl = g.createRadialGradient(W * 0.2, H * 0.12, 0, W * 0.2, H * 0.12, W * 0.62)
  hl.addColorStop(0, 'rgba(255,255,255,0.30)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = hl
  g.fillRect(0, 0, W, H)
  const sh = g.createRadialGradient(W * 0.92, H, 0, W * 0.92, H, W * 0.72)
  sh.addColorStop(0, 'rgba(20,26,48,0.18)')
  sh.addColorStop(1, 'rgba(20,26,48,0)')
  g.fillStyle = sh
  g.fillRect(0, 0, W, H)
}

function stitchFrame(g: CanvasRenderingContext2D, W: number, H: number, inset: number, lw: number) {
  g.save()
  g.setLineDash([26, 15])
  g.lineWidth = lw
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.beginPath()
  const x = inset
  const y = inset
  const w = W - inset * 2
  const h = H - inset * 2
  const r = 36
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
  g.stroke()
  g.restore()
}

const frontCache = new Map<number, THREE.Texture>()
const backCache = { tex: null as THREE.Texture | null }
const matCache = new Map<string, THREE.MeshStandardMaterial>()

/** UV de ShapeGeometry = coords de mundo: repeat/offset llevan a [0..1]. */
function finishTexture(cv: HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const { w, h } = MESA3D.cards.size
  tex.repeat.set(1 / w, 1 / h)
  tex.offset.set(0.5, 0.5)
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function loadFonts(): Promise<void> {
  return Promise.all([
    document.fonts.load('320px "Bowlby One"'),
    document.fonts.ready,
  ]).then(
    () => undefined,
    () => undefined,
  )
}

/** Pinta el lienzo completo del frente de `value` (idempotente). */
function paintFront(value: number, g: CanvasRenderingContext2D, W: number, H: number) {
  const pal = CARD_PALETTE[value]
  watercolorBase(g, W, H, pal.bg, pal.bg2)
  stitchFrame(g, W, H, 26, 12)

  // Número sticker: contorno blanco grueso + relleno del acento.
  g.save()
  g.textAlign = 'center'
  g.textBaseline = 'top'
  g.font = `${Math.round(H * 0.42)}px "Bowlby One", "Baloo 2", sans-serif`
  g.lineJoin = 'round'
  g.lineWidth = W * 0.075
  g.strokeStyle = '#fff'
  g.strokeText(String(value), W / 2, H * 0.022)
  g.fillStyle = pal.accent
  g.fillText(String(value), W / 2, H * 0.022)
  g.restore()

  // Monstruo pegado al borde inferior (88% del ancho, recorte leve).
  const mSize = W * 0.88
  g.save()
  g.translate((W - mSize) / 2, H - mSize + H * 0.012)
  g.scale(mSize / 100, mSize / 100)
  drawMonster(g, value, { fill: pal.monster, outline: '#fff', inkRing: false })
  g.restore()
}

/** Frente del valor (1..10): acuarela + número sticker + monstruo. */
export function cardFrontTexture(value: number): THREE.Texture {
  const hit = frontCache.get(value)
  if (hit) return hit
  if (!CARD_PALETTE[value]) return cardBackTexture() // defensivo: fuera de 1..10
  const [W, H] = CARD_TEX_SIZE
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  paintFront(value, g, W, H)

  const tex = finishTexture(cv)
  // Si "Bowlby One" llega tarde, el primer pintado usa el fallback: al cargar
  // la fuente se repinta el lienzo y se refresca la textura.
  void loadFonts().then(() => {
    paintFront(value, cv.getContext('2d')!, W, H)
    tex.needsUpdate = true
  })
  frontCache.set(value, tex)
  return tex
}

/** Dorso: índigo + peluche blanco (monstruo 1 sin número). */
export function cardBackTexture(): THREE.Texture {
  if (backCache.tex) return backCache.tex
  const [W, H] = CARD_TEX_SIZE
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!

  watercolorBase(g, W, H, '#454c86', '#2e3260')
  stitchFrame(g, W, H, 22, 9)

  const mSize = W * 0.64
  g.save()
  g.translate((W - mSize) / 2, H - mSize + H * 0.03)
  g.scale(mSize / 100, mSize / 100)
  drawMonster(g, 1, { fill: '#ffffff', outline: '#2b3050', inkRing: true })
  g.restore()

  const tex = finishTexture(cv)
  backCache.tex = tex
  return tex
}

/** Material del frente de un valor (compartido entre cartas iguales). */
export function cardFrontMaterial(value: number): THREE.MeshStandardMaterial {
  const key = `f${value}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: cardFrontTexture(value), roughness: 0.62, metalness: 0 })
    matCache.set(key, m)
  }
  return m
}

/** Material del dorso (compartido). */
export function cardBackMaterial(): THREE.MeshStandardMaterial {
  let m = matCache.get('back')
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: cardBackTexture(), roughness: 0.62, metalness: 0 })
    matCache.set('back', m)
  }
  return m
}

/** Material del filo (cartón índigo, da el grosor del objeto). */
export function cardEdgeMaterial(): THREE.MeshStandardMaterial {
  let m = matCache.get('edge')
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: '#232849', roughness: 0.7, metalness: 0.02 })
    matCache.set('edge', m)
  }
  return m
}
