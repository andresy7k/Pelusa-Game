// frontend/src/features/hero/monsters/stateAnimations.ts
// Máquina de estados por personalidad (T6): idle / hover / active / special.
// `Character.setState` delega acá; T7 reusa `animateTo` para el intro. Los
// especiales pueden soltar una ráfaga efímera vía
// el registry `registerBurstSpawner` (lo instala Particles al montarse:
// `animateTo` tiene firma fija de 4 params y el spawner no viaja como param).
import * as THREE from 'three'
import gsap from 'gsap'
import { HERO, type HeroValue } from '../config'
import type { FaceHandle } from './faces'
import type { FurQuality } from './furMaterial'
import { getPointer } from '../pointer'

export type MonsterState = 'idle' | 'hover' | 'active' | 'special'

/** Lo que necesita la animación: el grupo interno (lo mueve Character cada
 *  frame solo en idle) y la cara (pupilas, párpados y boca de faces.ts). */
export interface StateAnimHandle {
  inner: THREE.Group | null
  face: FaceHandle | null
}

export type SpawnBurst = (color: string, worldPos: THREE.Vector3) => void

// Registry de ráfagas (lo instala MonsterCanvas cuando monta Particles).
let burstSpawner: SpawnBurst | null = null
export function registerBurstSpawner(fn: SpawnBurst | null): void {
  burstSpawner = fn
}

// Balanceo de reposo (radianes): la Pelusa 1 "rueda" suave al flotar.
const IDLE_YAW = 0.08
// Límites del área de parpadeo: cada 3-6 s aleatorio (solo quality full;
// en lite los párpados quedan en reposo para no sumar timelines).
const BLINK_MIN_S = 3
const BLINK_RANGE_S = 3

// Tweens/delayedCalls vivos por grupo interno: al cambiar de estado se matan
// (el `killTweensOf` de los targets cubre los sueltos, esto cubre loops).
const tracked = new WeakMap<THREE.Group, Array<{ kill(): void }>>()

function track(key: THREE.Group, t: { kill(): void }): void {
  const list = tracked.get(key)
  if (list) list.push(t)
  else tracked.set(key, [t])
}

function lookUpOf(value: HeroValue): number {
  const eyes = HERO.monsters[value].face.eyes
  return (eyes.lookUp ?? 0) * eyes.size
}

/** Mata todo lo vivo de este personaje (loops de sway/parpadeo incluidos). */
export function killState(handle: StateAnimHandle): void {
  const { inner, face } = handle
  const list = inner ? tracked.get(inner) : undefined
  if (list) {
    for (const t of list) t.kill()
    tracked.delete(inner!)
  }
  if (!inner) return
  gsap.killTweensOf([inner.position, inner.scale, inner.rotation])
  if (!face) return
  for (const p of face.pupils) gsap.killTweensOf([p.position, p.scale])
  // Un blink matado a mitad deja el párpado visible y a medio abrir: se
  // devuelve a reposo acá (vale para todos los estados destino).
  for (const l of face.lids) {
    gsap.killTweensOf(l.scale)
    const rest = restLid(l)
    l.scale.y = rest
    l.visible = rest > 0.021
  }
  gsap.killTweensOf(face.mouth.scale)
}

function restLid(lid: THREE.Object3D): number {
  const rest = (lid.userData as { rest?: number }).rest
  return rest ?? 0.02
}

/** Pose final de reposo, sin timelines (reduced-motion y base de idle). */
function settleInstant(handle: StateAnimHandle, value: HeroValue): void {
  const { inner, face } = handle
  if (!inner) return
  inner.position.set(0, 0, 0)
  inner.rotation.set(0, 0, 0)
  inner.scale.setScalar(1)
  if (!face) return
  const lookUp = lookUpOf(value)
  for (const p of face.pupils) {
    p.position.y = lookUp
    p.position.x = 0
    p.scale.setScalar(1)
  }
  for (const l of face.lids) {
    const rest = restLid(l)
    l.scale.y = rest
    l.visible = rest > 0.021
  }
  face.mouth.scale.setScalar(1)
}

