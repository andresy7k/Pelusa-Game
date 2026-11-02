// Identidad online por dispositivo: el backend no tiene login, así que cada
// navegador recuerda en qué sala entró y con qué jugador. Se guarda por id de
// partida (no una sola global): podés estar en varias mesas sin pisarte.
const PREFIX = 'pelusa.identity.';

export interface Identity {
  playerId: string;
  name: string;
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
    return parsed.playerId ? { playerId: parsed.playerId, name: parsed.name ?? '' } : null;
  } catch {
    return null;
  }
}
