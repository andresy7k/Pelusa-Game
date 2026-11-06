package com.pelusa.domain.port;

/**
 * Puerto del sorteo de quién empieza. Igual que {@link ShufflePort}: el dominio
 * no usa Random directo, así las pruebas fijan el resultado y son deterministas.
 */
public interface StarterPort {
  /** Asiento (0..playerCount-1) del jugador que abre la partida. */
  int pick(int playerCount);
}
