package com.pelusa.domain.policy;

import com.pelusa.domain.model.Card;
import java.util.List;

/**
 * Regla de pérdida R-02: bust ⟺ el valor recién sacado YA estaba en mi frente
 * Y mi frente tiene 3 o más cartas (evaluado DESPUÉS de colocar la carta).
 * Con menos de 3, aunque repita, se sigue jugando.
 *
 * <p>Como la carta ya está colocada, "repetido" ⟺ el valor aparece 2+ veces.
 */
public final class BustPolicy {
  private BustPolicy() {}

  public static boolean isBust(List<Card> frontIncludingDrawn, Card drawn) {
    if (frontIncludingDrawn.size() < 3) {
      return false;
    }
    long sameValue = frontIncludingDrawn.stream().filter(c -> c.value() == drawn.value()).count();
    return sameValue >= 2;
  }
}
