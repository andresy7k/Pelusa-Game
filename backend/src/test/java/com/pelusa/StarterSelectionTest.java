package com.pelusa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pelusa.domain.port.StarterPort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Quién empieza lo decide el sorteo, no el orden de los nombres ni el anfitrión.
 * El sorteo (StarterPort) se reemplaza con Mockito para fijar el resultado.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StarterSelectionTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @MockitoBean StarterPort starter;

  private JsonNode post(String path, String body) throws Exception {
    return json.readTree(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
            .post(path).contentType(MediaType.APPLICATION_JSON).content(body))
        .andReturn().getResponse().getContentAsString());
  }

  @Test
  void localGameStartsWithWhoeverTheDrawPicks() throws Exception {
    when(starter.pick(3)).thenReturn(2);

    JsonNode g = post("/api/games", "{\"names\":[\"Ana\",\"Beto\",\"Ceci\"],\"start\":true}");

    assertThat(g.get("currentPlayerId").asText()).isEqualTo(g.get("players").get(2).get("id").asText());
  }

  @Test
  void explicitFirstPlayerStillWinsOverTheDraw() throws Exception {
    when(starter.pick(2)).thenReturn(0);

    JsonNode g = post("/api/games", "{\"names\":[\"Ana\",\"Beto\"],\"firstPlayerIndex\":1}");

    assertThat(g.get("currentPlayerId").asText()).isEqualTo(g.get("players").get(1).get("id").asText());
  }

  @Test
  void onlineRoomDrawsAtStartAndMayNotBeTheHost() throws Exception {
    when(starter.pick(2)).thenReturn(1);
    JsonNode room = post("/api/games/online", "{\"name\":\"Ana\",\"capacity\":2}");
    String host = room.get("playerId").asText();
    JsonNode beto = post("/api/games/join",
        "{\"code\":\"" + room.get("game").get("code").asText() + "\",\"name\":\"Beto\"}");

    String started = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
            .post("/api/games/" + room.get("game").get("id").asText() + "/start")
            .contentType(MediaType.APPLICATION_JSON).content("{\"playerId\":\"" + host + "\"}"))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

    assertThat(json.readTree(started).get("currentPlayerId").asText()).isEqualTo(beto.get("playerId").asText());
  }
}
