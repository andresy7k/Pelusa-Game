package com.pelusa.infrastructure.shuffle;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * El sorteo real cae siempre en un asiento válido y, en muchas tiradas, sale
 * cada asiento. Con 4 asientos y 400 tiradas, que uno no salga nunca tiene
 * probabilidad (3/4)^400 ≈ 10^-50: en la práctica, imposible (no es frágil).
 */
class RandomStarterAdapterTest {

  @Test
  void picksEverySeatAndNeverOutOfRange() {
    RandomStarterAdapter starter = new RandomStarterAdapter();
    Set<Integer> seen = new HashSet<>();
    for (int i = 0; i < 400; i++) {
      int seat = starter.pick(4);
      assertThat(seat).isBetween(0, 3);
      seen.add(seat);
    }
    assertThat(seen).containsExactlyInAnyOrder(0, 1, 2, 3);
  }
}
