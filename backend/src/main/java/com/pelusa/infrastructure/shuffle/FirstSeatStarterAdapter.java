package com.pelusa.infrastructure.shuffle;

import com.pelusa.domain.port.StarterPort;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Perfiles test y e2e: siempre empieza el asiento 0. Las pruebas (JUnit y
 * Playwright) necesitan saber de antemano quién juega primero.
 */
@Component
@Profile({"test", "e2e"})
public class FirstSeatStarterAdapter implements StarterPort {
  @Override
  public int pick(int playerCount) {
    return 0;
  }
}
