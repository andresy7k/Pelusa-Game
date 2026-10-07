package com.pelusa.domain.policy;

import com.pelusa.domain.model.Card;
import java.util.List;

/**
 * Regla de robo R-01/ADR-011: solo en mi turno. Devuelve las cartas del
 * frente ajeno que coinciden con el valor pedido (el engine las mueve a mi
 * frente; si no hay ninguna, el engine responde 422 NO_STEALABLE_CARDS).
 */
public final class StealPolicy {
  private StealPolicy() {}

  public static List<Card> stealable(List<Card> victimFront, int value) {
    return victimFront.stream().filter(c -> c.value() == value).toList();
  }
}
