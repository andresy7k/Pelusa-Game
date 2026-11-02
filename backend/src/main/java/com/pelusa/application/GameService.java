package com.pelusa.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pelusa.application.dto.GameView;
import com.pelusa.application.dto.GameView.PlayerView;
import com.pelusa.application.dto.GameView.ResultView;
import com.pelusa.application.dto.GameView.ScoreView;
import com.pelusa.application.dto.GameView.StashView;
import com.pelusa.application.dto.JoinResult;
import com.pelusa.domain.engine.DomainException;
import com.pelusa.domain.engine.Table;
import com.pelusa.domain.engine.Table.DrawResult;
import com.pelusa.domain.engine.Table.StealResult;
import com.pelusa.domain.model.Card;
import com.pelusa.domain.port.ShufflePort;
import com.pelusa.domain.service.DeckFactory;
import com.pelusa.domain.service.RoomCode;
import com.pelusa.infrastructure.persistence.ActionKeyEntity;
import com.pelusa.infrastructure.persistence.ActionKeyRepository;
import com.pelusa.infrastructure.persistence.CardEntity;
import com.pelusa.infrastructure.persistence.CardRepository;
import com.pelusa.infrastructure.persistence.GameEntity;
import com.pelusa.infrastructure.persistence.GameRepository;
import com.pelusa.infrastructure.persistence.PlayerEntity;
import com.pelusa.infrastructure.persistence.PlayerRepository;
import com.pelusa.infrastructure.persistence.TurnEntity;
import com.pelusa.infrastructure.persistence.TurnRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Casos de uso del juego. Cada método público = 1 transacción:
 * reconstruye la {@link Table} desde las entidades, ejecuta la regla en
 * memoria y persiste con writes dirigidos. La regla NUNCA vive aquí.
 */
@Service
public class GameService {
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
  /** Plazo de turno en salas ONLINE (autoridad del servidor, no del cliente). */
  private static final int TURN_SECONDS = 15;

  private final GameRepository games;
  private final PlayerRepository players;
  private final CardRepository cards;
  private final TurnRepository turns;
  private final ActionKeyRepository keys;
  private final ShufflePort shuffle;
  private final ObjectMapper json;

  public GameService(
      GameRepository games,
      PlayerRepository players,
      CardRepository cards,
      TurnRepository turns,
      ActionKeyRepository keys,
      ShufflePort shuffle,
      ObjectMapper json) {
    this.games = games;
    this.players = players;
    this.cards = cards;
    this.turns = turns;
    this.keys = keys;
    this.shuffle = shuffle;
    this.json = json;
  }

  // ---------- creación ----------

  @Transactional
  public GameView create(List<String> names, Integer firstPlayerIndex) {
    validateNames(names);
    int first = firstPlayerIndex == null ? 0 : firstPlayerIndex;
    if (first < 0 || first >= names.size()) {
      throw new IllegalArgumentException("firstPlayerIndex fuera de rango");
    }
    UUID gameId = UUID.randomUUID();
    GameEntity game = new GameEntity(gameId, "CREATED");
    List<PlayerEntity> ps = new ArrayList<>();
    for (int i = 0; i < names.size(); i++) {
      ps.add(new PlayerEntity(UUID.randomUUID(), gameId, names.get(i).trim(), i));
    }
    // Orden obligatorio: primero el padre (games), luego los hijos (players).
    // Al revés, la FK players.game_id apunta a una fila que aún no existe → 500.
    games.save(game);
    try {
      players.saveAll(ps);
    } catch (DataIntegrityViolationException e) {
      throw new DomainException("VALIDATION_FAILED", "Nombres duplicados en la partida");
    }
    game.setCurrentPlayerId(ps.get(first).getId());
    games.save(game);

    seedDeck(gameId);
    return view(gameId, null);
  }

