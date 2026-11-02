package com.pelusa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
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

/**
 * Multijugador online (ADR-015/016/017): lobby por código, host, espectador y
 * reloj autoritativo. Se ejecuta en CI con JDK 17 (ver .github/workflows/ci.yml).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OnlineApiTest {
  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper json;

  @Autowired
  JdbcTemplate jdbc;

  private JsonNode createOnline(String name, int capacity) throws Exception {
    MvcResult r = mvc.perform(post("/api/games/online")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("name", name, "capacity", capacity))))
        .andExpect(status().isCreated())
        .andReturn();
    return json.readTree(r.getResponse().getContentAsString());
  }

  private JsonNode joinOk(String code, String name) throws Exception {
    MvcResult r = mvc.perform(post("/api/games/join")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("code", code, "name", name))))
        .andExpect(status().isOk())
        .andReturn();
    return json.readTree(r.getResponse().getContentAsString());
  }

  private MvcResult startAs(UUID gameId, String playerId) throws Exception {
    String body = playerId == null ? "{}" : json.writeValueAsString(Map.of("playerId", playerId));
    return mvc.perform(post("/api/games/" + gameId + "/start")
            .contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andReturn();
  }

  private static UUID id(JsonNode node, String field) {
    return UUID.fromString(node.get(field).asText());
  }

  @Test
  void createOnlineReturnsLobbyWithCodeAndHost() throws Exception {
    JsonNode r = createOnline("Ana", 4);
    JsonNode game = r.get("game");

    assertThat(game.get("mode").asText()).isEqualTo("ONLINE");
    assertThat(game.get("status").asText()).isEqualTo("CREATED");
    assertThat(game.get("code").asText()).hasSize(6);
    assertThat(game.get("capacity").asInt()).isEqualTo(4);
    assertThat(game.get("hostPlayerId").asText()).isEqualTo(r.get("playerId").asText());
    assertThat(game.get("players")).hasSize(1);
    assertThat(game.get("players").get(0).get("seat").asInt()).isZero();
    assertThat(game.get("turnDeadlineAt").isNull()).isTrue(); // lobby sin turno aún
    assertThat(r.get("spectator").asBoolean()).isFalse();
  }

  @Test
  void joinNormalizesCodeAndSeatsNextPlayer() throws Exception {
    JsonNode created = createOnline("Ana", 4);
    String code = created.get("game").get("code").asText();

    JsonNode joined = joinOk(code.toLowerCase(), "Beto");

    assertThat(joined.get("spectator").asBoolean()).isFalse();
    assertThat(joined.get("playerId").asText()).isNotEqualTo(created.get("playerId").asText());
    assertThat(joined.get("game").get("players")).hasSize(2);
    assertThat(joined.get("game").get("players").get(1).get("name").asText()).isEqualTo("Beto");
    assertThat(joined.get("game").get("players").get(1).get("seat").asInt()).isEqualTo(1);
  }

  @Test
  void joinRejectsDuplicateName() throws Exception {
    JsonNode created = createOnline("Ana", 3);
    String code = created.get("game").get("code").asText();
    joinOk(code, "Beto");

    mvc.perform(post("/api/games/join")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("code", code, "name", "beto"))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("NAME_TAKEN"));
  }

  @Test
  void joinRejectsFullRoom() throws Exception {
    JsonNode created = createOnline("Ana", 2);
    String code = created.get("game").get("code").asText();
    joinOk(code, "Beto");

    mvc.perform(post("/api/games/join")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("code", code, "name", "Carla"))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("GAME_FULL"));
  }

  @Test
  void joinUnknownCodeIs404() throws Exception {
    mvc.perform(post("/api/games/join")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("code", "ZZZZZZ", "name", "Ana"))))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.errorCode").value("CODE_NOT_FOUND"));
  }

  @Test
  void startRequiresHostAndTwoPlayers() throws Exception {
    JsonNode created = createOnline("Ana", 2);
    UUID gameId = id(created.get("game"), "id");
    UUID hostId = id(created, "playerId");
    String code = created.get("game").get("code").asText();

    // Solo el host (y con 2 jugadores) puede empezar.
    mvc.perform(post("/api/games/" + gameId + "/start")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("playerId", hostId))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("NOT_ENOUGH_PLAYERS"));

    joinOk(code, "Beto");

    mvc.perform(post("/api/games/" + gameId + "/start")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("playerId", UUID.randomUUID()))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("NOT_HOST"));

    MvcResult started = startAs(gameId, hostId.toString());
    assertThat(started.getResponse().getStatus()).isEqualTo(200);
    JsonNode state = json.readTree(started.getResponse().getContentAsString());
    assertThat(state.get("status").asText()).isEqualTo("IN_PROGRESS");
    assertThat(state.get("turnDeadlineAt").isNull()).isFalse();
  }

  @Test
  void lateJoinBecomesSpectatorWithoutSeat() throws Exception {
    JsonNode created = createOnline("Ana", 2);
    UUID gameId = id(created.get("game"), "id");
    UUID hostId = id(created, "playerId");
    String code = created.get("game").get("code").asText();
    joinOk(code, "Beto");
    startAs(gameId, hostId.toString());

    JsonNode late = joinOk(code, "Carla");

    assertThat(late.get("spectator").asBoolean()).isTrue();
    assertThat(late.get("playerId").isNull()).isTrue();
    assertThat(late.get("game").get("players")).hasSize(2); // no ocupa cupo
  }

  @Test
  void expiredTurnRotatesAndRejectsLateAction() throws Exception {
    JsonNode created = createOnline("Ana", 2);
    UUID gameId = id(created.get("game"), "id");
    UUID hostId = id(created, "playerId");
    String code = created.get("game").get("code").asText();
    JsonNode joined = joinOk(code, "Beto");
    UUID betoId = id(joined, "playerId");
    startAs(gameId, hostId.toString());

    // Forzamos el vencimiento (en vez de dormir 15 s): el reloj es del servidor.
    jdbc.update("UPDATE turns SET deadline_at = ? WHERE game_id = ? AND ended_at IS NULL",
        OffsetDateTime.now().minusSeconds(1), gameId);

    // La acción tardía aplica el reloj y se rechaza con TURN_EXPIRED.
    mvc.perform(post("/api/games/" + gameId + "/draw")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("playerId", hostId))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("TURN_EXPIRED"));

    // La lectura posterior confirma la rotación y el evento del reloj.
    JsonNode after = json.readTree(mvc.perform(get("/api/games/" + gameId))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());

    assertThat(after.get("currentPlayerId").asText()).isEqualTo(betoId.toString());
    assertThat(after.get("lastEvent").get("type").asText()).isEqualTo("TURN_EXPIRED");
    assertThat(after.get("turnDeadlineAt").isNull()).isFalse(); // nuevo turno con plazo
  }

  @Test
  void hotseatStartHasNoDeadlineAndAcceptsEmptyBody() throws Exception {
    String body = json.writeValueAsString(Map.of("names", List.of("Local1", "Local2")));
    MvcResult created = mvc.perform(post("/api/games")
            .contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated())
        .andReturn();
    UUID gameId = id(json.readTree(created.getResponse().getContentAsString()), "id");

    MvcResult started = startAs(gameId, null);

    assertThat(started.getResponse().getStatus()).isEqualTo(200);
    JsonNode state = json.readTree(started.getResponse().getContentAsString());
    assertThat(state.get("mode").asText()).isEqualTo("LOCAL");
    assertThat(state.get("turnDeadlineAt").isNull()).isTrue(); // hotseat sin reloj
  }

  @Test
  void nonJsonContentTypeIs415() throws Exception {
    JsonNode created = createOnline("Ana", 2);
    UUID gameId = id(created.get("game"), "id");

    mvc.perform(post("/api/games/" + gameId + "/start")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED))
        .andExpect(status().isUnsupportedMediaType())
        .andExpect(jsonPath("$.errorCode").value("UNSUPPORTED_MEDIA_TYPE"));
  }
}
