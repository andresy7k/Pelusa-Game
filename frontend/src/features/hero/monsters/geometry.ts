// frontend/src/features/hero/monsters/geometry.ts
// Blob 3D de cada monstruo: una "lente" (esfera achatada en z) cuyo contorno
// frontal ES el mismo trazado `d` del monstruo pintado (CAMINOS,
// components/monsterPaths.ts): la proyección sobre la carta calca la silueta
// dibujada —lóbulos de pelusa, picos del mango/erizo y la base ondulada de la
// babosa— y la profundidad se redondea elípticamente hacia atrás. Encima vive
// un ruido fino (la pelusa viva) determinista por semilla, apagado al frente
// (zona de la cara) y en los pies (anclaje exacto a la carta).
import * as THREE from 'three'
import { HERO, type HeroValue, type MonsterSilhouette } from '../config'
import { CAMINOS } from '../../../components/monsterPaths'

// Ruido 3D barato (value noise con hash), determinista por semilla.
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 13.7) * 43758.5453
  h = h - Math.floor(h)
  return h
}

function smoothstep(desde: number, hasta: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - desde) / (hasta - desde)))
  return t * t * (3 - 2 * t)
}

// Dirección de la cara (frente, z+): alrededor vive la zona limpia.
const CARA = new THREE.Vector3(0, 0.02, 1).normalize()

// Sectores de la tabla radial: 180 de 2°, resuelve los picos finos.
const BINS = 180

// Contorno muestreado del path, en unidades locales (ya escalado con el
// Y del SVG invertido). halfW es el semiancho local: f fija la profundidad.
interface Contorno {
  radio: Float32Array
  halfW: number
}

// Aplana un `d` absoluto (M/L/Q/Z, como los de CAMINOS) a una polilínea:
// las Q se subdividen en 10 pasos y las L largas cada ~2 unidades, porque
// la tabla radial muestrea VÉRTICES: una pared recta sin vértices intermedios
// se degradaría a cuerda (el fantasma 7 se hundiría a los costados).
const PASO_L = 2 // unidades del viewBox entre vértices de una arista recta

function aplana(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const tokens = d.match(/[MLQZ]|-?\d+(?:\.\d+)?/gi) ?? []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (t.length === 1 && /[MLQZ]/i.test(t)) {
      cmd = t.toUpperCase()
      i++
      if (cmd === 'Z') continue
    }
    if (cmd === 'M') {
      x = Number(tokens[i])
      y = Number(tokens[i + 1])
      i += 2
      out.push([x, y])
      cmd = 'L' // los cuerpos son un solo subtrazado: tras la M vienen L/Q/Z
    } else if (cmd === 'L') {
      const nx = Number(tokens[i])
      const ny = Number(tokens[i + 1])
      i += 2
      const pasos = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / PASO_L))
      for (let s = 1; s <= pasos; s++) {
        out.push([x + ((nx - x) * s) / pasos, y + ((ny - y) * s) / pasos])
      }
      x = nx
      y = ny
    } else if (cmd === 'Q') {
      const qx = Number(tokens[i])
      const qy = Number(tokens[i + 1])
      const ex = Number(tokens[i + 2])
      const ey = Number(tokens[i + 3])
      i += 4
      for (let s = 1; s <= 10; s++) {
        const u = s / 10
        const w = 1 - u
        out.push([w * w * x + 2 * w * u * qx + u * u * ex, w * w * y + 2 * w * u * qy + u * u * ey])
      }
      x = ex
      y = ey
    } else {
      break // token inesperado: corta en vez de girar en el loop
    }
  }
  return out
}

const cache = new Map<number, Contorno>()

