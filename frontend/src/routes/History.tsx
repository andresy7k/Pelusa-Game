import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { GameState } from '../api/types';

export function History() {
  const [items, setItems] = useState<GameState[]>([]);

  useEffect(() => {
    api.history().then((p) => setItems(p.content)).catch(() => setItems([]));
  }, []);

  return (
    <main className="page narrow">
      <p className="kicker">Archivo</p>
      <h1>Noches anteriores</h1>
      {items.length === 0 && <p>Todavía no hay partidas terminadas en esta mesa.</p>}
      <ul className="history-list">
        {items.map((g) => (
          <li key={g.id} className="panel">
            <Link to={`/game/${g.id}`}>Mesa {g.id.slice(0, 8)}</Link>
            <span>
              {' '}
              — {g.result?.winnerId ? `ganó ${nameOf(g, g.result.winnerId)}` : g.result?.tie ? 'empate' : '—'}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

function nameOf(g: GameState, id: string | null): string {
  return g.players.find((p) => p.id === id)?.name ?? id ?? '—';
}
