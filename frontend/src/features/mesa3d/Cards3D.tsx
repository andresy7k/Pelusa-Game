// frontend/src/features/mesa3d/Cards3D.tsx
// Paso 5: las cartas VIVEN sobre la mesa. El mazo ocupa el ojo del remolino
// y se AGOTA al jugar (la pileza sigue al conteo sobre los 110 del mazo +
// chip flotante con las cartas restantes); cada carta sacada viaja en vuelo
// mazo→jugador (espejo del FlightLayer 2D: la carta entrante nace oculta en
// su nido y la que vuela aterriza encima: nunca se ven dos a la vez) y el
// frente de cada jugador se despliega sobre su
// nido en filas de a 4 con leve solape (nunca apilado: en Pelusas todos los
// frentes están a la vista). Modo robo: las cartas del valor robable brillan
// en ámbar y son clickeables; arrastrar la órbita NO dispara clicks (guard
// de 6px). Hover: la carta se levanta 3cm.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { MESA3D, seatAngle, seatPoint } from './config'
import { mulberry32 } from './feltTexture'
import { cardBackMaterial, cardEdgeMaterial, cardFrontMaterial } from './cardTextures'

const CARD = MESA3D.cards
const { w: CW, h: CH, t: CT, cornerR: CR } = CARD.size

/** Vista mínima de un asiento para el canvas (la lógica vive en Board). */
export interface MesaSeatView {
  seat: number
  name: string
  values: number[]
  isTurn: boolean
}

/** Estado del juego reducido a lo que la mesa debe mostrar en 3D. */
export interface MesaGameView {
  deckCount: number
  stealValue: number | null
  seats: MesaSeatView[]
}

/** Vuelo de una carta del mazo hacia el nido de un asiento (lo dispara Board). */
export interface MesaFlight {
  id: number
  seat: number
  value: number
}

/** Rig compartido de interacción: drag-guard + cursor del puntero. */
interface PointerRig {
  down: { x: number; y: number } | null
  cursors: number
}

// --- geometrías compartidas (una sola vez para todas las cartas) -----------

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

let shared: { cap: THREE.ShapeGeometry; edge: THREE.ExtrudeGeometry; halo: THREE.ShapeGeometry } | null = null

function cardGeometries() {
  if (!shared) {
    const shape = roundedRectShape(CW, CH, CR)
    const cap = new THREE.ShapeGeometry(shape, 10)
    const edge = new THREE.ExtrudeGeometry(shape, { depth: CT, bevelEnabled: false, curveSegments: 10 })
    edge.translate(0, 0, -CT / 2)
    const halo = new THREE.ShapeGeometry(roundedRectShape(CW + 0.016, CH + 0.016, CR + 0.008), 10)
    shared = { cap, edge, halo }
  }
  return shared
}

// --- una carta -------------------------------------------------------------

interface Card3DProps {
  /** Valor 1..10; null = carta boca abajo (solo dorso). */
  value: number | null
  faceUp: boolean
  position: [number, number, number]
  rotY?: number
  /** Resaltado ámbar del modo robo (halo pulsante + click). */
  stealable?: boolean
  /** Se levanta con el hover (todas las cartas en mesa, salvo el mazo). */
  hoverable?: boolean
  onDown: (e: ThreeEvent<PointerEvent>) => void
  clickOk: (e: ThreeEvent<MouseEvent>) => boolean
  cursor: (on: boolean) => void
  onPick?: () => void
}

