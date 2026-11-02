package com.pelusa.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRepository extends JpaRepository<GameEntity, UUID> {
  Page<GameEntity> findByStatusOrderByFinishedAtDesc(String status, Pageable pageable);

  /** ¿Existe ya una sala con este código? (Spring Data escribe el SQL por su nombre). */
  boolean existsByCode(String code);

  /** Busca la sala por su código de invitación (vacío si no existe). */
  java.util.Optional<GameEntity> findByCode(String code);
}
