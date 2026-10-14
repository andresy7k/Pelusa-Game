package com.pelusa.domain.engine;

import com.pelusa.domain.model.Card;
import com.pelusa.domain.model.GameStatus;
import com.pelusa.domain.policy.BustPolicy;
import com.pelusa.domain.policy.StashPolicy;
import com.pelusa.domain.policy.StealPolicy;
import com.pelusa.domain.service.ScoringService;
import com.pelusa.domain.service.ScoringService.Score;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Mesa de juego en memoria. Java puro: sin Spring, sin JPA, sin I/O.
 *
 * <p>Una instancia = una partida. Phase 4 la reconstruye desde las entidades
 * al inicio de cada request y la persiste al final, todo en 1 transacción.
 *
 * <p>Reglas aplicadas aquí: R-01 robo solo en turno (todas las del valor),
 * R-02 bust = repetido && frente>=3 post-colocación, R-03 suma + desempate
 * 1→10, I-05 stash solo al inicio del turno, I-06 fin al agotarse el mazo.
 */
public class Table {
  private final List<UUID> playerOrder;
  private int currentIndex;
  private final Map<UUID, List<Card>> fronts = new HashMap<>();
  private final Map<UUID, List<Card>> stashed = new HashMap<>();
  private final List<Card> discarded = new ArrayList<>();
  private final Deque<Card> deck;
  private GameStatus status = GameStatus.IN_PROGRESS;
  private boolean actedThisTurn;
  private boolean stashedThisTurn;
  private UUID winnerId;
  private boolean tie;
  private Map<UUID, Score> scores = Map.of();

  /**
   * @param players orden de turno (2-6, sin duplicados)
   * @param deck cartas del mazo; la primera de la lista se saca primero.
   *     Prod pasa {@code DeckFactory.shuffledDeck(...)}; los tests pasan mazos amañados.
   * @param firstPlayerIndex quién empieza
   */
  public Table(List<UUID> players, List<Card> deck, int firstPlayerIndex) {
    if (players.size() < 2 || players.size() > 6) {
      throw new IllegalArgumentException("La partida necesita de 2 a 6 jugadores");
    }
    if (firstPlayerIndex < 0 || firstPlayerIndex >= players.size()) {
      throw new IllegalArgumentException("firstPlayerIndex fuera de rango");
    }
    this.playerOrder = List.copyOf(players);
    this.currentIndex = firstPlayerIndex;
    this.deck = new ArrayDeque<>(deck);
    for (UUID p : players) {
      fronts.put(p, new ArrayList<>());
      stashed.put(p, new ArrayList<>());
    }
  }

  public UUID currentPlayerId() {
    return playerOrder.get(currentIndex);
  }

  /** Guardar pelusas: frente propio → puntos. Solo al inicio del turno. */
  public int stashCurrent() {
    requireInProgress();
    List<Card> front = fronts.get(currentPlayerId());
    if (stashedThisTurn) {
      throw new DomainException("ALREADY_STASHED_THIS_TURN", "Ya guardaste este turno");
    }
    if (!StashPolicy.canStash(actedThisTurn, false, front)) {
      throw new DomainException("NO_STASHABLE_CARDS", "No hay cartas guardables (frente vacío o ya actuaste)");
    }
    stashed.get(currentPlayerId()).addAll(front);
    int count = front.size();
    front.clear();
    stashedThisTurn = true;
    return count;
  }

  /** Sacar carta del mazo. Puede causar bust o terminar la partida. */
  public DrawResult drawCurrent() {
    requireInProgress();
    if (deck.isEmpty()) {
      throw new DomainException("DECK_EMPTY", "El mazo está vacío");
    }
    Card drawn = deck.removeFirst();
    List<Card> front = fronts.get(currentPlayerId());
    front.add(drawn);
    actedThisTurn = true;

    if (BustPolicy.isBust(front, drawn)) {
      discarded.addAll(front);
      front.clear();
      nextTurn();
      if (deck.isEmpty()) {
        finish(); // el mazo se agotó con el bust: también termina
        return new DrawResult(drawn, true, true);
      }
      return new DrawResult(drawn, true, false);
    }
    if (deck.isEmpty()) {
      finish();
      return new DrawResult(drawn, false, true);
    }
    return new DrawResult(drawn, false, false);
  }

