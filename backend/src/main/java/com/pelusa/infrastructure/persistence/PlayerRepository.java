package com.pelusa.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<PlayerEntity, UUID> {
  List<PlayerEntity> findByGameIdOrderBySeatAsc(UUID gameId);
}
