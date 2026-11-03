package com.pelusa.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

/** CORS_ALLOWED_ORIGINS llega como texto coma-separado desde Render/.env. */
class WebCorsConfigTest {

  /** CorsRegistry expone su configuración solo a subclases. */
  static class InspectableRegistry extends CorsRegistry {
    Map<String, CorsConfiguration> configs() {
      return getCorsConfigurations();
    }
  }

  @Test
  void parsesCommaSeparatedOriginsIgnoringBlanksAndSpaces() {
    InspectableRegistry registry = new InspectableRegistry();
    new WebCorsConfig(" https://front.example , ,http://localhost:5173,").addCorsMappings(registry);

    CorsConfiguration api = registry.configs().get("/api/**");
    assertThat(api.getAllowedOrigins()).containsExactly("https://front.example", "http://localhost:5173");
    assertThat(api.getAllowedMethods()).containsExactly("GET", "POST", "OPTIONS");
    assertThat(api.getAllowedHeaders()).contains("Content-Type", "Idempotency-Key");
  }
}
