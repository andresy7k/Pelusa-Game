import { ApiException, type ApiError, type GameState, type JoinResult } from './types';

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
  /** Crear partida; con `start` vuelve ya iniciada (un request en vez de dos). */
  create(names: string[], firstPlayerIndex: number | null, start = false): Promise<GameState> {
    return request<GameState>('/api/games', {
      method: 'POST',
      body: JSON.stringify({ names, firstPlayerIndex, start }),
    });
  },
  /** Abrir sala online: devuelve el código y mi playerId (host). */
  createOnline(name: string, capacity: number): Promise<JoinResult> {
    return request<JoinResult>('/api/games/online', {
      method: 'POST',
      body: JSON.stringify({ name, capacity }),
    });
  },
  /** Entrar por código: jugador nuevo o espectador si ya empezó. */
  join(code: string, name: string): Promise<JoinResult> {
    return request<JoinResult>('/api/games/join', {
      method: 'POST',
      body: JSON.stringify({ code, name }),
    });
  },
  /** Hotseat: cuerpo {}. Online: el playerId prueba quién pide empezar. */
  start(id: string, playerId?: string): Promise<GameState> {
    return request<GameState>(`/api/games/${id}/start`, {
      method: 'POST',
      body: JSON.stringify(playerId ? { playerId } : {}),
    });
  },
  /** Keep-alive de Render Free: no toca la BD. */
  async ping(): Promise<void> {
    await fetch(`${BASE}/api/ping`);
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
  /** Histórico: sin filtro, por jugador (nombre parcial) o por día en que terminó (AAAA-MM-DD). */
  history(
    filter: { player?: string; date?: string } = {},
    page = 0,
    size = 20,
  ): Promise<{ content: GameState[]; totalElements: number }> {
    // URLSearchParams codifica espacios y tildes ("Andrés" → Andr%C3%A9s).
    const q = new URLSearchParams({ page: String(page), size: String(size) });
    if (filter.player) q.set('player', filter.player);
    if (filter.date) q.set('date', filter.date);
    return request(`/api/games/history?${q}`);
  },
};

export function newKey(): string {
  return crypto.randomUUID();
}
