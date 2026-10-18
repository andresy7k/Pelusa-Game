// frontend/src/features/mesa3d/Room3D.tsx
// La sala cerrada 360° (paso 3): tapiz damasco, alfombra, friso, columnas,
// cuadros de los monstruitos y apliques ámbar. Solo visual: nada de acá
// toca lógica ni estado del juego.
//
// Reglas del brief que aplican acá:
// - Paleta violeta/índigo + ámbar; nada de verde casino.
// - Nada que tape las cartas: columnas bien al fondo, cuadros altos.
// - Sin techo (la cámara cenital mira desde arriba; la oscuridad tapa).

import { useMemo } from 'react'
import * as THREE from 'three'
import { MESA3D } from './config'
import { damaskTexture, carpetTexture, paintingTexture } from './roomTextures'
import type { HeroValue } from '../hero/config'

/** Los tres cuadros del fondo: un rosa (4), un verde (5) y el 10 (anfitrión). */
const PICTURE_VALUES: HeroValue[] = [4, 5, 10]

/** Rotación Y para que el +z del objeto mire al centro desde el ángulo `a`. */
function faceCenter(a: number): number {
  return Math.atan2(-Math.cos(a), -Math.sin(a))
}

export function Room3D() {
  const { room, colors } = MESA3D

  const damask = useMemo(() => {
    const t = damaskTexture()
    t.repeat.set(room.damask.repeatX, room.damask.repeatY)
    return t
  }, [room.damask])
  const carpet = useMemo(() => carpetTexture(), [])
  const paintings = useMemo(() => PICTURE_VALUES.map((v) => paintingTexture(v)), [])

  const wallH = room.wallTop - room.floorY
  const wallCy = (room.wallTop + room.floorY) / 2

  return (
    <group>
      {/* Piso alfombrado (recibe la sombra de la mesa bajo la lámpara). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, room.floorY, 0]} receiveShadow>
        <circleGeometry args={[room.carpetRadius, 96]} />
        <meshStandardMaterial
          map={carpet}
          roughness={1}
          metalness={0}
          emissiveMap={carpet}
          emissive={room.glow.carpet.color}
          emissiveIntensity={room.glow.carpet.intensity}
        />
      </mesh>

      {/* Pared cilíndrica con damasco (se ve desde adentro). */}
      <mesh position={[0, wallCy, 0]}>
        <cylinderGeometry args={[room.radius, room.radius, wallH, 96, 1, true]} />
        <meshStandardMaterial
          map={damask}
          roughness={0.95}
          metalness={0}
          side={THREE.BackSide}
          emissiveMap={damask}
          emissive={room.glow.wall.color}
          emissiveIntensity={room.glow.wall.intensity}
        />
      </mesh>

      {/* Friso cerca del techo: remata la pared y guía la mirada al fondo. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, room.frieze.y, 0]}>
        <torusGeometry args={[room.radius, room.frieze.tube, 12, 160]} />
        <meshStandardMaterial color="#2A1C12" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Columnas a los costados del fondo. */}
      {room.columns.angles.map((a, i) => {
        const x = Math.cos(a) * room.columns.radius
        const z = Math.sin(a) * room.columns.radius
        return (
          <group key={`col-${i}`} position={[x, 0, z]}>
            <mesh position={[0, wallCy, 0]} castShadow>
              <cylinderGeometry args={[room.columns.half, room.columns.half * 1.06, wallH, 24]} />
              <meshStandardMaterial color={room.stone} roughness={0.85} metalness={0.04} />
            </mesh>
            {/* Capitel */}
            <mesh position={[0, room.wallTop - 0.18, 0]} castShadow>
              <boxGeometry args={[room.columns.half * 2.7, 0.32, room.columns.half * 2.7]} />
              <meshStandardMaterial color={room.stone} roughness={0.8} />
            </mesh>
            {/* Basa */}
            <mesh position={[0, room.floorY + 0.13, 0]} castShadow>
              <boxGeometry args={[room.columns.half * 3, 0.26, room.columns.half * 3]} />
              <meshStandardMaterial color={room.stone} roughness={0.85} />
            </mesh>
          </group>
        )
      })}

      {/* Cuadros de pelusas en el fondo (marcos oscuros). */}
      {room.pictures.angles.map((a, i) => {
        const x = Math.cos(a) * room.pictures.radius
        const z = Math.sin(a) * room.pictures.radius
        return (
          <group
            key={`pic-${i}`}
            position={[x, room.pictures.y, z]}
            rotation={[0, faceCenter(a), 0]}
          >
            <mesh castShadow>
              <boxGeometry args={[room.pictures.frame[0], room.pictures.frame[1], room.pictures.frame[2]]} />
              <meshStandardMaterial color="#160E22" roughness={0.55} metalness={0.15} />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <planeGeometry args={[room.pictures.canvas[0], room.pictures.canvas[1]]} />
              <meshStandardMaterial
                map={paintings[i]}
                roughness={0.9}
                emissiveMap={paintings[i]}
                emissive={room.glow.painting.color}
                emissiveIntensity={room.glow.painting.intensity}
              />
            </mesh>
          </group>
        )
      })}

      {/* Apliques ámbar: luz cálida en las paredes. */}
      {room.sconces.angles.map((a, i) => {
        const x = Math.cos(a) * room.sconces.radius
        const z = Math.sin(a) * room.sconces.radius
        return (
          <group
            key={`sc-${i}`}
            position={[x, room.sconces.y, z]}
            rotation={[0, faceCenter(a), 0]}
          >
            {/* Placa de pared */}
            <mesh>
              <boxGeometry args={[0.16, 0.34, 0.06]} />
              <meshStandardMaterial color="#160E22" roughness={0.6} metalness={0.2} />
            </mesh>
            {/* Bombita visible */}
            <mesh position={[0, 0.02, 0.11]}>
              <sphereGeometry args={[room.sconces.bulb, 16, 12]} />
              <meshBasicMaterial color={colors.bulb} />
            </mesh>
            <pointLight
              position={[0, 0.02, 0.18]}
              color={colors.lamp}
              intensity={room.sconces.intensity}
              distance={room.sconces.distance}
              decay={2}
            />
          </group>
        )
      })}
    </group>
  )
}
