package com.pelusa.domain.engine;

/**
 * Error de regla con código máquina-legible. Phase 4 lo mapea a RFC7807:
 * NOT_YOUR_TURN/CONCURRENT_TURN → 409, el resto de regla → 422.
 */
public class DomainException extends RuntimeException {
  private final String code;

  public DomainException(String code, String message) {
    super(message);
    this.code = code;
  }

  public String getCode() {
    return code;
  }
}
