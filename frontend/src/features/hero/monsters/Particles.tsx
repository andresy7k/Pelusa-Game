// frontend/src/features/hero/monsters/Particles.tsx
// Polvo ambiental del hero + ráfagas de los especiales (T6). El ambiente
// sube lento con wrap; las ráfagas las dispara `stateAnimations` vía el
// registry (spawnBurst) en la posición de mundo del monstruo. En `lite`:
// 30 partículas y sin blend aditivo.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { registerBurstSpawner } from './stateAnimations'
import type { FurQuality } from './furMaterial'

// Caja del polvo ambiental (unidades de mundo, cámara en z=14 fov 32).
const AREA_X = 9
const TOP = 5
const BOTTOM = -5
// Ráfagas: pool fijo con velocidad + vida por partícula (se aparcan abajo).
const BURST_POOL = 240
const BURST_N = 26
const BURST_LIFE = 0.9
const PARK_Y = -999

export function Particles({ accent, quality }: { accent: string; quality: FurQuality }) {
  const count = quality === 'full' ? 120 : 30
  const additive = quality === 'full'

  const ambientRef = useRef<THREE.Points>(null)
  const burstRef = useRef<THREE.Points>(null)
  const cursor = useRef(0)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Polvo ambiental: posiciones + velocidad de ascenso por partícula.
  const ambient = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const speed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * AREA_X
      pos[i * 3 + 1] = BOTTOM + Math.random() * (TOP - BOTTOM)
      pos[i * 3 + 2] = -2 + Math.random() * 3
      speed[i] = 0.12 + Math.random() * 0.23
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return { geo, speed }
  }, [count])
  useEffect(() => () => ambient.geo.dispose(), [ambient])

  // Pool de ráfagas: posición + color por vértice, velocidad y vida aparte.
  const bursts = useMemo(() => {
    const pos = new Float32Array(BURST_POOL * 3)
    const col = new Float32Array(BURST_POOL * 3)
    const vel = new Float32Array(BURST_POOL * 3)
    const life = new Float32Array(BURST_POOL)
    for (let i = 0; i < BURST_POOL; i++) pos[i * 3 + 1] = PARK_Y
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return { geo, vel, life }
  }, [])
  useEffect(() => () => bursts.geo.dispose(), [bursts])

  // Tinte: la luz y el polvo viran al color de la carta activa (~0.8 s).
  useEffect(() => {
    const mat = ambientRef.current?.material as THREE.PointsMaterial | undefined
    if (!mat) return
    const target = new THREE.Color(accent)
    if (reduced) mat.color.copy(target)
    else gsap.to(mat.color, { r: target.r, g: target.g, b: target.b, duration: 0.8, ease: 'power2.out', overwrite: 'auto' })
  }, [accent, reduced])

  // El spawner vive mientras el sistema está montado (firma del registry).
  useEffect(() => {
    registerBurstSpawner((color, worldPos) => {
      const c = new THREE.Color(color)
      const pos = bursts.geo.getAttribute('position') as THREE.BufferAttribute
      const colAttr = bursts.geo.getAttribute('color') as THREE.BufferAttribute
      for (let n = 0; n < BURST_N; n++) {
        const i = cursor.current
        cursor.current = (cursor.current + 1) % BURST_POOL
        pos.setXYZ(i, worldPos.x, worldPos.y, worldPos.z)
        // Esfera de velocidades hacia afuera y arriba.
        const a = Math.random() * Math.PI * 2
        const up = 0.8 + Math.random() * 1.6
        const out = 0.6 + Math.random() * 1.8
        bursts.vel[i * 3] = Math.cos(a) * out
        bursts.vel[i * 3 + 1] = up
        bursts.vel[i * 3 + 2] = (Math.random() - 0.5) * 1.2
        bursts.life[i] = BURST_LIFE * (0.7 + Math.random() * 0.5)
        colAttr.setXYZ(i, c.r, c.g, c.b)
      }
      pos.needsUpdate = true
      colAttr.needsUpdate = true
    })
    return () => registerBurstSpawner(null)
  }, [bursts])

  useFrame((_root, delta) => {
    const dt = Math.min(delta, 0.05)
    // Ambiente: ascenso lento con wrap (en reduced-motion queda quieto).
    const posAttr = ambient.geo.getAttribute('position') as THREE.BufferAttribute
    if (!reduced) {
      const arr = posAttr.array as Float32Array
      for (let i = 0; i < count; i++) {
        let y = arr[i * 3 + 1] + ambient.speed[i] * dt
        if (y > TOP) y = BOTTOM
        arr[i * 3 + 1] = y
      }
      posAttr.needsUpdate = true
    }
    // Ráfagas: balística corta con frenado; al morir se aparcan.
    const bPos = bursts.geo.getAttribute('position') as THREE.BufferAttribute
    const bArr = bPos.array as Float32Array
    let dirty = false
    for (let i = 0; i < BURST_POOL; i++) {
      if (bursts.life[i] <= 0) continue
      bursts.life[i] -= dt
      if (bursts.life[i] <= 0) {
        bArr[i * 3 + 1] = PARK_Y
      } else {
        const damp = 1 - 1.8 * dt
        bursts.vel[i * 3] *= damp
        bursts.vel[i * 3 + 1] = bursts.vel[i * 3 + 1] * damp - 0.6 * dt
        bursts.vel[i * 3 + 2] *= damp
        bArr[i * 3] += bursts.vel[i * 3] * dt
        bArr[i * 3 + 1] += bursts.vel[i * 3 + 1] * dt
        bArr[i * 3 + 2] += bursts.vel[i * 3 + 2] * dt
      }
      dirty = true
    }
    if (dirty) bPos.needsUpdate = true
  })

  return (
    <>
      <points ref={ambientRef} geometry={ambient.geo} frustumCulled={false}>
        <pointsMaterial
          size={0.05}
          color={accent}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>
      <points ref={burstRef} geometry={bursts.geo} frustumCulled={false}>
        <pointsMaterial
          size={0.07}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>
    </>
  )
}
