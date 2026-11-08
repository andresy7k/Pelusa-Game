// frontend/src/features/mesa3d/Seats3D.tsx
// Paso 6: los jugadores. Cada asiento tiene SU silla de cuero (violeta con
// interior vino) fuera de la mesa y, encima, el monstruo R3F reutilizado del
// hero (LOD lite: 7 personajes dentro del presupuesto de 60fps), mirando al
// centro con su idle vivo (bob + balanceo + parpadeo). Junto al mazo vive el
// anfitrión: la Pelusa 10 rosa como crupier diminuto (HOST). Los estados de
// turno/robo/celebración llegan en el paso 7. Cada sentado lleva SU chapa de
// nombre (sprite con canvas) flotando sobre la cabeza, con punto ámbar si
// tiene el turno (misma gramática que las chapas del frente 2D).
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MESA3D, seatAngle } from './config'
import { Character } from '../hero/monsters/Character'
import { feetRadius } from '../hero/monsters/geometry'
import { HERO, type HeroValue } from '../hero/config'
import { pillPath, type MesaSeatView } from './Cards3D'

const CHAIR = MESA3D.chairs
const HOST = MESA3D.players.host
const FLOOR_Y = MESA3D.room.floorY

// --- geometrías y materiales compartidos (una sola vez para todas) ---------

let geo: {
  seat: THREE.CylinderGeometry
  base: THREE.CylinderGeometry
  column: THREE.CylinderGeometry
  back: THREE.CylinderGeometry
  backIn: THREE.CylinderGeometry
  rail: THREE.TorusGeometry
} | null = null

function chairGeometries() {
  if (!geo) {
    const { seat, back, column, base } = CHAIR
    const arcHalf = back.arc / 2
    // Respaldo: media barriga ABierta hacia el lado local -Z (hacia afuera
    // de la mesa, con el personaje mirando +Z al centro).
    const mkBack = (r: number, h: number, arc: number) =>
      new THREE.CylinderGeometry(r, r, h, 48, 1, true, Math.PI - arc / 2, arc)
    const rail = new THREE.TorusGeometry(back.r, 0.05, 8, 28, back.arc)
    // El toro arranca en +X: se gira en su plano para centrar el arco en +Y
    // (que tras rotateX(-90°) cae sobre -Z, el borde del respaldo).
    rail.rotateZ(Math.PI / 2 - arcHalf)
    rail.rotateX(-Math.PI / 2)
    geo = {
      seat: new THREE.CylinderGeometry(seat.r, seat.r, seat.thickness, 48),
      base: new THREE.CylinderGeometry(base.r, base.rBottom, base.h, 48),
      column: new THREE.CylinderGeometry(column.rTop, column.rBottom, column.top - column.bottom, 24),
      back: mkBack(back.r, back.top - (seat.top - seat.thickness), back.arc),
      backIn: mkBack(back.inner, back.top - (seat.top - seat.thickness) - 0.06, back.arc - 0.1),
      rail,
    }
    // Respaldo/interior centrados verticalemente sobre el asiento.
    const backH = back.top - (seat.top - seat.thickness)
    geo.back.translate(0, seat.top - seat.thickness + backH / 2, 0)
    geo.backIn.translate(0, seat.top - seat.thickness + (backH - 0.06) / 2, 0)
    geo.rail.translate(0, back.top, 0)
    geo.column.translate(0, (column.top + column.bottom) / 2, 0)
  }
  return geo
}

let mat: {
  leather: THREE.MeshStandardMaterial
  wine: THREE.MeshStandardMaterial
  column: THREE.MeshStandardMaterial
  base: THREE.MeshStandardMaterial
} | null = null

function chairMaterials() {
  if (!mat) {
    const c = CHAIR.colors
    mat = {
      leather: new THREE.MeshStandardMaterial({ color: c.leather, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide }),
      wine: new THREE.MeshStandardMaterial({ color: c.wine, roughness: 0.55, metalness: 0.04, side: THREE.DoubleSide }),
      column: new THREE.MeshStandardMaterial({ color: c.column, roughness: 0.45, metalness: 0.35 }),
      base: new THREE.MeshStandardMaterial({ color: c.base, roughness: 0.8, metalness: 0.1 }),
    }
  }
  return mat
}

// --- una silla + su sentado -------------------------------------------------

/** Rotación para que el local +Z del grupo mire al CENTRO de la mesa. */
function faceCenter(x: number, z: number): number {
  return Math.atan2(-x, -z)
}

