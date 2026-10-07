package com.pelusa.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.policy.StealPolicy;
import java.util.List;
import org.junit.jupiter.api.Test;

class StealPolicyTest {

  @Test
  void takesAllCardsOfRequestedValue() {
    List<Card> victim = List.of(new Card(4), new Card(7), new Card(4));
    assertThat(StealPolicy.stealable(victim, 4)).containsExactly(new Card(4), new Card(4));
  }

  @Test
  void returnsEmptyWhenValueAbsent() {
    assertThat(StealPolicy.stealable(List.of(new Card(4), new Card(7)), 9)).isEmpty();
  }

  @Test
  void leavesOtherValuesAlone() {
    List<Card> victim = List.of(new Card(4), new Card(7));
    assertThat(StealPolicy.stealable(victim, 7)).containsExactly(new Card(7));
    assertThat(victim).hasSize(2); // no muta: el engine mueve
  }
}
