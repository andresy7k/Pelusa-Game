package com.pelusa.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

/** El limitador con un reloj que la prueba mueve a mano: sin esperar minutos reales. */
class RateLimiterTest {

  /** Reloj manual: avanza solo cuando la prueba lo pide. */
  static final class ManualClock extends Clock {
    private Instant now = Instant.parse("2026-11-06T12:00:00Z");

    void advance(Duration d) {
      now = now.plus(d);
    }

    @Override
    public Instant instant() {
      return now;
    }

    @Override
    public ZoneOffset getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(java.time.ZoneId zone) {
      return this;
    }
  }

  @Test
  void allowsUpToTheLimitThenAsksToWaitUntilTheWindowEnds() {
    ManualClock clock = new ManualClock();
    RateLimiter limiter = new RateLimiter(clock, 3, Duration.ofMinutes(1));

    assertThat(limiter.acquire("ip")).isZero();
    assertThat(limiter.acquire("ip")).isZero();
    assertThat(limiter.acquire("ip")).isZero();
    clock.advance(Duration.ofSeconds(20));
    assertThat(limiter.acquire("ip")).as("cuarto pedido: esperar lo que queda del minuto").isEqualTo(40);

    clock.advance(Duration.ofSeconds(39) .plusMillis(500));
    assertThat(limiter.acquire("ip")).as("medio segundo restante se redondea a 1").isEqualTo(1);

    clock.advance(Duration.ofMillis(500));
    assertThat(limiter.acquire("ip")).as("ventana nueva").isZero();
  }

  @Test
  void keysAreIndependent() {
    RateLimiter limiter = new RateLimiter(new ManualClock(), 1, Duration.ofMinutes(1));
    assertThat(limiter.acquire("a")).isZero();
    assertThat(limiter.acquire("a")).isPositive();
    assertThat(limiter.acquire("b")).isZero();
  }

  @Test
  void expiredWindowsAreSweptSoMemoryStaysBounded() {
    ManualClock clock = new ManualClock();
    RateLimiter limiter = new RateLimiter(clock, 5, Duration.ofMinutes(1));
    for (int i = 0; i < RateLimiter.SWEEP_THRESHOLD; i++) {
      limiter.acquire("ip-" + i);
    }
    assertThat(limiter.trackedKeys()).isEqualTo(RateLimiter.SWEEP_THRESHOLD);

    clock.advance(Duration.ofMinutes(2));
    limiter.acquire("viva"); // todavía en el umbral: no barre; ventana nueva y vigente
    limiter.acquire("otra"); // ya lo supera → barre las vencidas y conserva "viva"
    assertThat(limiter.trackedKeys()).as("se van las vencidas, quedan las vivas").isEqualTo(2);
    assertThat(limiter.acquire("viva")).as("la viva conserva su conteo").isZero();
  }

  @Test
  void problemWrittenOutsideARequestHasNoRequestId() throws Exception {
    MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/x");
    org.springframework.mock.web.MockHttpServletResponse res = new org.springframework.mock.web.MockHttpServletResponse();
    org.slf4j.MDC.remove("requestId");
    ProblemResponses.write(res, req, 429, "Too Many Requests", "RATE_LIMITED", "espera");
    assertThat(res.getStatus()).isEqualTo(429);
    assertThat(res.getContentType()).startsWith("application/problem+json");
    assertThat(res.getContentAsString()).contains("\"errorCode\":\"RATE_LIMITED\"").doesNotContain("requestId");
  }

  @Test
  void clientIpComesFromTheLastForwardedHop() {
    MockHttpServletRequest direct = new MockHttpServletRequest();
    direct.setRemoteAddr("10.1.1.1");
    assertThat(RateLimitFilter.clientIp(direct)).isEqualTo("10.1.1.1");

    MockHttpServletRequest blank = new MockHttpServletRequest();
    blank.setRemoteAddr("10.1.1.2");
    blank.addHeader("X-Forwarded-For", " ");
    assertThat(RateLimitFilter.clientIp(blank)).isEqualTo("10.1.1.2");

    // El cliente puede inventar la primera entrada; la última la puso el proxy.
    MockHttpServletRequest proxied = new MockHttpServletRequest();
    proxied.addHeader("X-Forwarded-For", "1.2.3.4, 198.51.100.7");
    assertThat(RateLimitFilter.clientIp(proxied)).isEqualTo("198.51.100.7");
  }

  @Test
  void problemJsonEscapesClientControlledText() {
    assertThat(ProblemResponses.escape("a\"b\\c\nd")).isEqualTo("a\\\"b\\\\c\\u000ad");
  }
}
