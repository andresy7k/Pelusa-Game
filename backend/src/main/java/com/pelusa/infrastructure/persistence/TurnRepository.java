package com.pelusa.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TurnRepository extends JpaRepository<TurnEntity, UUID> {
  Optional<TurnEntity> findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(UUID gameId);

  List<TurnEntity> findByGameIdOrderByStartedAtDesc(UUID gameId);
}
