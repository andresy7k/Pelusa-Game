// frontend/src/features/hero/Cursor.tsx
// Cursor custom del hero: halo (con inercia) + punto (pegado al puntero),
// solo transform en el rAF. Se monta únicamente con puntero fino y sin
// reduced-motion; fuera del hero se oculta (el resto del sitio conserva su
// cursor nativo). El halo crece 1.6× sobre interactivos y emite los sonidos
// hover/click.
import { useEffect, useRef, useState } from 'react'
import { play } from './sound'
import './Cursor.css'

// Interactivos del hero: el halo crece sobre ellos.
const INTERACTIVO = 'a, button, .hc-slot, .hc-dot'
// Persecución del halo por frame (0..1): más bajo = más estela.
const ALCANCE = 0.2

export function Cursor() {
  const haloRef = useRef<HTMLDivElement | null>(null)
  const puntoRef = useRef<HTMLDivElement | null>(null)
  // Puerta de montaje: sin puntero fino o con reduced-motion no hay cursor
  // (tampoco nodos en el DOM).
  const [activo] = useState(() => {
    try {
      return (
        window.matchMedia('(pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!activo) return
    const halo = haloRef.current
    const punto = puntoRef.current
    if (!halo || !punto) return
    // El stage dueño: los sonidos viven solo dentro de él (el `cursor: none`
    // lo gobierna Cursor.css con la misma puerta de montaje, en CSS).
    const stage = halo.parentElement?.closest('.hero-stage')
    if (!stage) return

    let raf = 0
    // Objetivo (puntero real) y posición suavizada del halo.
    let ox = -100
    let oy = -100
    let hx = -100
    let hy = -100
    let encima = false
    let visible = false

    const pintar = () => {
      hx += (ox - hx) * ALCANCE
      hy += (oy - hy) * ALCANCE
      // Solo transform: el navegador no recalcula layout.
      halo.style.transform = `translate3d(${hx}px, ${hy}px, 0) translate(-50%, -50%) scale(${encima ? 1.6 : 1})`
      punto.style.transform = `translate3d(${ox}px, ${oy}px, 0) translate(-50%, -50%)`
      raf = window.requestAnimationFrame(pintar)
    }

    const mostrar = (v: boolean) => {
      if (v === visible) return
      visible = v
      halo.classList.toggle('hero-cursor--visible', v)
      punto.classList.toggle('hero-cursor--visible', v)
    }

    const cercaDe = (t: EventTarget | null, sel: string): boolean => {
      const el = t as Element | null
      return !!el && typeof el.closest === 'function' && el.closest(sel) !== null
    }

    // Posición + visibilidad + detección de interactivo (con sonido al entrar).
    const actualizar = (t: EventTarget | null, x?: number, y?: number) => {
      if (x !== undefined && y !== undefined) {
        ox = x
        oy = y
      }
      const dentro = cercaDe(t, '.hero-stage')
      mostrar(dentro)
      if (!dentro) {
        encima = false
        return
      }
      const ahora = cercaDe(t, INTERACTIVO)
      if (ahora && !encima) play('hover')
      encima = ahora
    }

    const alMover = (e: MouseEvent) => actualizar(e.target, e.clientX, e.clientY)
    // El DOM puede cambiar bajo un puntero quieto (el carrusel rota solo):
    // `mouseover` (burbujea) reevalúa sin necesidad de movimiento.
    const alSobre = (e: MouseEvent) => actualizar(e.target)
    const alClic = (e: MouseEvent) => {
      if (cercaDe(e.target, '.hero-stage') && cercaDe(e.target, INTERACTIVO)) play('click')
    }
    const alSalir = () => mostrar(false)

    document.addEventListener('mousemove', alMover, { passive: true })
    document.addEventListener('mouseover', alSobre, { passive: true })
    document.addEventListener('click', alClic, { passive: true })
    document.documentElement.addEventListener('mouseleave', alSalir)
    raf = window.requestAnimationFrame(pintar)
    return () => {
      window.cancelAnimationFrame(raf)
      document.removeEventListener('mousemove', alMover)
      document.removeEventListener('mouseover', alSobre)
      document.removeEventListener('click', alClic)
      document.documentElement.removeEventListener('mouseleave', alSalir)
    }
  }, [activo])

  if (!activo) return null
  return (
    <>
      <div ref={haloRef} className="hero-cursor" aria-hidden="true" />
      <div ref={puntoRef} className="hero-cursor__dot" aria-hidden="true" />
    </>
  )
}
