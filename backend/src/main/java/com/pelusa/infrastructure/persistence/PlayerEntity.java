package com.pelusa.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "players",
    uniqueConstraints = {
      @UniqueConstraint(name = "uq_game_position", columnNames = {"game_id", "seat"}),
      @UniqueConstraint(name = "uq_game_name", columnNames = {"game_id", "name"})})
public class PlayerEntity {
  @Id
  private UUID id;

  @Column(name = "game_id", nullable = false)
  private UUID gameId;

  @Column(nullable = false, length = 60)
  private String name;

  @Column(nullable = false)
  private int seat;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected PlayerEntity() {}

  public PlayerEntity(UUID id, UUID gameId, String name, int seat) {
    this.id = id;
    this.gameId = gameId;
    this.name = name;
    this.seat = seat;
    this.createdAt = OffsetDateTime.now();
  }

  public UUID getId() { return id; }
  public UUID getGameId() { return gameId; }
  public String getName() { return name; }
  public int getSeat() { return seat; }
}
