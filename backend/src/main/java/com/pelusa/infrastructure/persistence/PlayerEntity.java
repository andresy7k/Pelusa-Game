package com.pelusa.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "players",
    uniqueConstraints = {
      @UniqueConstraint(name = "uq_game_position", columnNames = {"game_id", "seat"}),
      @UniqueConstraint(name = "uq_game_name", columnNames = {"game_id", "name"})})
public class PlayerEntity extends AssignedIdEntity {

  @Column(name = "game_id", nullable = false)
  private UUID gameId;

  @Column(nullable = false, length = 60)
  private String name;

  @Column(nullable = false)
  private int seat;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  /** Monstruo del jugador (1..10, V9): su personaje en la mesa 2D y 3D. */
  @Column(nullable = false)
  private int avatar;

  /** SHA-256 del token de asiento en salas ONLINE (V8); null en hotseat. */
  @Column(name = "token_hash", length = 64)
  private String tokenHash;

  protected PlayerEntity() {}

  public PlayerEntity(UUID id, UUID gameId, String name, int seat) {
    this.id = id;
    this.gameId = gameId;
    this.name = name;
    this.seat = seat;
    this.avatar = seat % 10 + 1;
    this.createdAt = OffsetDateTime.now();
  }

  public String getName() { return name; }
  public int getAvatar() { return avatar; }
  public void setAvatar(int avatar) { this.avatar = avatar; }
  public String getTokenHash() { return tokenHash; }
  public void setTokenHash(String hash) { this.tokenHash = hash; }
  public int getSeat() { return seat; }
}
