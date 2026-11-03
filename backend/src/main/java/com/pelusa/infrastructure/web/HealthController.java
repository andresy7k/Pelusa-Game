package com.pelusa.infrastructure.web;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Health ligero (sin DB) para el health check de Render y la UI.
 * El health REAL (con DB) es /actuator/health; no usarlo como probe de Render
 * porque despierta Neon en cada chequeo y consume sus CU-hours gratis.
 */
@RestController
public class HealthController {
  @GetMapping("/api/health")
  public Map<String, String> health() {
    return Map.of("status", "UP");
  }
}
