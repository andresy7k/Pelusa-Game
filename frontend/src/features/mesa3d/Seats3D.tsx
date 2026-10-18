// frontend/src/features/mesa3d/Seats3D.tsx
// Paso 6: los jugadores. Cada asiento tiene SU silla de cuero (violeta con
// interior vino) fuera de la mesa y, encima, el monstruo R3F reutilizado del
// hero (LOD lite: 7 personajes dentro del presupuesto de 60fps), mirando al
// centro con su idle vivo (bob + balanceo + parpadeo). Junto al mazo vive el
// anfitrión: la Pelusa 10 rosa como crupier diminuto (HOST). Los estados de
// turno/robo/celebración llegan en el paso 7.
import * as THREE from 'three'
import { MESA3D, seatAngle } from './config'
import { Character } from '../hero/monsters/Character'
import { feetRadius } from '../hero/monsters/geometry'
import { HERO, type HeroValue } from '../hero/config'
import type { MesaSeatView } from './Cards3D'

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

function SeatedMonster({ x, z, value }: { x: number; z: number; value: HeroValue }) {
  const spec = HERO.monsters[value]
  // Los pies (radio inferior del blob) apoyan sobre el cojín de la silla.
  const feet = feetRadius(spec.scale) * HERO.character.scale
  return (
    <group position={[x, CHAIR.seat.top + feet, z]} rotation={[0, faceCenter(x, z), 0]}>
      <Character value={value} active={false} hovered={false} quality={MESA3D.players.quality} />
    </group>
  )
}

/** El anfitrión: Pelusa 10 rosa a escala de juguete, junto al mazo. */
function HostMascot() {
  const value = HOST.monster
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
          const value = MESA3D.players.roster[s.seat % MESA3D.players.roster.length]
          return (
            <group key={s.seat}>
              <Chair3D x={x} z={z} />
              <SeatedMonster x={x} z={z} value={value} />
            </group>
          )
        })}
      <HostMascot />
    </group>
  )
}
