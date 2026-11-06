import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { GameState } from '../api/types';
import { ApiException } from '../api/types';

// Hook de estado del servidor: la única fuente es GET /api/games/{id}.
// Después de cada mutación se reemplaza el estado con lo que el backend
// devuelve (reconciliación, nunca predicción local de reglas).
//
// `initial`: el estado que ya trajo la pantalla anterior (crear/iniciar). Si
// llega, el tablero se pinta al instante y no repite el GET al montarse.
export function useGame(id: string | undefined, initial?: GameState) {
  const seeded = initial && initial.id === id ? initial : null;
  const [state, setState] = useState<GameState | null>(seeded);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Cada mutación sube este contador. Un sondeo que salió ANTES de la mutación
  // y vuelve DESPUÉS traería un estado viejo: se descarta en vez de pisar el nuevo.
  const mutations = useRef(0);

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
    if (!seeded) void refresh();
    // Solo al cambiar de partida; `seeded` es el estado inicial de esta misma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // Solo las salas ONLINE cambian por otros jugadores, así que solo ahí se sondea.
  // En hotseat todo pasa en este dispositivo y cada acción ya trae el estado:
  // sondear sería tráfico (y consultas a la BD) sin ninguna información nueva.
  // Cada minuto, un ping sin BD para que Render Free no duerma la instancia.
  const online = state?.mode === 'ONLINE';
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let polling = false;
    const tick = () => {
      if (!online || document.hidden || polling) return;
      polling = true;
      const seq = mutations.current;
      api
        .state(id)
        .then((next) => {
          if (alive && seq === mutations.current) setState(next);
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
  }, [id, online]);

  async function act(fn: () => Promise<GameState>): Promise<GameState | null> {
    mutations.current += 1;
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
