package com.pelusa;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Phase 2: el contexto levanta, Flyway aplica V1 sobre H2 y el health de DB existe.
 * Las reglas se prueban en Phase 3 (dominio puro, sin Spring).
 */
@SpringBootTest
@ActiveProfiles("test")
class PelusaApplicationTests {
  @Test
  void contextLoads() {}
}
