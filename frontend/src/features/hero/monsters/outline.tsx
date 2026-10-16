// frontend/src/features/hero/monsters/outline.tsx
// Contorno blanco tipo sticker: copia con BackSide, escala 1.04, y una
// ondulación de ruido en el vertex para que parezca dibujado a mano.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export function createOutlineMaterial(color = '#ffffff'): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      uniform float uScale;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main() {
        vec3 wob = normal * (hash(floor(position * 6.0)) - 0.5) * 0.02;
        vec3 p = (position + wob) * uScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      void main() { gl_FragColor = vec4(uColor, uOpacity); }`,
    uniforms: {
      uScale: { value: 1.04 },
      uColor: { value: new THREE.Color(color) },
      // La opacidad la maneja el canvas (presencia al alejarse del centro).
      uOpacity: { value: 1 },
    },
  })
}

/** Casco invertido del mismo blob: el borde blanco dibujado a mano. */
export function StickerOutline({ geometry, color = '#ffffff' }: { geometry: THREE.BufferGeometry; color?: string }) {
  const material = useMemo(() => createOutlineMaterial(color), [color])
  useEffect(() => () => material.dispose(), [material])
  return <mesh geometry={geometry} material={material} />
}
