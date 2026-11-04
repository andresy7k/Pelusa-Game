import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { GameState } from '../api/types';

type Filter = 'player' | 'date';

// Histórico: el backend devuelve la partida completa ya terminada (fechas,
// jugadores, puntos y conteo por valor) y hace el filtrado. Aquí solo se presenta.
export function History() {
  const [items, setItems] = useState<GameState[]>([]);
  const [filter, setFilter] = useState<Filter>('player');
  const [player, setPlayer] = useState('');
  const [date, setDate] = useState('');

  // Busca mientras escribís: espera 300 ms desde la última tecla para no mandar
  // un pedido por letra. `alive` descarta respuestas viejas que lleguen tarde.
  useEffect(() => {
    let alive = true;
    const query = filter === 'player' ? { player: player.trim() } : { date };
    const timer = window.setTimeout(
      () => {
        api
          .history(query)
          .then((p) => alive && setItems(p.content))
          .catch(() => alive && setItems([]));
      },
      filter === 'player' ? 300 : 0,
    );
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [filter, player, date]);

  const filtering = filter === 'player' ? player.trim() !== '' : date !== '';

  return (
    <main className="page narrow">
      <p className="kicker">Archivo</p>
      <h1>Juegos anteriores</h1>

      <div className="mode-tabs" role="tablist" aria-label="Filtrar historial">
        <button type="button" role="tab" className="ghost" aria-selected={filter === 'player'}
          onClick={() => setFilter('player')}>
          Por jugador
        </button>
        <button type="button" role="tab" className="ghost" aria-selected={filter === 'date'}
          onClick={() => setFilter('date')}>
          Por fecha
        </button>
      </div>
      {filter === 'player' ? (
        <label>
          Jugador
          <input value={player} onChange={(e) => setPlayer(e.target.value)}
            placeholder="Ej: Andrés" maxLength={60} />
        </label>
      ) : (
        <label>
          Día en que terminó
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}

      {items.length === 0 && (
        <p>
          {filtering
            ? 'No hay partidas que coincidan con el filtro.'
            : 'Todavía no hay partidas terminadas en esta mesa.'}
        </p>
      )}
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
