package com.pelusa.domain.service;

import com.pelusa.domain.model.Card;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Puntuación R-03/ADR-013: puntos = suma de guardadas. Gana la mayor suma;
 * desempate lexicográfico contando 1s, luego 2s, ... hasta 10s.
 * Si todo empata, es empate (compare == 0).
 */
public final class ScoringService {
  private ScoringService() {}

  /** Suma + conteo por valor de las cartas guardadas de un jugador. */
  public static Score score(List<Card> stashed) {
    Map<Integer, Long> counts = new HashMap<>();
    int sum = 0;
    for (Card c : stashed) {
      sum += c.value();
      counts.merge(c.value(), 1L, Long::sum);
    }
    return new Score(sum, Map.copyOf(counts));
  }

  /**
   * Compara dos puntuaciones. Positivo si a es mejor, negativo si b es mejor,
   * 0 si empatan en todo (empate declarado).
   */
  public static int compare(Score a, Score b) {
    if (a.sum() != b.sum()) {
      return Integer.compare(a.sum(), b.sum());
    }
    for (int value = 1; value <= 10; value++) {
      long ca = a.countsByValue().getOrDefault(value, 0L);
      long cb = b.countsByValue().getOrDefault(value, 0L);
      if (ca != cb) {
        return Long.compare(ca, cb);
      }
    }
    return 0;
  }

  public record Score(int sum, Map<Integer, Long> countsByValue) {}
}
