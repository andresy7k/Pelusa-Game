package com.pelusa.infrastructure.shuffle;

import com.pelusa.domain.port.StarterPort;
import java.security.SecureRandom;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Sorteo real de quién empieza (SecureRandom, el mismo criterio que el barajado).
 * En los perfiles de prueba lo reemplaza {@link FirstSeatStarterAdapter}.
 */
@Component
@Profile("!test & !e2e")
public class RandomStarterAdapter implements StarterPort {
  private final SecureRandom random = new SecureRandom();

  @Override
  public int pick(int playerCount) {
    return random.nextInt(playerCount);
  }
}