function Card3D({
  value,
  faceUp,
  position,
  rotY = 0,
  stealable = false,
  hoverable = false,
  onDown,
  clickOk,
  cursor,
  onPick,
}: Card3DProps) {
  const { cap, edge, halo } = cardGeometries()
  const inner = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const interactive = onPick !== undefined
  const lifts = interactive || hoverable

  // Material del halo: instancia propia (la opacidad pulsa por carta);
  // se libera al apagar/encender el modo robo.
  const haloMat = useMemo(
    () =>
      stealable
        ? new THREE.MeshBasicMaterial({
            color: MESA3D.colors.amber,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        : null,
    [stealable],
  )
  useEffect(() => () => haloMat?.dispose(), [haloMat])

  const frontMat = value != null ? cardFrontMaterial(value) : cardBackMaterial()
  const backMat = cardBackMaterial()
  const edgeMat = cardEdgeMaterial()

  useFrame((state, dt) => {
    if (haloMat) haloMat.opacity = 0.3 + 0.18 * Math.sin(state.clock.elapsedTime * 4.2)
    if (inner.current && lifts) {
      const target = hovered ? CARD.hoverLift : 0
      inner.current.position.y = THREE.MathUtils.damp(inner.current.position.y, target, 9, dt)
    }
  })

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <group ref={inner} rotation={[faceUp ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
        {haloMat && <mesh geometry={halo} material={haloMat} position={[0, 0, -CT / 2 - 0.0009]} />}
        <mesh
          geometry={edge}
          material={edgeMat}
          castShadow
          onPointerDown={lifts ? onDown : undefined}
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation()
                  if (!clickOk(e)) return
                  onPick?.()
                }
              : undefined
          }
          onPointerOver={
            lifts
              ? (e) => {
                  e.stopPropagation()
                  setHovered(true)
                  cursor(true)
                }
              : undefined
          }
          onPointerOut={
            lifts
              ? () => {
                  setHovered(false)
                  cursor(false)
                }
              : undefined
          }
        />
        <mesh geometry={cap} material={faceUp ? frontMat : backMat} position={[0, 0, CT / 2 + 0.0004]} />
        <mesh
          geometry={cap}
          material={faceUp ? backMat : frontMat}
          position={[0, 0, -CT / 2 - 0.0004]}
          rotation={[0, Math.PI, 0]}
        />
      </group>
    </group>
  )
}

// --- mazo ------------------------------------------------------------------

/** Cartas visibles del montón: la pileza se agota con el conteo (0 = vacío,
 *  escala proporcional sobre los 110 del mazo para que NADA se vea fijo). */
export function deckPile(count: number): number {
  if (count <= 0) return 0
  const ratio = count / CARD.deck.total
  return Math.min(CARD.deck.maxPile, Math.max(1, Math.round(ratio * CARD.deck.maxPile)))
}

function DeckPile({
  count,
  active,
  onDraw,
  onDown,
  clickOk,
  cursor,
}: {
  count: number
  active: boolean
  onDraw?: () => void
  onDown: (e: ThreeEvent<PointerEvent>) => void
  clickOk: (e: ThreeEvent<MouseEvent>) => boolean
  cursor: (on: boolean) => void
}) {
  const { cap, edge } = cardGeometries()
  const backMat = cardBackMaterial()
  const edgeMat = cardEdgeMaterial()

  // Jitter estable por slot: el montón no "tiembla" cuando cambia el conteo.
  const jitter = useMemo(() => {
    const rnd = mulberry32(0xd3c4)
    return Array.from({ length: CARD.deck.maxPile }, () => ({
      x: (rnd() - 0.5) * 2 * CARD.deck.jitterXZ,
      z: (rnd() - 0.5) * 2 * CARD.deck.jitterXZ,
      rot: (rnd() - 0.5) * 2 * CARD.deck.rotJitter,
    }))
  }, [])

  const pile = deckPile(count)
  const step = CARD.deck.step

  return (
    <group>
      {Array.from({ length: pile }, (_, i) => {
        const j = jitter[i]
        return (
          <group key={i} position={[j.x, CARD.baseY + i * step, j.z]} rotation={[0, j.rot, 0]}>
            <group rotation={[Math.PI / 2, 0, 0]}>
              <mesh geometry={edge} material={edgeMat} castShadow={i === 0 || i === pile - 1} />
              <mesh geometry={cap} material={backMat} position={[0, 0, CT / 2 + 0.0004]} />
              <mesh geometry={cap} material={backMat} position={[0, 0, -CT / 2 - 0.0004]} rotation={[0, Math.PI, 0]} />
            </group>
          </group>
        )
      })}

      {/* Zona de click del mazo (material invisible: raycastable). */}
      {active && (
        <mesh
          position={[0, CARD.baseY + 0.14, 0]}
          onPointerDown={onDown}
          onClick={(e) => {
            e.stopPropagation()
            if (!clickOk(e)) return
            onDraw?.()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            cursor(true)
          }}
          onPointerOut={() => cursor(false)}
        >
          <boxGeometry args={[0.2, 0.3, 0.22]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

// --- chip de conteo del mazo ------------------------------------------------

/** Píldora (mismo violeta oscuro que las chapas 2D) con bordes redondeados
 *  a mano (arcTo: roundRect no está en todos los lib.dom). También la usan
 *  las chapas de nombre (Seats3D). */
export function pillPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** "N cartas" flotando junto al mazo (paridad con el .deck-count 2D): el
 *  número baja en vivo. Lienzo propio: se repinta por conteo y al llegar la
 *  fuente (mismo patrón de repaint que las texturas de carta). */
function DeckCountChip({ count }: { count: number }) {
  const chip = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 384
    cv.height = 128
    const tex = new THREE.CanvasTexture(cv)
    tex.anisotropy = 8
    return { cv, g: cv.getContext('2d')!, tex }
  }, [])
  const countRef = useRef(count)
  countRef.current = count

  const draw = (n: number) => {
    const { cv, g, tex } = chip
    g.clearRect(0, 0, cv.width, cv.height)
    pillPath(g, 3, 3, cv.width - 6, cv.height - 6)
    g.fillStyle = 'rgba(23, 16, 31, 0.85)'
    g.fill()
    g.lineWidth = 4
    g.strokeStyle = 'rgba(203, 155, 234, 0.5)'
    g.stroke()
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    g.font = `700 58px 'Space Grotesk', system-ui, sans-serif`
    const label = String(Math.max(0, n))
    g.fillStyle = MESA3D.colors.amber
    g.fillText(label, 34, cv.height / 2 + 2)
    const wNum = g.measureText(label).width
    g.font = `600 44px 'Space Grotesk', system-ui, sans-serif`
    g.fillStyle = '#F2ECF4'
    g.fillText(' cartas', 34 + wNum, cv.height / 2 + 3)
    tex.needsUpdate = true
  }

  useEffect(() => {
    draw(count)
  }, [count])

  // Fuente tardía: repinta con el conteo actual (el primer paint usa fallback).
  useEffect(() => {
    let live = true
    void document.fonts.load('700 58px "Space Grotesk"').then(() => {
      if (live) draw(countRef.current)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => () => chip.tex.dispose(), [chip])

  const c = CARD.deck.countChip
  const h = 0.11
  return (
    <sprite position={[c.x, c.y, c.z]} scale={[(h * chip.cv.width) / chip.cv.height, h, 1]}>
      <spriteMaterial map={chip.tex} transparent depthWrite={false} />
    </sprite>
  )
}

// --- vuelo de una carta sacada ---------------------------------------------

/** Carta en vuelo mazo→nido (espejo 3D del FlightLayer 2D): power2.inOut
 *  sobre `dur`, arco de `lift` y balanceo ±9°; aterriza en su nido boca arriba
 *  con el "top" hacia el centro (misma pose que FrontRow). */
function DrawFlight({
  flight,
  seatCount,
  deckTop,
  onDone,
}: {
  flight: MesaFlight
  seatCount: number
  deckTop: number
  onDone: () => void
}) {
  const g = useRef<THREE.Group>(null)
  const prog = useRef(0)
  const done = useRef(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const to = seatPoint(flight.seat, seatCount)
  const toRotY = Math.atan2(to.x, to.z)
  const bank = to.x >= 0 ? 1 : -1 // mismo ±9° que el vuelo 2D

  useFrame((_, dt) => {
    const el = g.current
    if (!el || done.current) return
    prog.current = Math.min(1, prog.current + dt / MESA3D.cards.flight.dur)
    const t = prog.current
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 // power2.inOut
    el.position.x = THREE.MathUtils.lerp(0, to.x, e)
    el.position.z = THREE.MathUtils.lerp(0, to.z, e)
    el.position.y =
      THREE.MathUtils.lerp(deckTop, CARD.baseY, e) + Math.sin(Math.PI * e) * MESA3D.cards.flight.lift
    el.rotation.y = toRotY * e
    el.rotation.z = Math.sin(Math.PI * e) * 0.16 * bank
    if (t >= 1) {
      done.current = true
      doneRef.current()
    }
  })

  return (
    <group ref={g} position={[0, deckTop, 0]}>
      <Card3D
        value={flight.value}
        faceUp
        position={[0, 0, 0]}
        onDown={() => {}}
        clickOk={() => false}
        cursor={() => {}}
      />
    </group>
  )
}

// --- frentes de un asiento -------------------------------------------------

interface FrontRowProps {
  seatIndex: number
  seatCount: number
  values: number[]
  /** Es el asiento de quien tiene el turno (no puede robarse a sí mismo). */
  isTurn: boolean
  /** Valor robable este turno (null = modo robo apagado). */
  steal: number | null
  canSteal: boolean
  onSteal?: (value: number) => void
  onDown: (e: ThreeEvent<PointerEvent>) => void
  clickOk: (e: ThreeEvent<MouseEvent>) => boolean
  cursor: (on: boolean) => void
}

function FrontRow({
  seatIndex,
  seatCount,
  values,
  isTurn,
  steal,
  canSteal,
  onSteal,
  onDown,
  clickOk,
  cursor,
}: FrontRowProps) {
  const p = seatPoint(seatIndex, seatCount)
  const a = seatAngle(seatIndex, seatCount)
  const radial = { x: Math.cos(a), z: Math.sin(a) } // afuera
  const tangent = { x: -Math.sin(a), z: Math.cos(a) } // a lo largo del borde

  // Filas de a `perRow` (fila 0 = la más cerca del jugador; la 1 hacia el centro).
  const rows: number[][] = []
  for (let i = 0; i < values.length; i += CARD.fronts.perRow) {
    rows.push(values.slice(i, i + CARD.fronts.perRow))
  }

  return (
    <group>
      {rows.map((row, ri) => {
        const k = row.length
        return row.map((v, ci) => {
          const idx = ri * CARD.fronts.perRow + ci
          const off = (ci - (k - 1) / 2) * CARD.fronts.spacing
          const rnd = mulberry32(seatIndex * 997 + idx + 1)
          const jr = (rnd() - 0.5) * 2 * CARD.fronts.jitterZ
          const x = p.x - radial.x * ri * CARD.fronts.rowGap + tangent.x * off + radial.x * jr
          const z = p.z - radial.z * ri * CARD.fronts.rowGap + tangent.z * off + radial.z * jr
          // Carta con el "top" hacia el centro + abanico leve según su lugar.
          const rotY = Math.atan2(x, z) + off * CARD.fronts.fan + (rnd() - 0.5) * 0.06
          const stealable = !isTurn && steal != null && v === steal && canSteal
          return (
            <Card3D
              key={idx}
              value={v}
              faceUp
              position={[x, CARD.baseY, z]}
              rotY={rotY}
              stealable={stealable}
              hoverable
              onDown={onDown}
              clickOk={clickOk}
              cursor={cursor}
              onPick={
                stealable && onSteal
                  ? () => onSteal(v)
                  : undefined
              }
            />
          )
        })
      })}
    </group>
  )
}

// --- aro de turno ----------------------------------------------------------

function TurnRing({ seatIndex, seatCount }: { seatIndex: number; seatCount: number }) {
  const p = seatPoint(seatIndex, seatCount)
  return (
    <group position={[p.x, CARD.turnRing.y, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[CARD.turnRing.inner, CARD.turnRing.outer, 64]} />
        <meshBasicMaterial
          color={MESA3D.colors.amber}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

// --- conjunto ---------------------------------------------------------------

export interface Cards3DProps {
  game: MesaGameView
  /** Último robo del mazo en curso (Board lo limpia al aterrizar). */
  flight?: MesaFlight | null
  canAct?: boolean
  onDraw?: () => void
  onSteal?: (value: number) => void
}

export function Cards3D({ game, flight = null, canAct = false, onDraw, onSteal }: Cards3DProps) {
  const rig = useRef<PointerRig>({ down: null, cursors: 0 })
  // Vuelos ya aterrizados: no se reproducen dos veces (mismo id → ignorado).
  const [landed, setLanded] = useState(-1)

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    rig.current.down = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
  }
  const clickOk = (e: ThreeEvent<MouseEvent>) => {
    const d = rig.current.down
    rig.current.down = null
    if (!d) return false
    return Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) <= 6
  }
  const cursor = (on: boolean) => {
    rig.current.cursors = Math.max(0, rig.current.cursors + (on ? 1 : -1))
    document.body.style.cursor = rig.current.cursors > 0 ? 'pointer' : ''
  }

  // Si el canvas se desmonta con el puntero encima, devolvemos el cursor.
  useEffect(
    () => () => {
      rig.current.cursors = 0
      document.body.style.cursor = ''
    },
    [],
  )

  const n = game.seats.length
  const turnSeat = game.seats.find((s) => s.isTurn)?.seat ?? -1
  const canSteal = canAct && game.stealValue != null
  // Vuelo activo: mientras viaja, la carta entrante queda OCULTA en su nido
  // (misma regla "nunca dos a la vez" que en 2D) y el mazo ya descontó.
  const active = flight && flight.id !== landed ? flight : null
  const deckTop = CARD.baseY + deckPile(game.deckCount + 1) * CARD.deck.step

  return (
    <group>
      <DeckPile
        count={game.deckCount}
        active={canAct && game.deckCount > 0 && onDraw != null}
        onDraw={onDraw}
        onDown={onDown}
        clickOk={clickOk}
        cursor={cursor}
      />
      <DeckCountChip count={game.deckCount} />

      {active && (
        <DrawFlight
          key={active.id}
          flight={active}
          seatCount={Math.max(1, n)}
          deckTop={deckTop}
          onDone={() => setLanded(active.id)}
        />
      )}

      {n > 0 &&
        game.seats.map((s) => (
          <FrontRow
            key={s.seat}
            seatIndex={s.seat}
            seatCount={n}
            values={active && active.seat === s.seat ? s.values.slice(0, -1) : s.values}
            isTurn={s.isTurn}
            steal={game.stealValue}
            canSteal={canSteal}
            onSteal={onSteal}
            onDown={onDown}
            clickOk={clickOk}
            cursor={cursor}
          />
        ))}

      {turnSeat >= 0 && <TurnRing seatIndex={turnSeat} seatCount={n} />}
    </group>
  )
}
