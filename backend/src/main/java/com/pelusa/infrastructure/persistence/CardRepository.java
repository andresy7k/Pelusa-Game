package com.pelusa.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Una sola lectura por request (findByGameId); el service muta las entidades
 * gestionadas y el dirty checking persiste al commitear.
 *
 * <p>Decisión consciente: SIN bulk @Modifying. Los bulk updates escriben en
 * la DB saltándose el contexto de persistencia, así que una lectura posterior
 * EN LA MISMA transacción devuelve datos viejos (bug real que tumbó el CI:
 * el frente "descartado" seguía apareciendo). Mutar entidades gestionadas
 * mantiene DB y memoria siempre de acuerdo.
 */
public interface CardRepository extends JpaRepository<CardEntity, UUID> {
  List<CardEntity> findByGameId(UUID gameId);
}
