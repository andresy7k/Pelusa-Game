package com.pelusa.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pelusa.application.dto.GameView;
import com.pelusa.application.dto.GameView.PlayerView;
import com.pelusa.application.dto.GameView.ResultView;
import com.pelusa.application.dto.GameView.ScoreView;
import com.pelusa.application.dto.GameView.StashView;
import com.pelusa.application.dto.IssuedGame;
import com.pelusa.application.dto.JoinResult;
import com.pelusa.application.dto.PlayerSummary;
import com.pelusa.domain.engine.DomainException;
import com.pelusa.domain.engine.Table;
import com.pelusa.domain.engine.Table.DrawResult;
import com.pelusa.domain.engine.Table.StealResult;
import com.pelusa.domain.model.Card;
import com.pelusa.domain.port.ShufflePort;
import com.pelusa.domain.port.StarterPort;
import com.pelusa.domain.service.DeckFactory;
import com.pelusa.domain.service.RoomCode;
import com.pelusa.domain.service.ScoringService;
import com.pelusa.domain.service.ScoringService.Score;
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
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
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
  /** Largo de action_keys.action_key (V2): una clave más larga rompía el INSERT con 500. */
  private static final int MAX_KEY_LENGTH = 64;
  /** Zona del juego para filtrar el histórico por día ("terminó el 3 de noviembre"). */
  private static final ZoneId GAME_ZONE = ZoneId.of("America/Bogota");

  private final GameRepository games;
  private final PlayerRepository players;
  private final CardRepository cards;
  private final TurnRepository turns;
  private final ActionKeyRepository keys;
  private final ShufflePort shuffle;
  /** Sorteo de quién empieza (SecureRandom en prod, asiento 0 en pruebas). */
  private final StarterPort starter;
  private final ObjectMapper json;
  /** Exigir el token de asiento en cada acción (ver SeatTokens). Solo se apaga en el perfil test. */
  private final boolean requireSeatToken;

  public GameService(
      GameRepository games,
      PlayerRepository players,
      CardRepository cards,
      TurnRepository turns,
      ActionKeyRepository keys,
      ShufflePort shuffle,
      StarterPort starter,
      ObjectMapper json,
      @Value("${pelusa.security.require-seat-token:true}") boolean requireSeatToken) {
    this.games = games;
    this.players = players;
    this.cards = cards;
    this.turns = turns;
    this.keys = keys;
    this.shuffle = shuffle;
    this.starter = starter;
    this.json = json;
    this.requireSeatToken = requireSeatToken;
  }

  // ---------- creación ----------

  /**
   * Crear (y opcionalmente iniciar) en una sola transacción: el hotseat crea y
   * empieza enseguida, así se ahorra un viaje navegador → servidor → BD.
   */
  @Transactional
  public IssuedGame create(List<String> names, Integer firstPlayerIndex, boolean startNow) {
    validateNames(names);
    // Sin jugador inicial explícito, lo decide un sorteo (la UI ya no lo pregunta).
    int first = firstPlayerIndex == null ? starter.pick(names.size()) : firstPlayerIndex;
    if (first < 0 || first >= names.size()) {
      throw new IllegalArgumentException("firstPlayerIndex fuera de rango");
    }
    UUID gameId = UUID.randomUUID();
    GameEntity game = new GameEntity(gameId, "CREATED");
    List<PlayerEntity> ps = new ArrayList<>();
    for (int i = 0; i < names.size(); i++) {
      ps.add(new PlayerEntity(UUID.randomUUID(), gameId, names.get(i).trim(), i));
    }
    // El dispositivo que crea una partida LOCAL juega por todos: un solo token.
    String token = SeatTokens.issue();
    game.setControlTokenHash(SeatTokens.hash(token));
    games.save(game);
    players.saveAll(ps);
    game.setCurrentPlayerId(ps.get(first).getId());

    seedDeck(gameId);
    return new IssuedGame(startNow ? begin(game) : view(gameId, null), token);
  }

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
    String token = SeatTokens.issue();
    host.setTokenHash(SeatTokens.hash(token));
    players.save(host);
    game.setCurrentPlayerId(host.getId());
    game.setHostPlayerId(host.getId());
    games.save(game);
    seedDeck(gameId);
    return new JoinResult(view(gameId, null), host.getId(), false, token);
  }

  private String availableCode() {
    for (int attempt = 0; attempt < 5; attempt++) {
      String code = RoomCode.generate();
      if (!games.existsByCode(code)) {
        return code;
      }
    }
    throw new DomainException("CODE_COLLISION", "No se pudo generar un código único, reintenta");
  }

  @Transactional
  public JoinResult join(String code, String name) {
    validateSingleName(name);
    GameEntity game = games.findByCode(code.trim().toUpperCase(Locale.ROOT))
        .orElseThrow(() -> new DomainException("CODE_NOT_FOUND", "Ese código no existe"));
    if (!"CREATED".equals(game.getStatus())) {
      return new JoinResult(view(game.getId(), null), null, true, null);
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
    String token = SeatTokens.issue();
    player.setTokenHash(SeatTokens.hash(token));
    try {
      // saveAndFlush: el INSERT ocurre AQUÍ. Con save() la violación UNIQUE
      // aparecía después (en la próxima query o al commitear), fuera del catch → 500.
      players.saveAndFlush(player);
    } catch (DataIntegrityViolationException e) {
      // Carrera: otro request tomó el nombre o el asiento mientras decidíamos.
      // La sesión quedó inutilizable para releer; el reintento verá NAME_TAKEN/GAME_FULL.
      throw new DomainException("CONCURRENT_TURN", "La mesa cambió, reintenta");
    }
    return new JoinResult(view(game.getId(), null), player.getId(), false, token);
  }

  @Transactional
  public GameView start(UUID gameId, UUID playerId, String token) {
    GameEntity game = gameOr404(gameId);
    if ("FINISHED".equals(game.getStatus())) {
      throw new DomainException("GAME_FINISHED", "La partida ya terminó");
    }
    if ("IN_PROGRESS".equals(game.getStatus())) {
      throw new DomainException("ALREADY_STARTED", "La partida ya empezó");
    }
    // Quien pide debe ser el anfitrión. Hotseat no tiene anfitrión (null): solo
    // vale no mandar playerId. ONLINE siempre lo tiene: omitirlo NO lo saltea.
    if (!Objects.equals(playerId, game.getHostPlayerId())) {
      throw new DomainException("NOT_HOST", "Solo el anfitrión puede empezar");
    }
    List<PlayerEntity> ps = players.findByGameIdOrderBySeatAsc(gameId);
    requireSeat(game, ps, playerId, token);
    if ("ONLINE".equals(game.getMode())) {
      if (ps.size() < 2) {
        throw new DomainException("NOT_ENOUGH_PLAYERS", "Se necesitan al menos 2 jugadores");
      }
      // En una sala el sorteo es al empezar: recién ahí se sabe quiénes se sentaron.
      game.setCurrentPlayerId(ps.get(starter.pick(ps.size())).getId());
    }
    return begin(game);
  }

  /** CREATED → IN_PROGRESS y primer turno abierto (lo comparten start y create con start). */
  private GameView begin(GameEntity game) {
    game.setStatus("IN_PROGRESS");
    game.setStartedAt(OffsetDateTime.now());
    openTurn(game.getId(), game.getCurrentPlayerId(), game, OffsetDateTime.now());
    return view(game.getId(), null);
  }

  /**
   * Seguridad: el playerId es público, así que no prueba nada. Hay que traer el
   * token secreto que recibió el dispositivo al crear (LOCAL) o al sentarse (ONLINE).
   * Partidas anteriores a V8 no tienen hash y se siguen aceptando.
   */
  private void requireSeat(GameEntity game, List<PlayerEntity> ps, UUID playerId, String token) {
    if (!requireSeatToken) {
      return;
    }
    String expected = "ONLINE".equals(game.getMode())
        ? ps.stream().filter(p -> p.getId().equals(playerId)).findFirst()
            .map(PlayerEntity::getTokenHash).orElse(null)
        : game.getControlTokenHash();
    if (expected != null && !SeatTokens.matches(token, expected)) {
      throw new DomainException("SEAT_FORBIDDEN", "Este dispositivo no puede jugar por ese jugador");
    }
  }

  /** La lectura también hace cumplir el reloj (expiración perezosa, sin job). */
  @Transactional
  public GameView state(UUID gameId) {
    GameEntity game = gameOr404(gameId);
    expireIfDue(game);
    return view(gameId, null);
  }

  /** Jugadores de la mesa con su frente y puntos guardados (aplica el reloj como state). */
  @Transactional
  public List<PlayerSummary> players(UUID gameId) {
    GameView v = state(gameId);
    return v.players().stream()
        .map(p -> new PlayerSummary(p.id(), p.name(), p.seat(),
            p.id().equals(v.currentPlayerId()),
            v.fronts().get(p.id()),
            v.stashed().get(p.id()).sum()))
        .toList();
  }

  // ---------- acciones (con idempotencia) ----------

  @Transactional
  public GameView stash(UUID gameId, UUID playerId, String key, String token) {
    return guarded(gameId, playerId, key, token, (t, turn, rows) -> {
      int count = t.stashCurrent();
      frontRows(rows, playerId).forEach(c -> c.setLocation("STASHED"));
      turn.setStashed(true);
      Map<String, Object> ev = event("STASH", Map.of("count", count, "playerId", playerId.toString()));
      turn.setDetail(toJson(ev));
      return ev;
    });
  }

  @Transactional
  public GameView draw(UUID gameId, UUID playerId, String key, String token) {
    return guarded(gameId, playerId, key, token, (t, turn, rows) -> {
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
      } else if (turn.getDeadlineAt() != null) {
        // ONLINE: cada carta sacada renueva los 15 s para decidir el siguiente paso.
        turn.setDeadlineAt(OffsetDateTime.now().plusSeconds(TURN_SECONDS));
      }
      return ev;
    });
  }

  @Transactional
  public GameView stand(UUID gameId, UUID playerId, String key, String token) {
    return guarded(gameId, playerId, key, token, (t, turn, rows) -> {
      t.standCurrent();
      closeAndRotate(gameId, turn, playerId, t, "STAND");
      return event("STAND", Map.of("playerId", playerId.toString()));
    });
  }

  @Transactional
  public GameView steal(UUID gameId, UUID playerId, String key, String token, int value) {
    return guarded(gameId, playerId, key, token, (t, turn, rows) -> {
      StealResult r = t.stealCurrent(value);
      rows.stream()
          .filter(c -> "FRONT".equals(c.getLocation())
              && c.getValue() == value
              && !playerId.equals(c.getOwnerPlayerId()))
          .forEach(c -> c.setOwnerPlayerId(playerId));
      // turns.acted ya es true: robar exige haber sacado este turno (ADR-014).
      Map<String, Object> ev = event("STEAL",
          Map.of("value", value, "count", r.count(), "fromPlayerIds", r.fromPlayerIds()));
      turn.setDetail(toJson(ev));
      return ev;
    });
  }

  // ---------- histórico / resultado ----------

  /**
   * Histórico de partidas terminadas. Filtro opcional, uno u otro (si llegan los
   * dos, manda el jugador): nombre parcial sin mayúsculas ni tildes, o el día en
   * que terminó la partida, en hora de Colombia.
   */
  @Transactional(readOnly = true)
  public Page<GameView> history(String player, LocalDate date, Pageable pageable) {
    if (pageable.getPageSize() > 50) {
      throw new IllegalArgumentException("size máximo 50");
    }
    Page<GameEntity> page;
    if (player != null) {
      page = games.findFinishedWithPlayer("%" + searchable(player.trim()) + "%", pageable);
    } else if (date != null) {
      // [00:00 de ese día, 00:00 del siguiente) en Bogotá: sin la zona, una partida
      // que terminó a las 23:30 caería en el día siguiente (la BD guarda en UTC).
      OffsetDateTime start = date.atStartOfDay(GAME_ZONE).toOffsetDateTime();
      OffsetDateTime end = date.plusDays(1).atStartOfDay(GAME_ZONE).toOffsetDateTime();
      page = games.findFinishedBetween(start, end, pageable);
    } else {
      page = games.findByStatusOrderByFinishedAtDesc("FINISHED", pageable);
    }
    return page.map(g -> view(g.getId(), null));
  }

  /** Minúsculas y sin tildes ("Andrés" → "andres"), igual que la consulta en la BD. */
  private static String searchable(String text) {
    String noMarks = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    return noMarks.toLowerCase(Locale.ROOT);
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

  private GameView guarded(UUID gameId, UUID playerId, String key, String token, Action action) {
    if (key != null && (key.isBlank() || key.length() > MAX_KEY_LENGTH)) {
      throw new IllegalArgumentException("Idempotency-Key inválida (1-64 caracteres)");
    }
    // OPTIMISTIC_FORCE_INCREMENT: toda acción sube games.version aunque solo
    // cambie cartas o turnos. Dos acciones concurrentes sobre la misma versión
    // → la segunda falla al commitear → 409 CONCURRENT_TURN (ADR-006).
    GameEntity game = games.findLockedById(gameId)
        .orElseThrow(() -> new DomainException("GAME_NOT_FOUND", "La partida no existe"));
    UUID expiredPlayer = expireIfDue(game);
    // Reintento con la misma clave: se devuelve el estado actual ANTES de
    // validar el turno, porque la acción original pudo haberlo rotado o
    // terminado la partida (si no, reintentar un stand daría 409).
    if (key != null && keys.existsByGameIdAndKey(gameId, key)) {
      return view(gameId, null);
    }
    if ("FINISHED".equals(game.getStatus())) {
      throw new DomainException("GAME_FINISHED", "La partida ya terminó");
    }
    // Sin start no hay turno abierto: actuar sobre una partida CREATED era un 500.
    if ("CREATED".equals(game.getStatus())) {
      throw new DomainException("GAME_NOT_STARTED", "La partida todavía no empezó");
    }
    List<PlayerEntity> ps = players.findByGameIdOrderBySeatAsc(gameId);
    if (ps.stream().noneMatch(p -> p.getId().equals(playerId))) {
      throw new DomainException("INVALID_PLAYER", "Ese jugador no está en la partida");
    }
    requireSeat(game, ps, playerId, token);
    if (!game.getCurrentPlayerId().equals(playerId)) {
      if (playerId.equals(expiredPlayer)) {
        throw new DomainException("TURN_EXPIRED", "Se acabó el tiempo de tu turno");
      }
      throw new DomainException("NOT_YOUR_TURN", "No es tu turno");
    }
    if (key != null) {
      try {
        // Se registra ANTES de actuar y con flush inmediato: si otro request con
        // la misma clave ganó la carrera, el UNIQUE salta aquí y no se actúa dos veces.
        keys.saveAndFlush(new ActionKeyEntity(gameId, key));
      } catch (DataIntegrityViolationException race) {
        throw new DomainException("CONCURRENT_TURN", "Esa acción ya se está procesando, reintenta");
      }
    }
    List<CardEntity> rows = cards.findByGameId(gameId);
    // IN_PROGRESS siempre tiene un turno abierto: lo abren start/closeAndRotate/expireIfDue.
    TurnEntity turn = turns.findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(gameId).orElseThrow();
    Table table = rebuild(game, ps, rows, turn);
    Map<String, Object> lastEvent = action.run(table, turn, rows);
    return view(game, ps, rows, lastEvent);
  }

  private Table rebuild(GameEntity game, List<PlayerEntity> ps, List<CardEntity> rows, TurnEntity open) {
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
    // Flags del turno en curso persistidos en turns (V2/V5): sin ellos la mesa
    // reconstruida "olvidaría" si ya sacaste, guardaste o qué valor podés robar.
    table.hydrate(fronts, saved, discarded, open.isActed(), open.isStashed(), open.getLastDrawnValue());
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
  private void openTurn(UUID gameId, UUID playerId, GameEntity game, OffsetDateTime now) {
    TurnEntity turn = new TurnEntity(UUID.randomUUID(), gameId, playerId);
    if ("ONLINE".equals(game.getMode())) {
      turn.setDeadlineAt(now.plusSeconds(TURN_SECONDS));
    }
    turns.save(turn);
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
    // ONLINE + IN_PROGRESS ⇒ hay turno abierto y con plazo (openTurn lo fija;
    // V7 rellenó los turnos abiertos existentes al migrar).
    TurnEntity open = turns.findFirstByGameIdAndEndedAtIsNullOrderByStartedAtDesc(game.getId()).orElseThrow();
    OffsetDateTime now = OffsetDateTime.now();
    if (now.isBefore(open.getDeadlineAt())) {
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

  /** Caracteres de control (saltos de línea, NUL, escapes de terminal) no son un nombre. */
  private static boolean hasControlChars(String text) {
    return text.codePoints().anyMatch(Character::isISOControl);
  }

  private static void validateSingleName(String name) {
    if (name == null || name.isBlank() || name.trim().length() > 60 || hasControlChars(name)) {
      throw new IllegalArgumentException("Nombre inválido (1-60 caracteres)");
    }
  }

  private static void validateNames(List<String> names) {
    if (names == null || names.size() < 2 || names.size() > 6) {
      throw new IllegalArgumentException("La partida necesita de 2 a 6 nombres");
    }
    for (String n : names) {
      if (n == null || n.isBlank() || n.trim().length() > 60 || hasControlChars(n)) {
        throw new IllegalArgumentException("Nombre inválido (1-60 caracteres)");
      }
    }
    long distinct = names.stream().map(String::trim).distinct().count();
    if (distinct != names.size()) {
      throw new IllegalArgumentException("Los nombres no pueden repetirse");
    }
  }

  private GameView view(UUID gameId, Map<String, Object> lastEvent) {
    return view(games.getReferenceById(gameId), players.findByGameIdOrderBySeatAsc(gameId),
        cards.findByGameId(gameId), lastEvent);
  }

  /**
   * Vista a partir de datos ya cargados: tras una acción, guarded() ya tiene la
   * partida, los jugadores y las 110 cartas (gestionadas, con los cambios hechos),
   * así que no se vuelven a pedir a la BD.
   */
  private GameView view(GameEntity game, List<PlayerEntity> ps, List<CardEntity> rows,
      Map<String, Object> lastEvent) {
    UUID gameId = game.getId();
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
      // Solo el último turno con evento (antes se traían TODOS los turnos de la partida).
      event = turns.findFirstByGameIdAndDetailIsNotNullOrderByStartedAtDesc(gameId)
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
      List<ScoreView> scores = new ArrayList<>();
      for (PlayerEntity p : ps) {
        StashView s = stashed.get(p.getId());
        scores.add(new ScoreView(p.getId(), p.getName(), s.sum(), s.countsByValue()));
      }
      // Ranking con la MISMA regla que decide el ganador (suma + desempate 1→10):
      // ordenar solo por suma podía dejar al ganador segundo con sumas iguales.
      scores.sort((a, b) -> ScoringService.compare(
          new Score(b.sum(), b.countsByValue()), new Score(a.sum(), a.countsByValue())));
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
        deck, deck, lastDrawn, turnDeadline, game.getCreatedAt(), game.getStartedAt(),
        game.getFinishedAt(), playerViews, fronts, stashed, event, result);
  }
}
