package com.pelusa.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface GameRepository extends JpaRepository<GameEntity, UUID> {
  Page<GameEntity> findByStatusOrderByFinishedAtDesc(String status, Pageable pageable);

  /** ¿Existe ya una sala con este código? (Spring Data escribe el SQL por su nombre). */
  boolean existsByCode(String code);

  /** Busca la sala por su código de invitación (vacío si no existe). */
  Optional<GameEntity> findByCode(String code);

  /**
   * Carga para una acción de juego: fuerza el incremento de {@code version} al
   * commitear aunque la acción solo toque cartas o turnos (ADR-006).
   */
  @Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)
  Optional<GameEntity> findLockedById(UUID id);
}
