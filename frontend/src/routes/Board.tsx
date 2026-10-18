import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { friendlyMessage } from '../api/types';
import { useGame } from '../hooks/useGame';
import { CardBack, CardView } from '../components/CardView';
import { FlightLayer, type Flight, type FlightPoint } from '../components/FlightLayer';
import { TableCanvasR3F, type MesaFlight } from '../features/mesa3d/TableCanvasR3F';
import { MESA_CAMERA_PRESETS, type MesaCameraPreset } from '../features/mesa3d/config';

// Mesa cósmica en arco: el activo vive SIEMPRE abajo al centro (su asiento
// es "tú", frente a la mesa) y los rivales ocupan un ARCO en el lado
// opuesto, siempre cerca y nítidos (vista fija, sin cámara que girar). El
// "Turno de X" va en texto plano arriba a la izquierda (sin recuadro). El
// backend decide; hotseat = la UI actúa como el jugador del turno.
// Vista 3D (?vista=3d): canvas R3F con mesa + salón + cámara libre + cartas
// (paso 5). El estado del juego se pasa como vista RESUMIDA (mazo, frentes,
// turno, valor robable); las reglas y mutaciones siguen acá igual que en 2D.

// Arco de rivales: grados sobre la mesa (0 = frente, 180 = tú).
const ARC_DEG = 150;
const ARC_HALF = ARC_DEG / 2;

