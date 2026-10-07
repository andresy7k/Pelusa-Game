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
    <main className="page">
      <h1>Historial</h1>
      {items.length === 0 && <p>Sin partidas terminadas.</p>}
      <ul>
        {items.map((g) => (
          <li key={g.id}>
            <Link to={`/game/${g.id}`}>{g.id.slice(0, 8)}</Link> — ganador:{' '}
            {g.result?.winnerId ? nameOf(g, g.result.winnerId) : g.result?.tie ? 'empate' : '—'}
          </li>
        ))}
      </ul>
    </main>
  );
}

function nameOf(g: GameState, id: string | null): string {
  return g.players.find((p) => p.id === id)?.name ?? id ?? '—';
}