// Radio máximo por sector angular del contorno pintado, normalizado: el bbox
// del path se centra en el origen y se escala UNIFORMEMENTE para que mida
// 2·scale[1] de alto (pies a scale[1] bajo el origen); el ancho y la
// profundidad salen del propio dibujo, así el aspecto pintado queda exacto
// (el 1.0 ancho/alto de la babosa no se estira: scale[0] es histórico).
function contornoDe(value: HeroValue): Contorno {
  const hit = cache.get(value)
  if (hit) return hit
  const pts = aplana(CAMINOS[value])
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [px, py] of pts) {
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const spec = HERO.monsters[value]
  const s = spec.scale[1] / ((maxY - minY) / 2)
  const radio = new Float32Array(BINS)
  for (const [px, py] of pts) {
    // El eje Y del SVG mira para abajo: se invierte al espacio del mundo.
    const dx = (px - cx) * s
    const dy = -(py - cy) * s
    const r = Math.hypot(dx, dy)
    const a = Math.atan2(dy, dx)
    const bin = Math.floor(((a + Math.PI) / (2 * Math.PI)) * BINS) % BINS
    if (r > radio[bin]) radio[bin] = r
  }
  // Sectores sin cobertura (ángulos estrechos): promedio de los vecinos
  // no vacíos más próximos a izquierda y derecha.
  for (let i = 0; i < BINS; i++) {
    if (radio[i] > 0) continue
    let l = 1
    while (radio[(i - l + BINS * 2) % BINS] === 0 && l < BINS) l++
    let r = 1
    while (radio[(i + r) % BINS] === 0 && r < BINS) r++
    const a = radio[(i - l + BINS * 2) % BINS]
    const b = radio[(i + r) % BINS]
    radio[i] = a === 0 ? b : b === 0 ? a : (a + b) / 2
  }
  const cont: Contorno = { radio, halfW: ((maxX - minX) / 2) * s }
  cache.set(value, cont)
  return cont
}

// Radio del contorno en el ángulo φ (x-y), interpolado entre sectores.
function radioEn(c: Contorno, phi: number): number {
  const f = (((phi + Math.PI) / (2 * Math.PI)) * BINS) % BINS
  const i0 = Math.floor(f) % BINS
  const t = f - Math.floor(f)
  return c.radio[i0] * (1 - t) + c.radio[(i0 + 1) % BINS] * t
}

/** Radio inferior del mesh (para apoyar los pies sobre la carta): el
 *  contorno llega exacto a ±scale[1] y el borde sticker escala 1.04.
 *  Lo usa MonsterCanvas. */
export function feetRadius(scale: [number, number, number], _silhouette?: MonsterSilhouette): number {
  return scale[1] * 1.055
}

/** z de la piel sobre el frente (unidades del cuerpo) en la posición (x, y):
 *  la misma lente de makeBlobGeometry, para asentar ojos y boca. */
export function surfaceZ(value: HeroValue, x: number, y: number): number {
  const cont = contornoDe(value)
  const spec = HERO.monsters[value]
  const R = radioEn(cont, Math.atan2(y, x))
  const sigma = Math.min(1, Math.hypot(x, y) / R)
  return Math.sqrt(Math.max(0, 1 - sigma * sigma)) * cont.halfW * spec.scale[2]
}

export function makeBlobGeometry(value: HeroValue): THREE.BufferGeometry {
  const spec = HERO.monsters[value]
  const cont = contornoDe(value)
  const geo = new THREE.IcosahedronGeometry(1, 5) // 10242 vértices: suficiente para pelaje
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  // Profundidad = semiancho del dibujo: la figurita rueda redonda a los
  // costados (misma convención visual que la esfera vieja), sin huevo.
  const d = cont.halfW * spec.scale[2]
  const liso = spec.silhouette.tipo === 'smooth'
  // El contorno ya lo define el path pintado: el ruido solo da vida a la
  // pelusa (la babosa, lisa, casi no respira).
  const ruidoAmp = liso ? 0.04 : 0.06
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    // Lente: cada meridiano (ángulo φ en x-y) tiene el radio del contorno
    // pintado; la sección transversal se aplana elípticamente en z. En los
    // polos (vp≈0) el vértice va al toque de profundidad ±d.
    const vp = Math.hypot(v.x, v.y)
    let x = 0
    let y = 0
    let z = d
    if (vp > 1e-6) {
      const R = radioEn(cont, Math.atan2(v.y, v.x))
      const a = (v.z / vp) * (R / d)
      const sig = 1 / Math.sqrt(1 + a * a)
      const lam = (sig * R) / vp
      x = lam * v.x
      y = lam * v.y
      z = a * sig * d
    }
    // Pelusa viva: ruido determinista apagado al frente (la cara asienta
    // limpia) y en los pies (anclaje exacto a la carta, sin temblor).
    const frente = smoothstep(0.55, 0.88, v.dot(CARA))
    const pies = smoothstep(-0.9, -0.5, v.y)
    const n =
      hash3(Math.floor(v.x * 2.2), Math.floor(v.y * 2.2), Math.floor(v.z * 2.2), spec.seed) * 0.5 +
      hash3(Math.floor(v.x * 4.5), Math.floor(v.y * 4.5), Math.floor(v.z * 4.5), spec.seed + 7) * 0.25
    const f = 1 + (n - 0.35) * ruidoAmp * (1 - frente) * pies
    pos.setXYZ(i, x * f, y * f, z * f)
  }
  geo.computeVertexNormals()
  return geo
}