  /**
   * Sala online: el host abre la mesa (modo ONLINE, cupo que él elige), queda
   * como jugador asiento 0 y recibe un código único para invitar. La partida
   * nace en CREATED = lobby de espera; el turno recién existe al hacer start.
   */
  @Transactional
  public JoinResult createOnline(String name, int capacity) {
    validateSingleName(name);
    if (capacity < 2 || capacity > 6) {
      throw new IllegalArgumentException("El cupo va de 2 a 6");
    }
    UUID gameId = UUID.randomUUID();
    GameEntity game = new GameEntity(gameId, "CREATED");
    game.setMode("ONLINE");
    game.setCapacity(capacity);
    game.setCode(availableCode());
    // Orden obligatorio: primero el padre (games), luego los hijos (players).
    games.save(game);

    PlayerEntity host = new PlayerEntity(UUID.randomUUID(), gameId, name.trim(), 0);
    players.save(host);
    game.setCurrentPlayerId(host.getId());
    game.setHostPlayerId(host.getId());
    games.save(game);
    seedDeck(gameId);
    return new JoinResult(view(gameId, null), host.getId(), false);
  }

  /**
   * Código único con reintento. La ventana de carrera entre "buscar" y "guardar"
   * la cierra el índice UNIQUE de la migración V6: Java evita el error común
   * (defensa amable) y la BD impide el imposible (defensa dura).
   */
  private String availableCode() {
    for (int attempt = 0; attempt < 5; attempt++) {
      String code = RoomCode.generate();
      if (!games.existsByCode(code)) {
        return code;
      }
    }
    throw new DomainException("CODE_COLLISION", "No se pudo generar un código único, reintenta");
  }

  /**
   * Unirse a una sala por código. Tres desenlaces:
   * - lobby abierto con cupo: entra como jugador en el siguiente asiento;
   * - lobby abierto pero lleno: GAME_FULL;
   * - partida ya empezada/terminada: ESPECTADOR (no se crea jugador).
   * El código es una llave: se normaliza a mayúsculas para tolerar cómo lo tecleen.
   */
  @Transactional
  public JoinResult join(String code, String name) {
    validateSingleName(name);
    GameEntity game = games.findByCode(code.trim().toUpperCase(Locale.ROOT))
        .orElseThrow(() -> new DomainException("CODE_NOT_FOUND", "Ese código no existe"));
    if (!"CREATED".equals(game.getStatus())) {
      return new JoinResult(view(game.getId(), null), null, true);
    }
    List<PlayerEntity> ps = players.findByGameIdOrderBySeatAsc(game.getId());
    if (ps.size() >= game.getCapacity()) {
      throw new DomainException("GAME_FULL", "La sala está llena");
    }
    String clean = name.trim();
    if (ps.stream().anyMatch(p -> p.getName().equalsIgnoreCase(clean))) {
      throw new DomainException("NAME_TAKEN", "Ese nombre ya está en la mesa");
    }
    PlayerEntity player = new PlayerEntity(UUID.randomUUID(), game.getId(), clean, ps.size());
    try {
      players.save(player);
    } catch (DataIntegrityViolationException e) {
      // Carrera: otro request tomó el nombre o el asiento mientras decidíamos.
      boolean nameTaken = players.findByGameIdOrderBySeatAsc(game.getId()).stream()
          .anyMatch(p -> p.getName().equalsIgnoreCase(clean));
      throw new DomainException(nameTaken ? "NAME_TAKEN" : "CONCURRENT_TURN",
          nameTaken ? "Ese nombre ya está en la mesa" : "La mesa cambió, reintenta");
    }
    return new JoinResult(view(game.getId(), null), player.getId(), false);
  }

  /** Hotseat/compatibilidad: sin playerId no se exige host. */
  @Transactional
  public GameView start(UUID gameId) {
    return start(gameId, null);
  }

  @Transactional
  public GameView start(UUID gameId, UUID playerId) {
    GameEntity game = gameOr404(gameId);
    if ("FINISHED".equals(game.getStatus())) {
      throw new DomainException("GAME_FINISHED", "La partida ya terminó");
    }
    if ("IN_PROGRESS".equals(game.getStatus())) {
      throw new DomainException("ALREADY_STARTED", "La partida ya empezó");
    }
    if (playerId != null && !playerId.equals(game.getHostPlayerId())) {
      throw new DomainException("NOT_HOST", "Solo el anfitrión puede empezar");
    }
    if ("ONLINE".equals(game.getMode())
        && players.findByGameIdOrderBySeatAsc(gameId).size() < 2) {
      throw new DomainException("NOT_ENOUGH_PLAYERS", "Se necesitan al menos 2 jugadores");
    }
    game.setStatus("IN_PROGRESS");
    game.setStartedAt(OffsetDateTime.now());
    openTurn(gameId, game.getCurrentPlayerId(), game, OffsetDateTime.now());
    return view(gameId, null);
  }

