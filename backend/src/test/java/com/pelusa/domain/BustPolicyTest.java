package com.pelusa.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.policy.BustPolicy;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Tabla de verdad 2x2 de R-02: bust ⟺ repetido && frente>=3 (post-colocación).
 */
class BustPolicyTest {

  static Stream<Arguments> truthTable() {
    return Stream.of(
        Arguments.of(List.of(new Card(4), new Card(4)), new Card(4), false, "repite pero <3 → sigue"),
        Arguments.of(List.of(new Card(4), new Card(5)), new Card(5), false, "no repite y <3 → sigue"),
        Arguments.of(List.of(new Card(4), new Card(5), new Card(4)), new Card(4), true, "repite y 3 → bust"),
        Arguments.of(
            List.of(new Card(4), new Card(5), new Card(6), new Card(7)), new Card(7), false, "4 cartas sin repetir → sigue"),
        Arguments.of(
            List.of(new Card(2), new Card(2), new Card(2)), new Card(2), true, "triple con 3 → bust"));
  }

  @ParameterizedTest(name = "{3}")
  @MethodSource("truthTable")
  void bustTruthTable(List<Card> front, Card drawn, boolean expectedBust, String ignored) {
    assertThat(BustPolicy.isBust(front, drawn)).isEqualTo(expectedBust);
  }

  @Test
  void boundaryExactlyThreeWithRepeatIsBust() {
    assertThat(BustPolicy.isBust(List.of(new Card(1), new Card(9), new Card(1)), new Card(1))).isTrue();
  }
}
