import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { GameState } from '../api/types';
import { ApiException } from '../api/types';

// Hook de estado del servidor: la única fuente es GET /api/games/{id}.
// Después de cada mutación se reemplaza el estado con lo que el backend
// devuelve (reconciliación, nunca predicción local de reglas).
export function useGame(id: string | undefined) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setState(await api.state(id));
    } catch (e) {
      setError(e instanceof ApiException ? e.apiError.errorCode : 'UNKNOWN');
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Salas ONLINE: el estado cambia por otros jugadores, así que se sondea.
  // (En hotseat es un request barato cada 2.5 s; con la pestaña oculta, nada.)
  // Cada minuto, un ping sin BD para que Render Free no duerma la instancia.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let polling = false;
    const tick = () => {
      if (document.hidden || polling) return;
      polling = true;
      api
        .state(id)
        .then((next) => {
          if (alive) setState(next);
        })
        .catch(() => {
          // Un fallo de red transitorio no debe borrar la mesa en pantalla.
        })
        .finally(() => {
          polling = false;
        });
    };
    const poll = window.setInterval(tick, 2500);
    const keepAlive = window.setInterval(() => {
      if (!document.hidden) void api.ping();
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      window.clearInterval(keepAlive);
    };
  }, [id]);

  async function act(fn: () => Promise<GameState>): Promise<GameState | null> {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setState(next);
      return next;
    } catch (e) {
      setError(e instanceof ApiException ? e.apiError.errorCode : 'UNKNOWN');
      // 409 de concurrencia: releer para mostrar lo último
      if (e instanceof ApiException && e.apiError.errorCode === 'CONCURRENT_TURN') {
        await refresh();
      }
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { state, error, busy, refresh, act, setState };
}
