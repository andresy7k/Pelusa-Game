import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { friendlyMessage } from '../api/types';
import { useGame } from '../hooks/useGame';
import { CardBack, CardView } from '../components/CardView';
import { FlightLayer, type Flight, type FlightPoint } from '../components/FlightLayer';

// Mesa 3D rotativa: los asientos viven en un anillo alrededor del fieltro y la
// mesa gira para que el jugador en turno quede SIEMPRE abajo (ringRot). El
// contenido de cada asiento contra-rota para quedar legible.
// Hotseat: la UI siempre actúa como el jugador del turno — el backend decide.
export function Board() {
  const { id } = useParams();
  const { state, error, busy, act } = useGame(id);
  const [robbing, setRobbing] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightSeq = useRef(0);
  // Cartas recién ganadas (draw/steal) que aún están "en vuelo": se ocultan
  // en el frente hasta que su fantasma aterriza (evita verlas duplicadas).
  const [arrivals, setArrivals] = useState(0);

  // Al cambiar de turno (stand, bust) el modo robo queda obsoleto: se apaga.
  const turnKey = state?.currentPlayerId ?? null;
  useEffect(() => {
    setRobbing(false);
  }, [turnKey]);

  if (!state) return <main className="page">{error ? friendlyMessage(error) : 'Repartiendo…'}</main>;

  const finished = state.status === 'FINISHED';
  const meId = state.currentPlayerId ?? '';
  const myTurn = !finished && meId !== '';
  const ev = state.lastEvent as { type?: string; value?: number; count?: number; bust?: boolean } | null;
  const bust = !finished && ev?.type === 'DRAW' && ev.bust === true;
  const stealValue = state.lastDrawnValue;
  const rivals = state.players.filter((p) => p.id !== meId);
  const hasStealTarget = stealValue != null && rivals.some((p) => (state.fronts[p.id] ?? []).includes(stealValue));
  // Modo robo efectivo: activo, mi turno y con algo robable este turno.
  const stealing = robbing && myTurn && stealValue != null;

  // Geometría del anillo: asiento i en (360/n)·i grados; la mesa se gira para
  // que el ángulo del activo caiga en 180° (abajo). n=1 no ocurre (mín. 2).
  const n = state.players.length;
  const step = 360 / n;
  const activeIdx = Math.max(0, state.players.findIndex((p) => p.id === meId));
  const ringRot = 180 - step * activeIdx;

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
    const deckRect = centerOf(document.getElementById('deck-pile'));
    const next = await act(() => api.draw(id, meId));
    if (!next) return;
    const e = next.lastEvent as { type?: string; value?: number; bust?: boolean } | null;
    if (e?.type !== 'DRAW' || e.bust || typeof e.value !== 'number' || reduced) return;
    const drawn = e.value;
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
      <div className="table-head">
        <div>
          <p className="kicker">{finished ? 'Mesa cerrada' : 'Turno de'}</p>
          <h1 className="turn-name">{finished ? 'Partida terminada' : nameOf(state.players, meId)}</h1>
        </div>
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
      </div>

      {bust && (
        <p className="bust-banner" role="alert">
          Carta repetida con 3+ en el frente: todo al descarte. Turno perdido.
        </p>
      )}

      <div className="table-stage">
        <div className="table-felt" style={{ ['--ring-rot' as string]: `${ringRot}deg` }}>
          <div className="felt-disc" aria-hidden="true" />

          <div className="deck-area">
            <div className="deck-inner" style={{ ['--counter' as string]: `${-ringRot}deg` }}>
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
          </div>

          {state.players.map((p, i) => {
            const angle = step * i;
            const counter = -(angle + ringRot);
            const active = p.id === meId && !finished;
            const isRival = p.id !== meId;
            return (
              <div key={p.id} className="seat" style={{ ['--a' as string]: `${angle}deg` }}>
                <div
                  className="seat-inner"
                  style={{
                    ['--counter' as string]: `${counter}deg`,
                    ['--scale' as string]: active ? '1.12' : '1',
                  }}
                >
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
      </div>

      {!finished && (
        <>
          <div className="actions table-actions">
            <button className="primary" disabled={busy || !myTurn} onClick={draw}>
              Sacar carta
            </button>
            <button
              className={stealing ? 'primary' : 'ghost'}
              disabled={busy || !myTurn || stealValue == null || !hasStealTarget}
              onClick={() => setRobbing((r) => !r)}
              aria-pressed={stealing}
              title={
                stealValue == null
                  ? 'Primero sacá una carta'
                  : !hasStealTarget
                    ? `Nadie tiene un ${stealValue} boca arriba`
                    : `Robar los ${stealValue} ajenos`
              }
            >
              {stealing ? 'Cancelar robo' : `Robar ${stealValue ?? ''}`}
            </button>
            <button className="ghost" disabled={busy || !myTurn} onClick={() => id && act(() => api.stash(id, meId))}>
              Guardar pelusas
            </button>
            <button className="ghost" disabled={busy || !myTurn} onClick={() => id && act(() => api.stand(id, meId))}>
              Plantarse
            </button>
          </div>
          {stealing && (
            <p className="hint">
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