function Chair3D({ x, z }: { x: number; z: number }) {
  const g = chairGeometries()
  const m = chairMaterials()
  return (
    <group position={[x, 0, z]} rotation={[0, faceCenter(x, z), 0]}>
      <mesh geometry={g.base} material={m.base} position={[0, FLOOR_Y + CHAIR.base.h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.column} material={m.column} castShadow />
      <mesh geometry={g.seat} material={m.leather} position={[0, CHAIR.seat.top - CHAIR.seat.thickness / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.back} material={m.leather} castShadow />
      <mesh geometry={g.backIn} material={m.wine} castShadow />
      <mesh geometry={g.rail} material={m.leather} castShadow />
    </group>
  )
}

function SeatedMonster({ x, z, value, feet }: { x: number; z: number; value: HeroValue; feet: number }) {
  return (
    <group position={[x, CHAIR.seat.top + feet, z]} rotation={[0, faceCenter(x, z), 0]}>
      <Character value={value} active={false} hovered={false} quality={MESA3D.players.quality} />
    </group>
  )
}

// --- chapas de nombre -------------------------------------------------------

/** Caché global de texturas (clave `turno|nombre`: pocas variantes). */
interface PlateEntry {
  canvas: HTMLCanvasElement
  tex: THREE.CanvasTexture
  draw: () => void
}

const plateCache = new Map<string, PlateEntry>()
let plateFontsLoaded = false

const PLATE_FONT = `600 62px 'Space Grotesk', system-ui, sans-serif`

/** Pinta la píldora: fondo violeta oscuro translúcido, borde (ámbar si es su
 *  turno) y el nombre en pergamino; punto ámbar del turno a la izquierda. */
function plateDraw(g: CanvasRenderingContext2D, W: number, H: number, name: string, isTurn: boolean) {
  g.clearRect(0, 0, W, H)
  pillPath(g, 3, 3, W - 6, H - 6)
  g.fillStyle = 'rgba(23, 16, 31, 0.85)'
  g.fill()
  g.lineWidth = 4
  g.strokeStyle = isTurn ? 'rgba(239, 168, 49, 0.75)' : 'rgba(203, 155, 234, 0.5)'
  g.stroke()
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.font = PLATE_FONT
  let x = 34
  if (isTurn) {
    g.beginPath()
    g.arc(x + 8, H / 2, 13, 0, Math.PI * 2)
    g.fillStyle = MESA3D.colors.amber
    g.fill()
    x += 50
  }
  g.fillStyle = '#F2ECF4'
  g.fillText(name, x, H / 2 + 3)
}

function plateEntry(name: string, isTurn: boolean): PlateEntry {
  const key = `${isTurn ? 1 : 0}|${name}`
  const hit = plateCache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')!
  g.font = PLATE_FONT
  const textW = g.measureText(name).width
  canvas.width = Math.min(640, Math.max(220, Math.ceil(textW + (isTurn ? 114 : 68))))
  canvas.height = 128
  const ctx = canvas.getContext('2d')! // el resize resetea el estado: se repinta abajo
  const draw = () => plateDraw(ctx, canvas.width, canvas.height, name, isTurn)
  draw()
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 8
  const entry: PlateEntry = { canvas, tex, draw }
  plateCache.set(key, entry)

  // Fuente tardía: repinta TODAS las chapas (mismo patrón que las cartas).
  if (!plateFontsLoaded) {
    void document.fonts.load(PLATE_FONT).then(() => {
      plateFontsLoaded = true
      plateCache.forEach((e) => {
        e.draw()
        e.tex.needsUpdate = true
      })
    })
  }
  return entry
}

/** Chapa de nombre flotando sobre la cabeza del monstruo (billboard). */
function NamePlate({
  name,
  isTurn,
  x,
  y,
  z,
}: {
  name: string
  isTurn: boolean
  x: number
  y: number
  z: number
}) {
  const entry = useMemo(() => plateEntry(name, isTurn), [name, isTurn])
  const h = MESA3D.players.namePlate.h
  const w = (h * entry.canvas.width) / entry.canvas.height
  return (
    <sprite position={[x, y, z]} scale={[w, h, 1]}>
      <spriteMaterial map={entry.tex} transparent depthWrite={false} />
    </sprite>
  )
}

// --- aviso de decisión sobre la cabeza ---------------------------------------

type ActKind = 'draw' | 'stand' | 'steal' | 'stash'

/** Mismos colores que los botones de la barra (pages.css .act-*). */
const ACT_COLORS: Record<ActKind, string> = {
  draw: '#36b56a',
  stand: '#e0523f',
  steal: '#e8913f',
  stash: '#8c5fe0',
}

const actTextures = new Map<ActKind, THREE.CanvasTexture>()

/** Ficha redonda con el símbolo de la decisión (una textura por tipo). */
function actTexture(kind: ActKind): THREE.CanvasTexture {
  const hit = actTextures.get(kind)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.beginPath()
  g.arc(128, 128, 112, 0, Math.PI * 2)
  g.fillStyle = ACT_COLORS[kind]
  g.fill()
  g.lineWidth = 14
  g.strokeStyle = '#ffffff'
  g.stroke()
  g.fillStyle = '#ffffff'
  g.strokeStyle = '#ffffff'
  g.lineCap = 'round'
  if (kind === 'draw' || kind === 'stand') {
    g.lineWidth = 30
    g.beginPath()
    g.moveTo(74, 128)
    g.lineTo(182, 128)
    if (kind === 'draw') {
      g.moveTo(128, 74)
      g.lineTo(128, 182)
    }
    g.stroke()
  } else if (kind === 'stash') {
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 72 : 30
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      g.lineTo(128 + Math.cos(a) * r, 136 + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
  } else {
    // Ninja: cabeza oscura, banda clara y dos ojos.
    g.fillStyle = '#231a33'
    g.beginPath()
    g.ellipse(128, 132, 70, 66, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#f2e7d4'
    g.fillRect(62, 112, 132, 34)
    g.fillStyle = '#231a33'
    g.beginPath()
    g.ellipse(106, 129, 9, 11, 0, 0, Math.PI * 2)
    g.ellipse(150, 129, 9, 11, 0, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  actTextures.set(kind, tex)
  return tex
}

const ACT_LIFE = 1.9 // s

/** Aviso que salta, sube y se desvanece (se reinicia con `key`). */
function ActionBadge3D({ kind, x, y, z }: { kind: ActKind; x: number; y: number; z: number }) {
  const sprite = useRef<THREE.Sprite>(null)
  const born = useRef<number | null>(null)
  useFrame(({ clock }) => {
    const s = sprite.current
    if (!s) return
    if (born.current === null) born.current = clock.elapsedTime
    const t = clock.elapsedTime - born.current
    const pop = t < 0.25 ? (t / 0.25) * 1.15 : t < 0.4 ? 1.15 - ((t - 0.25) / 0.15) * 0.15 : 1
    const size = 0.26 * pop
    s.scale.set(size, size, 1)
    s.position.y = y + Math.min(t, ACT_LIFE) * 0.08
    const m = s.material as THREE.SpriteMaterial
    m.opacity = t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) / (ACT_LIFE - 1.3))
    s.visible = t < ACT_LIFE
  })
  return (
    <sprite ref={sprite} position={[x, y, z]} scale={[0.01, 0.01, 1]} renderOrder={10}>
      <spriteMaterial map={actTexture(kind)} transparent depthTest={false} depthWrite={false} />
    </sprite>
  )
}

/** El anfitrión: Pelusa 10 rosa a escala de juguete, junto al mazo. Si un
 *  jugador ya la eligió, el crupier es otro monstruo que nadie tenga. */
function HostMascot({ taken }: { taken: number[] }) {
  const value = ([HOST.monster, 9, 8, 7, 6, 5, 4, 3, 2, 1] as HeroValue[]).find((v) => !taken.includes(v)) ?? HOST.monster
  const feet = feetRadius(HERO.monsters[value].scale) * HERO.character.scale * HOST.scale
  return (
    <group position={[HOST.x, feet, HOST.z]} rotation={[0, HOST.rot, 0]} scale={HOST.scale}>
      <Character value={value} active={false} hovered={false} quality={MESA3D.players.quality} />
    </group>
  )
}

// --- conjunto ---------------------------------------------------------------

export function Seats3D({ seats }: { seats: MesaSeatView[] }) {
  const n = seats.length
  return (
    <group>
      {n > 0 &&
        seats.map((s) => {
          const a = seatAngle(s.seat, n)
          const x = Math.cos(a) * CHAIR.rx
          const z = Math.sin(a) * CHAIR.rz
          // Su monstruo elegido; sin dato, el del roster por asiento.
          const value = (s.avatar && s.avatar >= 1 && s.avatar <= 10
            ? s.avatar
            : MESA3D.players.roster[s.seat % MESA3D.players.roster.length]) as HeroValue
          // Pies sobre el cojín; la cabeza llega ≈ 2·feet sobre el asiento.
          const feet = feetRadius(HERO.monsters[value].scale) * HERO.character.scale
          return (
            <group key={s.seat}>
              <Chair3D x={x} z={z} />
              <SeatedMonster x={x} z={z} value={value} feet={feet} />
              <NamePlate
                name={s.name}
                isTurn={s.isTurn}
                x={x}
                y={CHAIR.seat.top + 2 * feet + MESA3D.players.namePlate.lift}
                z={z}
              />
              {s.action && (
                <ActionBadge3D
                  key={s.action.key}
                  kind={s.action.kind}
                  x={x}
                  y={CHAIR.seat.top + 2 * feet + MESA3D.players.namePlate.lift + 0.24}
                  z={z}
                />
              )}
            </group>
          )
        })}
      <HostMascot taken={seats.map((s) => s.avatar ?? 0)} />
    </group>
  )
}
