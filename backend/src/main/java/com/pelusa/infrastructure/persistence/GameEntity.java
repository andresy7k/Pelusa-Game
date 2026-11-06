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
public class GameEntity extends AssignedIdEntity {

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

  @Column(name = "host_player_id")
  private UUID hostPlayerId;

  @Column(name = "code")
  private String code;

  @Column(name = "mode")
  private String mode = "LOCAL";

  @Column(name = "capacity")
  private int capacity = 6;

  @Version
  private long version;

  protected GameEntity() {}

  public GameEntity(UUID id, String status) {
    this.id = id;
    this.status = status;
    this.createdAt = OffsetDateTime.now();
  }

  public String getStatus() { return status; }
  public UUID getCurrentPlayerId() { return currentPlayerId; }
  public UUID getWinnerId() { return winnerId; }
  public UUID getHostPlayerId() { return hostPlayerId; }
  public String getCode() { return code; }
  public String getMode() { return mode; }
  public int getCapacity() { return capacity; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getStartedAt() { return startedAt; }
  public OffsetDateTime getFinishedAt() { return finishedAt; }
  public void setStatus(String status) { this.status = status; }
  public void setCurrentPlayerId(UUID id) { this.currentPlayerId = id; }
  public void setWinnerId(UUID id) { this.winnerId = id; }
  public void setStartedAt(OffsetDateTime t) { this.startedAt = t; }
  public void setFinishedAt(OffsetDateTime t) { this.finishedAt = t; }
  public void setHostPlayerId(UUID id) { this.hostPlayerId = id; }
  public void setCode(String code) {this.code = code; }
  public void setMode(String mode) { this.mode = mode; }
  public void setCapacity(int capacity) { this.capacity = capacity; }
}
