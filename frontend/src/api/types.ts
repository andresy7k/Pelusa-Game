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
  /** Dueño del lobby en salas ONLINE; null en hotseat (LOCAL). */
  hostPlayerId: string | null;
  /** Código de invitación de la sala; null en hotseat. */
  code: string | null;
  mode: 'LOCAL' | 'ONLINE';
  capacity: number;
  deckRemaining: number;
  /** R-01/ADR-014: valor robable este turno (última carta sacada); null si no sacó. */
  lastDrawnValue: number | null;
  /** Plazo ISO-8601 del turno ONLINE; null en hotseat o sin turno abierto. */
  turnDeadlineAt: string | null;
  players: PlayerView[];
  fronts: Record<string, number[]>;
  stashed: Record<string, StashView>;
  lastEvent: Record<string, unknown> | null;
  result: ResultView | null;
}

/** Respuesta de crear/unirse: el tablero + quién sos en esa sala. */
export interface JoinResult {
  game: GameState;
  /** null cuando se entra como ESPECTADOR (la partida ya empezó). */
  playerId: string | null;
  spectator: boolean;
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
    case 'DECK_EMPTY':
      return 'No quedan cartas en el mazo.';
    case 'NO_STASHABLE_CARDS':
      return 'No tenés cartas para guardar ahora.';
    case 'NO_STEALABLE_CARDS':
      return 'Nadie tiene ese valor boca arriba.';
    case 'STEAL_VALUE_MISMATCH':
      return 'Solo puedes robar el valor de la última carta que sacaste.';
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
    case 'CODE_NOT_FOUND':
      return 'Ese código no existe. Revisalo.';
    case 'GAME_FULL':
      return 'La sala está llena.';
    case 'NAME_TAKEN':
      return 'Ese nombre ya está en la mesa. Probá otro.';
    case 'NOT_HOST':
      return 'Solo el anfitrión puede empezar la partida.';
    case 'NOT_ENOUGH_PLAYERS':
      return 'Faltan jugadores: se necesitan al menos 2.';
    case 'CODE_COLLISION':
      return 'No pudimos generar el código, probá de nuevo.';
    case 'TURN_EXPIRED':
      return 'Se te acabó el tiempo del turno.';
    case 'INTERNAL':
      return 'Error del servidor, probá de nuevo.';
    default:
      return 'Algo salió mal, probá de nuevo.';
  }
}
