package com.pelusa.infrastructure.web;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Despertar el backend dormido (Render Free) sin tocar la base de datos. */
@RestController
public class PingController {
  @GetMapping("/api/ping")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void ping() {
    // 204: barato, no consulta BD, solo dice "sigo aquí".
  }
}
