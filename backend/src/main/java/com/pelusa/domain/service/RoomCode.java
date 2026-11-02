package com.pelusa.domain.service;

import java.security.SecureRandom;

/**
 * Fábrica de códigos de sala: 6 caracteres sin 0/O/1/I/L.
 * El código es una LLAVE, no un número de orden: si fuera secuencial
 * (A001, A002...) cualquiera podría adivinar la mesa recién creada.
 * SecureRandom es el mismo criterio que RandomShuffleAdapter usa para barajar;
 * Math.random() es una secuencia predecible y no sirve como llave.
 */
public final class RoomCode {
  private RoomCode() {}

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final String ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  /** Código de 6 caracteres al azar. La unicidad real la impone la BD (uq_games_code). */
  public static String generate() {
    StringBuilder sb = new StringBuilder(6);
    for (int i = 0; i < 6; i++) {
      sb.append(ALFABETO.charAt(RANDOM.nextInt(ALFABETO.length())));
    }
    return sb.toString();
  }
}
