// frontend/src/features/hero/pointer.ts
// Posición del mouse normalizada (-1..1) que consumen los estados hover
// (el ojo de la Pelusa 5 sigue al cursor). Singleton perezoso: el primer
// getPointer() instala el listener una sola vez; sin ventana no hace nada.
export interface HeroPointer {
  x: number
  y: number
}

const pointer: HeroPointer = { x: 0, y: 0 }
let installed = false

function install(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('mousemove', (e) => {
    pointer.x = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1
    pointer.y = -((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1)
  }, { passive: true })
}

export function getPointer(): HeroPointer {
  install()
  return pointer
}
