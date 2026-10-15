import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { friendlyMessage } from '../api/types';
import { useGame } from '../hooks/useGame';
import { CardGroup } from '../components/CardView';

// Mesa: modo robo por resaltado (sin inputs numéricos). Tocás "Robar",
// las cartas ajenas brillan, tocás una y se roba ese valor. La elegibilidad
// sale del estado (frentes ajenos no vacíos), la autorización del backend.
export function Board() {
  const { id } = useParams();
  const { state, error, busy, act } = useGame(id);
  const [me, setMe] = useState<string>('');
  const [robbing, setRobbing] = useState(false);

  if (!state) return <main className="page">{error ? friendlyMessage(error) : 'Repartiendo…'}</main>;
  const meId = me || state.currentPlayerId || '';
  const finished = state.status === 'FINISHED';
  const bust = !finished && (state.lastEvent as { bust?: boolean } | null)?.bust === true;
  const myTurn = !finished && state.currentPlayerId === meId && meId !== '';

  async function stealValue(value: number) {
    if (!id || !meId) return;
    const next = await act(() => api.steal(id, meId, value));
    if (next) setRobbing(false);
  }

  return (
    <main className="page table">
      <p className="kicker">{finished ? 'Mesa cerrada' : bust ? '¡Reventó!' : 'En juego'}</p>
      <div className="table-head">
        <h1>
          Turno de <span className="turn-name">{nameOf(state, state.currentPlayerId)}</span>
        </h1>
        <div className="deck-pile" aria-label={`Mazo: ${state.deckRemaining} cartas`}>
          <div className="deck-pile-card" />
          <div className="deck-pile-card" />
          <div className="deck-pile-card top" />
          <span className="deck-count" key={state.deckRemaining}>
            {state.deckRemaining}
          </span>
        </div>
      </div>

      {bust && (
        <p className="bust-banner" role="alert">
          Carta repetida con 3+ en frente: todo al descarte. Turno perdido.
        </p>
      )}

      {!finished && (
        <>
          <label className="identity">
            Jugar como
            <select value={meId} onChange={(e) => setMe(e.target.value)}>
              <option value="">— elegir —</option>
              {state.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="actions">
            <button className="primary" disabled={busy} onClick={() => id && meId && act(() => api.draw(id, meId))}>
              Sacar carta
            </button>
            <button className="ghost" disabled={busy} onClick={() => id && meId && act(() => api.stand(id, meId))}>
              Plantarse
            </button>
            <button className="ghost" disabled={busy} onClick={() => id && meId && act(() => api.stash(id, meId))}>
              Guardar pelusas
            </button>
            <button
              className={robbing ? 'primary' : 'ghost'}
              disabled={busy}
              onClick={() => setRobbing((r) => !r)}
              aria-pressed={robbing}
            >
              {robbing ? 'Tocá una carta rival…' : 'Robar'}
            </button>
          </div>
          {robbing && myTurn && <p className="hint">Las cartas que brillan se pueden robar. Tocá una.</p>}
          {error && (
            <p className="error" role="alert">
              {friendlyMessage(error)}
            </p>
          )}
        </>
      )}

      <section className="fronts">
        {state.players.map((p) => {
          const active = p.id === state.currentPlayerId && !finished;
          const rival = p.id !== meId;
          const highlight = robbing && myTurn && rival;
          return (
            <article key={p.id} className={active ? 'panel active' : 'panel'}>
              <div className="player-head">
                <h2>
                  {p.name} {active && <span className="turn-dot" aria-label="en turno" />}
                </h2>
                <span className="points">{state.stashed[p.id]?.sum ?? 0} pts</span>
              </div>
              <CardGroup
                values={state.fronts[p.id] ?? []}
                stealable={highlight}
                onPick={highlight ? stealValue : undefined}
              />
            </article>
          );
        })}
      </section>

      {finished && state.result && (
        <section className="panel result">
          <h2>{state.result.tie ? 'Empate en la mesa.' : `${nameOf(state, state.result.winnerId)} se lleva la noche.`}</h2>
          <ol>
            {state.result.scores.map((s) => (
              <li key={s.playerId}>
                <strong>{s.name}</strong> — {s.sum} pts
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}

function nameOf(state: { players: { id: string; name: string }[] }, id: string | null): string {
  return state.players.find((p) => p.id === id)?.name ?? '—';
}