  /** Plantarse voluntariamente y pasar el turno. */
  public void standCurrent() {
    requireInProgress();
    nextTurn();
  }

  /**
   * Robar: trae a mi frente TODAS las cartas del valor pedido que estén
   * boca arriba en frentes ajenos. No dispara bust (solo el draw lo hace).
   */
  public StealResult stealCurrent(int value) {
    requireInProgress();
    if (value < 1 || value > 10) {
      throw new IllegalArgumentException("value debe estar entre 1 y 10");
    }
    UUID me = currentPlayerId();
    List<Card> taken = new ArrayList<>();
    List<UUID> victims = new ArrayList<>();
    for (UUID other : playerOrder) {
      if (other.equals(me)) {
        continue;
      }
      List<Card> found = StealPolicy.stealable(fronts.get(other), value);
      if (!found.isEmpty()) {
        fronts.get(other).removeAll(found);
        taken.addAll(found);
        victims.add(other);
      }
    }
    if (taken.isEmpty()) {
      throw new DomainException("NO_STEALABLE_CARDS", "Nadie tiene ese valor boca arriba");
    }
    fronts.get(me).addAll(taken);
    actedThisTurn = true;
    return new StealResult(value, taken.size(), List.copyOf(victims));
  }

  /** Fin I-06: mazo vacío → auto-stash de frentes, puntuación, ganador. */
  private void finish() {
    for (UUID p : playerOrder) {
      stashed.get(p).addAll(fronts.get(p));
      fronts.get(p).clear();
    }
    Map<UUID, Score> result = new HashMap<>();
    for (UUID p : playerOrder) {
      result.put(p, ScoringService.score(stashed.get(p)));
    }
    UUID best = null;
    boolean draw = false;
    for (UUID p : playerOrder) {
      if (best == null) {
        best = p;
      } else {
        int cmp = ScoringService.compare(result.get(p), result.get(best));
        if (cmp > 0) {
          best = p;
          draw = false;
        } else if (cmp == 0) {
          draw = true;
        }
      }
    }
    this.scores = Collections.unmodifiableMap(result);
    this.tie = draw;
    this.winnerId = draw ? null : best;
    this.status = GameStatus.FINISHED;
  }

  private void nextTurn() {
    currentIndex = (currentIndex + 1) % playerOrder.size();
    actedThisTurn = false;
    stashedThisTurn = false;
  }

  private void requireInProgress() {
    if (status == GameStatus.FINISHED) {
      throw new DomainException("GAME_FINISHED", "La partida ya terminó");
    }
  }

  /**
   * Hidratación desde persistencia (Phase 4): el service reconstruye frentes,
   * puntos y flags del turno en curso sobre una mesa fresca. Solo llamar una vez.
   */
  public void hydrate(
      Map<UUID, List<Card>> savedFronts,
      Map<UUID, List<Card>> savedStashed,
      List<Card> savedDiscarded,
      boolean acted,
      boolean stashedFlag) {
    for (UUID p : playerOrder) {
      fronts.get(p).addAll(savedFronts.getOrDefault(p, List.of()));
      stashed.get(p).addAll(savedStashed.getOrDefault(p, List.of()));
    }
    discarded.addAll(savedDiscarded);
    this.actedThisTurn = acted;
    this.stashedThisTurn = stashedFlag;
  }

  // --- Lecturas para el service (Phase 4 mapea a DTOs/entidades) ---

  public GameStatus status() {
    return status;
  }

  public int deckRemaining() {
    return deck.size();
  }

  public Map<UUID, List<Card>> fronts() {
    return Collections.unmodifiableMap(fronts);
  }

  public Map<UUID, List<Card>> stashed() {
    return Collections.unmodifiableMap(stashed);
  }

  public List<Card> discarded() {
    return Collections.unmodifiableList(discarded);
  }

  public UUID winnerId() {
    return winnerId;
  }

  public boolean isTie() {
    return tie;
  }

  public Map<UUID, Score> scores() {
    return scores;
  }

  public record DrawResult(Card drawn, boolean bust, boolean gameFinished) {}

  public record StealResult(int value, int count, List<UUID> fromPlayerIds) {}
}
