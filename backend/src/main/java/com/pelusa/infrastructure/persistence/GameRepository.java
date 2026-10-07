package com.pelusa.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRepository extends JpaRepository<GameEntity, UUID> {
  Page<GameEntity> findByStatusOrderByFinishedAtDesc(String status, Pageable pageable);
}
