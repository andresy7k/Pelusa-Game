package com.pelusa.infrastructure.config;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS para el front desplegado (Vercel) llamando al backend (Render).
 * En dev no hace falta (Vite proxya /api), pero habilitarlo no estorba.
 * Orígenes por variable de entorno: CORS_ALLOWED_ORIGINS (coma-separados).
 */
@Configuration
public class WebCorsConfig implements WebMvcConfigurer {
  private final String[] origins;

  public WebCorsConfig(
      @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173}") String origins) {
    this.origins = Arrays.stream(origins.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .toArray(String[]::new);
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
        .allowedOrigins(origins)
        .allowedMethods("GET", "POST", "OPTIONS")
        .allowedHeaders("Content-Type", "Idempotency-Key")
        .maxAge(3600);
  }
}
