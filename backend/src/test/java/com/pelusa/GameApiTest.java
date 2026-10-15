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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Contrato REST (API_CONTRACT §10): status + errorCode + transiciones contra
 * persistencia real H2. El mazo se amaña vía repositorio para determinismo
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

  private JsonNode createGame(String... names) throws Exception {
    String body = json.writeValueAsString(java.util.Map.of("names", List.of(names)));
    MvcResult r = mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("CREATED"))
        .andExpect(jsonPath("$.deckRemaining").value(110))
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

  /** Reescribe el mazo con la secuencia dada (el resto se elimina). */
  private void rigDeck(UUID gameId, int... values) {
    List<CardEntity> deck = cards.findByGameId(gameId).stream()
        .filter(c -> "DECK".equals(c.getLocation()))
        .sorted(Comparator.comparingInt(CardEntity::getPileOrder))
        .toList();
    assertThat(deck.size()).isGreaterThanOrEqualTo(values.length);
    for (int i = values.length; i < deck.size(); i++) {
      cards.delete(deck.get(i));
    }
    // Se relee y se recrean las filas con los valores amañados en orden
    List<CardEntity> kept = cards.findByGameId(gameId).stream()
        .filter(c -> "DECK".equals(c.getLocation()))
        .sorted(Comparator.comparingInt(CardEntity::getPileOrder))
        .toList();
    for (int i = 0; i < values.length; i++) {
      // Nota: CardEntity no expone setValue (inmutable por diseño); se recrea la fila
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
    assertThat(after.get("deckRemaining").asInt()).isEqualTo(109);
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
    rigDeck(gameId, 4, 5, 4, 9);
    UUID ana = playerId(created, 0);

    act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    JsonNode bust = act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    assertThat(bust.get("lastEvent").get("bust").asBoolean()).isTrue();
    assertThat(bust.get("fronts").get(ana.toString()).size()).isZero();
    assertThat(bust.get("currentPlayerId").asText()).isNotEqualTo(ana.toString());
  }

  @Test
  void stealTakesAllOfValue() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDeck(gameId, 4, 4, 4, 4, 9);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    act(gameId, "stand", ana, UUID.randomUUID().toString(), null);
    act(gameId, "draw", beto, UUID.randomUUID().toString(), null);
    act(gameId, "draw", beto, UUID.randomUUID().toString(), null);
    act(gameId, "stand", beto, UUID.randomUUID().toString(), null);
    // Ana debe sacar este turno: su 4 es la última carta y habilita robar 4
    JsonNode drawn = act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    assertThat(drawn.get("lastDrawnValue").asInt()).isEqualTo(4);

    JsonNode after = act(gameId, "steal", ana, UUID.randomUUID().toString(),
        "{\"playerId\":\"" + ana + "\",\"value\":4}");
    // Ana: 4,4 propios + 4,4 robados de Beto
    assertThat(after.get("fronts").get(ana.toString()).size()).isEqualTo(4);
    // El evento del robo identifica a la víctima (contrato §7: fromPlayerIds)
    assertThat(after.get("lastEvent").get("fromPlayerIds").get(0).asText()).isEqualTo(beto.toString());

    // Mismo valor (4) pero ya no queda ninguno en frentes ajenos → 422
    mvc.perform(post("/api/games/" + gameId + "/steal").contentType(MediaType.APPLICATION_JSON)
            .content("{\"playerId\":\"" + ana + "\",\"value\":4}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("NO_STEALABLE_CARDS"));
  }

  @Test
  void stealMismatchedValueRejected() throws Exception {
    // Regresión del bug: Beto tiene un 4 boca arriba, pero Ana sacó 5.
    // Robar el 4 debe ser rechazado: solo vale el valor de la última sacada.
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDeck(gameId, 4, 4, 5, 9);
    UUID ana = playerId(created, 0);
    UUID beto = playerId(created, 1);

    act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    act(gameId, "stand", ana, UUID.randomUUID().toString(), null);
    act(gameId, "draw", beto, UUID.randomUUID().toString(), null);
    act(gameId, "stand", beto, UUID.randomUUID().toString(), null);
    JsonNode drawn = act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    assertThat(drawn.get("lastDrawnValue").asInt()).isEqualTo(5);

    mvc.perform(post("/api/games/" + gameId + "/steal").contentType(MediaType.APPLICATION_JSON)
            .content("{\"playerId\":\"" + ana + "\",\"value\":4}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("STEAL_VALUE_MISMATCH"));
  }

  @Test
  void stealBeforeDrawingThisTurnRejected() throws Exception {
    // Contrato §10: robar sin haber sacado carta en el turno → 422.
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    UUID ana = playerId(created, 0);

    mvc.perform(post("/api/games/" + gameId + "/steal").contentType(MediaType.APPLICATION_JSON)
            .content("{\"playerId\":\"" + ana + "\",\"value\":4}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errorCode").value("STEAL_VALUE_MISMATCH"));
  }

  @Test
  void viewExposesLastDrawnValue() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDeck(gameId, 4, 5, 6);
    UUID ana = playerId(created, 0);

    JsonNode before = json.readTree(mvc.perform(get("/api/games/" + gameId))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    assertThat(before.get("lastDrawnValue").isNull()).isTrue();

    JsonNode after = act(gameId, "draw", ana, UUID.randomUUID().toString(), null);
    assertThat(after.get("lastDrawnValue").asInt()).isEqualTo(4);
    // El tope del mazo NO se expone (§11): no debe existir "nextCard" en la vista
    assertThat(after.has("nextCard")).isFalse();

    // Al rotar el turno el valor robable se limpia: el siguiente turno lo trae null
    JsonNode rotated = act(gameId, "stand", ana, UUID.randomUUID().toString(), null);
    assertThat(rotated.get("lastDrawnValue").isNull()).isTrue();
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
    assertThat(second.get("deckRemaining").asInt()).isEqualTo(first.get("deckRemaining").asInt());
    assertThat(second.get("fronts").get(ana.toString()).size()).isEqualTo(1);
  }

  @Test
  void finishDeclaresWinnerHistoryAndResult() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);
    rigDeck(gameId, 5, 1);
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
  void resultInNotFinishedGame() throws Exception {
    JsonNode created = createGame("Ana", "Beto");
    UUID gameId = UUID.fromString(created.get("id").asText());
    start(gameId);

    mvc.perform(get("/api/games/" + gameId + "/result")).andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("GAME_NOT_FINISHED"));
  }

  @Test
  void unknownGameIs404() throws Exception {
    mvc.perform(get("/api/games/" + UUID.randomUUID())).andExpect(status().isNotFound())
        .andExpect(jsonPath("$.errorCode").value("GAME_NOT_FOUND"));
  }
}
