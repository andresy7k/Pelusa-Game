package com.pelusa.infrastructure.shuffle;

import static org.assertj.core.api.Assertions.assertThat;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.service.DeckFactory;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * El adaptador de producción (SecureRandom) sí baraja. Que salga en el mismo
 * orden que el mazo ordenado tiene probabilidad 1/110! (en la práctica, nunca);
 * por eso el test es determinista aunque la entrada sea aleatoria.
 */
class RandomShuffleAdapterTest {

  @Test
  void shuffleChangesOrderButKeepsTheCards() {
    List<Card> ordered = DeckFactory.orderedDeck();
    List<Card> deck = new ArrayList<>(ordered);

    new RandomShuffleAdapter().shuffle(deck);

    assertThat(deck).isNotEqualTo(ordered);
    assertThat(deck).containsExactlyInAnyOrderElementsOf(ordered);
  }
}
