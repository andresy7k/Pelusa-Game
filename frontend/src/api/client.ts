import { ApiException, type ApiError, type GameState } from './types';

// Cliente tipado del contrato. Decisiones:
// - fetch nativo (sin axios): menos dependencias para Phase 5.
// - Idempotency-Key con crypto.randomUUID por intención ("sacar carta"):
//   si el usuario hace doble click o reintenta, el backend no duplica.
// - Los errores 4xx se traducen a ApiException con errorCode; la UI los
//   muestra con friendlyMessage, jamás decide reglas por su cuenta.

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit, key?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['Idempotency-Key'] = key;
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) {
    let body: { errorCode?: string; detail?: string; requestId?: string } = {};
    try {
      body = await res.json();
    } catch {
      // cuerpo no-JSON (ej. 404 de ruta): mensaje genérico
    }
    const err: ApiError = {
      status: res.status,
      errorCode: body.errorCode ?? 'UNKNOWN',
      detail: body.detail ?? `HTTP ${res.status}`,
      requestId: body.requestId,
    };
    throw new ApiException(err);
  }
  return (await res.json()) as T;
}

export const api = {
  create(names: string[], firstPlayerIndex: number | null): Promise<GameState> {
    return request<GameState>('/api/games', {
      method: 'POST',
      body: JSON.stringify({ names, firstPlayerIndex }),
    });
  },
  start(id: string): Promise<GameState> {
    return request<GameState>(`/api/games/${id}/start`, { method: 'POST' });
  },
  state(id: string): Promise<GameState> {
    return request<GameState>(`/api/games/${id}`);
  },
  stash(id: string, playerId: string, key = newKey()): Promise<GameState> {
    return request<GameState>(`/api/games/${id}/stash`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }, key);
  },
  draw(id: string, playerId: string, key = newKey()): Promise<GameState> {
    return request<GameState>(`/api/games/${id}/draw`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }, key);
  },
  stand(id: string, playerId: string, key = newKey()): Promise<GameState> {
    return request<GameState>(`/api/games/${id}/stand`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }, key);
  },
  steal(id: string, playerId: string, value: number, key = newKey()): Promise<GameState> {
    return request<GameState>(`/api/games/${id}/steal`, {
      method: 'POST',
      body: JSON.stringify({ playerId, value }),
    }, key);
  },
  result(id: string): Promise<GameState> {
    return request<GameState>(`/api/games/${id}/result`);
  },
  history(page = 0, size = 20): Promise<{ content: GameState[]; totalElements: number }> {
    return request(`/api/games/history?page=${page}&size=${size}`);
  },
};

export function newKey(): string {
  return crypto.randomUUID();
}
