package com.pelusa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Presupuesto de consultas SQL por request. En producción cada sentencia es un
 * viaje de red a Neon, así que su cantidad ES el tiempo de respuesta. Si alguien
 * reintroduce el SELECT-por-carta (merge) o quita el batching, esto falla.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PerformanceBudgetTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired EntityManagerFactory emf;

  private Statistics stats;

  @BeforeEach
  void resetStats() {
    stats = emf.unwrap(SessionFactory.class).getStatistics();
    stats.clear();
  }

  @Test
  void createAndStartInOneRequestStaysWithinSqlBudget() throws Exception {
    JsonNode game = json.readTree(mvc.perform(post("/api/games")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"names\":[\"Ana\",\"Beto\",\"Ceci\"],\"start\":true}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
        .andExpect(jsonPath("$.deckRemaining").value(110))
        .andReturn().getResponse().getContentAsString());

    // Antes: 233 sentencias (110 SELECT de merge + 110 INSERT sueltos + resto).
    // Ahora las 110 cartas viajan en lotes de 50: unas pocas sentencias en total.
    assertThat(stats.getPrepareStatementCount()).as("sentencias SQL al crear e iniciar").isLessThan(25);
    assertThat(stats.getEntityInsertCount()).isEqualTo(1 + 3 + 110 + 1); // partida, jugadores, cartas, turno

    // Una acción tampoco relee lo que ya cargó para responder.
    stats.clear();
    String ana = game.get("players").get(0).get("id").asText();
    mvc.perform(post("/api/games/" + game.get("id").asText() + "/draw")
            .contentType(MediaType.APPLICATION_JSON).content("{\"playerId\":\"" + ana + "\"}"))
        .andExpect(status().isOk());
    assertThat(stats.getPrepareStatementCount()).as("sentencias SQL de un draw").isLessThan(12);

    stats.clear();
    mvc.perform(get("/api/games/" + game.get("id").asText())).andExpect(status().isOk());
    assertThat(stats.getPrepareStatementCount()).as("sentencias SQL de leer el estado").isLessThan(8);
  }
}
