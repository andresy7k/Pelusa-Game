// frontend/src/features/hero/monsters/MonsterCanvas.tsx
// Canvas fijo transparente encima del DOM (pointer-events:none). Cada
// monstruo visible se posiciona en world coords a partir del rect CSS de
// su carta (medido solo cuando algo se mueve).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import gsap from 'gsap'
import { HERO, type HeroValue } from '../config'
import { ringOffset } from '../HeroCarousel'
import { readAnchor, trackAnchorsFor } from './anchors'
import { Character, type CharacterHandle } from './Character'
import { Particles } from './Particles'
import type { FurQuality } from './furMaterial'

export interface MonsterCanvasProps {
  mode: 'full' | 'lite' | 'off'
  activeValue: HeroValue
  /** Tinte de la carta activa (HERO.cards[v].monster): tiñe la rim y el polvo. */
  accent: string
  /** Valor con el cursor encima (distinto de la activa): recibe el hover. */
  hoveredValue: HeroValue | null
  /** Celebración de la intro (T7): HeroStage la pone en true sobre la cola de
   *  las cartas; cada monstruo montado hace su pop de `active` una sola vez. */
  intro: boolean
  /** T8: celebración bajo demanda (Enter) — HeroStage la dispara; quien
   *  posee `chars` (CardMonsters) la asigna en un efecto. */
  celebrateRef?: { current: ((v: HeroValue) => void) | null }
  onReady: () => void
  /** T9: el canvas avisa que perdió el contexto WebGL (degradación a pintados). */
  onContextLost?: () => void
}

// Presencia por anillo: opacidad objetivo según |off| (0 = la activa).
const PRESENCE_OP = [1, 0.8, 0.38] as const
// Despedida: quien sale sigue montado hasta que termina el slide + el
// seguimiento de anclas, así el desvanecido no se corta con un pop.
const LEAVE_MS = HERO.timings.slideMs + 120
// Suavizado exponencial por segundo (independiente del framerate).
const PRESENCE_RATE = 10
// El pop de entrada arranca al 80 % del tamaño final.
const POP_SCALE = 0.8

/** Opacidad de un subárbol: uniforme `uOpacity` si el shader lo tiene,
 *  `opacity`/`transparent` estándar si no. */
function setGroupOpacity(root: THREE.Object3D, value: number): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as THREE.Material & { uniforms?: { uOpacity?: { value: number } } }
    const u = mat.uniforms?.uOpacity
    if (u) u.value = value
    if (mat.transparent !== value < 1) {
      mat.transparent = value < 1
      mat.needsUpdate = true // el cambio de pase (opaco↔transparente) lo exige
    }
    mat.opacity = value
  })
}

// Retardo entre el pop de entrada y el special (el monstruo ya aterrizó).
const SPECIAL_DELAY_MS = 200

