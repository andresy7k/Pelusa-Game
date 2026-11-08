// frontend/src/features/mesa3d/TableCanvasR3F.tsx
// El canvas 3D de la mesa (pasos 2-6: mesa, sala, cámara libre, cartas y
// jugadores sentados). Recibe el asiento (nidos del tapete) y una vista
// juego (mazo, frentes, turno y valor robable): las reglas siguen viviendo
// en Board/backend, acá solo se pintan.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { MESA3D, cameraPose, portraitFactor, type MesaCameraPreset } from './config'
import { buildFeltTexture } from './feltTexture'
import { Table3D } from './Table3D'
import { Lamp3D } from './Lamp3D'
import { Room3D } from './Room3D'
import { Cards3D, type MesaFlight, type MesaGameView } from './Cards3D'
import { Seats3D } from './Seats3D'

export type { MesaFlight, MesaGameView, MesaSeatView } from './Cards3D'

const CAMERA = { fov: MESA3D.camera.fov, near: MESA3D.camera.near, far: MESA3D.camera.far }

/** Botones de cámara (esquina inferior izquierda del canvas). */
const CAM_BUTTONS: Array<[MesaCameraPreset, string, string]> = [
  ['seat', 'Mi vista', 'Siempre desde tu silla'],
  ['wide', 'Vista general', 'Sigue al jugador que tiene el turno'],
  ['top', 'Desde arriba', 'La mesa vista desde el techo'],
]

/** Teclas 1-4 = presets de cámara. */
const CAM_KEYS: Record<string, MesaCameraPreset> = {
  '1': 'seat',
  '2': 'wide',
  '3': 'top',
  '4': 'detail',
}

/** Lo mínimo que necesitamos del OrbitControls (makeDefault lo deja en el
 *  store de R3F; evita depender de los tipos de three-stdlib). */
interface ControlsLike {
  target: THREE.Vector3
  update: () => void
}

export interface TableCanvasR3FProps {
  seatCount: number
  cam?: MesaCameraPreset
  /** Estado resumido del juego (paso 5: cartas); opcional para previews. */
  game?: MesaGameView
  /** Carta en vuelo mazo→jugador (Board lo dispara y limpia al aterrizar). */
  flight?: MesaFlight | null
  /** Click en el mazo 3D (solo si `canAct`; Board revalida igual). */
  onDraw?: () => void
  /** Click en una carta rival resaltada en modo robo. */
  onSteal?: (value: number) => void
  /** Mi turno y sin acciones pendientes: habilita los clicks de mesa. */
  canAct?: boolean
  /** Mi asiento (Mi vista). Hotseat: el de quien juega; espectador: null. */
  mySeat?: number | null
  /** Asiento de quien tiene el turno (Vista general lo sigue). */
  turnSeat?: number | null
}

export function TableCanvasR3F({
  seatCount,
  cam = 'seat',
  game,
  flight = null,
  onDraw,
  onSteal,
  canAct = false,
  mySeat = null,
  turnSeat = null,
}: TableCanvasR3FProps) {
  const [felt, setFelt] = useState<THREE.Texture | null>(null)
  // Vista inicial = la del URL (?cam=), por defecto "Mi asiento": el default
  // definitivo del brief (los jugadores del paso 6 ya ocupan sus sillas).
  const [activeCam, setActiveCam] = useState<MesaCameraPreset>(cam)

  useEffect(() => {
    let live = true
    buildFeltTexture(seatCount).then((t) => {
      if (live) setFelt(t)
    })
    return () => {
      live = false
    }
  }, [seatCount])

  // Atajos 1-4 para las vistas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const p = CAM_KEYS[e.key]
      if (p) setActiveCam(p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="mesa3d-host" data-cam={activeCam}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={CAMERA}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = MESA3D.exposure
        }}
      >
        <Scene
          cam={activeCam}
          followSeat={activeCam === 'seat' ? (mySeat ?? turnSeat) : turnSeat}
          seatCount={seatCount}
          felt={felt}
          game={game}
          flight={flight}
          onDraw={onDraw}
          onSteal={onSteal}
          canAct={canAct}
        />
      </Canvas>
      <div className="cam-group" role="group" aria-label="Vista de cámara">
        {CAM_BUTTONS.map(([p, label, hint]) => (
          <button
            key={p}
            type="button"
            className={p === activeCam ? 'cam-btn cam-btn--on' : 'cam-btn'}
            data-cam={p}
            aria-pressed={p === activeCam}
            title={hint}
            onClick={() => setActiveCam(p)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Scene({
  cam,
  followSeat,
  seatCount,
  felt,
  game,
  flight,
  onDraw,
  onSteal,
  canAct,
}: {
  cam: MesaCameraPreset
  followSeat: number | null
  seatCount: number
  felt: THREE.Texture | null
  game?: MesaGameView
  flight?: MesaFlight | null
  onDraw?: () => void
  onSteal?: (value: number) => void
  canAct?: boolean
}) {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  useEffect(() => {
    if (!felt) return
    felt.anisotropy = Math.min(8, maxAniso)
    felt.needsUpdate = true
  }, [felt, maxAniso])

  return (
    <>
      <color attach="background" args={[MESA3D.colors.void]} />
      <fog attach="fog" args={[MESA3D.colors.void, 9, 34]} />
      <ambientLight color={MESA3D.colors.ambient} intensity={MESA3D.lights.ambient} />
      <hemisphereLight
        color={MESA3D.colors.hemisphereSky}
        groundColor={MESA3D.colors.hemisphereGround}
        intensity={MESA3D.lights.hemisphere}
      />
      <directionalLight
        position={MESA3D.lights.fill.pos}
        color={MESA3D.lights.fill.color}
        intensity={MESA3D.lights.fill.intensity}
      />
      <directionalLight
        position={MESA3D.lights.rim.pos}
        color={MESA3D.lights.rim.color}
        intensity={MESA3D.lights.rim.intensity}
      />
      <Room3D />
      <Table3D felt={felt} />
      {game && <Cards3D game={game} flight={flight} canAct={canAct} onDraw={onDraw} onSteal={onSteal} />}
      {game && <LitSeats seats={game.seats} />}
      <Lamp3D />
      <CameraRig cam={cam} seat={followSeat} seatCount={seatCount} />
      <ReadyPing armed={felt !== null} />
    </>
  )
}

/**
 * Sentados con su propio brillo: tras montar (y cada vez que cambian), los
 * materiales de los monstruos emiten una fracción de ese color (MESA3D.players.glow).
 * Los materiales son por instancia (useMemo en FurMesh/Character): tocarlos
 * acá no afecta a los monstruos de la portada.
 */
function LitSeats({ seats }: { seats: MesaGameView['seats'] }) {
  const group = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    group.current?.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        // Solo los monstruos (MeshPhysical); las sillas comparten MeshStandard.
        const std = m as THREE.MeshPhysicalMaterial
        if (std.isMeshPhysicalMaterial && std.userData.glow !== true) {
          std.emissive.copy(std.color).multiplyScalar(MESA3D.players.glow)
          std.userData.glow = true
        }
      }
    })
  })
  return (
    <group ref={group}>
      <Seats3D seats={seats} />
    </group>
  )
}

