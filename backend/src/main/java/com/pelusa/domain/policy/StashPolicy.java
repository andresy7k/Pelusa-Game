package com.pelusa.domain.policy;

import com.pelusa.domain.model.Card;
import java.util.List;

/**
 * Regla de guardado I-05: solo al inicio de mi turno (antes de sacar la
 * primera carta) y solo si tengo frente de turnos anteriores.
 */
public final class StashPolicy {
  private StashPolicy() {}

  public static boolean canStash(boolean actedThisTurn, boolean stashedThisTurn, List<Card> front) {
    return !actedThisTurn && !stashedThisTurn && !front.isEmpty();
  }
}
