// frontend/src/features/hero/monsters/faces.ts
// Ojos y bocas paramétricos (FaceSpec de config.ts): primitivas unlit en
// unidades del cuerpo montadas SOBRE la superficie real del blob (zPiel, la
// misma lente de geometry.ts que dibuja el contorno pintado), listas para
// que T6 anime pupilas, párpados y boca.
import * as THREE from 'three'
import type { FaceSpec } from '../config'

const INK = '#26303A' // tinta de ojos y bocas (misma que el pintado)
const WHITE = '#ffffff'

const EYE_Y = 0.3
const MOUTH_Y = -0.32

// z de la piel a esa altura, más un pelo, para que la pieza nacida sobre
// ella media dentro y media fuera (como el sticker pintado).
function zOn(zPiel: (x: number, y: number) => number, x: number, y: number): number {
  return zPiel(x, y) + 0.02
}

export interface FaceHandle {
  group: THREE.Group
  pupils: THREE.Object3D[]
  lids: THREE.Object3D[]
  mouth: THREE.Object3D
}

type StickerMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>

function basic(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color })
}

// Todo al frente de las capas de pelaje (renderOrder alto, como pide el brief).
function piece(geo: THREE.BufferGeometry, color: string): StickerMesh {
  const m = new THREE.Mesh(geo, basic(color))
  m.renderOrder = 2
  return m
}

// Arco inferior de un toro: la sonrisa dibujada a mano.
function smile(radius: number, tube: number): StickerMesh {
  const arco = piece(new THREE.TorusGeometry(radius, tube, 8, 24, Math.PI), INK)
  arco.rotation.z = Math.PI
  return arco
}

function makeMouth(spec: FaceSpec, zPiel: (x: number, y: number) => number): THREE.Object3D {
  const mouth = new THREE.Group()
  const dark = spec.mouthInner ?? INK
  switch (spec.mouth) {
    case 'o': {
      const o = piece(new THREE.SphereGeometry(1, 20, 14), dark)
      o.scale.set(0.062, 0.078, 0.09)
      mouth.add(o)
      break
    }
    case 'tinySmile':
      mouth.add(smile(0.13, 0.022))
      break
    case 'tinyOpen': {
      const o = piece(new THREE.SphereGeometry(1, 20, 14), dark)
      o.scale.set(0.075, 0.058, 0.09)
      mouth.add(o)
      break
    }
    case 'wideSmile': {
      const toro = piece(new THREE.TorusGeometry(0.2, 0.045, 10, 32), dark)
      toro.scale.set(1, 0.62, 0.8)
      mouth.add(toro)
      break
    }
    case 'bigSmile': {
      const boca = piece(new THREE.SphereGeometry(1, 24, 16), dark)
      boca.scale.set(0.21, 0.13, 0.09)
      mouth.add(boca)
      break
    }
    case 'crookedTooth': {
      const arco = smile(0.15, 0.028)
      arco.rotation.z += 0.18 // torcida, pícara
      mouth.add(arco)
      const diente = piece(new THREE.BoxGeometry(0.055, 0.065, 0.03), WHITE)
      diente.position.set(0.1, -0.045, 0.07)
      mouth.add(diente)
      break
    }
    case 'smirk': {
      // Sonrisa pícara: arco torcido y discreto (monstruo 4).
      const arco = smile(0.15, 0.028)
      arco.rotation.z += 0.28
      mouth.add(arco)
      break
    }
    case 'shout': {
      // Bocaza de grito (monstruo 10): óvalo grande y oscuro.
      const boca = piece(new THREE.SphereGeometry(1, 24, 16), dark)
      boca.scale.set(0.24, 0.17, 0.09)
      mouth.add(boca)
      break
    }
    case 'grinTeeth2': {
      mouth.add(smile(0.19, 0.03))
      for (const x of [-0.07, 0.07]) {
        const diente = piece(new THREE.BoxGeometry(0.06, 0.07, 0.03), WHITE)
        diente.position.set(x, -0.035, 0.07)
        mouth.add(diente)
      }
      break
    }
    case 'fangs': {
      const interior = piece(new THREE.SphereGeometry(1, 24, 16), dark)
      interior.scale.set(0.16, 0.11, 0.09)
      mouth.add(interior)
      for (const x of [-0.065, 0.065]) {
        const colmillo = piece(new THREE.BoxGeometry(0.05, 0.07, 0.035), WHITE)
        colmillo.position.set(x, 0.045, 0.09)
        mouth.add(colmillo)
      }
      break
    }
    case 'openTeeth': {
      const interior = piece(new THREE.SphereGeometry(1, 24, 16), dark)
      interior.scale.set(0.18, 0.13, 0.09)
      mouth.add(interior)
      for (const x of [-0.075, 0, 0.075]) {
        const diente = piece(new THREE.BoxGeometry(0.05, 0.06, 0.03), WHITE)
        diente.position.set(x, 0.075, 0.09)
        mouth.add(diente)
      }
      break
    }
    case 'neutral': {
      const linea = piece(new THREE.BoxGeometry(0.18, 0.028, 0.03), INK)
      mouth.add(linea)
      break
    }
  }
  if (spec.tongue !== undefined) {
    const lengua = piece(new THREE.SphereGeometry(1, 16, 12), spec.tongue)
    // Boca ancha (monstruo 2): la lengua es una banda que cruza la sonrisa;
    // bocaza del grito (10): asoma ancha al fondo; en el resto, un óvalo
    // chico abajo.
    const banda = spec.mouth === 'wideSmile'
    const grito = spec.mouth === 'shout'
    lengua.scale.set(banda ? 0.13 : grito ? 0.11 : 0.055, grito ? 0.045 : 0.032, 0.045)
    lengua.position.set(0, banda ? -0.06 : grito ? -0.065 : -0.045, 0.08)
    mouth.add(lengua)
  }
  mouth.position.set(0, MOUTH_Y, zOn(zPiel, 0, MOUTH_Y))
  return mouth
}

