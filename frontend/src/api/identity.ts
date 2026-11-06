// Identidad por dispositivo: el backend no tiene login, así que cada navegador
// recuerda en qué sala entró, con qué jugador y su TOKEN de asiento. Se guarda
// por id de partida (no una sola global): podés estar en varias mesas sin pisarte.
//
// Seguridad: el playerId es público (sale en el estado de la partida); lo que
// prueba que este dispositivo puede jugar es el token, que solo recibió él al
// crear (partida local) o al sentarse (sala online). Nunca se muestra en pantalla.
const PREFIX = 'pelusa.identity.';
const GAME_TOKEN_PREFIX = 'pelusa.gameToken.';

export interface Identity {
  playerId: string;
  name: string;
  token?: string;
}

export function remember(gameId: string, identity: Identity): void {
  try {
    localStorage.setItem(PREFIX + gameId, JSON.stringify(identity));
  } catch {
    // Modo privado / storage lleno: la sesión vive igual, solo no sobrevive al reload.
  }
}

export function recall(gameId: string): Identity | null {
  try {
    const raw = localStorage.getItem(PREFIX + gameId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    return parsed.playerId
      ? { playerId: parsed.playerId, name: parsed.name ?? '', token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

/** Token de una partida LOCAL (este dispositivo juega por todos los asientos). */
export function rememberGameToken(gameId: string, token: string): void {
  try {
    localStorage.setItem(GAME_TOKEN_PREFIX + gameId, token);
  } catch {
    // Sin storage: la partida sigue en esta pestaña mientras no se recargue.
  }
}

/** Token que este dispositivo tiene para la partida: el de su asiento online o el de la partida local. */
export function seatToken(gameId: string): string | null {
  const online = recall(gameId)?.token;
  if (online) return online;
  try {
    return localStorage.getItem(GAME_TOKEN_PREFIX + gameId);
  } catch {
    return null;
  }
}
