package com.pelusa.infrastructure.shuffle;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.port.ShufflePort;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Aleatoriedad real de producción. Los tests usan seed fijo (ver domain tests).
 */
@Component
public class RandomShuffleAdapter implements ShufflePort {
  private final SecureRandom random = new SecureRandom();

  @Override
  public void shuffle(List<Card> cards) {
    Collections.shuffle(cards, random);
  }
}
