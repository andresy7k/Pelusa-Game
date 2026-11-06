package com.pelusa.infrastructure.security;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Límite de peticiones por clave (IP + tipo de acción) con ventana fija.
 *
 * <p>Ventana fija = "como mucho N pedidos por minuto": simple de explicar y de
 * probar, y suficiente para frenar a alguien que crea miles de partidas o prueba
 * códigos de sala por fuerza bruta. Vive en memoria (una sola instancia en Render).
 * El {@link Clock} se inyecta para que las pruebas controlen el tiempo.
 */
public class RateLimiter {
  /** Por encima de esta cantidad de claves se barren las ventanas vencidas (memoria acotada). */
  static final int SWEEP_THRESHOLD = 10_000;

  private final Clock clock;
  private final int limit;
  private final long windowMillis;
  private final Map<String, Window> windows = new ConcurrentHashMap<>();

  public RateLimiter(Clock clock, int limit, Duration window) {
    this.clock = clock;
    this.limit = limit;
    this.windowMillis = window.toMillis();
  }

  private record Window(long start, int count) {}

  /**
   * Registra un pedido. Devuelve 0 si se permite, o cuántos segundos faltan para
   * que se abra la próxima ventana si se pasó del límite (va en {@code Retry-After}).
   */
  public long acquire(String key) {
    long now = clock.millis();
    if (windows.size() > SWEEP_THRESHOLD) {
      windows.values().removeIf(w -> now - w.start() >= windowMillis);
    }
    Window w = windows.compute(key, (k, old) ->
        old == null || now - old.start() >= windowMillis ? new Window(now, 1) : new Window(old.start(), old.count() + 1));
    if (w.count() <= limit) {
      return 0;
    }
    long waitMillis = w.start() + windowMillis - now;
    return Math.max(1, (waitMillis + 999) / 1000);
  }

  int trackedKeys() {
    return windows.size();
  }
}