  /** La lectura también hace cumplir el reloj (expiración perezosa, sin job). */
  @Transactional
  public GameView state(UUID gameId) {
    GameEntity game = gameOr404(gameId);
    expireIfDue(game);
    return view(gameId, null);
  }

  // ---------- acciones (con idempotencia) ----------

  @Transactional
  public GameView stash(UUID gameId, UUID playerId, String key) {
    return guarded(gameId, playerId, key, (t, turn, rows) -> {
      int count = t.stashCurrent();
      frontRows(rows, playerId).forEach(c -> c.setLocation("STASHED"));
      turn.setStashed(true);
      Map<String, Object> ev = event("STASH", Map.of("count", count, "playerId", playerId.toString()));
      turn.setDetail(toJson(ev));
      return ev;
    });
  }

  @Transactional
  public GameView draw(UUID gameId, UUID playerId, String key) {
    return guarded(gameId, playerId, key, (t, turn, rows) -> {
      CardEntity top = topDust(rows)
          .orElseThrow(() -> new DomainException("DECK_EMPTY", "El mazo está vacío"));
      DrawResult r = t.drawCurrent();
      top.setLocation("FRONT");
      top.setOwnerPlayerId(playerId);
      turn.setActed(true);
      turn.setLastDrawnValue(r.drawn().value());
      Map<String, Object> ev = event("DRAW", Map.of("value", r.drawn().value(), "bust", r.bust()));
      turn.setDetail(toJson(ev));
      if (r.bust()) {
        frontRows(rows, playerId).forEach(c -> c.setLocation("DISCARDED"));
      }
      if (r.gameFinished()) {
        return finishGame(gameId, turn, t, rows, ev, r.bust() ? "BUST" : "AUTO_FINISH");
      }
      if (r.bust()) {
        closeAndRotate(gameId, turn, playerId, t, "BUST");
      }
      return ev;
    });
  }

  @Transactional
  public GameView stand(UUID gameId, UUID playerId, String key) {
    return guarded(gameId, playerId, key, (t, turn, rows) -> {
      t.standCurrent();
      closeAndRotate(gameId, turn, playerId, t, "STAND");
      return event("STAND", Map.of("playerId", playerId.toString()));
    });
  }

  @Transactional
  public GameView steal(UUID gameId, UUID playerId, String key, int value) {
    return guarded(gameId, playerId, key, (t, turn, rows) -> {
      StealResult r = t.stealCurrent(value);
      rows.stream()
          .filter(c -> "FRONT".equals(c.getLocation())
              && c.getValue() == value
              && !playerId.equals(c.getOwnerPlayerId()))
          .forEach(c -> c.setOwnerPlayerId(playerId));
      turn.setActed(true);
      Map<String, Object> ev = event("STEAL",
          Map.of("value", value, "count", r.count(), "fromPlayerIds", r.fromPlayerIds()));
      turn.setDetail(toJson(ev));
      return ev;
    });
  }

  // ---------- histórico / resultado ----------

  @Transactional(readOnly = true)
  public Page<GameView> history(Pageable pageable) {
    if (pageable.getPageSize() > 50) {
      throw new IllegalArgumentException("size máximo 50");
    }
    return games.findByStatusOrderByFinishedAtDesc("FINISHED", pageable).map(g -> view(g.getId(), null));
  }

  @Transactional(readOnly = true)
  public GameView result(UUID gameId) {
    GameEntity game = gameOr404(gameId);
    if (!"FINISHED".equals(game.getStatus())) {
      throw new DomainException("GAME_NOT_FINISHED", "La partida no terminó");
    }
    return view(gameId, null);
  }

  // ---------- internas ----------

  private interface Action {
    Map<String, Object> run(Table table, TurnEntity turn, List<CardEntity> rows);
  }

