import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { GameState } from '../api/types';

// Histórico: el backend devuelve la partida completa ya terminada (fechas,
// jugadores, puntos y conteo por valor). Aquí solo se presenta.
export function History() {
  const [items, setItems] = useState<GameState[]>([]);

  useEffect(() => {
    api.history().then((p) => setItems(p.content)).catch(() => setItems([]));
  }, []);

  return (
    <main className="page narrow">
      <p className="kicker">Archivo</p>
      <h1>Juegos anteriores</h1>
      {items.length === 0 && <p>Todavía no hay partidas terminadas en esta mesa.</p>}
      <ul className="history-list">
        {items.map((g) => (
          <li key={g.id} className="panel" data-testid="history-item">
            <Link to={`/game/${g.id}`}>Mesa {g.id.slice(0, 8)}</Link>
            <span>
              {' '}
              — {g.result?.tie ? 'empate' : g.result?.winnerId ? `ganó ${nameOf(g, g.result.winnerId)}` : '—'}
              {g.finishedAt && ` · ${new Date(g.finishedAt).toLocaleString()}`}
            </span>
            <ol>
              {g.result?.scores.map((s) => (
                <li key={s.playerId}>
                  <strong>{s.name}</strong> — {s.sum} pts · {countsLabel(s.countsByValue)}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </main>
  );
}

function nameOf(g: GameState, id: string | null): string {
  return g.players.find((p) => p.id === id)?.name ?? id ?? '—';
}

// "2×1, 1×7": cartas acumuladas por valor (es lo que decide el desempate).
function countsLabel(counts: Record<number, number>): string {
  const parts = Object.entries(counts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([v, n]) => `${n}×${v}`);
  return parts.length ? parts.join(', ') : 'sin cartas';
}
