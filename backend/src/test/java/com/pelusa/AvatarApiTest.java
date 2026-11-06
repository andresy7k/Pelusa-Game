package com.pelusa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Avatares: cada jugador elige uno de los 10 monstruos y es su personaje en la mesa. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AvatarApiTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  private ResultActions send(String path, String body) throws Exception {
    return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private JsonNode read(ResultActions r) throws Exception {
    return json.readTree(r.andReturn().getResponse().getContentAsString());
  }

  @Test
  void chosenAvatarsAreKeptPerPlayer() throws Exception {
    JsonNode g = read(send("/api/games", "{\"names\":[\"Ana\",\"Beto\"],\"avatars\":[4,9]}")
        .andExpect(status().isCreated()));

    assertThat(g.get("players").get(0).get("avatar").asInt()).isEqualTo(4);
    assertThat(g.get("players").get(1).get("avatar").asInt()).isEqualTo(9);
    mvc.perform(get("/api/games/" + g.get("id").asText() + "/players"))
        .andExpect(jsonPath("$[0].avatar").value(4))
        .andExpect(jsonPath("$[1].avatar").value(9));
  }

  @Test
  void withoutChoiceEachSeatGetsADifferentMonster() throws Exception {
    JsonNode g = read(send("/api/games", "{\"names\":[\"Ana\",\"Beto\",\"Ceci\"]}"));

    assertThat(g.get("players").findValuesAsText("avatar")).containsExactly("1", "2", "3");
  }

  @Test
  void avatarsMustBeOnePerPlayerBetweenOneAndTen() throws Exception {
    send("/api/games", "{\"names\":[\"Ana\",\"Beto\"],\"avatars\":[4,11]}")
        .andExpect(status().isBadRequest());
    send("/api/games", "{\"names\":[\"Ana\",\"Beto\"],\"avatars\":[4]}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
  }

  @Test
  void onlineRoomUsesChosenOrFirstFreeMonster() throws Exception {
    JsonNode room = read(send("/api/games/online", "{\"name\":\"Ana\",\"capacity\":4,\"avatar\":1}")
        .andExpect(status().isCreated()));
    String code = room.get("game").get("code").asText();
    assertThat(room.get("game").get("players").get(0).get("avatar").asInt()).isEqualTo(1);

    // Sin elegir: el primero que nadie tiene (el 1 ya es de Ana → 2).
    JsonNode beto = read(send("/api/games/join", "{\"code\":\"" + code + "\",\"name\":\"Beto\"}"));
    assertThat(beto.get("game").get("players").get(1).get("avatar").asInt()).isEqualTo(2);
    // Eligiendo: se respeta.
    JsonNode ceci = read(send("/api/games/join", "{\"code\":\"" + code + "\",\"name\":\"Ceci\",\"avatar\":8}"));
    assertThat(ceci.get("game").get("players").get(2).get("avatar").asInt()).isEqualTo(8);

    send("/api/games/join", "{\"code\":\"" + code + "\",\"name\":\"Dani\",\"avatar\":12}")
        .andExpect(status().isBadRequest());
    send("/api/games/online", "{\"name\":\"Eva\",\"capacity\":2,\"avatar\":0}")
        .andExpect(status().isBadRequest());
  }
}
