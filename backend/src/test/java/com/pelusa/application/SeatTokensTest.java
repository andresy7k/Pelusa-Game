package com.pelusa.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class SeatTokensTest {

  @Test
  void issuedTokensAreLongUrlSafeAndUnique() {
    Set<String> seen = new HashSet<>();
    for (int i = 0; i < 200; i++) {
      String t = SeatTokens.issue();
      assertThat(t).hasSize(43).matches("[A-Za-z0-9_-]+"); // 32 bytes en base64url sin '='
      assertThat(seen.add(t)).as("repetido").isTrue();
    }
  }

  @Test
  void hashIsDeterministicSha256Hex() {
    // SHA-256("abc") es un vector de prueba conocido.
    assertThat(SeatTokens.hash("abc"))
        .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  }

  @Test
  void matchesOnlyTheRightToken() {
    String token = SeatTokens.issue();
    String stored = SeatTokens.hash(token);
    assertThat(SeatTokens.matches(token, stored)).isTrue();
    assertThat(SeatTokens.matches(SeatTokens.issue(), stored)).isFalse();
    assertThat(SeatTokens.matches(null, stored)).isFalse();
    assertThat(SeatTokens.matches("  ", stored)).isFalse();
  }

  @Test
  void unknownAlgorithmIsAnExplicitError() {
    assertThatThrownBy(() -> SeatTokens.digest("NO-EXISTE"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("NO-EXISTE");
  }
}
