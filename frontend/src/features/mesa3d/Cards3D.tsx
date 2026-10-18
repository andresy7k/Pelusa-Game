// frontend/src/features/mesa3d/Cards3D.tsx
// Paso 5: las cartas VIVEN sobre la mesa. El mazo ocupa el ojo del remolino
// (su altura crece con las cartas restantes), la última carta sacada queda
// boca arriba junto al mazo y el frente de cada jugador se despliega sobre su
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
  values: number[]
  isTurn: boolean
}

/** Estado del juego reducido a lo que la mesa debe mostrar en 3D. */
export interface MesaGameView {
  deckCount: number
  lastDrawnValue: number | null
  stealValue: number | null
  seats: MesaSeatView[]
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

  const pile = Math.max(0, Math.min(count, CARD.deck.maxPile))
  // Altura ∝ cartas: mazos largos se comprimen bajo el tope del montón.
  const step = Math.min(CARD.deck.step, CARD.deck.maxStack / Math.max(1, pile))

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
  canAct?: boolean
  onDraw?: () => void
  onSteal?: (value: number) => void
}

export function Cards3D({ game, canAct = false, onDraw, onSteal }: Cards3DProps) {
  const rig = useRef<PointerRig>({ down: null, cursors: 0 })

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

      {game.lastDrawnValue != null && (
        <Card3D
          value={game.lastDrawnValue}
          faceUp
          position={[CARD.lastCard.x, CARD.baseY, CARD.lastCard.z]}
          rotY={Math.atan2(CARD.lastCard.x, CARD.lastCard.z) + CARD.lastCard.rot}
          hoverable
          onDown={onDown}
          clickOk={clickOk}
          cursor={cursor}
        />
      )}

      {n > 0 &&
        game.seats.map((s) => (
          <FrontRow
            key={s.seat}
            seatIndex={s.seat}
            seatCount={n}
            values={s.values}
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
