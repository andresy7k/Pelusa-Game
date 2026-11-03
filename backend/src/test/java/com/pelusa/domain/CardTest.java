package com.pelusa.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.pelusa.domain.model.Card;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** La carta solo existe con valores 1-10: los bordes son los que importan. */
class CardTest {

  @ParameterizedTest
  @ValueSource(ints = {1, 10})
  void acceptsBoundaryValues(int value) {
    assertThat(new Card(value).value()).isEqualTo(value);
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 11, -3})
  void rejectsValuesOutsideOneToTen(int value) {
    assertThatThrownBy(() -> new Card(value))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining(String.valueOf(value));
  }
}