export function Board() {
  const { id } = useParams();
  const { state, error, busy, act } = useGame(id);
  // Vista 3D del paso 2: ?vista=3d la activa y ?cam= elige la vista fija.
  const [search, setSearch] = useSearchParams();
  const vista3d = search.get('vista') === '3d';
  const camRaw = search.get('cam') ?? 'seat';
  const cam: MesaCameraPreset = MESA_CAMERA_PRESETS.includes(camRaw as MesaCameraPreset)
    ? (camRaw as MesaCameraPreset)
    : 'seat';
  const [robbing, setRobbing] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightSeq = useRef(0);
  // Vuelo de carta del mazo en la vista 3D (espejo del FlightLayer 2D).
  const [mesaFlight, setMesaFlight] = useState<MesaFlight | null>(null);
  const mesaFlightSeq = useRef(0);
  // Cartas recién ganadas (draw/steal) que aún están "en vuelo": se ocultan
  // en el frente hasta que su fantasma aterriza (evita verlas duplicadas).
  const [arrivals, setArrivals] = useState(0);

  // Al cambiar de turno (stand, bust) el modo robo queda obsoleto: se apaga.
  useEffect(() => {
    setRobbing(false);
  }, [state?.currentPlayerId ?? null]);

  if (!state) return <main className="page">{error ? friendlyMessage(error) : 'Repartiendo…'}</main>;

  const finished = state.status === 'FINISHED';
  const meId = state.currentPlayerId ?? '';
  const myTurn = !finished && meId !== '';
  const ev = state.lastEvent as { type?: string; value?: number; count?: number; bust?: boolean } | null;
  const bust = !finished && ev?.type === 'DRAW' && ev.bust === true;
  const stealValue = state.lastDrawnValue;
  const rivals = state.players.filter((p) => p.id !== meId);
  // Asiento de quien tiene el turno (constante por render): con él disparamos
  // el vuelo 3D, porque `meId` cambia apenas se muta el estado.
  const drawerSeat = state.players.find((p) => p.id === meId)?.seat ?? 0;
  const hasStealTarget = stealValue != null && rivals.some((p) => (state.fronts[p.id] ?? []).includes(stealValue));
  // Modo robo efectivo: activo, mi turno y con algo robable este turno.
  const stealing = robbing && myTurn && stealValue != null;

  // Ángulo de cada asiento sobre la mesa: el activo siempre a 180° (abajo,
  // cerca del jugador); los rivales repartidos en el arco opuesto.
  function arcAngle(playerId: string): number {
    if (playerId === meId) return 180;
    const ri = rivals.findIndex((p) => p.id === playerId);
    if (rivals.length <= 1) return 0;
    return -ARC_HALF + (ARC_DEG * ri) / (rivals.length - 1);
  }

  // Alterna vista clásica (2D) ↔ vista 3D del paso 2. Temporal: el toggle
  // definitivo vive en el grupo de cámara (pasos 4/8).
  function toggleVista() {
    const next = new URLSearchParams(search);
    if (vista3d) next.delete('vista');
    else next.set('vista', '3d');
    next.delete('cam');
    setMesaFlight(null); // un vuelo a medias no debe reanudarse al volver
    setSearch(next);
  }

  function addFlight(from: FlightPoint, to: FlightPoint, value: number, delay: number) {
    flightSeq.current += 1;
    const f: Flight = { id: flightSeq.current, from, to, value, delay };
    setFlights((prev) => [...prev, f]);
  }

  function removeFlight(fid: number) {
    setFlights((prev) => prev.filter((f) => f.id !== fid));
    // Cada vuelo creado tiene su +1 en `arrivals`: al aterrizar se descuenta.
    setArrivals((n) => Math.max(0, n - 1));
  }

  function centerOf(el: Element | null): FlightPoint | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Cartas de mi frente que están ocultas esperando su vuelo (posición real).
  function incomingSlots(): FlightPoint[] {
    return Array.from(document.querySelectorAll(`.seat-panel[data-player="${meId}"] .card-slot.incoming`))
      .map((el) => centerOf(el))
      .filter((p): p is FlightPoint => p !== null);
  }

  // Rect del mazo ANTES de mutar (el mazo no se mueve; es más robusto).
  // La carta nueva del frente nace oculta (`arrivals`) y el vuelo aterriza
  // encima de ella: nunca se ven las dos a la vez.
  async function draw() {
    if (!id || !myTurn) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const deckRect = vista3d ? null : centerOf(document.getElementById('deck-pile'));
    const next = await act(() => api.draw(id, meId));
    if (!next) return;
    const e = next.lastEvent as { type?: string; value?: number; bust?: boolean } | null;
    if (e?.type !== 'DRAW' || e.bust || typeof e.value !== 'number' || reduced) return;
    const drawn = e.value;
    // Vista 3D: el vuelo lo pinta el canvas (mismo timing que FlightLayer 2D).
    if (vista3d) {
      mesaFlightSeq.current += 1;
      setMesaFlight({ id: mesaFlightSeq.current, seat: drawerSeat, value: drawn });
      return;
    }
    setArrivals((n) => n + 1);
    requestAnimationFrame(() => {
      const slots = incomingSlots();
      const dest = slots[slots.length - 1] ?? centerOf(document.querySelector(`[data-front="${meId}"]`));
      if (!deckRect || !dest) {
        setArrivals((n) => Math.max(0, n - 1));
        return;
      }
      addFlight(deckRect, dest, drawn, 0);
    });
  }

  async function doSteal(value: number) {
    if (!id || !myTurn) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Snapshot de las cartas resaltadas ANTES de mutar: al robarlas, esos
    // nodos desaparecen del DOM y perderíamos su posición.
    const sources = Array.from(document.querySelectorAll('.seat-panel.rival .card.stealable'))
      .map((el) => centerOf(el))
      .filter((p): p is FlightPoint => p !== null);
    const next = await act(() => api.steal(id, meId, value));
    if (!next) return;
    setRobbing(false);
    if (reduced || sources.length === 0) return;
    setArrivals((n) => n + sources.length);
    requestAnimationFrame(() => {
      const slots = incomingSlots();
      const start = slots.length - sources.length;
      let flying = 0;
      sources.forEach((from, i) => {
        const dest = slots[start + i] ?? centerOf(document.querySelector(`[data-front="${meId}"]`));
        if (dest) {
          addFlight(from, dest, value, i * 70);
          flying += 1;
        }
      });
      if (flying < sources.length) {
        setArrivals((n) => Math.max(0, n - (sources.length - flying)));
      }
    });
  }

  return (
    <main className="page table">
      {bust && (
        <p className="bust-banner" role="alert">
          Carta repetida con 3+ en el frente: todo al descarte. Turno perdido.
        </p>
      )}

      <div className="table-stage">
        {/* Texto del turno: plano, arriba a la izquierda, sobre el fondo
            (sin recuadro). El estado de turno también vive en cada chapa. */}
        <p className="felt-turn" role="status">
          <span className="felt-turn-k">{finished ? 'Mesa cerrada' : 'Turno de'}</span>
          <strong>{finished ? 'Partida terminada' : nameOf(state.players, meId)}</strong>
        </p>

        {(ev?.type === 'DRAW' || ev?.type === 'STEAL' || ev?.type === 'STASH') && (
          <div className="event-chip">
            {ev?.type === 'DRAW' && (
              <>
                Sacó <strong>{String(ev.value)}</strong>
              </>
            )}
            {ev?.type === 'STEAL' && (
              <>
                Robó <strong>{String(ev.count)}</strong> × {String(ev.value)}
              </>
            )}
            {ev?.type === 'STASH' && (
              <>
                Guardó <strong>{String(ev.count)}</strong>
              </>
            )}
          </div>
        )}

        {vista3d ? (
          <TableCanvasR3F
            seatCount={state.players.length}
            cam={cam}
            canAct={myTurn && !busy}
            onDraw={() => {
              void draw()
            }}
            onSteal={(v) => {
              void doSteal(v)
            }}
            flight={mesaFlight}
            game={{
              deckCount: state.deckRemaining,
              stealValue: stealing ? stealValue : null,
              seats: [...state.players]
                .sort((a, b) => a.seat - b.seat)
                .map((p) => ({
                  seat: p.seat,
                  name: p.name,
                  isTurn: p.id === meId && !finished,
                  values: state.fronts[p.id] ?? [],
                })),
            }}
          />
        ) : (
        <div className="table-felt">
          <div className="felt-disc" aria-hidden="true" />

          <div className="deck-area">
            <button
              type="button"
              id="deck-pile"
              className={`deck-pile${myTurn ? ' clickable' : ''}`}
              onClick={draw}
              disabled={!myTurn || busy || state.deckRemaining === 0}
              aria-label={`Mazo: ${state.deckRemaining} cartas. Sacar carta`}
            >
              <span className="deck-stack">
                <CardBack small />
                <CardBack small />
                <CardBack small />
              </span>
              <span className="deck-count" key={state.deckRemaining}>
                {state.deckRemaining} cartas
              </span>
            </button>
          </div>

          {state.players.map((p) => {
            const angle = arcAngle(p.id);
            const active = p.id === meId && !finished;
            const isRival = p.id !== meId;
            return (
              <div
                key={p.id}
                className={`seat${isRival ? ' seat-rival' : ' seat-mine'}`}
                style={{ ['--a' as string]: `${angle}deg` }}
              >
                <div className="seat-inner" style={{ ['--scale' as string]: active ? '1.06' : '1' }}>
                  <article
                    className={`seat-panel${active ? ' active' : ''}${isRival ? ' rival' : ''}`}
                    data-player={p.id}
                  >
                    <header className="player-head">
                      <h2>
                        {p.name}
                        {active && <span className="turn-dot" role="img" aria-label="en turno" />}
                      </h2>
                      <span className="points">{state.stashed[p.id]?.sum ?? 0} pts</span>
                    </header>
                    <div className="front-zone" data-front={p.id}>
                      <FrontCards
                        values={state.fronts[p.id] ?? []}
                        steal={robbing && myTurn && isRival ? stealValue : undefined}
                        hideTail={p.id === meId ? arrivals : 0}
                        onPick={doSteal}
                      />
                    </div>
                  </article>
                </div>
              </div>
            );
          })}
        </div>
        )}

        <button type="button" className="vista-toggle" onClick={toggleVista}>
          {vista3d ? 'Vista clásica' : 'Vista 3D · WIP'}
        </button>
      </div>

      {!finished && (
        <>
          <div className="action-bar" role="group" aria-label="Acciones de turno">
            <button
              type="button"
              className="act act-draw"
              disabled={busy || !myTurn || state.deckRemaining === 0}
              onClick={draw}
              title={
                state.deckRemaining === 0
                  ? 'Mazo vacío: plantate para pasar el turno'
                  : 'Sacar una carta del mazo'
              }
            >
              <span className="act-icon" aria-hidden="true">
                +
              </span>
              <span className="act-label">Pedir</span>
            </button>
            <button
              type="button"
              className="act act-stand"
              disabled={busy || !myTurn}
              onClick={() => id && act(() => api.stand(id, meId))}
              title="Plantarse: pasar el turno"
            >
              <span className="act-icon" aria-hidden="true">
                −
              </span>
              <span className="act-label">Plantarse</span>
            </button>
            <button
              type="button"
              className={`act act-steal${stealing ? ' armed' : ''}`}
              disabled={busy || !myTurn || stealValue == null || !hasStealTarget}
              onClick={() => setRobbing((r) => !r)}
              aria-pressed={stealing}
              aria-label={stealValue != null ? `Robar los ${stealValue}` : 'Robar'}
              title={
                stealValue == null
                  ? 'Primero sacá una carta'
                  : !hasStealTarget
                    ? `Nadie tiene un ${stealValue} boca arriba`
                    : `Robar los ${stealValue} ajenos`
              }
            >
              <span className="act-icon" aria-hidden="true">
                {/* SVG en vez de 🥷: U+1F977 no existe en fuentes emoji viejas
                    (Windows 10) y aparece como cuadrado vacío. */}
                <svg viewBox="0 0 32 32" className="ninja-svg">
                  <path
                    d="M16 4.5c6 0 10 3.9 10 9v4.1c0 5.2-4.4 8.4-10 8.4s-10-3.2-10-8.4V13.5c0-5.1 4-9 10-9Z"
                    fill="oklch(0.14 0.05 292)"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7.5 13.8c2.5-1.4 5.2-2.1 8.5-2.1s6 .7 8.5 2.1v3.4c-2.5 1.3-5.2 2-8.5 2s-6-.7-8.5-2Z"
                    fill="var(--parchment)"
                  />
                  <ellipse cx="12.7" cy="15.5" rx="1.55" ry="1.85" fill="oklch(0.14 0.05 292)" />
                  <ellipse cx="19.3" cy="15.5" rx="1.55" ry="1.85" fill="oklch(0.14 0.05 292)" />
                </svg>
              </span>
              <span className="act-label">{stealing ? 'Cancelar' : 'Robar'}</span>
            </button>
            <button
              type="button"
              className="act act-stash"
              disabled={busy || !myTurn}
              onClick={() => id && act(() => api.stash(id, meId))}
              title="Guardar tus pelusas en el pote"
            >
              <span className="act-icon" aria-hidden="true">
                ★
              </span>
              <span className="act-label">Guardar</span>
            </button>
          </div>
          {stealing && (
            <p className="hint" role="status">
              Tocá una carta resaltada: solo se roban los {stealValue}s de la última carta que sacaste.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {friendlyMessage(error)}
            </p>
          )}
        </>
      )}

      {finished && state.result && (
        <section className="panel result">
          <h2>{state.result.tie ? 'Empate en la mesa.' : `${nameOf(state.players, state.result.winnerId)} se lleva la noche.`}</h2>
          <ol>
            {state.result.scores.map((s) => (
              <li key={s.playerId}>
                <strong>{s.name}</strong> — {s.sum} pts
              </li>
            ))}
          </ol>
        </section>
      )}

      <FlightLayer flights={flights} onDone={removeFlight} />
    </main>
  );
}

