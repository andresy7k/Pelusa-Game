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
