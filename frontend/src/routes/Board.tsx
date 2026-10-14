import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { friendlyMessage } from '../api/types';
import { useGame } from '../hooks/useGame';

// Tablero funcional Phase 5 (la identidad visual premium llega en Phase 6).
// Decisiones: "jugar como" es un selector nominal (sin auth, ADR-010); cada
// botón dispara la mutación y muestra lo que el backend responde; los 409/422
// se traducen a mensajes sin reinterpretar reglas.
export function Board() {
  const { id } = useParams();
  const { state, error, busy, act } = useGame(id);
  const [me, setMe] = useState<string>('');
  const [stealValue, setStealValue] = useState(4);

  if (!state) return <main className="page">{error ? friendlyMessage(error) : 'Cargando…'}</main>;
  const meId = me || state.currentPlayerId || '';
  const isMe = (pid: string) => pid === state.currentPlayerId && pid === meId;

  return (
    <main className="page">
      <h1>Mesa {state.status === 'FINISHED' ? '(terminada)' : ''}</h1>
      <p>
        Turno de: <strong>{nameOf(state, state.currentPlayerId)}</strong> · Mazo:{' '}
        {state.deckRemaining}
      </p>

      <label>
        Jugar como:{' '}
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
        <button disabled={busy} onClick={() => id && meId && act(() => api.draw(id, meId))}>
          Sacar carta
        </button>
        <button disabled={busy} onClick={() => id && meId && act(() => api.stand(id, meId))}>
          Plantarse
        </button>
        <button disabled={busy} onClick={() => id && meId && act(() => api.stash(id, meId))}>
          Guardar pelusas
        </button>
        <label>
          Robar valor:
          <input
            type="number"
            min={1}
            max={10}
            value={stealValue}
            onChange={(e) => setStealValue(Number(e.target.value))}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => id && meId && act(() => api.steal(id, meId, stealValue))}
        >
          Robar
        </button>
      </div>
      {error && <p className="error">{friendlyMessage(error)}</p>}

      <section>
        {state.players.map((p) => (
          <article key={p.id}>
            <h2>
              {p.name} {isMe(p.id) ? '(tu turno)' : ''} — puntos: {state.stashed[p.id]?.sum ?? 0}
            </h2>
            <p>Frente: {grouped(state.fronts[p.id] ?? [])}</p>
          </article>
        ))}
      </section>

      {state.status === 'FINISHED' && state.result && (
        <section>
          <h2>Resultado</h2>
          {state.result.tie ? (
            <p>Empate.</p>
          ) : (
            <p>Ganador: {nameOf(state, state.result.winnerId)}</p>
          )}
          <ol>
            {state.result.scores.map((s) => (
              <li key={s.playerId}>
                {s.name}: {s.sum}
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

function grouped(values: number[]): string {
  if (values.length === 0) return '—';
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([v, n]) => (n > 1 ? `${n}×${v}` : `${v}`))
    .join(' ');
}
