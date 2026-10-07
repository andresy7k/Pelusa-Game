package com.pelusa.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Claves de idempotencia: UNIQUE(game,key). Reintento con la misma key
 * devuelve el estado actual 200 sin actuar dos veces (API_CONTRACT §10).
 */
@Entity
@Table(name = "action_keys", uniqueConstraints = @UniqueConstraint(name = "uq_game_key", columnNames = {"game_id", "action_key"}))
public class ActionKeyEntity {
  @Id
  private UUID id;

  @Column(name = "game_id", nullable = false)
  private UUID gameId;

  @Column(name = "action_key", nullable = false, length = 64)
  private String key;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected ActionKeyEntity() {}

  public ActionKeyEntity(UUID gameId, String key) {
    this.id = UUID.randomUUID();
    this.gameId = gameId;
    this.key = key;
    this.createdAt = OffsetDateTime.now();
  }
}
