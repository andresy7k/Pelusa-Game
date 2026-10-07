package com.pelusa.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Espejo JPA de games. Sin reglas: los CHECKs viven en la migración V1,
 * las transiciones viven en el dominio (Phase 3). {@code @Version} = base del 409.
 */
@Entity
@Table(name = "games")
public class GameEntity {
  @Id
  private UUID id;

  @Column(nullable = false, length = 16)
  private String status;

  @Column(name = "current_player_id")
  private UUID currentPlayerId;

  @Column(name = "winner_id")
  private UUID winnerId;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "started_at")
  private OffsetDateTime startedAt;

  @Column(name = "finished_at")
  private OffsetDateTime finishedAt;

  @Version
  private long version;

  protected GameEntity() {}

  public GameEntity(UUID id, String status) {
    this.id = id;
    this.status = status;
    this.createdAt = OffsetDateTime.now();
  }

  public UUID getId() { return id; }
  public String getStatus() { return status; }
}
