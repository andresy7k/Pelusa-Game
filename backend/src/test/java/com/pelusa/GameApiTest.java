package com.pelusa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pelusa.infrastructure.persistence.CardEntity;
import com.pelusa.infrastructure.persistence.CardRepository;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;

/**
 * Contrato REST (API_CONTRACT §10): status + errorCode + transiciones contra
 * persistencia real H2. El polvo se amaña vía repositorio para determinismo
 * (el barajado real ya está cubierto en DeckFactoryTest).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GameApiTest {
  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper json;

  @Autowired
  CardRepository cards;

  @Autowired
  JdbcTemplate jdbc;

  private JsonNode createGame(String... names) throws Exception {
    String body = json.writeValueAsString(java.util.Map.of("names", List.of(names)));
    MvcResult r = mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("CREATED"))
        .andExpect(jsonPath("$.dustRemaining").value(110))
        .andReturn();
    return json.readTree(r.getResponse().getContentAsString());
  }

  private void start(UUID gameId) throws Exception {
    mvc.perform(post("/api/games/" + gameId + "/start")).andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
  }

  private JsonNode act(UUID gameId, String action, UUID playerId, String key, String extraJson) throws Exception {
    String body = extraJson == null
        ? "{\"playerId\":\"" + playerId + "\"}"
        : extraJson;
    var req = post("/api/games/" + gameId + "/" + action)
        .contentType(MediaType.APPLICATION_JSON).content(body);
    if (key != null) {
      req.header("Idempotency-Key", key);
    }
    MvcResult r = mvc.perform(req).andExpect(status().isOk()).andReturn();
    return json.readTree(r.getResponse().getContentAsString());
  }

  private void rigDust(UUID gameId, int... values) {
    List<CardEntity> dust = cards.findByGameId(gameId).stream()
        .filter(c -> "DECK".equals(c.getLocation()))
        .sorted(Comparator.comparingInt(CardEntity::getPileOrder))
        .toList();
    assertThat(dust.size()).isGreaterThanOrEqualTo(values.length);
    for (int i = values.length; i < dust.size(); i++) {
      cards.delete(dust.get(i));
    }
    List<CardEntity> kept = cards.findByGameId(gameId).stream()
        .filter(c -> "DECK".equals(c.getLocation()))
        .sorted(Comparator.comparingInt(CardEntity::getPileOrder))
        .toList();
    for (int i = 0; i < values.length; i++) {
      CardEntity old = kept.get(i);
      cards.delete(old);
      cards.save(new CardEntity(UUID.randomUUID(), gameId, values[i], "DECK", null, i));
    }
  }

  private UUID playerId(JsonNode state, int seat) {
    return UUID.fromString(state.get("players").get(seat).get("id").asText());
  }

  @Test
  void createRejectsDuplicateNames() throws Exception {
    String body = "{\"names\":[\"Ana\",\"Ana\"]}";
    mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON).content(body))
        .andDo(print())
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
  }

  @Test
  void drawAndStandRotateTurn() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    JsonNode s0 = json.readTree(mvc.perform(get("/api/games/" + gameId)).andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    UUID ana = playerId(s0, 0);
    UUID beto = playerId(s0, 1);

    JsonNode after = act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    assertThat(after.get("dustRemaining").asInt()).isEqualTo(109);
    assertThat(after.get("fronts").get(ana.toString()).size()).isEqualTo(1);

    // Fuera de turno → 409
    mvc.perform(post("/api/games/" + gameId + "/draw").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + beto + "\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("NOT_YOUR_TURN"));

    act(gameId, "stand", ana, UUID.randomUUID().toString(), null);
    JsonNode s1 = json.readTree(mvc.perform(get("/api/games/" + gameId)).andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertThat(s1.get("currentPlayerId").asText()).isEqualTo(beto.toString());
  }

  @Test
  void bustDiscardsFrontAndRotates() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 4, 5, 4, 9);
    UUID ana = playerId(created, 0);

    act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    JsonNode bust = act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    assertThat(bust.get("lastEvent").get("bust").asBoolean()).isTrue();
    assertThat(bust.get("fronts").get(ana.toString()).size()).isZero();
    assertThat(bust.get("currentPlayerId").asText()).isNotEqualTo(ana.toString());
    // Ninguna carta del bust puntúa: las 3 quedan DISCARDED en la BD, 0 guardadas.
    assertThat(bust.get("stashed").get(ana.toString()).get("sum").asInt()).isZero();
    assertThat(jdbc.queryForObject(
        "SELECT COUNT(*) FROM cards WHERE game_id = ? AND owner_player_id = ? AND location = 'DISCARDED'",
        Integer.class, gameId, ana)).isEqualTo(3);
    assertThat(jdbc.queryForObject(
        "SELECT outcome FROM turns WHERE game_id = ? AND player_id = ? AND ended_at IS NOT NULL",
        String.class, gameId, ana)).isEqualTo("BUST");
  }

  @Test
  void bustOnLastCardFinishesGameWithoutScoringBustedCards() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 8, 4, 5, 4);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, null, null); // Ana 8
    act(gameId, "stand", ana, null, null);
    act(gameId, "draw", beto, null, null); // Beto 4
    act(gameId, "draw", beto, null, null); // Beto 5
    JsonNode end = act(gameId, "draw", beto, null, null); // Beto 4 → bust y mazo vacío
    assertThat(end.get("status").asText()).isEqualTo("FINISHED");
    assertThat(end.get("lastEvent").get("bust").asBoolean()).isTrue();
    assertThat(end.get("result").get("winnerId").asText()).isEqualTo(ana.toString());
    assertThat(end.get("stashed").get(beto.toString()).get("sum").asInt()).isZero();
    assertThat(jdbc.queryForObject(
        "SELECT outcome FROM turns WHERE game_id = ? AND player_id = ? AND ended_at IS NOT NULL "
            + "ORDER BY started_at DESC LIMIT 1",
        String.class, gameId, beto)).isEqualTo("BUST");
  }

  @Test
  void playContinuesAfterBustWithDiscardedCardsInTable() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 4, 5, 4, 9, 2);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);
    act(gameId, "draw", ana, null, null);
    act(gameId, "draw", ana, null, null);
    act(gameId, "draw", ana, null, null); // bust
    JsonNode next = act(gameId, "draw", beto, null, null); // reconstruye con DISCARDED
    assertThat(next.get("fronts").get(beto.toString()).get(0).asInt()).isEqualTo(9);
    assertThat(next.get("deckRemaining").asInt()).isEqualTo(1);
  }

  @Test
  void corruptedEventDetailDoesNotBreakStateRead() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    act(gameId, "draw", playerId(created, 0), null, null);
    jdbc.update("UPDATE turns SET detail = 'no-es-json' WHERE game_id = ?", gameId);

    mvc.perform(get("/api/games/" + gameId)).andExpect(status().isOk())
        .andExpect(jsonPath("$.lastEvent").doesNotExist());
  }

  @Test
  void actionOnUnknownGameIs404() throws Exception {
    mvc.perform(post("/api/games/" + UUID.randomUUID() + "/draw").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + UUID.randomUUID() + "\"}"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.errorCode").value("GAME_NOT_FOUND"));
  }

  @Test
  void turnFlagsSurviveBetweenRequests() throws Exception {
    // Cada request reconstruye la mesa desde la BD: si turns.acted no se
    // persistiera, Ana podría guardar DESPUÉS de sacar en el mismo turno.
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 4, 9, 6, 4, 8);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);
    act(gameId, "draw", ana, null, null); // Ana 4 (frente de turno anterior)
    act(gameId, "stand", ana, null, null);
    act(gameId, "draw", beto, null, null); // Beto 9
    act(gameId, "stand", beto, null, null);

    act(gameId, "draw", ana, null, null); // Ana 6: ya actuó este turno
    mvc.perform(post("/api/games/" + gameId + "/stash").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + ana + "\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("NO_STASHABLE_CARDS"));
    act(gameId, "stand", ana, null, null);

    // Robar también cuenta como actuar.
    act(gameId, "draw", beto, null, null); // Beto 4
    act(gameId, "steal", beto, null, "{\"playerId\":\"" + beto + "\",\"value\":4}");
    mvc.perform(post("/api/games/" + gameId + "/stash").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + beto + "\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("NO_STASHABLE_CARDS"));
  }

  @Test
  void lastEventIsPersistedForLaterReads() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 4, 4, 9, 9);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, null, null);
    mvc.perform(get("/api/games/" + gameId))
        .andExpect(jsonPath("$.lastEvent.type").value("DRAW"))
        .andExpect(jsonPath("$.lastEvent.value").value(4));
    JsonNode stood = act(gameId, "stand", ana, null, null);
    assertThat(stood.get("lastEvent").get("type").asText()).isEqualTo("STAND");
    act(gameId, "draw", beto, null, null);
    act(gameId, "steal", beto, null, "{\"playerId\":\"" + beto + "\",\"value\":4}");
    mvc.perform(get("/api/games/" + gameId))
        .andExpect(jsonPath("$.lastEvent.type").value("STEAL"))
        .andExpect(jsonPath("$.lastEvent.count").value(1));
    act(gameId, "stand", beto, null, null);
    act(gameId, "draw", ana, null, null); // Ana 9
    act(gameId, "stand", ana, null, null);
    act(gameId, "stash", beto, null, null);
    mvc.perform(get("/api/games/" + gameId))
        .andExpect(jsonPath("$.lastEvent.type").value("STASH"))
        .andExpect(jsonPath("$.lastEvent.count").value(2));
  }

  @Test
  void errorsFollowProblemDetailsContract() throws Exception {
    UUID missing = UUID.randomUUID();
    mvc.perform(get("/api/games/" + missing).header("X-Request-Id", "req_contract"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.type").value("https://pelusa/errors/GAME_NOT_FOUND"))
        .andExpect(jsonPath("$.title").value("Not Found"))
        .andExpect(jsonPath("$.status").value(404))
        .andExpect(jsonPath("$.instance").value("/api/games/" + missing))
        .andExpect(jsonPath("$.errorCode").value("GAME_NOT_FOUND"))
        .andExpect(jsonPath("$.requestId").value("req_contract"));
  }

  @Test
  void validationBoundariesAcceptTheLimits() throws Exception {
    // Límites válidos: 6 jugadores, nombre de 60 caracteres, clave de 64.
    String sixty = "N".repeat(60);
    MvcResult r = mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON)
        .content("{\"names\":[\"" + sixty + "\",\"B\",\"C\",\"D\",\"E\",\"F\"]}"))
        .andExpect(status().isCreated()).andReturn();
    JsonNode g = json.readTree(r.getResponse().getContentAsString());
    assertThat(g.get("players")).hasSize(6);
    UUID gameId = UUID.fromString(g.get("id").asText());
    start(gameId);
    act(gameId, "draw", playerId(g, 0), "k".repeat(64), null);
  }

  @Test
  void hotseatStartWithAPlayerIdIsNotHost() throws Exception {
    // Hotseat no tiene anfitrión: mandar un playerId no habilita a nadie.
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    mvc.perform(post("/api/games/" + gameId + "/start").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + playerId(created, 0) + "\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("NOT_HOST"));
  }

  @Test
  void testSupportEndpointDoesNotExistOutsideE2eProfile() throws Exception {
    mvc.perform(post("/api/test/games/" + UUID.randomUUID() + "/deck").contentType(MediaType.APPLICATION_JSON)
        .content("{\"values\":[1]}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void actionsBeforeStartAreConflictNot500() throws Exception {
    // Regresión: sin turno abierto (partida CREATED) el draw lanzaba
    // NoSuchElementException → 500.
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    UUID ana = playerId(created, 0);
    for (String action : List.of("draw", "stand", "stash")) {
      mvc.perform(post("/api/games/" + gameId + "/" + action).contentType(MediaType.APPLICATION_JSON)
          .content("{\"playerId\":\"" + ana + "\"}"))
          .andExpect(status().isConflict())
          .andExpect(jsonPath("$.errorCode").value("GAME_NOT_STARTED"));
    }
    // Nada cambió: sigue con las 110 cartas en el mazo.
    mvc.perform(get("/api/games/" + gameId)).andExpect(jsonPath("$.deckRemaining").value(110));
  }

  @Test
  void standWithoutDrawingIsRejected() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    UUID ana = playerId(created, 0);

    mvc.perform(post("/api/games/" + gameId + "/stand").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + ana + "\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("MUST_DRAW_FIRST"));
    // El turno no se movió.
    mvc.perform(get("/api/games/" + gameId)).andExpect(jsonPath("$.currentPlayerId").value(ana.toString()));
  }

  @Test
  void repeatWithTwoCardsKeepsTurn() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 6, 6, 9);
    UUID ana = playerId(created, 0);

    act(gameId, "draw", ana, null, null);
    JsonNode second = act(gameId, "draw", ana, null, null);
    assertThat(second.get("lastEvent").get("bust").asBoolean()).isFalse();
    assertThat(second.get("currentPlayerId").asText()).isEqualTo(ana.toString());
    assertThat(second.get("fronts").get(ana.toString())).hasSize(2);
  }

  @Test
  void stashMovesPreviousTurnFrontToPoints() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 7, 3, 9, 9);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, null, null); // 7
    act(gameId, "stand", ana, null, null);
    // Beto no tiene frente: no hay nada que guardar.
    mvc.perform(post("/api/games/" + gameId + "/stash").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + beto + "\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("NO_STASHABLE_CARDS"));
    act(gameId, "draw", beto, null, null); // 3
    act(gameId, "stand", beto, null, null);

    JsonNode stashed = act(gameId, "stash", ana, null, null);
    assertThat(stashed.get("stashed").get(ana.toString()).get("sum").asInt()).isEqualTo(7);
    assertThat(stashed.get("fronts").get(ana.toString())).isEmpty();
    assertThat(stashed.get("lastEvent").get("type").asText()).isEqualTo("STASH");
    // Una vez por turno.
    mvc.perform(post("/api/games/" + gameId + "/stash").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + ana + "\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("ALREADY_STASHED_THIS_TURN"));
    // Las cartas del frente de Beto siguen boca arriba (no se guardan solas).
    assertThat(stashed.get("fronts").get(beto.toString())).hasSize(1);
  }

  @Test
  void stealValueMustMatchLastDrawnCard() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 4, 5, 9, 9);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, null, null); // Ana 4
    act(gameId, "stand", ana, null, null);
    act(gameId, "draw", beto, null, null); // Beto 5: Ana tiene un 4, no un 5
    mvc.perform(post("/api/games/" + gameId + "/steal").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + beto + "\",\"value\":4}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("STEAL_VALUE_MISMATCH"));
    mvc.perform(post("/api/games/" + gameId + "/steal").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + beto + "\",\"value\":11}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
  }

  @Test
  void idempotentRetryOfStandAfterRotationReturnsState() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);
    String key = UUID.randomUUID().toString();

    act(gameId, "draw", ana, null, null); // plantarse exige haber sacado
    act(gameId, "stand", ana, key, null);
    // El turno ya es de Beto: el reintento NO debe dar 409 ni volver a rotar.
    JsonNode retry = act(gameId, "stand", ana, key, null);
    assertThat(retry.get("currentPlayerId").asText()).isEqualTo(beto.toString());
  }

  @Test
  void idempotencyKeyLongerThanColumnIs400() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    UUID ana = playerId(created, 0);

    mvc.perform(post("/api/games/" + gameId + "/draw").contentType(MediaType.APPLICATION_JSON)
        .header("Idempotency-Key", "k".repeat(65))
        .content("{\"playerId\":\"" + ana + "\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
  }

  @Test
  void everyActionBumpsOptimisticVersion() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 4, 5, 9);
    UUID ana = playerId(created, 0);
    Long before = jdbc.queryForObject("SELECT version FROM games WHERE id = ?", Long.class, gameId);

    // Un draw sin bust solo toca cards/turns; aun así la versión de games sube,
    // así dos draws concurrentes no pueden commitear ambos (ADR-006).
    act(gameId, "draw", ana, null, null);
    Long after = jdbc.queryForObject("SELECT version FROM games WHERE id = ?", Long.class, gameId);
    assertThat(after).isEqualTo(before + 1);
  }

  @Test
  void rankingUsesTiebreakWhenSumsAreEqual() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 2, 1, 1);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, null, null); // Ana 2
    act(gameId, "stand", ana, null, null);
    act(gameId, "draw", beto, null, null); // Beto 1
    JsonNode end = act(gameId, "draw", beto, null, null); // Beto 1 → mazo vacío
    // 2 puntos cada uno; Beto tiene dos 1s y Ana ninguno → gana Beto y va primero.
    assertThat(end.get("result").get("winnerId").asText()).isEqualTo(beto.toString());
    assertThat(end.get("result").get("tie").asBoolean()).isFalse();
    assertThat(end.get("result").get("scores").get(0).get("name").asText()).isEqualTo("Beto");
    assertThat(end.get("result").get("scores").get(0).get("countsByValue").get("1").asInt()).isEqualTo(2);
    assertThat(end.get("result").get("scores").get(1).get("sum").asInt()).isEqualTo(2);
  }

  @Test
  void identicalStashesAreDeclaredTie() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 3, 3);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, null, null);
    act(gameId, "stand", ana, null, null);
    JsonNode end = act(gameId, "draw", beto, null, null);
    assertThat(end.get("result").get("tie").asBoolean()).isTrue();
    assertThat(end.get("result").get("winnerId").isNull()).isTrue();
  }

  @Test
  void historyKeepsDatesPlayersScoresAndWinner() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 8, 2);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);
    act(gameId, "draw", ana, null, null);
    act(gameId, "stand", ana, null, null);
    act(gameId, "draw", beto, null, null);

    JsonNode page = json.readTree(mvc.perform(get("/api/games/history?size=50"))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    JsonNode item = null;
    for (JsonNode g : page.get("content")) {
      if (g.get("id").asText().equals(gameId.toString())) {
        item = g;
      }
    }
    assertThat(item).as("la partida terminada aparece en el histórico").isNotNull();
    assertThat(item.get("createdAt").isNull()).isFalse();
    assertThat(item.get("startedAt").isNull()).isFalse();
    assertThat(item.get("finishedAt").isNull()).isFalse();
    assertThat(item.get("players")).hasSize(2);
    assertThat(item.get("result").get("winnerId").asText()).isEqualTo(ana.toString());
    assertThat(item.get("result").get("scores").get(0).get("name").asText()).isEqualTo("Ana");
    assertThat(item.get("result").get("scores").get(0).get("sum").asInt()).isEqualTo(8);
    assertThat(item.get("result").get("scores").get(0).get("countsByValue").get("8").asInt()).isEqualTo(1);
  }

  @Test
  void historyRejectsPageSizeOver50() throws Exception {
    mvc.perform(get("/api/games/history?size=51")).andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
  }

  @Test
  void playersEndpointShowsTurnFrontAndPoints() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 6, 9);
    UUID ana = playerId(created, 0);
    act(gameId, "draw", ana, null, null);

    mvc.perform(get("/api/games/" + gameId + "/players")).andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].name").value("Ana"))
        .andExpect(jsonPath("$[0].currentTurn").value(true))
        .andExpect(jsonPath("$[0].front[0]").value(6))
        .andExpect(jsonPath("$[0].stashedSum").value(0))
        .andExpect(jsonPath("$[1].name").value("Beto"))
        .andExpect(jsonPath("$[1].currentTurn").value(false));
  }

  @Test
  void startTwiceAndStartFinishedAreConflicts() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    mvc.perform(post("/api/games/" + gameId + "/start")).andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("ALREADY_STARTED"));

    rigDust(gameId, 5);
    act(gameId, "draw", playerId(created, 0), null, null); // última carta → FINISHED
    mvc.perform(post("/api/games/" + gameId + "/start")).andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("GAME_FINISHED"));
  }

  @Test
  void actionByStrangerIs422AndDrawOnEmptyDeckIs422() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    mvc.perform(post("/api/games/" + gameId + "/draw").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + UUID.randomUUID() + "\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("INVALID_PLAYER"));

    // Estado artificial (mazo vaciado por la BD con la partida abierta): la
    // defensa del service responde 422 en vez de romper.
    rigDust(gameId);
    mvc.perform(post("/api/games/" + gameId + "/draw").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + playerId(created, 0) + "\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("DECK_EMPTY"));
  }

  @Test
  void createValidatesPlayerCountNamesAndFirstPlayer() throws Exception {
    mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON)
        .content("{\"names\":[\"Solo\"]}"))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON)
        .content("{\"names\":[\"Ana\",\"Beto\"],\"firstPlayerIndex\":2}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON)
        .content("{\"names\":[\"Ana\",\"   \"]}"))
        .andExpect(status().isBadRequest());

    // Jugador inicial elegido: Beto (índice 1) tiene el primer turno.
    MvcResult r = mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON)
        .content("{\"names\":[\"Ana\",\"Beto\"],\"firstPlayerIndex\":1}"))
        .andExpect(status().isCreated()).andReturn();
    JsonNode g = json.readTree(r.getResponse().getContentAsString());
    assertThat(g.get("currentPlayerId").asText()).isEqualTo(g.get("players").get(1).get("id").asText());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM cards WHERE game_id = ?", Integer.class,
        UUID.fromString(g.get("id").asText()))).isEqualTo(110);
  }

  @Test
  void malformedIdAndUnknownRouteAreClientErrors() throws Exception {
    mvc.perform(get("/api/games/no-es-uuid")).andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    mvc.perform(get("/api/no-existe")).andExpect(status().isNotFound())
        .andExpect(jsonPath("$.errorCode").value("NOT_FOUND"));
  }

  @Test
  void requestIdIsEchoedOrGenerated() throws Exception {
    mvc.perform(get("/api/health").header("X-Request-Id", "req_test"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"))
        .andExpect(result -> assertThat(result.getResponse().getHeader("X-Request-Id")).isEqualTo("req_test"));
    mvc.perform(get("/api/ping").header("X-Request-Id", " "))
        .andExpect(status().isNoContent())
        .andExpect(result -> assertThat(result.getResponse().getHeader("X-Request-Id")).startsWith("req_"));
  }

  @Test
  void stealTakesAllOfValue() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 9, 4, 4, 4, 8);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, UUID.randomUUID().toString(), null); // Ana 9
    act(gameId, "stand", ana, UUID.randomUUID().toString(), null);
    act(gameId, "draw", beto, UUID.randomUUID().toString(), null);
    act(gameId, "draw", beto, UUID.randomUUID().toString(), null);
    act(gameId, "stand", beto, UUID.randomUUID().toString(), null);
    act(gameId, "draw", ana, UUID.randomUUID().toString(), null);

    JsonNode after = act(gameId, "steal", ana, UUID.randomUUID().toString(),
        "{\"playerId\":\"" + ana + "\",\"value\":4}");
    // 9 + su 4 + los dos 4 de Beto
    assertThat(after.get("fronts").get(ana.toString()).size()).isEqualTo(4);
    assertThat(after.get("fronts").get(beto.toString())).isEmpty();
  }

  @Test
  void stealMovesOnlyThatValueFromRivalFront() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 9, 4, 7, 4, 8); // el 8 evita que el mazo se agote antes del robo
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, null, null); // Ana 9
    act(gameId, "stand", ana, null, null);
    act(gameId, "draw", beto, null, null); // Beto 4
    act(gameId, "draw", beto, null, null); // Beto 7
    act(gameId, "stand", beto, null, null);
    act(gameId, "draw", ana, null, null); // Ana 4
    JsonNode after = act(gameId, "steal", ana, null, "{\"playerId\":\"" + ana + "\",\"value\":4}");
    assertThat(after.get("fronts").get(ana.toString())).hasSize(3); // 9, 4 y el 4 robado
    assertThat(after.get("fronts").get(beto.toString())).hasSize(1);
    assertThat(after.get("fronts").get(beto.toString()).get(0).asInt()).isEqualTo(7);
    assertThat(after.get("lastEvent").get("type").asText()).isEqualTo("STEAL");
    assertThat(after.get("lastEvent").get("count").asInt()).isEqualTo(1);
    assertThat(after.get("currentPlayerId").asText()).isEqualTo(ana.toString());

    // Agotadas las cartas robables de ese valor → 422
    mvc.perform(post("/api/games/" + gameId + "/steal").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + ana + "\",\"value\":4}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("NO_STEALABLE_CARDS"));
  }

  @Test
  void idempotentRetryReturnsSameState() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    UUID ana = playerId(created, 0);
    String key = UUID.randomUUID().toString();

    JsonNode first = act(gameId, "draw", ana, key, null);
    JsonNode second = act(gameId, "draw", ana, key, null);
    assertThat(second.get("dustRemaining").asInt()).isEqualTo(first.get("dustRemaining").asInt());
    assertThat(second.get("fronts").get(ana.toString()).size()).isEqualTo(1);
  }

  @Test
  void finishDeclaresWinnerHistoryAndResult() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDust(gameId, 5, 1);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    act(gameId, "stand", ana, UUID.randomUUID().toString(), null);
    JsonNode last = act(gameId, "draw", beto, UUID.randomUUID().toString(), null);
    assertThat(last.get("status").asText()).isEqualTo("FINISHED");
    assertThat(last.get("result").get("winnerId").asText()).isEqualTo(ana.toString());

    // Acción post-fin → 409
    mvc.perform(post("/api/games/" + gameId + "/draw").contentType(MediaType.APPLICATION_JSON)
        .content("{\"playerId\":\"" + ana + "\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("GAME_FINISHED"));

    // Result + history
    mvc.perform(get("/api/games/" + gameId + "/result")).andExpect(status().isOk())
        .andExpect(jsonPath("$.result.winnerId").value(ana.toString()));
    mvc.perform(get("/api/games/history")).andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(gameId.toString()));
  }

  @Test
  void unknownGameIs404() throws Exception {
    mvc.perform(get("/api/games/" + UUID.randomUUID())).andExpect(status().isNotFound())
        .andExpect(jsonPath("$.errorCode").value("GAME_NOT_FOUND"));
  }

  @Test
  void resultInNotFinishedGame() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);

    mvc.perform(get("/api/games/" + gameId + "/result")).andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("GAME_NOT_FINISHED"));
  }
}
