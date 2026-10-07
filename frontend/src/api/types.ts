// Tipos espejo del contrato (API_CONTRACT): la UI renderiza GameState,
// nunca decide reglas. Si el backend cambia el contrato, esto no compila.

export interface PlayerView {
  id: string;
  name: string;
  seat: number;
}

export interface StashView {
  sum: number;
  countsByValue: Record<number, number>;
}

export interface ScoreView {
  playerId: string;
  name: string;
  sum: number;
  countsByValue: Record<number, number>;
}

export interface ResultView {
  winnerId: string | null;
  tie: boolean;
  reason: string;
  scores: ScoreView[];
}

export interface GameState {
  id: string;
  status: 'CREATED' | 'IN_PROGRESS' | 'FINISHED';
  currentPlayerId: string | null;
  dustRemaining: number;
  players: PlayerView[];
  fronts: Record<string, number[]>;
  stashed: Record<string, StashView>;
  lastEvent: Record<string, unknown> | null;
  result: ResultView | null;
}

/** Error canónico RFC7807 con errorCode de dominio. */
export interface ApiError {
  status: number;
  errorCode: string;
  detail: string;
  requestId?: string;
}

export class ApiException extends Error {
  readonly apiError: ApiError;
  constructor(apiError: ApiError) {
    super(apiError.detail);
    this.apiError = apiError;
  }
}

/** Mensajes humanos por errorCode (la UI traduce, no reinterpreta reglas). */
export function friendlyMessage(code: string): string {
  switch (code) {
    case 'NOT_YOUR_TURN':
      return 'Todavía no es tu turno, esperá.';
    case 'GAME_FINISHED':
      return 'La partida ya terminó.';
    case 'GAME_NOT_FOUND':
      return 'Esa partida no existe.';
    case 'DUST_PILE_EMPTY':
      return 'No quedan cartas en el polvo.';
    case 'NO_STASHABLE_CARDS':
      return 'No tenés cartas para guardar ahora.';
    case 'NO_STEALABLE_CARDS':
      return 'Nadie tiene ese valor boca arriba.';
    case 'ALREADY_STARTED':
      return 'La partida ya empezó.';
    case 'ALREADY_STASHED_THIS_TURN':
      return 'Ya guardaste en este turno.';
    case 'CONCURRENT_TURN':
      return 'Otro movimiento se adelantó, actualizando…';
    case 'VALIDATION_FAILED':
      return 'Revisá los datos ingresados.';
    case 'GAME_NOT_FINISHED':
      return 'La partida sigue en curso.';
    default:
      return 'Algo salió mal, probá de nuevo.';
  }
}
