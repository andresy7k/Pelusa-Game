package com.pelusa.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.policy.StashPolicy;
import java.util.List;
import org.junit.jupiter.api.Test;

class StashPolicyTest {

  @Test
  void canStashAtTurnStartWithFront() {
    assertThat(StashPolicy.canStash(false, false, List.of(new Card(3)))).isTrue();
  }

  @Test
  void cannotStashAfterActing() {
    assertThat(StashPolicy.canStash(true, false, List.of(new Card(3)))).isFalse();
  }

  @Test
  void cannotStashTwice() {
    assertThat(StashPolicy.canStash(false, true, List.of(new Card(3)))).isFalse();
  }

  @Test
  void cannotStashEmptyFront() {
    assertThat(StashPolicy.canStash(false, false, List.of())).isFalse();
  }
}
