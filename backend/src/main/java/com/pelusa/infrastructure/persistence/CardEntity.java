package com.pelusa.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "cards", indexes = {
  @Index(name = "ix_cards_game_location", columnList = "game_id,location"),
  @Index(name = "ix_cards_game_owner_location", columnList = "game_id,owner_player_id,location"),
  @Index(name = "ix_cards_dust_order", columnList = "game_id,pile_order")})
public class CardEntity {
  @Id
  private UUID id;

  @Column(name = "game_id", nullable = false)
  private UUID gameId;

  @Column(name = "card_value", nullable = false)
  private int value;

  @Column(nullable = false, length = 12)
  private String location;

  @Column(name = "owner_player_id")
  private UUID ownerPlayerId;

  @Column(name = "pile_order", nullable = false)
  private int pileOrder;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected CardEntity() {}

  public CardEntity(UUID id, UUID gameId, int value, String location, UUID ownerPlayerId, int pileOrder) {
    this.id = id;
    this.gameId = gameId;
    this.value = value;
    this.location = location;
    this.ownerPlayerId = ownerPlayerId;
    this.pileOrder = pileOrder;
    this.createdAt = OffsetDateTime.now();
  }

  public UUID getId() { return id; }
  public int getValue() { return value; }
  public String getLocation() { return location; }
}
