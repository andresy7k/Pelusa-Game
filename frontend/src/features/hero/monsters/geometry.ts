// frontend/src/features/hero/monsters/geometry.ts
import * as THREE from 'three'

// Ruido 3D barato (value noise con hash), determinista por semilla.
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 13.7) * 43758.5453
  h = h - Math.floor(h)
  return h
}

export function makeBlobGeometry(seed: number, scale: [number, number, number]): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 5) // 10242 vértices: suficiente para pelaje
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    // deformación de baja frecuencia: la silueta única del monstruo
    const n =
      hash3(Math.floor(v.x * 2.2), Math.floor(v.y * 2.2), Math.floor(v.z * 2.2), seed) * 0.5 +
      hash3(Math.floor(v.x * 4.5), Math.floor(v.y * 4.5), Math.floor(v.z * 4.5), seed + 7) * 0.25
    const r = 1 + (n - 0.35) * 0.35
    pos.setXYZ(i, v.x * r * scale[0], v.y * r * scale[1], v.z * r * scale[2])
  }
  geo.computeVertexNormals()
  return geo
}
