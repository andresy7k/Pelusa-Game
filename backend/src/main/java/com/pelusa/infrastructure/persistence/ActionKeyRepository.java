package com.pelusa.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActionKeyRepository extends JpaRepository<ActionKeyEntity, UUID> {
  boolean existsByGameIdAndKey(UUID gameId, String key);
}
