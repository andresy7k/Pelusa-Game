package com.pelusa.infrastructure.web;

import com.pelusa.application.GameService;
import com.pelusa.application.dto.GameView;
import com.pelusa.infrastructure.web.dto.ActRequest;
import com.pelusa.infrastructure.web.dto.CreateGameRequest;
import com.pelusa.infrastructure.web.dto.StealRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Fachada HTTP fina: valida DTOs y delega. Cero reglas aquí (API_CONTRACT).
 * {@code Idempotency-Key} en POSTs de acción: reintento seguro.
 */
@RestController
@RequestMapping("/api/games")
public class GameController {
  private final GameService service;

  public GameController(GameService service) {
    this.service = service;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public GameView create(@Valid @RequestBody CreateGameRequest req) {
    return service.create(req.names(), req.firstPlayerIndex());
  }

  @PostMapping("/{id}/start")
  public GameView start(@PathVariable UUID id) {
    return service.start(id);
  }

  @GetMapping("/{id}")
  public GameView state(@PathVariable UUID id) {
    return service.state(id);
  }

  @PostMapping("/{id}/stash")
  public GameView stash(
      @PathVariable UUID id,
      @Valid @RequestBody ActRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    return service.stash(id, req.playerId(), key);
  }

  @PostMapping("/{id}/draw")
  public GameView draw(
      @PathVariable UUID id,
      @Valid @RequestBody ActRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    return service.draw(id, req.playerId(), key);
  }

  @PostMapping("/{id}/stand")
  public GameView stand(
      @PathVariable UUID id,
      @Valid @RequestBody ActRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    return service.stand(id, req.playerId(), key);
  }

  @PostMapping("/{id}/steal")
  public GameView steal(
      @PathVariable UUID id,
      @Valid @RequestBody StealRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    return service.steal(id, req.playerId(), key, req.value());
  }

  @GetMapping("/{id}/result")
  public GameView result(@PathVariable UUID id) {
    return service.result(id);
  }

  @GetMapping("/history")
  public Page<GameView> history(@PageableDefault(size = 20) Pageable pageable) {
    return service.history(pageable);
  }
}
