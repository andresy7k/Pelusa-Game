package com.pelusa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Seguridad encendida como en producción: tokens de asiento obligatorios, límites
 * de pedidos bajos y tope de cuerpo chico (para poder alcanzarlos en la prueba).
 * Cada prueba usa su propia IP (X-Forwarded-For) para no compartir cupos.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "pelusa.security.require-seat-token=true",
    "pelusa.security.max-body-bytes=512",
    "pelusa.rate-limit.create-per-minute=3",
    "pelusa.rate-limit.action-per-minute=1000",
    "pelusa.rate-limit.read-per-minute=5"})
class SecurityTest {
  private static final AtomicInteger IPS = new AtomicInteger(1);

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;

  /** Una IP distinta por prueba: cada una tiene su propio cupo. */
  private static String newIp() {
    return "203.0.113." + IPS.getAndIncrement();
  }

  private static MockHttpServletRequestBuilder from(String ip, MockHttpServletRequestBuilder req) {
    return req.header("X-Forwarded-For", ip);
  }

  private MvcResult createLocal(String ip, boolean start) throws Exception {
    return mvc.perform(from(ip, post("/api/games")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"names\":[\"Ana\",\"Beto\"],\"start\":" + start + "}"))
        .andExpect(status().isCreated())
        .andReturn();
  }

  private JsonNode body(MvcResult r) throws Exception {
    return json.readTree(r.getResponse().getContentAsString());
  }

  private MockHttpServletRequestBuilder act(String ip, String gameId, String action, String playerId,
      String token) {
    MockHttpServletRequestBuilder req = from(ip, post("/api/games/" + gameId + "/" + action))
        .contentType(MediaType.APPLICATION_JSON).content("{\"playerId\":\"" + playerId + "\"}");
    return token == null ? req : req.header("X-Player-Token", token);
  }

  @Test
  void localGameOnlyAcceptsTheDeviceThatCreatedIt() throws Exception {
    String ip = newIp();
    MvcResult created = createLocal(ip, true);
    String token = created.getResponse().getHeader("X-Game-Token");
    assertThat(token).as("el token va en cabecera, no en el cuerpo público").hasSize(43);
    assertThat(created.getResponse().getContentAsString()).doesNotContain(token);
    JsonNode g = body(created);
    String id = g.get("id").asText();
    String ana = g.get("players").get(0).get("id").asText();

    // Conocer el playerId (es público) NO alcanza: sin token o con otro → 403.
    mvc.perform(act(ip, id, "draw", ana, null))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.errorCode").value("SEAT_FORBIDDEN"));
    mvc.perform(act(ip, id, "draw", ana, "token-inventado"))
        .andExpect(status().isForbidden());
    mvc.perform(act(ip, id, "draw", ana, token)).andExpect(status().isOk());
    // La BD guarda el hash, nunca el token.
    String stored = jdbc.queryForObject("SELECT control_token_hash FROM games WHERE id = ?", String.class,
        UUID.fromString(id));
    assertThat(stored).hasSize(64).isNotEqualTo(token);
  }