// Parpadeo en loop: el párpado tapa (scale.y 1) y vuelve a su reposo. Los
// ojos sin `sleepy` traen tapa invisible en 0.02 (faces.ts): se muestra solo
// durante el parpadeo.
function startBlink(key: THREE.Group, face: FaceHandle): void {
  const blink = (): void => {
    const call = gsap.delayedCall(BLINK_MIN_S + Math.random() * BLINK_RANGE_S, () => {
      const lids = face.lids
      if (!lids.length) {
        blink()
        return
      }
      for (const l of lids) l.visible = true
      const tl = gsap.timeline({ onComplete: blink })
      track(key, tl)
      tl.to(
        lids.map((l) => l.scale),
        { y: 1, duration: 0.07, ease: 'power1.in', overwrite: 'auto' },
      ).to(
        lids.map((l) => l.scale),
        {
          y: (i) => restLid(lids[i]),
          duration: 0.12,
          ease: 'power1.out',
          overwrite: 'auto',
          onComplete: () => {
            for (const l of lids) l.visible = restLid(l) > 0.021
          },
        },
      )
    })
    track(key, call)
  }
  blink()
}

// Reposo: mirada arriba + balanceo suave + parpadeo. No toca position.y (es
// del bob de Character) ni rotation.y más que con el sway propio.
function idle(handle: StateAnimHandle, value: HeroValue, quality: FurQuality): void {
  const { inner, face } = handle
  if (!inner || !face) return
  // El confeti (7) deja rotation.y en 2π: se normaliza (invisible, misma
  // pose) para que el sway arranque limpio.
  inner.rotation.y = inner.rotation.y % (Math.PI * 2)
  const lookUp = lookUpOf(value)
  const pupils = face.pupils.map((p) => p.position)
  gsap.to(inner.position, { x: 0, z: 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
  gsap.to(inner.rotation, { x: 0, z: 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
  gsap.to(inner.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
  gsap.to(face.mouth.scale, { x: 1, y: 1, z: 1, duration: 0.4, overwrite: 'auto' })
  gsap.to(face.pupils.map((p) => p.scale), { x: 1, y: 1, z: 1, duration: 0.4, overwrite: 'auto' })
  gsap.to(pupils, { y: lookUp, duration: 0.7, ease: HERO.easings.pop, overwrite: 'auto' })
  const sway = gsap.to(inner.rotation, {
    y: IDLE_YAW,
    duration: 2.6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  })
  track(inner, sway)
  if (quality === 'full') startBlink(inner, face)
}

// Gestos de hover por personalidad: breves (un tiro, vuelven a reposo), no
// molestos. El 4 no trae gesto en el spec: gruñido genérico (se inclina).
function hover(handle: StateAnimHandle, value: HeroValue): void {
  const { inner, face } = handle
  if (!inner || !face) return
  const pupils = face.pupils
  switch (value) {
    case 1: { // salta atrás
      const tl = gsap.timeline()
      track(inner, tl)
      tl.to(inner.position, { y: 0.22, duration: 0.22, ease: 'power2.out' })
        .to(inner.rotation, { x: -0.1, duration: 0.22, ease: 'power2.out' }, 0)
        .to(inner.position, { y: 0, duration: 0.3, ease: 'power2.in' })
        .to(inner.rotation, { x: 0, duration: 0.3, ease: 'power2.in' }, '<')
      break
    }
    case 2: { // bleh (saca la lengua: la boca se estira y los ojos bajan)
      const tl = gsap.timeline()
      track(inner, tl)
      tl.to(face.mouth.scale, { x: 1.35, y: 1.35, z: 1.35, duration: 0.18, ease: 'power2.out' })
        .to(pupils.map((p) => p.position), { y: -0.05, duration: 0.18 }, 0)
        .to(face.mouth.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power2.in' }, '+=0.15')
        .to(pupils.map((p) => p.position), { y: lookUpOf(value), duration: 0.3 }, '<')
      break
    }
    case 3: { // se aplasta
      const tl = gsap.timeline()
      track(inner, tl)
      tl.to(inner.scale, { x: 1.1, y: 0.8, z: 1.05, duration: 0.25, ease: 'power2.in' })
        .to(inner.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2)' })
      break
    }
    case 4: { // gruñido: se inclina y abre las fauces
      const tl = gsap.timeline()
      track(inner, tl)
      tl.to(inner.rotation, { x: 0.12, duration: 0.2, ease: 'power2.out' })
        .to(face.mouth.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.2 }, 0)
        .to(inner.rotation, { x: 0, duration: 0.35, ease: 'power2.in' }, '+=0.1')
        .to(face.mouth.scale, { x: 1, y: 1, z: 1, duration: 0.35 }, '<')
      break
    }
    case 5: { // el ojo sigue al cursor (posición normalizada de pointer.ts)
      const pointer = getPointer()
      gsap.to(
        pupils.map((p) => p.position),
        {
          x: pointer.x * 0.14,
          y: lookUpOf(value) + pointer.y * 0.1,
          duration: 0.35,
          ease: 'power2.out',
          overwrite: 'auto',
        },
      )
      break
    }
    case 6: { // se agacha
      const tl = gsap.timeline()
      track(inner, tl)
      tl.to(inner.scale, { x: 1.05, y: 0.86, z: 1.05, duration: 0.3, ease: 'power2.in' })
        .to(inner.position, { y: -0.06, duration: 0.3 }, 0)
        .to(inner.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(1.7)' })
        .to(inner.position, { y: 0, duration: 0.4 }, '<')
      break
    }
    case 7: { // saluda (meneo lateral)
      const tl = gsap.timeline()
      track(inner, tl)
      tl.to(inner.rotation, { z: 0.14, duration: 0.15, ease: 'sine.inOut' })
        .to(inner.rotation, { z: -0.1, duration: 0.15, ease: 'sine.inOut' })
        .to(inner.rotation, { z: 0, duration: 0.2, ease: 'sine.inOut' })
      break
    }
    case 8: { // zoom del ojo
      const tl = gsap.timeline()
      track(inner, tl)
      tl.to(pupils.map((p) => p.scale), { x: 1.4, y: 1.4, z: 1.4, duration: 0.25, ease: 'power2.out' })
        .to(pupils.map((p) => p.scale), { x: 1, y: 1, z: 1, duration: 0.35, ease: 'power2.in' }, '+=0.1')
      break
    }
    case 9: { // ojos-caracol: cada pupila se estira a su lado
      const tl = gsap.timeline()
      track(inner, tl)
      pupils.forEach((p, i) => {
        const dir = i === 0 ? -1 : 1
        tl.to(p.position, { x: dir * 0.12, y: lookUpOf(value) + 0.04, duration: 0.25, ease: 'power2.out' }, 0)
      })
      pupils.forEach((p) => {
        tl.to(p.position, { x: 0, y: lookUpOf(value), duration: 0.3, ease: 'power2.in' }, '+=0.1')
      })
      break
    }
    case 10: { // risa temblorosa
      const tl = gsap.timeline()
      track(inner, tl)
      for (let i = 0; i < 6; i++) {
        tl.to(inner.position, { x: i % 2 === 0 ? 0.03 : -0.03, duration: 0.05 })
      }
      tl.to(inner.position, { x: 0, duration: 0.08 })
      break
    }
  }
}

// Entrada al centro: pop back.out(1.7) + aterrizaje con rebote suave.
function active(handle: StateAnimHandle): void {
  const { inner } = handle
  if (!inner) return
  const tl = gsap.timeline()
  track(inner, tl)
  tl.fromTo(inner.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1, y: 1, z: 1, duration: 0.55, ease: HERO.easings.pop }, 0)
    .fromTo(inner.position, { y: 0.35 }, { y: 0, duration: 0.5, ease: 'bounce.out' }, 0.05)
}

function burst(handle: StateAnimHandle, value: HeroValue): void {
  if (!burstSpawner || !handle.inner) return
  burstSpawner(HERO.cards[value].monster, handle.inner.getWorldPosition(new THREE.Vector3()))
}

// Especiales únicos por valor (spec §6): un tiro de ~1 s y de vuelta a idle.
// Cada uno puede soltar su ráfaga en el pico vía el registry de arriba.
function special(handle: StateAnimHandle, value: HeroValue, quality: FurQuality): void {
  const { inner, face } = handle
  if (!inner || !face) return
  const kind = HERO.monsters[value].special
  const done = () => idle(handle, value, quality)
  const tl = gsap.timeline({ onComplete: done })
  track(inner, tl)
  switch (kind) {
    case 'bounce': { // 1: salto alto con squash al caer
      tl.to(inner.position, { y: 0.55, duration: 0.3, ease: 'power2.out' })
        .to(inner.position, { y: 0, duration: 0.45, ease: 'bounce.out' })
        .to(inner.scale, { x: 1.12, y: 0.78, z: 1.12, duration: 0.1 }, '-=0.12')
        .add(() => burst(handle, value), '-=0.12')
        .to(inner.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2)' })
      break
    }
    case 'puff': { // 2: se infla y suelta aire
      tl.to(inner.scale, { x: 1.28, y: 1.28, z: 1.28, duration: 0.4, ease: 'power2.inOut' })
        .add(() => burst(handle, value))
        .to(inner.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.inOut' })
      break
    }
    case 'spring': { // 3: se comprime y sale lanzado
      tl.to(inner.scale, { x: 1.15, y: 0.65, z: 1.15, duration: 0.22, ease: 'power2.in' })
        .to(inner.scale, { x: 0.95, y: 1.2, z: 0.95, duration: 0.3, ease: 'power2.out' })
        .to(inner.position, { y: 0.3, duration: 0.3, ease: 'power2.out' }, '<')
        .add(() => burst(handle, value), '<')
        .to(inner.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(1.7)' })
        .to(inner.position, { y: 0, duration: 0.35, ease: 'power2.in' }, '<')
      break
    }
    case 'roar': { // 4: rugido (sacudida + fauces + ráfaga)
      tl.add(() => burst(handle, value), 0)
        .to(face.mouth.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 0.25, ease: 'power2.out' }, 0)
      for (let i = 0; i < 6; i++) {
        tl.to(inner.position, { x: i % 2 === 0 ? 0.06 : -0.06, duration: 0.07 }, 0.1 + i * 0.07)
      }
      tl.to(inner.position, { x: 0, duration: 0.1 })
        .to(face.mouth.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'power2.in' }, '-=0.1')
      break
    }
    case 'shake': { // 5: sacudida lateral
      tl.add(() => burst(handle, value), 0.2)
      for (let i = 0; i < 4; i++) {
        tl.to(inner.rotation, { z: i % 2 === 0 ? 0.18 : -0.18, duration: 0.12, ease: 'sine.inOut' })
      }
      tl.to(inner.rotation, { z: 0, duration: 0.2, ease: 'power2.out' })
      break
    }
    case 'laugh': { // 6: carcajada (saltitos)
      tl.add(() => burst(handle, value), 0.45)
      for (let i = 0; i < 3; i++) {
        tl.to(inner.position, { y: 0.12, duration: 0.14, ease: 'power2.out' })
          .to(inner.position, { y: 0, duration: 0.14, ease: 'power2.in' })
      }
      tl.to(inner.rotation, { z: 0, duration: 0.15 }, '<')
      break
    }
    case 'confetti': { // 7: giro con salto + confeti
      tl.to(inner.position, { y: 0.3, duration: 0.35, ease: 'power2.out' }, 0)
        .to(inner.rotation, { y: `+=${Math.PI * 2}`, duration: 0.7, ease: 'power2.inOut' }, 0)
        .add(() => burst(handle, value), 0.3)
        .to(inner.position, { y: 0, duration: 0.35, ease: 'power2.in' }, 0.35)
      break
    }
    case 'pulse': { // 8: pulso doble del ojo grande
      tl.to(inner.scale, { x: 1.16, y: 1.16, z: 1.16, duration: 0.3, ease: 'sine.inOut' })
        .to(inner.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'sine.inOut' })
        .add(() => burst(handle, value))
        .to(inner.scale, { x: 1.16, y: 1.16, z: 1.16, duration: 0.3, ease: 'sine.inOut' })
        .to(inner.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'sine.inOut' })
      break
    }
    case 'dance': { // 9: baile lado a lado
      tl.add(() => burst(handle, value), 0.44)
      for (let i = 0; i < 4; i++) {
        tl.to(inner.position, { x: i % 2 === 0 ? 0.22 : -0.22, duration: 0.22, ease: 'sine.inOut' })
        tl.to(inner.rotation, { z: i % 2 === 0 ? -0.12 : 0.12, duration: 0.22, ease: 'sine.inOut' }, '<')
      }
      tl.to(inner.position, { x: 0, duration: 0.2, ease: 'power2.out' })
        .to(inner.rotation, { z: 0, duration: 0.2 }, '<')
      break
    }
    case 'stars': { // 10: brinco con giro + estrellas
      tl.to(inner.position, { y: 0.4, duration: 0.3, ease: 'power2.out' }, 0)
        .to(inner.rotation, { y: `+=${Math.PI}`, duration: 0.6, ease: 'power2.inOut' }, 0)
        .to(face.pupils.map((p) => p.position), { y: lookUpOf(value) + 0.06, duration: 0.3 }, 0)
        .add(() => burst(handle, value), 0.28)
        .to(inner.position, { y: 0, duration: 0.35, ease: 'power2.in' }, 0.3)
      break
    }
  }
}

/** Entrada única de la máquina (firma fija: la reusa T7 para el intro).
 *  Mata los tweens vivos y arranca el estado pedido; con reduced-motion
 *  resuelve directo a la pose final, sin timelines (especiales y parpadeo
 *  incluidos: el special queda en reposo y no hay blink en loop). */
export function animateTo(
  handle: StateAnimHandle,
  state: MonsterState,
  value: HeroValue,
  quality: FurQuality,
): void {
  if (!handle.inner) return
  killState(handle)
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    settleInstant(handle, value)
    return
  }
  switch (state) {
    case 'idle':
      idle(handle, value, quality)
      break
    case 'hover':
      hover(handle, value)
      break
    case 'active':
      active(handle)
      break
    case 'special':
      special(handle, value, quality)
      break
  }
}
