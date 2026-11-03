package com.pelusa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * El soporte de Playwright debe ser confiable: si ordenara mal el mazo, los
 * casos e2e probarían otra cosa. Con perfil e2e activo (además de test).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "e2e"})
class E2eDeckControllerTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;

  private UUID[] startedGame() throws Exception {
    JsonNode g = json.readTree(mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON)
            .content("{\"names\":[\"Ana\",\"Beto\"]}"))
        .andReturn().getResponse().getContentAsString());
    UUID id = UUID.fromString(g.get("id").asText());
    mvc.perform(post("/api/games/" + id + "/start")).andExpect(status().isOk());
    return new UUID[] {id, UUID.fromString(g.get("players").get(0).get("id").asText())};
  }

  private void rig(UUID id, String body) throws Exception {
    mvc.perform(post("/api/test/games/" + id + "/deck").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isNoContent());
  }

  private int draw(UUID id, UUID player) throws Exception {
    JsonNode s = json.readTree(mvc.perform(post("/api/games/" + id + "/draw")
            .contentType(MediaType.APPLICATION_JSON).content("{\"playerId\":\"" + player + "\"}"))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    return s.get("lastEvent").get("value").asInt();
  }

  @Test
  void requestedValuesComeOutFirstAndCompositionIsKept() throws Exception {
    UUID[] g = startedGame();
    rig(g[0], "{\"values\":[10,1,10]}");

    assertThat(draw(g[0], g[1])).isEqualTo(10);
    assertThat(draw(g[0], g[1])).isEqualTo(1);
    // Composición intacta: sigue habiendo 110 cartas y 9 dieces en total.
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM cards WHERE game_id = ?", Integer.class, g[0]))
        .isEqualTo(110);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM cards WHERE game_id = ? AND card_value = 10",
        Integer.class, g[0])).isEqualTo(9);
    // El tercer valor pedido (10) es el próximo del mazo.
    assertThat(jdbc.queryForObject(
        "SELECT card_value FROM cards WHERE game_id = ? AND location = 'DECK' ORDER BY pile_order LIMIT 1",
        Integer.class, g[0])).isEqualTo(10);
  }

  @Test
  void rigOnlyReordersCardsStillInTheDeck() throws Exception {
    UUID[] g = startedGame();
    rig(g[0], "{\"values\":[7]}");
    assertThat(draw(g[0], g[1])).isEqualTo(7); // el 7 queda delante de Ana

    // Pedir otro 7: debe salir del mazo, no "recolocar" el del frente.
    rig(g[0], "{\"values\":[7]}");
    assertThat(draw(g[0], g[1])).isEqualTo(7);
    assertThat(jdbc.queryForObject(
        "SELECT COUNT(*) FROM cards WHERE game_id = ? AND location = 'FRONT'", Integer.class, g[0]))
        .isEqualTo(2);
  }

  @Test
  void truncateLeavesOnlyRequestedCards() throws Exception {
    UUID[] g = startedGame();
    rig(g[0], "{\"values\":[5,1],\"truncate\":true}");

    mvc.perform(get("/api/games/" + g[0])).andExpect(jsonPath("$.deckRemaining").value(2));
  }

  @Test
  void askingForMoreCopiesThanTheDeckHasIs400() throws Exception {
    UUID[] g = startedGame();
    mvc.perform(post("/api/test/games/" + g[0] + "/deck").contentType(MediaType.APPLICATION_JSON)
            .content("{\"values\":[6,6,6,6,6,6,6,6,6,6]}"))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/api/test/games/" + g[0] + "/deck").contentType(MediaType.APPLICATION_JSON)
            .content("{\"values\":[0]}"))
        .andExpect(status().isBadRequest());
  }
}
