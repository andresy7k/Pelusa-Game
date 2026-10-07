package com.pelusa.domain.port;

import com.pelusa.domain.model.Card;
import java.util.List;

/**
 * Puerto de aleatoriedad. El dominio NO usa Random/SecureRandom directo:
 * así los tests inyectan un seed fijo y son deterministas.
 */
public interface ShufflePort {
  void shuffle(List<Card> cards);
}
