package com.pelusa.infrastructure.web;

import com.pelusa.application.GameService;
import com.pelusa.application.dto.GameView;
import com.pelusa.application.dto.IssuedGame;
import com.pelusa.application.dto.JoinResult;
import com.pelusa.infrastructure.web.dto.ActRequest;
import com.pelusa.infrastructure.web.dto.CreateGameRequest;
import com.pelusa.infrastructure.web.dto.CreateOnlineRequest;
import com.pelusa.infrastructure.web.dto.JoinRequest;
import com.pelusa.infrastructure.web.dto.StartRequest;
import com.pelusa.infrastructure.web.dto.StealRequest;
import com.pelusa.application.dto.PlayerSummary;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Fachada HTTP fina: valida DTOs y delega. Cero reglas aquí (API_CONTRACT).
 * {@code Idempotency-Key} en POSTs de acción: reintento seguro.
 */
@RestController
@RequestMapping("/api/games")
public class GameController {
  /** Token del dispositivo que creó una partida LOCAL (respuesta de crear). */
  public static final String GAME_TOKEN_HEADER = "X-Game-Token";
  /** Token de asiento que el dispositivo manda en cada acción. */
  public static final String PLAYER_TOKEN_HEADER = "X-Player-Token";

  private final GameService service;

  public GameController(GameService service) {
    this.service = service;
  }

  /**
   * Crear partida (201). El token del dispositivo va en la cabecera
   * {@code X-Game-Token}, no en el cuerpo: el cuerpo es el mismo estado público
   * que cualquiera puede leer con GET.
   */
  @PostMapping
  public ResponseEntity<GameView> create(@Valid @RequestBody CreateGameRequest req) {
    IssuedGame issued = service.create(req.names(), req.avatars(), req.firstPlayerIndex(), req.start());
    return ResponseEntity.status(HttpStatus.CREATED)
        .header(GAME_TOKEN_HEADER, issued.token())
        .body(issued.game());
  }

  /** Abrir sala online: devuelve 201 con el código de invitación y el playerId del host. */
  @PostMapping("/online")
  @ResponseStatus(HttpStatus.CREATED)
  public JoinResult createOnline(@Valid @RequestBody CreateOnlineRequest req) {
    return service.createOnline(req.name(), req.avatar(), req.capacity());
  }

  /**
   * Unirse por código. 200 (no 201) porque la respuesta no siempre crea algo:
   * si la partida ya empezó, devuelve spectator=true y no hay jugador nuevo.
   */
  @PostMapping("/join")
  public JoinResult join(@Valid @RequestBody JoinRequest req) {
    return service.join(req.code(), req.name(), req.avatar());
  }

  @PostMapping("/{id}/start")
  public GameView start(
      @PathVariable UUID id,
      @RequestBody(required = false) @Valid StartRequest req,
      @RequestHeader(value = PLAYER_TOKEN_HEADER, required = false) String token) {
    return service.start(id, req == null ? null : req.playerId(), token);
  }

  @GetMapping("/{id}")
  public GameView state(@PathVariable UUID id) {
    return service.state(id);
  }

  /** Consultar jugadores: asiento, turno, frente y puntos guardados de cada uno. */
  @GetMapping("/{id}/players")
  public List<PlayerSummary> players(@PathVariable UUID id) {
    return service.players(id);
  }

  @PostMapping("/{id}/stash")
  public GameView stash(
      @PathVariable UUID id,
      @Valid @RequestBody ActRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestHeader(value = PLAYER_TOKEN_HEADER, required = false) String token) {
    return service.stash(id, req.playerId(), key, token);
  }

  @PostMapping("/{id}/draw")
  public GameView draw(
      @PathVariable UUID id,
      @Valid @RequestBody ActRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestHeader(value = PLAYER_TOKEN_HEADER, required = false) String token) {
    return service.draw(id, req.playerId(), key, token);
  }

  @PostMapping("/{id}/stand")
  public GameView stand(
      @PathVariable UUID id,
      @Valid @RequestBody ActRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestHeader(value = PLAYER_TOKEN_HEADER, required = false) String token) {
    return service.stand(id, req.playerId(), key, token);
  }

  @PostMapping("/{id}/steal")
  public GameView steal(
      @PathVariable UUID id,
      @Valid @RequestBody StealRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestHeader(value = PLAYER_TOKEN_HEADER, required = false) String token) {
    return service.steal(id, req.playerId(), key, token, req.value());
  }

  @GetMapping("/{id}/result")
  public GameView result(@PathVariable UUID id) {
    return service.result(id);
  }

  /**
   * Histórico. Filtros opcionales: {@code ?player=andres} (nombre parcial) o
   * {@code ?date=2026-11-03} (día en que terminó). Fecha mal escrita → 400.
   */
  @GetMapping("/history")
  public Page<GameView> history(
      @RequestParam(required = false) String player,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
      @PageableDefault(size = 20) Pageable pageable) {
    return service.history(player, date, pageable);
  }
}
