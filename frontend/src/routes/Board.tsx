import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { friendlyMessage } from '../api/types';
import { useGame } from '../hooks/useGame';
import { CardGroup } from '../components/CardView';

// Mesa: el mazo al centro como objeto con su cuenta, jugadores en paneles,
// el turno activo iluminado en ámbar. Una acción primaria (sacar), resto
// secundario. Todo lo que ves lo decidió el backend.
export function Board() {
  const { id } = useParams();
  const { state, error, busy, act } = useGame(id);
  const [me, setMe] = useState<string>('');
  const [stealValue, setStealValue] = useState(4);

  if (!state) return <main className="page">{error ? friendlyMessage(error) : 'Repartiendo…'}</main>;
  const meId = me || state.currentPlayerId || '';
  const finished = state.status === 'FINISHED';

  return (
    <main className="page table">
      <p className="kicker">{finished ? 'Mesa cerrada' : 'En juego'}</p>
      <div className="table-head">
        <h1>
          Turno de <span className="turn-name">{nameOf(state, state.currentPlayerId)}</span>
        </h1>
        <div className="deck-pile" aria-label={`Mazo: ${state.deckRemaining} cartas`}>
          <div className="deck-pile-card" />
          <div className="deck-pile-card" />
          <div className="deck-pile-card top" />
          <span className="deck-count">{state.deckRemaining}</span>
        </div>
      </div>

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
            <span className="steal-inline">
              <input
                type="number"
                min={1}
                max={10}
                value={stealValue}
                aria-label="Valor a robar"
                onChange={(e) => setStealValue(Number(e.target.value))}
              />
              <button className="ghost" disabled={busy} onClick={() => id && meId && act(() => api.steal(id, meId, stealValue))}>
                Robar
              </button>
            </span>
          </div>
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
          return (
            <article key={p.id} className={active ? 'panel active' : 'panel'}>
              <div className="player-head">
                <h2>
                  {p.name} {active && <span className="turn-dot" aria-label="en turno" />}
                </h2>
                <span className="points">{state.stashed[p.id]?.sum ?? 0} pts</span>
              </div>
              <CardGroup values={state.fronts[p.id] ?? []} />
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
