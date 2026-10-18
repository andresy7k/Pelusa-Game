// frontend/src/features/mesa3d/Lamp3D.tsx
// Lámpara colgante del paso 2: pantalla curva, bombita cálida, SpotLight con
// sombras suaves y un cono volumétrico con desvanecido (alphaMap) para que
// no tenga bordes duros.
import { useMemo } from 'react'
import * as THREE from 'three'
import { MESA3D } from './config'

/** Gradiente del cono: apagado en la base (sobre la mesa), máximo al 70 %
 *  de altura y sin corte seco en el vértice (v=1 = vértice, v=0 = base). */
function coneFadeTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 32
  cv.height = 256
  const g = cv.getContext('2d')!
  const grad = g.createLinearGradient(0, 256, 0, 0)
  grad.addColorStop(0, 'rgb(0,0,0)')
  grad.addColorStop(0.25, 'rgb(80,80,80)')
  grad.addColorStop(0.7, 'rgb(255,255,255)')
  grad.addColorStop(1, 'rgb(120,120,120)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 256)
  const t = new THREE.CanvasTexture(cv)
  t.needsUpdate = true
  return t
}

export function Lamp3D() {
  const { lamp, colors } = MESA3D

  // Pantalla: perfil curvo (lathe) alrededor del eje Y.
  const shadeGeo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    const n = 24
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const r = lamp.shade.rTop + (lamp.shade.rBottom - lamp.shade.rTop) * Math.pow(t, 1.5)
      pts.push(new THREE.Vector2(r, lamp.shade.height * (1 - t)))
    }
    return new THREE.LatheGeometry(pts, 48)
  }, [lamp.shade])

  const fade = useMemo(() => coneFadeTexture(), [])
  const cableLen = lamp.cableTop - lamp.y - lamp.shade.height

  return (
    <group position={[0, lamp.y, 0]}>
      {/* Cable hasta "el techo" (la sala llega en el paso 3). */}
      <mesh position={[0, lamp.shade.height + cableLen / 2, 0]}>
        <cylinderGeometry args={[0.013, 0.013, cableLen, 8]} />
        <meshStandardMaterial color="#0E0918" roughness={0.8} />
      </mesh>
      <mesh position={[0, lamp.cableTop - lamp.y, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.06, 20]} />
        <meshStandardMaterial color="#0E0918" roughness={0.8} />
      </mesh>

      {/* Pantalla (doble faz): emisiva tenue para que no sea un agujero negro
          cuando se la mira desde arriba. */}
      <mesh geometry={shadeGeo} castShadow>
        <meshStandardMaterial
          color={colors.shade}
          emissive={colors.shadeGlow}
          emissiveIntensity={0.55}
          roughness={0.45}
          metalness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bombita emisiva dentro de la pantalla. */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.055, 20, 16]} />
        <meshBasicMaterial color={colors.bulb} />
      </mesh>

      {/* Halo cálido cercano al bulbo. */}
      <pointLight position={[0, 0.1, 0]} color={colors.bulb} intensity={2.2} distance={4.5} decay={2} />

      {/* Foco principal hacia la mesa (sombras suaves). */}
      <spotLight
        position={[0, 0.08, 0]}
        angle={lamp.spot.angle}
        penumbra={lamp.spot.penumbra}
        intensity={lamp.spot.intensity}
        decay={lamp.spot.decay}
        distance={lamp.spot.distance}
        color={colors.lamp}
        castShadow
        shadow-mapSize-width={lamp.spot.shadows}
        shadow-mapSize-height={lamp.spot.shadows}
        shadow-bias={-0.0005}
        shadow-radius={6}
        shadow-camera-near={0.6}
        shadow-camera-far={12}
      />

      {/* Cono volumétrico: uno solo, con alphaMap (sin bordes duros). */}
      <mesh position={[0, 0.08 - lamp.cone.h / 2, 0]} renderOrder={3}>
        <coneGeometry args={[lamp.cone.rBottom, lamp.cone.h, 48, 1, true]} />
        <meshBasicMaterial
          color="#FFCF9A"
          transparent
          opacity={lamp.cone.opacity}
          alphaMap={fade}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          fog={false}
        />
      </mesh>
    </group>
  )
}
