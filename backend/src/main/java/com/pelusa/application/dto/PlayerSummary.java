package com.pelusa.application.dto;

import java.util.List;
import java.util.UUID;

/**
 * Consulta de jugadores ({@code GET /api/games/{id}/players}): quién es, su
 * asiento, si tiene el turno, qué tiene boca arriba y cuántos puntos guardó.
 */
public record PlayerSummary(
    UUID id, String name, int seat, boolean currentTurn, List<Integer> front, int stashedSum) {}
