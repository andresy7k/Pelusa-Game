package com.pelusa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada. No contiene reglas: solo arranca el contexto
 * (web + validación + JPA + Flyway + actuator).
 */
@SpringBootApplication
public class PelusaApplication {
  public static void main(String[] args) {
    SpringApplication.run(PelusaApplication.class, args);
  }
}