  private GameView guarded(UUID gameId, UUID playerId, String key, Action action) {
    GameEntity game = gameOr404(gameId);
    UUID expiredPlayer = expireIfDue(game);
    if ("FINISHED".equals(game.getStatus())) {
      throw new DomainException("GAME_FINISHED", "La partida ya terminó");
    }
    List<PlayerEntity> ps = players.findByGameIdOrderBySeatAsc(gameId);
    if (ps.stream().noneMatch(p -> p.getId().equals(playerId))) {
      throw new DomainException("INVALID_PLAYER", "Ese jugador no está en la partida");
    }
    if (!game.getCurrentPlayerId().equals(playerId)) {
      if (playerId.equals(expiredPlayer)) {
        throw new DomainException("TURN_EXPIRED", "Se acabó el tiempo de tu turno");
      }
      throw new DomainException("NOT_YOUR_TURN", "No es tu turno");
    }
    if (key != null && keys.existsByGameIdAndKey(gameId, key)) {
      return view(gameId, null); // reintento: mismo estado, sin actuar
    }
    List<CardEntity> rows = cards.findByGameId(gameId);
    Table table = rebuild(gameId, game, ps, rows);
    TurnEntity turn =
        turns.findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(gameId)
            .orElseGet(() -> turns.save(new TurnEntity(UUID.randomUUID(), gameId, playerId)));
    Map<String, Object> lastEvent = action.run(table, turn, rows);
    if (key != null) {
      try {
        keys.save(new ActionKeyEntity(gameId, key));
      } catch (DataIntegrityViolationException race) {
        if (keys.existsByGameIdAndKey(gameId, key)) {
          return view(gameId, null);
        }
        throw race;
      }
    }
    return view(gameId, lastEvent);
  }

  private Table rebuild(UUID gameId, GameEntity game, List<PlayerEntity> ps, List<CardEntity> rows) {
    List<UUID> order = ps.stream().map(PlayerEntity::getId).toList();
    List<Card> deck =
        rows.stream()
            .filter(c -> "DECK".equals(c.getLocation()))
            .sorted(Comparator.comparingInt(CardEntity::getPileOrder))
            .map(c -> new Card(c.getValue()))
            .toList();
    int first = 0;
    UUID current = game.getCurrentPlayerId();
    for (int i = 0; i < order.size(); i++) {
      if (order.get(i).equals(current)) {
        first = i;
      }
    }
    Table table = new Table(order, deck, first);
    Map<UUID, List<Card>> fronts = new HashMap<>();
    Map<UUID, List<Card>> saved = new HashMap<>();
    List<Card> discarded = new ArrayList<>();
    for (CardEntity c : rows) {
      switch (c.getLocation()) {
        case "FRONT" -> fronts.computeIfAbsent(c.getOwnerPlayerId(), k -> new ArrayList<>()).add(new Card(c.getValue()));
        case "STASHED" -> saved.computeIfAbsent(c.getOwnerPlayerId(), k -> new ArrayList<>()).add(new Card(c.getValue()));
        case "DISCARDED" -> discarded.add(new Card(c.getValue()));
        default -> {}
      }
    }
    boolean acted = false;
    boolean stashedFlag = false;
    Integer lastDrawn = null;
    var open = turns.findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(gameId);
    if (open.isPresent()) {
      acted = open.get().isActed();
      stashedFlag = open.get().isStashed();
      lastDrawn = open.get().getLastDrawnValue();
    }
    table.hydrate(fronts, saved, discarded, acted, stashedFlag, lastDrawn);
    return table;
  }

  /** Filas gestionadas del frente de un jugador (dirty checking las persiste). */
  private static List<CardEntity> frontRows(List<CardEntity> rows, UUID owner) {
    return rows.stream()
        .filter(c -> "FRONT".equals(c.getLocation()) && owner.equals(c.getOwnerPlayerId()))
        .toList();
  }

  /** Primera carta del mazo por pile_order (ya cargada, sin query extra). */
  private static java.util.Optional<CardEntity> topDust(List<CardEntity> rows) {
    return rows.stream()
        .filter(c -> "DECK".equals(c.getLocation()))
        .min(Comparator.comparingInt(CardEntity::getPileOrder));
  }

