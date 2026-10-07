package com.pelusa.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.port.ShufflePort;
import com.pelusa.domain.service.DeckFactory;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class DeckFactoryTest {

  @Test
  void deckHasExactly110Cards() {
    assertThat(DeckFactory.orderedDeck()).hasSize(110);
  }

  @Test
  void lowValuesHave13CopiesAndHighValuesHave9() {
    Map<Integer, Long> counts =
        DeckFactory.orderedDeck().stream().collect(Collectors.groupingBy(Card::value, Collectors.counting()));
    for (int v = 1; v <= 5; v++) {
      assertThat(counts.get(v)).as("valor %d", v).isEqualTo(13L);
    }
    for (int v = 6; v <= 10; v++) {
      assertThat(counts.get(v)).as("valor %d", v).isEqualTo(9L);
    }
  }

  @Test
  void shuffledDeckKeepsSameMultiset() {
    List<Integer> ordered =
        DeckFactory.orderedDeck().stream().map(Card::value).sorted().toList();
    List<Integer> shuffled =
        DeckFactory.shuffledDeck(cards -> Collections2Shuffle(cards, 9L)).stream()
            .map(Card::value)
            .sorted()
            .toList();
    assertThat(shuffled).isEqualTo(ordered);
  }

  @Test
  void shuffledDeckIsDeterministicWithSameSeed() {
    ShufflePort seed7a = cards -> Collections2Shuffle(cards, 7L);
    ShufflePort seed7b = cards -> Collections2Shuffle(cards, 7L);
    assertThat(DeckFactory.shuffledDeck(seed7a)).isEqualTo(DeckFactory.shuffledDeck(seed7b));
  }

  @Test
  void shuffledDeckKeepsComposition() {
    List<Card> shuffled = DeckFactory.shuffledDeck(cards -> Collections2Shuffle(cards, 3L));
    Map<Integer, Long> counts =
        shuffled.stream().collect(Collectors.groupingBy(Card::value, Collectors.counting()));
    assertThat(shuffled).hasSize(110);
    assertThat(counts.get(1)).isEqualTo(13L);
    assertThat(counts.get(10)).isEqualTo(9L);
  }

  private static void Collections2Shuffle(List<Card> cards, long seed) {
    java.util.Collections.shuffle(cards, new Random(seed));
  }
}
