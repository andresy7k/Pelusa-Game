package com.pelusa.domain.service;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.port.ShufflePort;
import java.util.ArrayList;
import java.util.List;

/**
 * Construye el mazo de 110 exactas: 13 por cada valor 1-5 (65) y 9 por cada
 * valor 6-10 (45). Invariante I-01: si alguien cambia un 13 por un 12,
 * DeckFactoryTest falla.
 */
public final class DeckFactory {
  private DeckFactory() {}

  /** Mazo ordenado (para tests y para contar la composición). */
  public static List<Card> orderedDeck() {
    List<Card> deck = new ArrayList<>(110);
    for (int value = 1; value <= 5; value++) {
      for (int i = 0; i < 13; i++) {
        deck.add(new Card(value));
      }
    }
    for (int value = 6; value <= 10; value++) {
      for (int i = 0; i < 9; i++) {
        deck.add(new Card(value));
      }
    }
    return deck;
  }

  /** Mazo barajado con el puerto inyectado (prod: SecureRandom, tests: seed fijo). */
  public static List<Card> shuffledDeck(ShufflePort shuffle) {
    List<Card> deck = orderedDeck();
    shuffle.shuffle(deck);
    return deck;
  }
}
