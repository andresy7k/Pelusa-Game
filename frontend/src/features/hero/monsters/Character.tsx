// frontend/src/features/hero/monsters/Character.tsx
// Personaje procedural (T4): blob con pelaje + contorno sticker + cara
// paramétrica. El `group` externo lo posiciona y escala MonsterCanvas cada
// frame; el bob y las animaciones de estado viven acá adentro para que el
// ancla no las herede.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { HERO, type HeroValue } from '../config'
import { makeBlobGeometry } from './geometry'
import { FurMesh, type FurQuality } from './furMaterial'
import { StickerOutline } from './outline'
import { disposeFace, makeFace, type FaceHandle } from './faces'

export type MonsterState = 'idle' | 'hover' | 'active' | 'special'
export interface CharacterHandle { setState(s: MonsterState): void }

// Bob de reposo (unidades de mundo): asignación, nunca += (se acumularía).
const BOB_Y = 0.015
// 5 mechones en abanico sobre el borde superior (monstruo 7, fantasma).
const TUFTS: Array<{ position: [number, number, number]; tilt: number }> = [
  { position: [-0.58, 0.88, -0.05], tilt: 0.42 },
  { position: [-0.3, 0.99, -0.05], tilt: 0.2 },
  { position: [0, 1.02, -0.05], tilt: 0 },
  { position: [0.3, 0.99, -0.05], tilt: -0.2 },
  { position: [0.58, 0.88, -0.05], tilt: -0.42 },
]

// 2 cuernos arriba (monstruo 10): esferas achatadas con pelaje corto.
const HORNS: Array<{ position: [number, number, number] }> = [
  { position: [-0.42, 0.82, 0] },
  { position: [0.42, 0.82, 0] },
]
// Balanceo de reposo (radianes): la Pelusa 1 "rueda" suave al flotar.
const IDLE_YAW = 0.08

export interface CharacterProps {
  value: HeroValue
  active: boolean
  hovered: boolean
  quality: FurQuality
}

export const Character = forwardRef<CharacterHandle, CharacterProps>(function Character(
  { value, active, hovered, quality },
  ref,
) {
  const innerRef = useRef<THREE.Group>(null)
  const faceRef = useRef<FaceHandle | null>(null)
  const swayRef = useRef<gsap.core.Tween | null>(null)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Diseño del monstruo de este valor (T5): semilla, proporciones, cara,
  // apéndices y special (el special lo anima T6; acá solo se guarda).
  const spec = HERO.monsters[value]
  const color = HERO.cards[value].monster
  // Geometría por valor (memoizada por valor, como en T4).
  const geo = useMemo(() => makeBlobGeometry(spec.seed, spec.scale), [value])
  const face = useMemo(() => makeFace(spec.face), [spec])
  faceRef.current = face

  // Apéndices con pelaje del color del monstruo (T5): solo el 3/7/10 traen.
  const tailGeo = useMemo(() => {
    if (!spec.appendages.includes('tailLeft')) return null
    // Cola izquierda (3): cilindro achatado curvado que sale del lateral y
    // se arrastra sobre el "piso" de la carta.
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.8, -0.3, 0.05),
      new THREE.Vector3(-1.2, -0.48, 0.12),
      new THREE.Vector3(-1.62, -0.6, 0.22),
    ])
    const tubo = new THREE.TubeGeometry(curva, 12, 0.16, 8, false)
    tubo.scale(1, 0.7, 0.85) // achatada
    return tubo
  }, [spec])
  const tuftGeo = useMemo(() => {
    if (!spec.appendages.includes('tufts')) return null
    // Mechones (7): conos romos (cilindro cónico) alrededor del borde alto.
    return new THREE.CylinderGeometry(0.05, 0.17, 0.45, 10)
  }, [spec])
  const hornGeo = useMemo(() => {
    if (!spec.appendages.includes('horns')) return null
    // Cuernos (10): esferas achatadas con pelaje corto en la parte alta.
    const cuerno = new THREE.SphereGeometry(0.22, 16, 12)
    cuerno.scale(1, 1.3, 0.65)
    return cuerno
  }, [spec])

  useEffect(() => () => {
    geo.dispose()
    tailGeo?.dispose()
    tuftGeo?.dispose()
    hornGeo?.dispose()
    disposeFace(face)
  }, [geo, tailGeo, tuftGeo, hornGeo, face])

  const setState = useCallback(
    (s: MonsterState) => {
      const inner = innerRef.current
      if (!inner) return
      // T4: 'idle' y 'active' comparten el gesto base (mirada arriba +
      // balanceo suave); hover/special plenos llegan en T6.
      if (s !== 'idle' && s !== 'active') return
      const pupils = (faceRef.current?.pupils ?? []).map((p) => p.position)
      const lookUp = (spec.face.eyes.lookUp ?? 0) * spec.face.eyes.size
      swayRef.current?.kill()
      swayRef.current = null
      gsap.killTweensOf(pupils)
      if (reduced) {
        inner.rotation.y = 0
        for (const p of pupils) p.y = lookUp
        return
      }
      gsap.to(pupils, { y: lookUp, duration: 0.7, ease: HERO.easings.pop, overwrite: 'auto' })
      swayRef.current = gsap.to(inner.rotation, {
        y: IDLE_YAW,
        duration: 2.6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    },
    [reduced, spec],
  )

  useImperativeHandle(ref, () => ({ setState }), [setState])

  // La selección manda el estado (T6 completa hover/active/special).
  const state: MonsterState = active ? 'active' : hovered ? 'hover' : 'idle'
  useEffect(() => {
    setState(state)
  }, [setState, state])

  useEffect(
    () => () => {
      swayRef.current?.kill()
    },
    [],
  )

  // Bob de reposo: solo asignación; en reduced-motion no corre.
  useFrame((root) => {
    const inner = innerRef.current
    if (!inner || reduced) return
    inner.position.y = Math.sin(root.clock.elapsedTime * 1.6) * BOB_Y
  })

  return (
    <group ref={innerRef}>
      {/* Escala global del personaje (T4); las proporciones por monstruo
          viven en la geometría (spec.seed/scale). */}
      <group scale={HERO.character.scale}>
        <FurMesh geometry={geo} color={color} seed={spec.seed} quality={quality} />
        <StickerOutline geometry={geo} />
        <primitive object={face.group} />
        {tailGeo !== null && (
          <FurMesh geometry={tailGeo} color={color} seed={spec.seed} quality={quality} />
        )}
        {tuftGeo !== null && TUFTS.map((t, i) => (
          <group key={i} position={t.position} rotation={[0, 0, t.tilt]}>
            <FurMesh geometry={tuftGeo} color={color} seed={spec.seed} quality={quality} />
          </group>
        ))}
        {hornGeo !== null && HORNS.map((h, i) => (
          <group key={i} position={h.position}>
            <FurMesh geometry={hornGeo} color={color} seed={spec.seed} quality={quality} />
          </group>
        ))}
      </group>
    </group>
  )
})
