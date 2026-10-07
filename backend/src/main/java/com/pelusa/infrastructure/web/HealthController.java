package com.pelusa.infrastructure.web;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Health ligero para la UI. El health REAL (con DB) es /actuator/health.
 */
@RestController
public class HealthController {
  @GetMapping("/api/health")
  public Map<String, String> health() {
    return Map.of("status", "UP");
  }
}
