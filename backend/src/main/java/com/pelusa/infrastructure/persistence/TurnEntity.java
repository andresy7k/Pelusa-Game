package com.pelusa.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "turns")
public class TurnEntity {
  @Id
  private UUID id;

  @Column(name = "game_id", nullable = false)
  private UUID gameId;

  @Column(name = "player_id", nullable = false)
  private UUID playerId;

  @Column(name = "started_at", nullable = false)
  private OffsetDateTime startedAt;

  @Column(name = "ended_at")
  private OffsetDateTime endedAt;

  @Column(length = 16)
  private String outcome;

  @Column(columnDefinition = "TEXT")
  private String detail;

  @Column(nullable = false)
  private boolean acted;

  @Column(nullable = false)
  private boolean stashed;

  protected TurnEntity() {}

  public TurnEntity(UUID id, UUID gameId, UUID playerId) {
    this.id = id;
    this.gameId = gameId;
    this.playerId = playerId;
    this.startedAt = OffsetDateTime.now();
  }

  public UUID getId() { return id; }
  public UUID getPlayerId() { return playerId; }
  public String getDetail() { return detail; }
  public boolean isActed() { return acted; }
  public boolean isStashed() { return stashed; }
  public void setEndedAt(OffsetDateTime t) { this.endedAt = t; }
  public void setOutcome(String outcome) { this.outcome = outcome; }
  public void setDetail(String detail) { this.detail = detail; }
  public void setActed(boolean acted) { this.acted = acted; }
  public void setStashed(boolean stashed) { this.stashed = stashed; }
}
