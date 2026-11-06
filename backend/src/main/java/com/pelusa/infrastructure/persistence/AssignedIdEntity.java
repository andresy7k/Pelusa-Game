package com.pelusa.infrastructure.persistence;

import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import java.util.UUID;
import org.springframework.data.domain.Persistable;

/**
 * Base de las entidades cuyo id (UUID) lo genera la aplicación, no la BD.
 *
 * <p>Sin esto, Spring Data ve un id ya puesto y supone que la fila existe:
 * {@code save()} hace {@code merge}, que primero lanza un SELECT por cada
 * entidad. Crear una partida eran ~115 SELECT inútiles (110 cartas + jugadores);
 * con Neon por red, segundos de espera. {@link #isNew()} le dice la verdad:
 * nueva hasta que se inserta o se carga de la BD.
 */
@MappedSuperclass
public abstract class AssignedIdEntity implements Persistable<UUID> {
  @Id
  protected UUID id;

  @Transient
  private boolean fresh = true;

  @Override
  public UUID getId() {
    return id;
  }

  @Override
  public boolean isNew() {
    return fresh;
  }

  @PostPersist
  @PostLoad
  void markPersisted() {
    fresh = false;
  }
}