function CardMonsters({
  activeValue,
  hoveredValue,
  intro,
  celebrateRef,
  quality,
  onSlowFps,
}: {
  activeValue: HeroValue
  hoveredValue: HeroValue | null
  intro: boolean
  celebrateRef?: { current: ((v: HeroValue) => void) | null }
  quality: FurQuality
  /** T9: se llama al degradar por FPS bajo sostenido. */
  onSlowFps?: () => void
}) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const idx = HERO.order.indexOf(activeValue)

  // Valores con |off| <= 2 alrededor de la activa (la vecina inmediata y la
  // siguiente, incluida la vuelta del anillo).
  const visible = useMemo(
    () => HERO.order.filter((v) => Math.abs(ringOffset(HERO.order.indexOf(v), idx, HERO.order.length)) <= 2),
    [idx],
  )

  const [mounted, setMounted] = useState<HeroValue[]>(visible)
  const prevVisible = useRef<HeroValue[]>(visible)
  const timers = useRef(new Map<HeroValue, number>())
  const groups = useRef(new Map<HeroValue, THREE.Group>())
  const chars = useRef(new Map<HeroValue, CharacterHandle | null>()) // T6 los anima
  const presence = useRef(new Map<HeroValue, number>())
  // Última opacidad aplicada por valor: la actualización recorre ~100
  // materiales y solo se hace si cambió de verdad (ver useFrame).
  const lastOp = useRef(new Map<HeroValue, number>())
  // T9: muestreador de FPS (ventanas de 60 frames; dos seguidas < 35 fps
  // degradan en caliente a `lite`).
  const fpsFrames = useRef(0)
  const fpsElapsed = useRef(0)
  const fpsSlow = useRef(0)

  // Rectángulos frescos al montar y en cada resize (zoom incluido).
  useEffect(() => {
    trackAnchorsFor(0)
    const onResize = () => trackAnchorsFor(200)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Reconciliación del set montado: entran los visibles, y los que salen se
  // despiden (siguen montados LEAVE_MS para que el fade no salte).
  useEffect(() => {
    const prev = prevVisible.current
    prevVisible.current = visible
    const entering = visible.filter((v) => !prev.includes(v))
    const leaving = prev.filter((v) => !visible.includes(v))
    for (const v of entering) {
      const t = timers.current.get(v)
      if (t !== undefined) {
        clearTimeout(t) // volvió antes de irse: se cancela la salida
        timers.current.delete(v)
      }
    }
    if (entering.length) setMounted((cur) => [...cur, ...entering.filter((v) => !cur.includes(v))])
    for (const v of leaving) {
      if (timers.current.has(v)) continue
      timers.current.set(
        v,
        window.setTimeout(() => {
          timers.current.delete(v)
          setMounted((cur) => cur.filter((x) => x !== v))
        }, LEAVE_MS),
      )
    }
  }, [visible])

  // Nunca dejar timers vivos si el canvas se desmonta.
  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t)
      timers.current.clear()
    },
    [],
  )

  // La recién llegada corre su special una vez (200 ms tras el pop) y
  // queda en idle (el propio special encadena el idle al terminar). El
  // timer se limpia al cambiar de carta o desmontar: no pelea con el
  // efecto [active] de Character (setState mata los tweens previos).
  useEffect(() => {
    const v = activeValue
    const t = window.setTimeout(() => {
      chars.current.get(v)?.setState('special')
    }, SPECIAL_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [activeValue])

  // Celebración bajo demanda (T8, Enter): corre el special del valor pedido.
  // La posee quien tiene `chars`.
  useEffect(() => {
    if (!celebrateRef) return
    celebrateRef.current = (v: HeroValue) => {
      chars.current.get(v)?.setState('special')
    }
    return () => {
      celebrateRef.current = null
    }
  }, [celebrateRef])

  // Celebración de la intro (T7): un pop de `active` por personaje montado,
  // una sola vez y todos a la vez (el timer de 200 ms del mount ya disparó
  // oculto tras el preloader; esto es aparte). Después cada uno vuelve a su
  // estado lógico: el pop mata los loops de idle (sway/parpadeo) y sin esto
  // los vecinos quedarían congelados.
  const celebradoRef = useRef(false)
  const logicaRef = useRef({ activeValue, hoveredValue })
  useEffect(() => {
    logicaRef.current = { activeValue, hoveredValue }
  })
  useEffect(() => {
    if (!intro || celebradoRef.current) return
    celebradoRef.current = true
    const foto = logicaRef.current
    for (const h of chars.current.values()) h?.setState('active')
    const t = window.setTimeout(() => {
      const ahora = logicaRef.current
      // Si la selección cambió en el medio, los efectos ya pusieron el
      // estado correcto: no se pisa.
      if (ahora.activeValue !== foto.activeValue || ahora.hoveredValue !== foto.hoveredValue) return
      for (const [v, h] of chars.current) {
        if (!h) continue
        h.setState(v === foto.activeValue ? 'active' : v === foto.hoveredValue ? 'hover' : 'idle')
      }
    }, 700)
    return () => window.clearTimeout(t)
  }, [intro])

  useFrame((_root, delta) => {
    // T9: guardia de FPS (solo degrada vía `onSlowFps`; el padre decide si
    // aplica según `mode === 'full'`).
    fpsFrames.current += 1
    fpsElapsed.current += delta
    if (fpsFrames.current >= 60) {
      const secs = fpsElapsed.current
      const avg = secs > 0 ? fpsFrames.current / secs : 60
      fpsFrames.current = 0
      fpsElapsed.current = 0
      if (avg < 35) {
        fpsSlow.current += 1
        if (fpsSlow.current >= 2) {
          fpsSlow.current = 0
          onSlowFps?.()
        }
      } else {
        fpsSlow.current = 0
      }
    }
    const cam = camera
    const ndc = new THREE.Vector3()
    const world = new THREE.Vector3()
    for (const [v, g] of groups.current) {
      const rect = readAnchor(v)
      if (!rect) continue
      const px = rect.x + rect.w / 2
      const py = rect.y + rect.h * 0.62 // los pies, un poco sobre el borde inferior
      // NDC → mundo sobre el plano z=0 (cámara mirando al origen).
      ndc.set((px / size.width) * 2 - 1, -(py / size.height) * 2 + 1, 0.5)
      ndc.unproject(cam)
      const dir = ndc.sub(cam.position).normalize()
      world.copy(cam.position).addScaledVector(dir, -cam.position.z / dir.z)

      // Presencia: 1 en el anillo cercano, 0 al salir (suavizado exponencial
      // con snap: sin esto `next` nunca llega exacto y la activa queda para
      // siempre en el pase transparente, pagando ordenamiento por nada).
      const off = ringOffset(HERO.order.indexOf(v), idx, HERO.order.length)
      const target = Math.abs(off) <= 2 ? 1 : 0
      const p = presence.current.get(v) ?? 0
      let next = p + (target - p) * (1 - Math.exp(-delta * PRESENCE_RATE))
      if (target === 1 && next > 0.995) next = 1
      else if (target === 0 && next < 0.005) next = 0
      presence.current.set(v, next)

      const base = rect.w / 76 // 76px = ancho de diseño; el rect YA incluye
      // el scale CSS (la activa mide 76*1.15) — no reescalar
      // Compensación de zoom: la proyección perspectiva escala con el alto
      // del viewport (px por unidad = alto / (2·tan(fov/2)·dist)), así que a
      // 50 % o 200 % de zoom el monstruo no acompañaba a su carta (ancho CSS
      // fijo): refHeight/alto lo mantiene a tamaño CSS constante.
      const zoomFix = HERO.character.refHeight / Math.max(size.height, 1)
      g.position.set(world.x, world.y, 0)
      g.scale.setScalar(base * zoomFix * (POP_SCALE + (1 - POP_SCALE) * next))
      const op = PRESENCE_OP[Math.min(Math.abs(off), PRESENCE_OP.length - 1)] * next
      // setGroupOpacity recorre todo el subárbol (~100 materiales): solo si
      // el valor cambió de verdad. En régimen queda fijo y no se toca más.
      const prev = lastOp.current.get(v)
      if (prev === undefined || Math.abs(op - prev) > 0.004) {
        lastOp.current.set(v, op)
        setGroupOpacity(g, op)
      }
    }
  })

  return (
    <>
      {mounted.map((v) => (
        <group
          key={v}
          ref={(g) => {
            if (g) groups.current.set(v, g)
            else groups.current.delete(v)
          }}
        >
          <Character
            ref={(h) => {
              chars.current.set(v, h)
            }}
            value={v}
            active={v === activeValue}
            hovered={v === hoveredValue && v !== activeValue}
            quality={quality}
          />
        </group>
      ))}
    </>
  )
}

export function MonsterCanvas({ mode, activeValue, accent, hoveredValue, intro, celebrateRef, onReady, onContextLost }: MonsterCanvasProps) {
  const readyRef = useRef(false)
  const rimRef = useRef<THREE.PointLight>(null)
  // T9: degradación en caliente por FPS (una sola vía: full → lite).
  const [degraded, setDegraded] = useState(false)
  const quality: FurQuality = mode === 'full' && !degraded ? 'full' : 'lite'
  // T9: el aviso de FPS se emite una sola vez (al degradar).
  const handleSlowFps = () => {
    if (mode !== 'full') return
    setDegraded((prev) => {
      if (!prev) console.info('[hero] modo lite por FPS')
      return true
    })
  }
  // `onCreated` puede repetirse (StrictMode): el aviso es una vez, pero el
  // listener se adjunta a cada gl (el remount crea otro renderer y el canvas
  // vivo quedaría sin aviso). El callback va por ref para no congelar props.
  const listenedRef = useRef<THREE.WebGLRenderer | null>(null)
  const onLostRef = useRef(onContextLost)
  useEffect(() => { onLostRef.current = onContextLost })
  const handleCreated = (state: { gl: THREE.WebGLRenderer }) => {
    if (listenedRef.current !== state.gl) {
      listenedRef.current = state.gl
      // T9: pérdida de contexto WebGL (GPU): se previene el default para que
      // el canvas no quede muerto y se avisa al stage (degrada a pintados).
      state.gl.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        onLostRef.current?.()
      })
    }
    if (readyRef.current) return
    readyRef.current = true
    onReady()
  }
  // Tinte: la rim vira al color de la carta activa en ~0.8 s (el polvo lo
  // hace en Particles y el humo en HeroStage vía --hero-accent).
  useEffect(() => {
    const light = rimRef.current
    if (!light) return
    const target = new THREE.Color(accent)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      light.color.copy(target)
      return
    }
    gsap.to(light.color, { r: target.r, g: target.g, b: target.b, duration: 0.8, ease: 'power2.out', overwrite: 'auto' })
  }, [accent])
  return (
    <Canvas
      flat // colores exactos de config (sin tone mapping)
      orthographic={false}
      camera={{ fov: HERO.camera.fov, position: [0, HERO.camera.y, 14] }}
      gl={{ alpha: true, antialias: true }}
      dpr={mode === 'full' ? [1, 1.75] : 1}
      onCreated={handleCreated}
      style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      aria-hidden
    >
      {/* Rig del canvas (config por el constraint de cero números visuales
          fuera de config); el LOD lite es material estándar y sí recibe luz. */}
      <ambientLight intensity={HERO.lights.ambient} />
      <directionalLight position={HERO.lights.key.position} intensity={HERO.lights.key.intensity} />
      <pointLight
        ref={rimRef}
        position={HERO.lights.rim.position}
        color={HERO.lights.rim.color}
        intensity={HERO.lights.rim.intensity}
      />
      <CardMonsters activeValue={activeValue} hoveredValue={hoveredValue} intro={intro} celebrateRef={celebrateRef} quality={quality} onSlowFps={handleSlowFps} />
      <Particles accent={accent} quality={quality} />
      {quality === 'full' && (
        <EffectComposer>
          <Bloom intensity={0.35} luminanceThreshold={0.6} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.75} />
          <Noise opacity={0.035} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