  private void closeAndRotate(UUID gameId, TurnEntity turn, UUID playerId, Table table, String outcome) {
    OffsetDateTime now = OffsetDateTime.now();
    turn.setEndedAt(now);
    turn.setOutcome(outcome);
    // La Table rotó en memoria: hay que persistir la rotación o el turno
    // quedaría congelado en el jugador anterior (bug real cazado por CI).
    GameEntity game = games.getReferenceById(gameId);
    game.setCurrentPlayerId(table.currentPlayerId());
    openTurn(gameId, table.currentPlayerId(), game, now);
  }

  /** Abre turno; en ONLINE le pone plazo. En hotseat no hay reloj. */
  private TurnEntity openTurn(UUID gameId, UUID playerId, GameEntity game, OffsetDateTime now) {
    TurnEntity turn = new TurnEntity(UUID.randomUUID(), gameId, playerId);
    if ("ONLINE".equals(game.getMode())) {
      turn.setDeadlineAt(now.plusSeconds(TURN_SECONDS));
    }
    return turns.save(turn);
  }

  /**
   * Expiración perezosa: si el turno ONLINE abierto pasó su plazo, lo cierra
   * como STAND con evento TURN_EXPIRED y abre el siguiente. Devuelve el
   * jugador que perdió el turno (null si no expiró nada). El cliente nunca
   * decide el tiempo: cualquier lectura/acción aplica el paso del reloj.
   */
  private UUID expireIfDue(GameEntity game) {
    if (!"ONLINE".equals(game.getMode()) || !"IN_PROGRESS".equals(game.getStatus())) {
      return null;
    }
    var openOpt = turns.findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(game.getId());
    if (openOpt.isEmpty()) {
      return null;
    }
    TurnEntity open = openOpt.get();
    OffsetDateTime deadline = open.getDeadlineAt();
    OffsetDateTime now = OffsetDateTime.now();
    if (deadline == null || now.isBefore(deadline)) {
      return null;
    }
    UUID expired = open.getPlayerId();
    open.setEndedAt(now);
    open.setOutcome("STAND");
    open.setDetail(toJson(event("TURN_EXPIRED", Map.of("playerId", expired.toString()))));
    List<PlayerEntity> ps = players.findByGameIdOrderBySeatAsc(game.getId());
    int index = 0;
    for (int i = 0; i < ps.size(); i++) {
      if (ps.get(i).getId().equals(expired)) {
        index = i;
      }
    }
    UUID next = ps.get((index + 1) % ps.size()).getId();
    game.setCurrentPlayerId(next);
    openTurn(game.getId(), next, game, now);
    return expired;
  }

  private Map<String, Object> finishGame(UUID gameId, TurnEntity turn, Table table,
      List<CardEntity> rows, Map<String, Object> lastEvent, String outcome) {
    rows.stream()
        .filter(c -> "FRONT".equals(c.getLocation()))
        .forEach(c -> c.setLocation("STASHED"));
    GameEntity game = games.getReferenceById(gameId);
    game.setStatus("FINISHED");
    game.setFinishedAt(OffsetDateTime.now());
    game.setWinnerId(table.winnerId());
    turn.setEndedAt(OffsetDateTime.now());
    turn.setOutcome(outcome);
    return lastEvent;
  }

  private String toJson(Map<String, Object> event) {
    try {
      return json.writeValueAsString(event);
    } catch (Exception e) {
      throw new IllegalStateException("No se pudo serializar el evento", e);
    }
  }

  private Map<String, Object> event(String type, Map<String, Object> data) {
    Map<String, Object> e = new LinkedHashMap<>();
    e.put("type", type);
    e.putAll(data);
    return e;
  }

  private GameEntity gameOr404(UUID gameId) {
    return games.findById(gameId)
        .orElseThrow(() -> new DomainException("GAME_NOT_FOUND", "La partida no existe"));
  }

  /** Mazo inicial: el mismo origen para partida local y sala online (DRY). */
  private void seedDeck(UUID gameId) {
    List<Card> deck = DeckFactory.shuffledDeck(shuffle);
    List<CardEntity> rows = new ArrayList<>(deck.size());
    for (int i = 0; i < deck.size(); i++) {
      rows.add(new CardEntity(UUID.randomUUID(), gameId, deck.get(i).value(), "DECK", null, i));
    }
    cards.saveAll(rows);
  }