// Cartas del frente, desplegadas (nunca apiladas). Si `steal` trae valor,
// SOLO las cartas de ese valor (R-01: el de la última sacada) se resaltan y
// son clickeables; el resto se atenúa.
function FrontCards({
  values,
  steal,
  hideTail = 0,
  onPick,
}: {
  values: number[];
  steal?: number | null;
  hideTail?: number;
  onPick: (v: number) => void;
}) {
  if (values.length === 0) return <span className="empty-front">Sin cartas a la vista</span>;
  const robbing = steal != null;
  return (
    <div className="card-group spread">
      {values.map((v, i) => {
        const match = robbing && v === steal;
        const dim = robbing && v !== steal;
        // Las últimas `hideTail` cartas acaban de llegar: quedan ocultas
        // hasta que su vuelo aterrice (si no, se ven duplicadas).
        const incoming = i >= values.length - hideTail;
        return (
          <div
            key={`${v}-${i}`}
            className={`card-slot pop-in${dim ? ' dimmed' : ''}${incoming ? ' incoming' : ''}`}
            style={{ ['--d' as string]: `${i * 45}ms` }}
          >
            <CardView value={v} small stealable={match} onPick={match ? () => onPick(v) : undefined} />
          </div>
        );
      })}
    </div>
  );
}

function nameOf(players: { id: string; name: string }[], id: string | null): string {
  return players.find((p) => p.id === id)?.name ?? '—';
}