  @Test
  void startingALocalGameAlsoNeedsItsToken() throws Exception {
    String ip = newIp();
    MvcResult created = createLocal(ip, false);
    String token = created.getResponse().getHeader("X-Game-Token");
    String id = body(created).get("id").asText();

    mvc.perform(from(ip, post("/api/games/" + id + "/start"))).andExpect(status().isForbidden());
    mvc.perform(from(ip, post("/api/games/" + id + "/start")).header("X-Player-Token", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
  }

  @Test
  void onlineSeatCannotBeUsedFromAnotherDevice() throws Exception {
    String ip = newIp();
    JsonNode room = json.readTree(mvc.perform(from(ip, post("/api/games/online"))
            .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Ana\",\"capacity\":2}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    String id = room.get("game").get("id").asText();
    String host = room.get("playerId").asText();
    String hostToken = room.get("playerToken").asText();
    JsonNode beto = json.readTree(mvc.perform(from(ip, post("/api/games/join"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"" + room.get("game").get("code").asText() + "\",\"name\":\"Beto\"}"))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    String betoToken = beto.get("playerToken").asText();
    assertThat(betoToken).isNotEqualTo(hostToken);

    // Beto intenta arrancar haciéndose pasar por el anfitrión.
    mvc.perform(from(ip, post("/api/games/" + id + "/start")).contentType(MediaType.APPLICATION_JSON)
            .header("X-Player-Token", betoToken).content("{\"playerId\":\"" + host + "\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(from(ip, post("/api/games/" + id + "/start")).contentType(MediaType.APPLICATION_JSON)
            .header("X-Player-Token", hostToken).content("{\"playerId\":\"" + host + "\"}"))
        .andExpect(status().isOk());

    // Turno del anfitrión: Beto no puede jugar por él con su propio token.
    mvc.perform(act(ip, id, "draw", host, betoToken)).andExpect(status().isForbidden());
    mvc.perform(act(ip, id, "draw", host, hostToken)).andExpect(status().isOk());

    // Quien llega tarde mira: no recibe token de nada.
    JsonNode spectator = json.readTree(mvc.perform(from(ip, post("/api/games/join"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"" + room.get("game").get("code").asText() + "\",\"name\":\"Ceci\"}"))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    assertThat(spectator.get("playerToken").isNull()).isTrue();
  }

  @Test
  void gamesCreatedBeforeTokensKeepWorking() throws Exception {
    String ip = newIp();
    JsonNode g = body(createLocal(ip, true));
    jdbc.update("UPDATE games SET control_token_hash = NULL WHERE id = ?", UUID.fromString(g.get("id").asText()));

    mvc.perform(act(ip, g.get("id").asText(), "draw", g.get("players").get(0).get("id").asText(), null))
        .andExpect(status().isOk());
  }

  @Test
  void everyResponseCarriesSecurityHeaders() throws Exception {
    mvc.perform(from(newIp(), get("/api/health")))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Content-Type-Options", "nosniff"))
        .andExpect(header().string("X-Frame-Options", "DENY"))
        .andExpect(header().string("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"))
        .andExpect(header().string("Referrer-Policy", "no-referrer"))
        .andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(header().doesNotExist("Strict-Transport-Security"));
    // Conexión HTTPS directa, o detrás del proxy HTTPS de Render: se agrega HSTS.
    mvc.perform(from(newIp(), get("/api/health")).secure(true))
        .andExpect(header().exists("Strict-Transport-Security"));
    mvc.perform(from(newIp(), get("/api/health")).header("X-Forwarded-Proto", "https"))
        .andExpect(header().string("Strict-Transport-Security", "max-age=31536000; includeSubDomains"));
  }

  @Test
  void oversizedBodiesAreRejectedBeforeBeingRead() throws Exception {
    mvc.perform(from(newIp(), post("/api/games")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"names\":[\"" + "x".repeat(600) + "\"]}"))
        .andExpect(status().isPayloadTooLarge())
        .andExpect(jsonPath("$.errorCode").value("PAYLOAD_TOO_LARGE"));
  }

  @Test
  void creatingIsRateLimitedPerIp() throws Exception {
    String ip = newIp();
    for (int i = 0; i < 3; i++) {
      createLocal(ip, false);
    }
    mvc.perform(from(ip, post("/api/games")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"names\":[\"Ana\",\"Beto\"]}"))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists("Retry-After"))
        .andExpect(jsonPath("$.errorCode").value("RATE_LIMITED"))
        .andExpect(jsonPath("$.requestId").exists());
    // Otra IP no se ve afectada.
    createLocal(newIp(), false);
  }

  @Test
  void readsAreLimitedButHealthIsFree() throws Exception {
    String ip = newIp();
    for (int i = 0; i < 5; i++) {
      mvc.perform(from(ip, get("/api/games/history"))).andExpect(status().isOk());
    }
    mvc.perform(from(ip, get("/api/games/history"))).andExpect(status().isTooManyRequests());
    for (int i = 0; i < 10; i++) {
      mvc.perform(from(ip, get("/api/health"))).andExpect(status().isOk());
      // Fuera de /api (actuator) tampoco cuenta.
      mvc.perform(from(ip, get("/actuator/health"))).andExpect(status().isOk());
    }
  }

  @Test
  void namesWithControlCharactersAreRejected() throws Exception {
    mvc.perform(from(newIp(), post("/api/games")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"names\":[\"Ana\\u0007\",\"Beto\"]}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
  }
}