  private static void validateSingleName(String name) {
    if (name == null || name.isBlank() || name.trim().length() > 60) {
      throw new IllegalArgumentException("Nombre inválido (1-60 caracteres)");
    }
  }

  private static void validateNames(List<String> names) {
    if (names == null || names.size() < 2 || names.size() > 6) {
      throw new IllegalArgumentException("La partida necesita de 2 a 6 nombres");
    }
    for (String n : names) {
      if (n == null || n.isBlank() || n.trim().length() > 60) {
        throw new IllegalArgumentException("Nombre inválido (1-60 caracteres)");
      }
    }
    long distinct = names.stream().map(String::trim).distinct().count();
    if (distinct != names.size()) {
      throw new IllegalArgumentException("Los nombres no pueden repetirse");
    }
  }

  private GameView view(UUID gameId, Map<String, Object> lastEvent) {
    GameEntity game = games.getReferenceById(gameId);
    List<PlayerEntity> ps = players.findByGameIdOrderBySeatAsc(gameId);
    List<CardEntity> rows = cards.findByGameId(gameId);
    int deck = 0;
    Map<UUID, List<Integer>> fronts = new HashMap<>();
    Map<UUID, List<Integer>> stashValues = new HashMap<>();
    for (PlayerEntity p : ps) {
      fronts.put(p.getId(), new ArrayList<>());
      stashValues.put(p.getId(), new ArrayList<>());
    }
    for (CardEntity c : rows) {
      switch (c.getLocation()) {
        case "DECK" -> deck++;
        case "FRONT" -> fronts.get(c.getOwnerPlayerId()).add(c.getValue());
        case "STASHED" -> stashValues.get(c.getOwnerPlayerId()).add(c.getValue());
        default -> {}
      }
    }
    Map<UUID, StashView> stashed = new HashMap<>();
    for (var e : stashValues.entrySet()) {
      int sum = e.getValue().stream().mapToInt(Integer::intValue).sum();
      Map<Integer, Long> counts = new HashMap<>();
      for (int v : e.getValue()) {
        counts.merge(v, 1L, Long::sum);
      }
      stashed.put(e.getKey(), new StashView(sum, counts));
    }
    Map<String, Object> event = lastEvent;
    if (event == null) {
      event = turns.findByGameIdOrderByStartedAtDesc(gameId).stream()
          .filter(t -> t.getDetail() != null)
          .findFirst()
          .map(t -> {
            try {
              return json.readValue(t.getDetail(), MAP_TYPE);
            } catch (Exception ex) {
              return null;
            }
          })
          .orElse(null);
    }
    ResultView result = null;
    if ("FINISHED".equals(game.getStatus())) {
      Map<UUID, String> names = new HashMap<>();
      for (PlayerEntity p : ps) {
        names.put(p.getId(), p.getName());
      }
      List<ScoreView> scores = new ArrayList<>();
      for (PlayerEntity p : ps) {
        StashView s = stashed.get(p.getId());
        scores.add(new ScoreView(p.getId(), p.getName(), s.sum(), s.countsByValue()));
      }
      scores.sort((a, b) -> Integer.compare(b.sum(), a.sum()));
      result = new ResultView(game.getWinnerId(), game.getWinnerId() == null, "DECK_EMPTY", scores);
    }
    List<PlayerView> playerViews =
        ps.stream().map(p -> new PlayerView(p.getId(), p.getName(), p.getSeat())).toList();
    // R-01/ADR-014: valor robable este turno = última carta sacada (null si no hay).
    // La próxima carta del mazo NO se expone (§11 del contrato): filtra estrategia.
    var openTurn = turns.findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(gameId);
    Integer lastDrawn = openTurn.map(TurnEntity::getLastDrawnValue).orElse(null);
    OffsetDateTime turnDeadline = openTurn.map(TurnEntity::getDeadlineAt).orElse(null);
    return new GameView(game.getId(), game.getStatus(), game.getCurrentPlayerId(),
        game.getHostPlayerId(), game.getCode(), game.getMode(), game.getCapacity(),
        deck, lastDrawn, turnDeadline, playerViews, fronts, stashed, event, result);
  }
}
