package com.pelusa.infrastructure.web;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pelusa.application.GameService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Slice web (@WebMvcTest): solo controller + GlobalExceptionHandler, con el
 * service como mock. Sirve para probar el CONTRATO HTTP de errores que no se
 * pueden provocar de forma determinista con la BD real (conflicto optimista,
 * excepción inesperada). Sin filtros: así también se cubre la respuesta sin requestId.
 */
@WebMvcTest(GameController.class)
@AutoConfigureMockMvc(addFilters = false)
class GameControllerSliceTest {
  @Autowired MockMvc mvc;
  @MockitoBean GameService service;

  private final UUID game = UUID.randomUUID();
  private final UUID ana = UUID.randomUUID();

  @Test
  void optimisticLockConflictIs409ConcurrentTurn() throws Exception {
    when(service.draw(eq(game), eq(ana), any(), any()))
        .thenThrow(new ObjectOptimisticLockingFailureException("GameEntity", game));

    mvc.perform(post("/api/games/" + game + "/draw").contentType(MediaType.APPLICATION_JSON)
            .content("{\"playerId\":\"" + ana + "\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.errorCode").value("CONCURRENT_TURN"))
        .andExpect(jsonPath("$.requestId").doesNotExist());
  }

  @Test
  void unexpectedErrorIs500WithoutLeakingDetails() throws Exception {
    when(service.stand(eq(game), eq(ana), any(), any())).thenThrow(new RuntimeException("password=hunter2"));

    mvc.perform(post("/api/games/" + game + "/stand").contentType(MediaType.APPLICATION_JSON)
            .content("{\"playerId\":\"" + ana + "\"}"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.errorCode").value("INTERNAL"))
        .andExpect(content().string(not(containsString("hunter2"))));
  }

  @Test
  void malformedJsonIs400AndNeverReachesService() throws Exception {
    mvc.perform(post("/api/games/" + game + "/draw").contentType(MediaType.APPLICATION_JSON)
            .content("{\"playerId\": "))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    mvc.perform(post("/api/games/" + game + "/draw").contentType(MediaType.APPLICATION_JSON)
            .content("{\"playerId\":\"no-uuid\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/api/games/" + game + "/draw").contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isBadRequest());
    verifyNoInteractions(service);
  }

  @Test
  void controllerForwardsBodyHeaderAndPathUntouched() throws Exception {
    mvc.perform(post("/api/games/" + game + "/steal").contentType(MediaType.APPLICATION_JSON)
            .header("Idempotency-Key", "k-42")
            .header("X-Player-Token", "tok-secreto")
            .content("{\"playerId\":\"" + ana + "\",\"value\":4}"))
        .andExpect(status().isOk());
    // El token de asiento llega intacto al servicio (ahí se valida).
    verify(service).steal(game, ana, "k-42", "tok-secreto", 4);

    mvc.perform(post("/api/games/" + game + "/start")).andExpect(status().isOk());
    verify(service).start(game, null, null);
  }
}
