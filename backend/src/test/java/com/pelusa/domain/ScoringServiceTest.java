package com.pelusa.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.service.ScoringService;
import com.pelusa.domain.service.ScoringService.Score;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * R-03: gana la mayor suma; desempate lexicográfico 1→10.
 */
class ScoringServiceTest {

  private static List<Card> cards(int... values) {
    return java.util.Arrays.stream(values).mapToObj(Card::new).toList();
  }

  @Test
  void higherSumWins() {
    Score a = ScoringService.score(cards(5, 5));
    Score b = ScoringService.score(cards(3, 3));
    assertThat(ScoringService.compare(a, b)).isPositive();
    assertThat(ScoringService.compare(b, a)).isNegative();
  }

  @Test
  void tiebreakPrefersMoreOnes() {
    // 13 pts vs 13 pts: A tiene tres 1s, B ninguno → gana A
    Score a = ScoringService.score(cards(1, 1, 1, 10));
    Score b = ScoringService.score(cards(5, 5, 3));
    assertThat(a.sum()).isEqualTo(b.sum());
    assertThat(ScoringService.compare(a, b)).isPositive();
  }

  @Test
  void tiebreakWalksUpValues() {
    // Empate en suma y en 1s: deciden los 2s
    Score a = ScoringService.score(cards(1, 2, 2, 8)); // 13
    Score b = ScoringService.score(cards(1, 3, 9)); // 13
    assertThat(ScoringService.compare(a, b)).isPositive();
  }

  @Test
  void fullTieIsZero() {
    Score a = ScoringService.score(cards(1, 4, 6));
    Score b = ScoringService.score(cards(6, 4, 1));
    assertThat(ScoringService.compare(a, b)).isZero();
  }

  @Test
  void scoreExposesSumAndCounts() {
    Score s = ScoringService.score(cards(4, 4, 7));
    assertThat(s.sum()).isEqualTo(15);
    assertThat(s.countsByValue()).containsEntry(4, 2L).containsEntry(7, 1L);
  }
}
