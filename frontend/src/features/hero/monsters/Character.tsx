// frontend/src/features/hero/monsters/Character.tsx
// Personaje procedural (T4): blob con pelaje + contorno sticker + cara
// paramétrica. El `group` externo lo posiciona y escala MonsterCanvas cada
// frame; el bob y las animaciones de estado viven acá adentro para que el
// ancla no las herede.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HERO, type HeroValue } from '../config'
import { makeBlobGeometry, surfaceZ } from './geometry'
import { FurMesh, type FurQuality } from './furMaterial'
import { StickerOutline } from './outline'
import { disposeFace, makeFace, type FaceHandle } from './faces'
import { animateTo, killState, type MonsterState } from './stateAnimations'

export type { MonsterState }
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
  // Estado lógico actual: el bob de reposo solo corre en idle (en el resto
  // los tweens son dueños de position.y y pelearían por asignación).
  const stateRef = useRef<MonsterState>('idle')
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Diseño del monstruo de este valor (T5): semilla, proporciones, cara,
  // apéndices y special (el special lo anima T6; acá solo se guarda).
  const spec = HERO.monsters[value]
  const color = HERO.cards[value].monster
  // Geometría por valor (memoizada por valor, como en T4): una lente cuyo
  // contorno frontal calca el `d` del monstruo pintado (CAMINOS).
  const geo = useMemo(() => makeBlobGeometry(value), [value])
  const face = useMemo(() => makeFace(spec.face, (x, y) => surfaceZ(value, x, y)), [spec, value])
  faceRef.current = face

  // Cuerpo liso (babosa 7, `pelaje: false`): una malla física con brillo, como
  // el LOD lite; el resto usa el pelaje por shells.
  const smoothMat = useMemo(() => {
    if (spec.pelaje !== false) return null
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.42,
      clearcoat: 0.65,
      clearcoatRoughness: 0.4,
      sheen: 0.5,
      sheenColor: new THREE.Color('#ffffff'),
    })
  }, [spec, color])

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
    smoothMat?.dispose()
    disposeFace(face)
  }, [geo, tailGeo, tuftGeo, hornGeo, smoothMat, face])

  // Máquina de estados (T6): delega en stateAnimations (mata los tweens
  // vivos y arranca el nuevo; con reduced-motion resuelve a la pose final).
  const setState = useCallback(
    (s: MonsterState) => {
      stateRef.current = s
      animateTo({ inner: innerRef.current, face: faceRef.current }, s, value, quality)
    },
    [value, quality],
  )

  useImperativeHandle(ref, () => ({ setState }), [setState])

  // La selección manda el estado: activa al centro, hover en laterales con
  // el cursor encima (la activa gana si coinciden), idle el resto.
  const state: MonsterState = active ? 'active' : hovered ? 'hover' : 'idle'
  useEffect(() => {
    setState(state)
  }, [setState, state])

  // Al desmontar no quedan loops vivos (sway/parpadeo de idle).
  useEffect(
    () => () => {
      killState({ inner: innerRef.current, face: faceRef.current })
    },
    [],
  )

  // Bob de reposo: solo asignación y solo en idle; en reduced-motion no corre.
  useFrame((root) => {
    const inner = innerRef.current
    if (!inner || reduced || stateRef.current !== 'idle') return
    inner.position.y = Math.sin(root.clock.elapsedTime * 1.6) * BOB_Y
  })

  return (
    <group ref={innerRef}>
      {/* Escala global del personaje (T4); las proporciones por monstruo
          viven en la geometría (spec.seed/scale). */}
      <group scale={HERO.character.scale}>
        {smoothMat ? (
          <mesh geometry={geo} material={smoothMat} castShadow />
        ) : (
          <FurMesh geometry={geo} color={color} seed={spec.seed} quality={quality} />
        )}
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
