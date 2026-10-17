// frontend/src/features/hero/monsters/furMaterial.ts
// Pelaje por shells: N capas de la MISMA geometría, cada una desplazada a lo
// largo de la normal, con alpha por ruido y gradiente raíz->punta + fresnel.
// LOD: `lite` = una sola malla con MeshPhysicalMaterial clearcoat/sheen.
// El color sale del tinte de la carta (rootDarken/tipLighten de config) y la
// semilla varía el patrón de pelos entre monstruos.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { HERO } from '../config'

export type FurQuality = 'full' | 'lite'

const FUR_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vShell; varying vec3 vPos;
  uniform float uShell; uniform float uThickness;
  void main() {
    vShell = uShell; vPos = position;
    vec3 p = position + normal * uShell * uThickness;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`

const FUR_FRAG = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vShell; varying vec3 vPos;
  uniform vec3 uRoot; uniform vec3 uTip; uniform float uSeed; uniform float uOpacity;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    float n = hash(floor(vPos * 42.0) + uSeed * 13.7);
    if (n < vShell) discard;                       // pelos: alpha por capa
    vec3 base = mix(uRoot, uTip, vShell);          // gradiente raíz -> punta
    float fres = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 2.0);
    vec3 col = base + fres * 0.25;                 // rim suave
    gl_FragColor = vec4(col, uOpacity);
  }`

export function createFurMaterial(
  root: THREE.Color,
  tip: THREE.Color,
  shell: number,
  thickness: number,
  seed: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FUR_VERT,
    fragmentShader: FUR_FRAG,
    uniforms: {
      uRoot: { value: root },
      uTip: { value: tip },
      uShell: { value: shell },
      uThickness: { value: thickness },
      uSeed: { value: seed },
      // La opacidad la maneja el canvas (presencia al alejarse del centro).
      uOpacity: { value: 1 },
    },
  })
}

/** Pelaje de un monstruo: N shells (full) o una malla con sheen (lite). */
export function FurMesh({
  geometry,
  color,
  seed,
  quality,
}: {
  geometry: THREE.BufferGeometry
  color: string
  seed: number
  quality: FurQuality
}) {
  const { root, tip, sheen } = useMemo(() => {
    // El shader de pelaje escribe crudo al framebuffer (sin conversión de
    // espacio de color): los uniformes van en espacio de pantalla para que el
    // pelaje coincida con el tinte pintado de la carta.
    const raw = new THREE.Color().setStyle(color, THREE.LinearSRGBColorSpace)
    const rawRoot = raw.clone().multiplyScalar(1 - HERO.fur.rootDarken)
    const rawTip = raw.clone().lerp(new THREE.Color(1, 1, 1), HERO.fur.tipLighten)
    // El LOD lite usa material estándar: ahí sí aplica la gestión de color.
    const std = new THREE.Color(color)
    const stdTip = std.clone().lerp(new THREE.Color('#ffffff'), HERO.fur.tipLighten)
    return { root: rawRoot, tip: rawTip, sheen: stdTip }
  }, [color])

  const materials = useMemo(() => {
    if (quality === 'lite') {
      return [new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, sheen: 1, sheenColor: sheen })]
    }
    return Array.from({ length: HERO.fur.shells }, (_, i) =>
      createFurMaterial(root, tip, i / HERO.fur.shells, HERO.fur.thickness, seed),
    )
  }, [quality, color, seed, root, tip, sheen])

  // Las capas viejas se liberan si cambia el LOD o el color (T5/T6).
  useEffect(() => () => {
    for (const m of materials) m.dispose()
  }, [materials])

  return (
    <>
      {materials.map((m, i) => (
        <mesh key={i} geometry={geometry} material={m} castShadow />
      ))}
    </>
  )
}
