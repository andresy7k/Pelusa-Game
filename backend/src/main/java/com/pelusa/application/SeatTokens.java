package com.pelusa.application;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Tokens de asiento: la prueba de que este dispositivo puede jugar por un
 * jugador (ONLINE) o por la partida entera (LOCAL).
 *
 * <ul>
 *   <li>{@link #issue()}: 32 bytes de SecureRandom (256 bits) en base64url. Imposible de adivinar.</li>
 *   <li>{@link #hash(String)}: SHA-256 en hex. La BD guarda solo esto, nunca el token.</li>
 *   <li>{@link #matches(String, String)}: compara en tiempo constante, para no filtrar
 *       por cuánto tarda en fallar cuántos caracteres coinciden.</li>
 * </ul>
 */
public final class SeatTokens {
  private SeatTokens() {}

  private static final SecureRandom RANDOM = new SecureRandom();

  public static String issue() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  public static String hash(String token) {
    byte[] digest = digest("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
    return HexFormat.of().formatHex(digest);
  }

  /** ¿Este token corresponde al hash guardado? Sin token, nunca. */
  public static boolean matches(String token, String expectedHash) {
    if (token == null || token.isBlank()) {
      return false;
    }
    return MessageDigest.isEqual(
        hash(token).getBytes(StandardCharsets.US_ASCII),
        expectedHash.getBytes(StandardCharsets.US_ASCII));
  }

  /** SHA-256 existe en toda JVM; el catch solo protege de una JVM rota. */
  static MessageDigest digest(String algorithm) {
    try {
      return MessageDigest.getInstance(algorithm);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("Algoritmo no disponible: " + algorithm, e);
    }
  }
}
