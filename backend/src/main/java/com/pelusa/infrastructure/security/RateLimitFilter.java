package com.pelusa.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Límite de pedidos por IP en la API, en tres cupos por minuto:
 * <ul>
 *   <li><b>create</b>: crear partida, abrir sala y unirse (lo más caro y lo que se usa
 *       para fuerza bruta de códigos).</li>
 *   <li><b>action</b>: el resto de POST (sacar, plantarse, robar…).</li>
 *   <li><b>read</b>: GET (incluye el sondeo de las salas online).</li>
 * </ul>
 * Pasado el cupo: 429 con {@code Retry-After}. Salud y ping no cuentan.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class RateLimitFilter extends OncePerRequestFilter {
  private static final Set<String> CREATE_PATHS = Set.of("/api/games", "/api/games/online", "/api/games/join");
  private static final Set<String> FREE_PATHS = Set.of("/api/health", "/api/ping");

  private final RateLimiter creates;
  private final RateLimiter actions;
  private final RateLimiter reads;

  public RateLimitFilter(
      @Value("${pelusa.rate-limit.create-per-minute:20}") int createPerMinute,
      @Value("${pelusa.rate-limit.action-per-minute:240}") int actionPerMinute,
      @Value("${pelusa.rate-limit.read-per-minute:600}") int readPerMinute) {
    Clock clock = Clock.systemUTC();
    Duration minute = Duration.ofMinutes(1);
    this.creates = new RateLimiter(clock, createPerMinute, minute);
    this.actions = new RateLimiter(clock, actionPerMinute, minute);
    this.reads = new RateLimiter(clock, readPerMinute, minute);
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest req) {
    String path = req.getRequestURI();
    return !path.startsWith("/api/") || FREE_PATHS.contains(path);
  }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    String ip = clientIp(req);
    boolean post = "POST".equals(req.getMethod());
    RateLimiter limiter = !post ? reads : CREATE_PATHS.contains(req.getRequestURI()) ? creates : actions;
    long retryAfter = limiter.acquire(ip);
    if (retryAfter > 0) {
      res.setHeader("Retry-After", Long.toString(retryAfter));
      ProblemResponses.write(res, req, 429, "Too Many Requests", "RATE_LIMITED",
          "Demasiados pedidos seguidos, esperá unos segundos");
      return;
    }
    chain.doFilter(req, res);
  }

  /**
   * IP del cliente. Detrás del proxy de Render la conexión viene del proxy, y la IP
   * real llega en {@code X-Forwarded-For}. Se toma la ÚLTIMA entrada (la que agregó
   * el proxy de confianza): las primeras las puede inventar el propio cliente.
   */
  static String clientIp(HttpServletRequest req) {
    String forwarded = req.getHeader("X-Forwarded-For");
    if (forwarded == null || forwarded.isBlank()) {
      return req.getRemoteAddr();
    }
    String[] hops = forwarded.split(",");
    return hops[hops.length - 1].trim();
  }
}