/** Cámara libre (paso 4): órbita/zoom/pan con límites + travelling suave
 *  entre vistas (botones y teclas 1-4). Mi vista y Vista general se paran
 *  detrás de una silla (la mía / la del turno): al cambiar el turno la cámara
 *  GIRA alrededor de la mesa (coordenadas cilíndricas, por el lado corto) en
 *  vez de atravesarla. Arrastrar cancela el travelling. */
function CameraRig({ cam, seat, seatCount }: { cam: MesaCameraPreset; seat: number | null; seatCount: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null
  // Vertical: más lejos para que la mesa entre a lo ancho.
  const zoomOut = useThree((s) => portraitFactor(s.size.width / Math.max(1, s.size.height)))
  const anim = useRef<{
    from: { r: number; a: number; y: number }
    to: { r: number; a: number; y: number }
    fromTgt: THREE.Vector3
    toTgt: THREE.Vector3
    start: number
  } | null>(null)
  const booted = useRef(false)

  useLayoutEffect(() => {
    const p = cameraPose(cam, seat, seatCount)
    const toTgt = new THREE.Vector3(...p.target)
    const toPos = new THREE.Vector3(...p.pos).sub(toTgt).multiplyScalar(zoomOut).add(toTgt)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!booted.current || !controls || reduced) {
      // Colocación directa: primer frame (y hasta que exista el control).
      camera.position.copy(toPos)
      camera.lookAt(toTgt)
      if (controls) {
        controls.target.copy(toTgt)
        controls.update()
        booted.current = true
      }
      return
    }
    const cyl = (v: THREE.Vector3) => ({ r: Math.hypot(v.x, v.z), a: Math.atan2(v.z, v.x), y: v.y })
    const from = cyl(camera.position)
    const to = cyl(toPos)
    // Giro por el camino corto (-pi..pi).
    let d = to.a - from.a
    d = Math.atan2(Math.sin(d), Math.cos(d))
    anim.current = {
      from,
      to: { ...to, a: from.a + d },
      fromTgt: controls.target.clone(),
      toTgt,
      start: performance.now(),
    }
  }, [cam, seat, seatCount, camera, controls, zoomOut])

  // Travelling entre vistas (easeInOutCubic) en cilíndricas.
  useFrame(() => {
    const a = anim.current
    if (!a || !controls) return
    const t = Math.min(1, (performance.now() - a.start) / MESA3D.camera.controls.tweenMs)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const r = a.from.r + (a.to.r - a.from.r) * e
    const ang = a.from.a + (a.to.a - a.from.a) * e
    camera.position.set(Math.cos(ang) * r, a.from.y + (a.to.y - a.from.y) * e, Math.sin(ang) * r)
    controls.target.lerpVectors(a.fromTgt, a.toTgt, e)
    controls.update()
    if (t >= 1) anim.current = null
  })

  // El pan no se lleva la mesa del centro (≤ panLimit).
  useFrame(() => {
    if (!controls) return
    const lim = MESA3D.camera.controls.panLimit
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -lim, lim)
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, lim)
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -lim, lim)
  })

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      panSpeed={0.45}
      screenSpacePanning={false}
      minDistance={MESA3D.camera.controls.minDistance}
      maxDistance={MESA3D.camera.controls.maxDistance}
      minPolarAngle={MESA3D.camera.controls.minPolarAngle}
      maxPolarAngle={MESA3D.camera.controls.maxPolarAngle}
      onStart={() => {
        anim.current = null
      }}
    />
  )
}

/** Marca `window.__mesa3dReady` en el primer frame ya con la textura puesta:
 *  el harness de capturas espera ese flag. */
function ReadyPing({ armed }: { armed: boolean }) {
  const done = useRef(false)
  useFrame(() => {
    if (!armed || done.current) return
    done.current = true
    ;(window as unknown as { __mesa3dReady?: boolean }).__mesa3dReady = true
  })
  useEffect(
    () => () => {
      delete (window as unknown as { __mesa3dReady?: boolean }).__mesa3dReady
    },
    [],
  )
  return null
}
