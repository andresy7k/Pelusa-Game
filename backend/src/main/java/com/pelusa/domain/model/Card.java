package com.pelusa.domain.model;

/**
 * Carta del mazo. Solo importa su valor (1-10); el "palo" no existe en Pelusas.
 * Es un record: inmutable y con igualdad por valor (dos 4 son iguales).
 */
public record Card(int value) {
  public Card {
    if (value < 1 || value > 10) {
      throw new IllegalArgumentException("Card value debe estar entre 1 y 10, fue: " + value);
    }
  }
}
