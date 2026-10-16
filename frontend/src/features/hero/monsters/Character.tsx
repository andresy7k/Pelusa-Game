// frontend/src/features/hero/monsters/Character.tsx
// Personaje procedural (T4): blob con pelaje + contorno sticker + cara
// paramétrica. El `group` externo lo posiciona y escala MonsterCanvas cada
// frame; el bob y las animaciones de estado viven acá adentro para que el
// ancla no las herede.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { FACE_1, FACE_DEFAULT, HERO, type FaceSpec, type HeroValue } from '../config'
import { makeBlobGeometry } from './geometry'
import { FurMesh, type FurQuality } from './furMaterial'
import { StickerOutline } from './outline'
import { disposeFace, makeFace, type FaceHandle } from './faces'

export type MonsterState = 'idle' | 'hover' | 'active' | 'special'
export interface CharacterHandle { setState(s: MonsterState): void }

// Bob de reposo (unidades de mundo): asignación, nunca += (se acumularía).
const BOB_Y = 0.015
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

  // T5 reemplaza esto por HERO.monsters[value] (semilla, proporciones y cara).
  const spec: FaceSpec = value === 1 ? FACE_1 : FACE_DEFAULT
  const geo = useMemo(() => makeBlobGeometry(value, [1, 1, 1]), [value])
  const face = useMemo(() => makeFace(spec), [spec])
  faceRef.current = face

  useEffect(() => () => {
    geo.dispose()
    disposeFace(face)
  }, [geo, face])

  const setState = useCallback(
    (s: MonsterState) => {
      const inner = innerRef.current
      if (!inner) return
      // T4: 'idle' y 'active' comparten el gesto base (mirada arriba +
      // balanceo suave); hover/special plenos llegan en T6.
      if (s !== 'idle' && s !== 'active') return
      const pupils = (faceRef.current?.pupils ?? []).map((p) => p.position)
      const lookUp = (spec.eyes.lookUp ?? 0) * spec.eyes.size
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
      {/* Escala global del personaje; T5 suma las proporciones por monstruo. */}
      <group scale={HERO.character.scale}>
        <FurMesh geometry={geo} color={HERO.cards[value].monster} seed={value} quality={quality} />
        <StickerOutline geometry={geo} />
        <primitive object={face.group} />
      </group>
    </group>
  )
})
