package com.pelusa.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pelusa.domain.engine.DomainException;
import com.pelusa.domain.port.ShufflePort;
import com.pelusa.infrastructure.persistence.ActionKeyRepository;
import com.pelusa.infrastructure.persistence.CardEntity;
import com.pelusa.infrastructure.persistence.CardRepository;
import com.pelusa.infrastructure.persistence.GameEntity;
import com.pelusa.infrastructure.persistence.GameRepository;
import com.pelusa.infrastructure.persistence.PlayerEntity;
import com.pelusa.infrastructure.persistence.PlayerRepository;
import com.pelusa.infrastructure.persistence.TurnEntity;
import com.pelusa.infrastructure.persistence.TurnRepository;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

/**
 * Unit test del service con Mockito: los repositorios son mocks porque aquí
 * interesa la ORQUESTACIÓN (qué hace el service ante una carrera o un fallo de
 * infraestructura), no la base de datos. Las reglas de juego NO se mockean:
 * la {@code Table} real corre dentro del service. Los flujos felices con BD
 * real viven en GameApiTest/OnlineApiTest (integración con MockMvc + H2).
 */
@ExtendWith(MockitoExtension.class)
class GameServiceTest {
  @Mock GameRepository games;
  @Mock PlayerRepository players;
  @Mock CardRepository cards;
  @Mock TurnRepository turns;
  @Mock ActionKeyRepository keys;
  @Mock ObjectMapper json;

  private final ShufflePort noShuffle = deck -> {};
  private GameService service;

  @BeforeEach
  void setUp() {
    service = new GameService(games, players, cards, turns, keys, noShuffle, json);
  }

  @Test
  void createOnlineGivesUpAfterFiveCodeCollisions() {
    when(games.existsByCode(anyString())).thenReturn(true);

    assertThatThrownBy(() -> service.createOnline("Ana", 4))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("CODE_COLLISION");
    verify(games, times(5)).existsByCode(anyString());
    verify(games, never()).save(any());
  }

  @Test
  void joinRaceOnUniqueSeatOrNameIsConflictNot500() {
    GameEntity lobby = new GameEntity(UUID.randomUUID(), "CREATED");
    lobby.setMode("ONLINE");
    lobby.setCapacity(4);
    when(games.findByCode("ABC234")).thenReturn(Optional.of(lobby));
    when(players.findByGameIdOrderBySeatAsc(lobby.getId())).thenReturn(new ArrayList<>());
    when(players.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uq_game_name"));

    assertThatThrownBy(() -> service.join(" abc234 ", "Beto"))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("CONCURRENT_TURN");
  }

  @Test
  void duplicateIdempotencyKeyRaceIsConflictAndDoesNotAct() {
    UUID gameId = UUID.randomUUID();
    UUID ana = UUID.randomUUID();
    GameEntity game = new GameEntity(gameId, "IN_PROGRESS");
    game.setCurrentPlayerId(ana);
    when(games.findLockedById(gameId)).thenReturn(Optional.of(game));
    when(players.findByGameIdOrderBySeatAsc(gameId)).thenReturn(
        List.of(new PlayerEntity(ana, gameId, "Ana", 0), new PlayerEntity(UUID.randomUUID(), gameId, "Beto", 1)));
    when(keys.existsByGameIdAndKey(gameId, "k1")).thenReturn(false);
    when(keys.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uq_game_key"));

    assertThatThrownBy(() -> service.draw(gameId, ana, "k1"))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("CONCURRENT_TURN");
    verify(cards, never()).findByGameId(any()); // ni siquiera cargó el mazo
  }

  @Test
  void eventSerializationFailureIsInternalError() throws Exception {
    UUID gameId = UUID.randomUUID();
    UUID ana = UUID.randomUUID();
    GameEntity game = new GameEntity(gameId, "IN_PROGRESS");
    game.setCurrentPlayerId(ana);
    when(games.findLockedById(gameId)).thenReturn(Optional.of(game));
    when(players.findByGameIdOrderBySeatAsc(gameId)).thenReturn(
        List.of(new PlayerEntity(ana, gameId, "Ana", 0), new PlayerEntity(UUID.randomUUID(), gameId, "Beto", 1)));
    when(cards.findByGameId(gameId)).thenReturn(List.of(new CardEntity(UUID.randomUUID(), gameId, 3, "DECK", null, 0),
        new CardEntity(UUID.randomUUID(), gameId, 4, "DECK", null, 1)));
    when(turns.findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(gameId))
        .thenReturn(Optional.of(new TurnEntity(UUID.randomUUID(), gameId, ana)));
    when(json.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") {});

    assertThatThrownBy(() -> service.draw(gameId, ana, null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("serializar");
  }

  @Test
  void createValidatesNamesEvenWithoutHttpLayer() {
    assertThatThrownBy(() -> service.create(null, null)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create(List.of("Ana"), null)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create(List.of("A", "B", "C", "D", "E", "F", "G"), null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create(Arrays.asList("Ana", null), null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create(List.of("Ana", "x".repeat(61)), null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create(List.of("Ana", " Ana "), null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("repetirse");
    assertThatThrownBy(() -> service.create(List.of("Ana", "Beto"), -1))
        .isInstanceOf(IllegalArgumentException.class);
    verify(games, never()).save(any());
  }

  @Test
  void onlineRoomValidatesNameAndCapacity() {
    assertThatThrownBy(() -> service.createOnline(null, 4)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.createOnline("  ", 4)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.createOnline("x".repeat(61), 4)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.createOnline("Ana", 1)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.createOnline("Ana", 7)).isInstanceOf(IllegalArgumentException.class);
    verify(games, never()).save(any());
  }

  @Test
  void joinValidatesNameBeforeLookingUpTheRoom() {
    assertThatThrownBy(() -> service.join("ABC234", " "))
        .isInstanceOf(IllegalArgumentException.class);
    verify(games, never()).findByCode(any());
  }

  @Test
  void historyRejectsPagesLargerThan50() {
    assertThatThrownBy(() -> service.history(PageRequest.of(0, 51)))
        .isInstanceOf(IllegalArgumentException.class);
    verify(games, never()).findByStatusOrderByFinishedAtDesc(any(), any());
  }

  @Test
  void blankIdempotencyKeyIsRejectedBeforeTouchingTheGame() {
    assertThatThrownBy(() -> service.stand(UUID.randomUUID(), UUID.randomUUID(), "  "))
        .isInstanceOf(IllegalArgumentException.class);
    verify(games, never()).findLockedById(any());
  }
}
