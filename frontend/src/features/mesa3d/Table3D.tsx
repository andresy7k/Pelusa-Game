// frontend/src/features/mesa3d/Table3D.tsx
// La mesa del paso 2: óvalo 2:1 con la piel de pelusa (textura creativa),
// cenefa de madera, filete ámbar y pedestal. Solo visual: ningún dato del
// juego vive acá.
import { useMemo } from 'react'
import * as THREE from 'three'
import { MESA3D } from './config'

/** Elipse como Shape (los UV de ShapeGeometry son coords de mundo). */
function ellipseShape(rx: number, ry: number): THREE.Shape {
  const s = new THREE.Shape()
  s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
  return s
}

export function Table3D({ felt }: { felt: THREE.Texture | null }) {
  const { table, colors } = MESA3D
  const { rx, ry, rim, fillet, pedestal } = table

  // Fieltro: elipse con la textura (UV = x/y de la forma).
  const feltGeo = useMemo(() => {
    const geo = new THREE.ShapeGeometry(ellipseShape(rx, ry), 160)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [rx, ry])

  // Cenefa: anillo extruido con bisel (madera).
  const rimGeo = useMemo(() => {
    const outer = fillet.width + rim.width
    const s = ellipseShape(rx + outer, ry + outer)
    s.holes.push(new THREE.Path().absellipse(0, 0, rx + fillet.width, ry + fillet.width, 0, Math.PI * 2, true, 0))
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: rim.height,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.04,
      bevelSegments: 3,
      curveSegments: 140,
    })
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [rx, ry, rim, fillet.width])

  // Filete ámbar: aro fino entre fieltro y cenefa.
  const filletGeo = useMemo(() => {
    const s = ellipseShape(rx + fillet.width, ry + fillet.width)
    s.holes.push(new THREE.Path().absellipse(0, 0, rx, ry, 0, Math.PI * 2, true, 0))
    const geo = new THREE.ExtrudeGeometry(s, { depth: fillet.height, bevelEnabled: false, curveSegments: 140 })
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [rx, ry, fillet.width, fillet.height])

  return (
    <group>
      {/* Fieltro (la piel de pelusa), apenas por encima del piso de la cenefa. */}
      <mesh geometry={feltGeo} position={[0, 0.004, 0]} receiveShadow>
        <meshStandardMaterial
          map={felt}
          color={felt ? '#ffffff' : colors.feltMid}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* Filete ámbar. */}
      <mesh geometry={filletGeo} position={[0, 0.02, 0]} castShadow>
        <meshStandardMaterial
          color={colors.amber}
          roughness={0.4}
          metalness={0.2}
          emissive={colors.amber}
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Cenefa de madera. */}
      <mesh geometry={rimGeo} castShadow receiveShadow>
        <meshStandardMaterial color={colors.wood} roughness={0.62} metalness={0.06} />
      </mesh>

      {/* Pedestal + base. */}
      <mesh position={[0, -0.03 - pedestal.height / 2, 0]} castShadow>
        <cylinderGeometry args={[pedestal.rTop, pedestal.rBottom, pedestal.height, 48]} />
        <meshStandardMaterial color={colors.woodDark} roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.03 - pedestal.height - 0.05, 0]}>
        <cylinderGeometry args={[pedestal.rBottom + 0.18, pedestal.rBottom + 0.22, 0.1, 48]} />
        <meshStandardMaterial color={colors.woodDark} roughness={0.95} metalness={0.02} />
      </mesh>
    </group>
  )
}
