package com.pelusa.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GameRepository extends JpaRepository<GameEntity, UUID> {
  Page<GameEntity> findByStatusOrderByFinishedAtDesc(String status, Pageable pageable);

  /** Terminadas en [start, end): el histórico filtrado por el día en que terminaron. */
  @Query("""
      select g from GameEntity g
      where g.status = 'FINISHED' and g.finishedAt >= :start and g.finishedAt < :end
      order by g.finishedAt desc""")
  Page<GameEntity> findFinishedBetween(
      @Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end, Pageable pageable);

  /**
   * Terminadas donde jugó alguien cuyo nombre, en minúsculas y sin tildes, encaja con
   * el patrón (like). SQL nativo a propósito: la versión JPQL con 7 replace() anidados
   * hacía explotar el parser de Hibernate (ANTLR) y el arranque moría por falta de
   * memoria en Render (512 MB). TRANSLATE existe igual en H2 y en PostgreSQL.
   */
  @Query(value = """
      select g.* from games g
      where g.status = 'FINISHED'
        and exists (
          select 1 from players p
          where p.game_id = g.id
            and translate(lower(p.name), 'áéíóúüñ', 'aeiouun') like :pattern)
      order by g.finished_at desc""",
      countQuery = """
      select count(*) from games g
      where g.status = 'FINISHED'
        and exists (
          select 1 from players p
          where p.game_id = g.id
            and translate(lower(p.name), 'áéíóúüñ', 'aeiouun') like :pattern)""",
      nativeQuery = true)
  Page<GameEntity> findFinishedWithPlayer(@Param("pattern") String pattern, Pageable pageable);

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
