package com.pelusa.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TurnRepository extends JpaRepository<TurnEntity, UUID> {
  Optional<TurnEntity> findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(UUID gameId);

  /** Último turno con evento: el "qué pasó" que muestra la mesa. */
  Optional<TurnEntity> findFirstByGameIdAndDetailIsNotNullOrderByStartedAtDesc(UUID gameId);
}
