package com.pelusa.application.dto;

import java.util.UUID;

/**
 * Respuesta de abrir o unirse a una sala: la partida completa + el ID que
 * ESTE dispositivo debe guardar (su identidad en la mesa) + si llegó como
 * espectador (entró con la partida ya empezada: ve, no juega).
 */
public record JoinResult(GameView game, UUID playerId, boolean spectator) {}
