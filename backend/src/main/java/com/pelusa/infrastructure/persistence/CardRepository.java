package com.pelusa.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/**
 * Una sola query de lectura por request (findByGameId) + writes dirigidos
 * por acción. Sin N+1: el service agrupa las ~110 filas en memoria.
 */
public interface CardRepository extends JpaRepository<CardEntity, UUID> {
  List<CardEntity> findByGameId(UUID gameId);

  Optional<CardEntity> findFirstByGameIdAndLocationOrderByPileOrderAsc(UUID gameId, String location);

  @Modifying
  @Query("UPDATE CardEntity c SET c.location='DISCARDED' WHERE c.gameId=?1 AND c.ownerPlayerId=?2 AND c.location='FRONT'")
  int discardFront(UUID gameId, UUID owner);

  @Modifying
  @Query("UPDATE CardEntity c SET c.location='STASHED' WHERE c.gameId=?1 AND c.ownerPlayerId=?2 AND c.location='FRONT'")
  int stashFront(UUID gameId, UUID owner);

  @Modifying
  @Query("UPDATE CardEntity c SET c.location='STASHED' WHERE c.gameId=?1 AND c.location='FRONT'")
  int stashAllFronts(UUID gameId);

  @Modifying
  @Query("UPDATE CardEntity c SET c.ownerPlayerId=?3 WHERE c.gameId=?1 AND c.location='FRONT' AND c.ownerPlayerId<>?3 AND c.value=?2")
  int stealValue(UUID gameId, int value, UUID thief);
}
