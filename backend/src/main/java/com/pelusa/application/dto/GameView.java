package com.pelusa.application.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Vista de estado canónica (API_CONTRACT). Sin anotaciones HTTP: el service
 * la construye, el controller la devuelve tal cual. Las claves UUID se
 * serializan como strings en JSON.
 */
public record GameView(
    UUID id,
    String status,
    UUID currentPlayerId,
    int dustRemaining,
    List<PlayerView> players,
    Map<UUID, List<Integer>> fronts,
    Map<UUID, StashView> stashed,
    Map<String, Object> lastEvent,
    ResultView result) {

  public record PlayerView(UUID id, String name, int seat) {}

  public record StashView(int sum, Map<Integer, Long> countsByValue) {}

  public record ResultView(UUID winnerId, boolean tie, String reason, List<ScoreView> scores) {}

  public record ScoreView(UUID playerId, String name, int sum, Map<Integer, Long> countsByValue) {}
}