export function makeFace(spec: FaceSpec, zPiel: (x: number, y: number) => number): FaceHandle {
  const group = new THREE.Group()
  const pupils: THREE.Object3D[] = []
  const lids: THREE.Object3D[] = []
  const e = spec.eyes
  const xs = e.count === 1 ? [0] : e.sides ? [-0.55, 0.55] : [-(0.14 + e.size), 0.14 + e.size]

  xs.forEach((x, i) => {
    // Ojos dispares (monstruo 9): el segundo puede llevar su propio radio.
    const size = i === 1 && e.sizeSecond !== undefined ? e.sizeSecond : e.size
    // Anillo del iris: `ringEye` lo limita a un solo ojo (el 9 lo lleva solo
    // en el derecho); sin `ringEye` va en todos.
    const conAnillo =
      e.ring !== undefined &&
      (e.ringEye === undefined || (e.ringEye === 'first' ? i === 0 : i === 1))
    const eyeColor = e.white ? WHITE : conAnillo ? (e.ring as string) : WHITE

    const eye = new THREE.Group()
    eye.position.set(x, EYE_Y, zOn(zPiel, x, EYE_Y))
    eye.add(piece(new THREE.SphereGeometry(size, 24, 16), eyeColor))
    const pupila = piece(new THREE.SphereGeometry(size * 0.52, 16, 12), INK)
    pupila.position.set(0, 0, size * 0.82)
    // Brillito en la superficie de la pupila (como el SVG del tablero).
    const brillito = piece(new THREE.SphereGeometry(size * 0.14, 8, 8), WHITE)
    brillito.position.set(-size * 0.22, size * 0.24, size * 0.4)
    pupila.add(brillito)
    eye.add(pupila)
    pupils.push(pupila)

    // Párpado superior: semiesfera que se escala en Y (T6 lo anima: parpadeo
    // en idle y gestos por personalidad). TODOS los ojos traen uno: sin
    // `sleepy` nace invisible en 0.02 y solo se muestra al parpadear (así el
    // blink corre para los 10); con `sleepy` descansa en su valor. El radio
    // va un pelo POR FUERA del ojo (1.015): con 0.98 la semiesfera quedaba
    // dentro de la esfera del ojo y el párpado (y el parpadeo) no se veía.
    const parpado = piece(new THREE.SphereGeometry(size * 1.015, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), INK)
    parpado.material.side = THREE.DoubleSide
    const rest = e.sleepy === undefined ? 0.02 : Math.max(0.02, e.sleepy)
    parpado.scale.y = rest
    parpado.visible = e.sleepy !== undefined
    parpado.userData.rest = rest
    eye.add(parpado)
    lids.push(parpado)
    group.add(eye)
  })

  const mouth = makeMouth(spec, zPiel)
  group.add(mouth)
  return { group, pupils, lids, mouth }
}

/** Libera geometrías y materiales del grupo (montaje/desmontaje del canvas). */
export function disposeFace(face: FaceHandle): void {
  face.group.traverse((o) => {
    const mesh = o as StickerMesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    mesh.material.dispose()
  })
}
