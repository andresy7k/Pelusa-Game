package com.pelusa.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Crear partida: 2-6 nombres únicos + jugador inicial (null = 0).
 * {@code start=true} la crea ya iniciada (un request en vez de dos).
 */
public record CreateGameRequest(
    @NotNull @Size(min = 2, max = 6) List<@Size(min = 1, max = 60) String> names,
    Integer firstPlayerIndex,
    boolean start) {}
