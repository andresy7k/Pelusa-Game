// frontend/src/features/mesa3d/TableCanvasR3F.tsx
// El canvas 3D de la mesa (pasos 2-6: mesa, sala, cámara libre, cartas y
// jugadores sentados). Recibe el asiento (nidos del tapete) y una vista
// juego (mazo, frentes, turno y valor robable): las reglas siguen viviendo
// en Board/backend, acá solo se pintan.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { MESA3D, type MesaCameraPreset } from './config'
import { buildFeltTexture } from './feltTexture'
import { Table3D } from './Table3D'
import { Lamp3D } from './Lamp3D'
import { Room3D } from './Room3D'
import { Cards3D, type MesaGameView } from './Cards3D'
import { Seats3D } from './Seats3D'

export type { MesaGameView, MesaSeatView } from './Cards3D'

const CAMERA = { fov: MESA3D.camera.fov, near: MESA3D.camera.near, far: MESA3D.camera.far }

/** Botones de cámara (esquina inferior izquierda del canvas). */
const CAM_BUTTONS: Array<[MesaCameraPreset, string]> = [
  ['seat', 'Mi asiento'],
  ['wide', 'Vista general'],
  ['top', 'Cenital'],
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
  /** Click en el mazo 3D (solo si `canAct`; Board revalida igual). */
  onDraw?: () => void
  /** Click en una carta rival resaltada en modo robo. */
  onSteal?: (value: number) => void
  /** Mi turno y sin acciones pendientes: habilita los clicks de mesa. */
  canAct?: boolean
}

export function TableCanvasR3F({ seatCount, cam = 'seat', game, onDraw, onSteal, canAct = false }: TableCanvasR3FProps) {
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
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        camera={CAMERA}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = MESA3D.exposure
        }}
      >
        <Scene cam={activeCam} felt={felt} game={game} onDraw={onDraw} onSteal={onSteal} canAct={canAct} />
      </Canvas>
      <div className="cam-group" role="group" aria-label="Vista de cámara">
        {CAM_BUTTONS.map(([p, label]) => (
          <button
            key={p}
            type="button"
            className={p === activeCam ? 'cam-btn cam-btn--on' : 'cam-btn'}
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
  felt,
  game,
  onDraw,
  onSteal,
  canAct,
}: {
  cam: MesaCameraPreset
  felt: THREE.Texture | null
  game?: MesaGameView
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
      {game && <Cards3D game={game} canAct={canAct} onDraw={onDraw} onSteal={onSteal} />}
      {game && <Seats3D seats={game.seats} />}
      <Lamp3D />
      <CameraRig cam={cam} />
      <ReadyPing armed={felt !== null} />
    </>
  )
}

/** Cámara libre (paso 4): órbita/zoom/pan con límites + travelling suave
 *  entre presets (botones y teclas 1-4). Arrastrar cancela el travelling. */
function CameraRig({ cam }: { cam: MesaCameraPreset }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null
  const anim = useRef<{
    fromPos: THREE.Vector3
    fromTgt: THREE.Vector3
    toPos: THREE.Vector3
    toTgt: THREE.Vector3
    start: number
  } | null>(null)
  const booted = useRef(false)

  useLayoutEffect(() => {
    const p = MESA3D.camera.presets[cam]
    const toPos = new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2])
    const toTgt = new THREE.Vector3(p.target[0], p.target[1], p.target[2])
    if (!booted.current || !controls) {
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
    anim.current = {
      fromPos: camera.position.clone(),
      fromTgt: controls.target.clone(),
      toPos,
      toTgt,
      start: performance.now(),
    }
  }, [cam, camera, controls])

  // Travelling entre vistas (easeInOutCubic).
  useFrame(() => {
    const a = anim.current
    if (!a || !controls) return
    const t = Math.min(1, (performance.now() - a.start) / MESA3D.camera.controls.tweenMs)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    camera.position.lerpVectors(a.fromPos, a.toPos, e)
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
