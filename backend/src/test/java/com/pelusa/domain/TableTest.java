package com.pelusa.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.pelusa.domain.engine.DomainException;
import com.pelusa.domain.engine.Table;
import com.pelusa.domain.engine.Table.DrawResult;
import com.pelusa.domain.model.Card;
import com.pelusa.domain.model.GameStatus;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * El engine con mazos amañados: prueba comportamiento real de punta a punta
 * sin Spring ni DB (eso llega en Phase 4 con MockMvc).
 */
class TableTest {

  private static List<Card> deck(int... values) {
    return java.util.Arrays.stream(values).mapToObj(Card::new).toList();
  }

  private static Table twoPlayers(int first, int... deck) {
    UUID ana = UUID.fromString("00000000-0000-0000-0000-000000000001");
    UUID beto = UUID.fromString("00000000-0000-0000-0000-000000000002");
    return new Table(List.of(ana, beto), deck(deck), first);
  }

  @Test
  void drawAndStandRotatesTurn() {
    Table t = twoPlayers(0, 4, 5, 6);
    UUID ana = t.currentPlayerId();
    DrawResult r = t.drawCurrent();
    assertThat(r.drawn()).isEqualTo(new Card(4));
    assertThat(r.bust()).isFalse();
    t.standCurrent();
    assertThat(t.currentPlayerId()).isNotEqualTo(ana);
  }

  @Test
  void repeatWithThreeFrontsIsBustAndDiscards() {
    // Frente de Ana: 4,5 + saca 4 → bust: frente a descarte, turno a Beto
    Table t = twoPlayers(0, 4, 5, 4, 9, 9);
    t.drawCurrent(); // 4
    t.drawCurrent(); // 5
    DrawResult bust = t.drawCurrent(); // 4 repetido con 3 → bust
    assertThat(bust.bust()).isTrue();
    assertThat(t.discarded()).containsExactly(new Card(4), new Card(5), new Card(4));
    assertThat(t.fronts().get(UUID.fromString("00000000-0000-0000-0000-000000000001"))).isEmpty();
    assertThat(t.currentPlayerId())
        .isEqualTo(UUID.fromString("00000000-0000-0000-0000-000000000002"));
  }

  @Test
  void repeatBelowThreeKeepsPlaying() {
    Table t = twoPlayers(0, 4, 4, 6, 7);
    t.drawCurrent(); // 4
    DrawResult second = t.drawCurrent(); // 4 repetido pero frente=2 → sigue
    assertThat(second.bust()).isFalse();
    assertThat(t.status()).isEqualTo(GameStatus.IN_PROGRESS);
  }

  @Test
  void stashMovesFrontToPointsOnlyAtTurnStart() {
    Table t = twoPlayers(0, 4, 5, 6, 7, 8);
    t.drawCurrent(); // 4 (frente turno en curso: no guardable)
    t.standCurrent(); // pasa a Beto
    t.drawCurrent(); // Beto saca 5
    t.standCurrent(); // vuelve a Ana, su 4 es de turno anterior
    int count = t.stashCurrent();
    assertThat(count).isEqualTo(1);
    assertThat(t.stashed().get(t.currentPlayerId()))
        .containsExactly(new Card(4));
    assertThat(t.fronts().get(t.currentPlayerId())).as("guardar vacía el frente").isEmpty();
  }

  @Test
  void stashAfterDrawingFails() {
    Table t = twoPlayers(0, 4, 5, 6);
    t.drawCurrent();
    assertThatThrownBy(t::stashCurrent)
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("NO_STASHABLE_CARDS");
  }

  @Test
  void stealTakesAllOfLastDrawnValueFromOtherFronts() {
    // Ana saca 4 este turno; Beto tiene 4,4 boca arriba → Ana roba ambas (R-01/ADR-014)
    Table t = twoPlayers(0, 4, 4, 4, 4, 9, 9);
    t.drawCurrent(); // Ana 4 (turno 1)
    t.standCurrent();
    t.drawCurrent(); // Beto 4
    t.drawCurrent(); // Beto 4 (frente 2, sin bust)
    t.standCurrent(); // vuelve Ana
    t.drawCurrent(); // Ana 4 (última sacada = 4)
    var steal = t.stealCurrent(4);
    assertThat(steal.count()).isEqualTo(2);
    assertThat(t.fronts().get(t.currentPlayerId()))
        .containsExactly(new Card(4), new Card(4), new Card(4), new Card(4));
  }

  @Test
  void stealOfValueOtherThanLastDrawnFails() {
    // Regresión del bug reportado: Ana sacó 7 y Beto tiene 4 y 9 boca arriba.
    // Antes se robaba cualquiera de ellos; ahora solo vale la última sacada.
    Table t = twoPlayers(0, 4, 4, 9, 7, 9, 7);
    t.drawCurrent(); // Ana 4 (turno 1)
    t.standCurrent();
    t.drawCurrent(); // Beto 4
    t.drawCurrent(); // Beto 9
    t.standCurrent();
    t.drawCurrent(); // Ana 7 (última sacada = 7)
    assertThatThrownBy(() -> t.stealCurrent(4))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("STEAL_VALUE_MISMATCH");
    assertThatThrownBy(() -> t.stealCurrent(9))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("STEAL_VALUE_MISMATCH");
  }

  @Test
  void stealBeforeDrawingThisTurnFails() {
    // Beto tiene un 4 boca arriba y es el turno de Ana, pero Ana aún no sacó.
    Table t = twoPlayers(0, 4, 4, 5);
    t.drawCurrent(); // Ana 4 (turno 1)
    t.standCurrent();
    t.drawCurrent(); // Beto 4
    t.standCurrent(); // Ana turno 2: sin draw todavía
    assertThatThrownBy(() -> t.stealCurrent(4))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("STEAL_VALUE_MISMATCH");
  }

  @Test
  void stealWithNoMatchingCardFails() {
    Table t = twoPlayers(0, 4, 5, 6, 7);
    t.drawCurrent(); // Ana 4
    t.standCurrent();
    t.drawCurrent(); // Beto 5
    t.standCurrent();
    t.drawCurrent(); // Ana 6 (última = 6; Beto no tiene ningún 6)
    assertThatThrownBy(() -> t.stealCurrent(6))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("NO_STEALABLE_CARDS");
  }

  @Test
  void emptyDustFinishesGameAndDeclaresWinner() {
    // Mazo: [5, 1] → Ana 5, Beto 1 → gana Ana (5>1), auto-stash aplicado
    Table t = twoPlayers(0, 5, 1);
    t.drawCurrent(); // Ana 5
    t.standCurrent();
    DrawResult last = t.drawCurrent(); // Beto 1, mazo vacío → fin
    assertThat(last.gameFinished()).isTrue();
    assertThat(t.status()).isEqualTo(GameStatus.FINISHED);
    assertThat(t.isTie()).isFalse();
    assertThat(t.winnerId()).isEqualTo(UUID.fromString("00000000-0000-0000-0000-000000000001"));
  }

  @Test
  void bustOnLastDustCardAlsoFinishes() {
    // Mazo [4,5,4]: Ana saca las 3 y revienta con la última → fin igual
    Table t = twoPlayers(0, 4, 5, 4);
    t.drawCurrent();
    t.drawCurrent();
    DrawResult bust = t.drawCurrent();
    assertThat(bust.bust()).isTrue();
    assertThat(bust.gameFinished()).isTrue();
    assertThat(t.status()).isEqualTo(GameStatus.FINISHED);
  }

  @Test
  void finishExposesScoresAndEmptyDeck() {
    Table t = twoPlayers(0, 5, 1);
    assertThat(t.deckRemaining()).isEqualTo(2);
    t.drawCurrent();
    assertThat(t.lastDrawnValue()).isEqualTo(5);
    assertThat(t.deckRemaining()).isEqualTo(1);
    t.standCurrent();
    assertThat(t.lastDrawnValue()).as("el valor robable se limpia al rotar").isNull();
    t.drawCurrent();
    assertThat(t.deckRemaining()).isZero();
    // Auto-stash al terminar: los frentes pasan a puntos y quedan vacíos.
    assertThat(t.scores().get(ANA).sum()).isEqualTo(5);
    assertThat(t.scores().get(BETO).sum()).isEqualTo(1);
    assertThat(t.fronts().get(ANA)).isEmpty();
    assertThat(t.stashed().get(BETO)).containsExactly(new Card(1));
  }

  @Test
  void bustedCardsNeverReachPoints() {
    // Ana guarda un 9 de antes, luego revienta: su puntuación final es solo el 9.
    Table t = twoPlayers(0, 9, 2, 4, 5, 4, 3);
    t.drawCurrent(); // Ana 9
    t.standCurrent();
    t.drawCurrent(); // Beto 2
    t.standCurrent();
    t.stashCurrent(); // Ana guarda 9
    t.drawCurrent(); // 4
    t.drawCurrent(); // 5
    DrawResult bust = t.drawCurrent(); // 4 → bust con 3
    assertThat(bust.bust()).isTrue();
    assertThat(t.stashed().get(ANA)).containsExactly(new Card(9));
    t.drawCurrent(); // Beto 3 → mazo vacío
    assertThat(t.scores().get(ANA).sum()).isEqualTo(9);
    assertThat(t.scores().get(BETO).sum()).isEqualTo(5);
  }

  @Test
  void repeatWithMoreThanThreeIsBust() {
    Table t = twoPlayers(0, 1, 2, 3, 2, 9);
    t.drawCurrent();
    t.drawCurrent();
    assertThat(t.drawCurrent().bust()).isFalse(); // 1,2,3 sin repetir
    DrawResult bust = t.drawCurrent(); // 2 repetido con 4 en el frente
    assertThat(bust.bust()).isTrue();
    assertThat(t.discarded()).hasSize(4);
    assertThat(t.currentPlayerId()).isEqualTo(BETO);
  }

  @Test
  void tieBetweenFirstTwoSurvivesLowerThird() {
    // Ana 5, Beto 5, Ceci 1 → empate Ana/Beto, sin ganador.
    Table t = threePlayers(5, 5, 1);
    playOneEach(t);
    assertThat(t.isTie()).isTrue();
    assertThat(t.winnerId()).isNull();
  }

  @Test
  void laterHigherScoreBreaksEarlierTie() {
    // Ana 3, Beto 3 (empate parcial), Ceci 8 → gana Ceci, no hay empate.
    Table t = threePlayers(3, 3, 8);
    playOneEach(t);
    assertThat(t.isTie()).isFalse();
    assertThat(t.winnerId()).isEqualTo(CECI);
  }

  @Test
  void laterPlayerTyingTheLeaderIsTie() {
    // Ana 7, Beto 2, Ceci 7 → empate Ana/Ceci.
    Table t = threePlayers(7, 2, 7);
    playOneEach(t);
    assertThat(t.isTie()).isTrue();
    assertThat(t.winnerId()).isNull();
  }

  @Test
  void winnerCanBeLastSeatWithoutTie() {
    Table t = threePlayers(1, 2, 3);
    playOneEach(t);
    assertThat(t.winnerId()).isEqualTo(CECI);
    assertThat(t.isTie()).isFalse();
  }

  @Test
  void turnRotationWrapsAroundFromLastSeat() {
    Table t = new Table(List.of(ANA, BETO, CECI), deck(4, 5, 6, 7), 2);
    assertThat(t.currentPlayerId()).isEqualTo(CECI);
    t.drawCurrent();
    t.standCurrent();
    assertThat(t.currentPlayerId()).isEqualTo(ANA);
  }

  @Test
  void standWithoutDrawingFailsEvenAfterStashing() {
    Table t = twoPlayers(0, 4, 5, 6);
    assertThatThrownBy(t::standCurrent)
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("MUST_DRAW_FIRST");
    t.drawCurrent();
    t.standCurrent();
    t.drawCurrent();
    t.standCurrent();
    t.stashCurrent(); // Ana guarda su 4: guardar no cuenta como sacar
    assertThatThrownBy(t::standCurrent)
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("MUST_DRAW_FIRST");
    assertThat(t.currentPlayerId()).isEqualTo(ANA);
  }

  @Test
  void stashTwiceInSameTurnFails() {
    Table t = twoPlayers(0, 4, 5, 6);
    t.drawCurrent();
    t.standCurrent();
    t.drawCurrent(); // Beto 5
    t.standCurrent();
    t.stashCurrent();
    assertThatThrownBy(t::stashCurrent)
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("ALREADY_STASHED_THIS_TURN");
  }

  @Test
  void drawFromEmptyDeckFails() {
    Table t = new Table(List.of(ANA, BETO), List.of(), 0);
    assertThatThrownBy(t::drawCurrent)
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("DECK_EMPTY");
  }

  @Test
  void stealRejectsOutOfRangeValues() {
    Table t = twoPlayers(0, 4, 5);
    t.drawCurrent();
    assertThatThrownBy(() -> t.stealCurrent(0)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> t.stealCurrent(11)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void stealAcceptsBoundaryValuesOneAndTen() {
    // 1 y 10 son valores válidos: llegan a la regla (aquí, nadie los tiene → NO_STEALABLE).
    Table low = twoPlayers(0, 1, 9);
    low.drawCurrent();
    assertThatThrownBy(() -> low.stealCurrent(1))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("NO_STEALABLE_CARDS");
    Table high = twoPlayers(0, 10, 9);
    high.drawCurrent();
    assertThatThrownBy(() -> high.stealCurrent(10))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("NO_STEALABLE_CARDS");
  }

  @Test
  void stealDoesNotTakeOwnCardsNorTriggerBust() {
    // Ana tiene 4 de antes y saca otro 4; Beto tiene un 4: solo se roba el de Beto.
    Table t = twoPlayers(0, 4, 4, 7, 4, 9);
    t.drawCurrent(); // Ana 4
    t.standCurrent();
    t.drawCurrent(); // Beto 4
    t.drawCurrent(); // Beto 7
    t.standCurrent();
    t.drawCurrent(); // Ana 4 (frente 4,4: 2 cartas, sigue)
    var steal = t.stealCurrent(4);
    assertThat(steal.count()).isEqualTo(1);
    assertThat(steal.fromPlayerIds()).containsExactly(BETO);
    assertThat(t.fronts().get(ANA)).containsExactly(new Card(4), new Card(4), new Card(4));
    assertThat(t.fronts().get(BETO)).containsExactly(new Card(7));
    assertThat(t.status()).isEqualTo(GameStatus.IN_PROGRESS);
    assertThat(t.currentPlayerId()).as("robar no rota el turno").isEqualTo(ANA);
  }

  @Test
  void constructorValidatesPlayersAndFirstIndex() {
    assertThatThrownBy(() -> new Table(List.of(ANA), deck(1), 0))
        .isInstanceOf(IllegalArgumentException.class);
    List<UUID> seven = java.util.stream.Stream.generate(UUID::randomUUID).limit(7).toList();
    assertThatThrownBy(() -> new Table(seven, deck(1), 0))
        .isInstanceOf(IllegalArgumentException.class);
    List<UUID> six = java.util.stream.Stream.generate(UUID::randomUUID).limit(6).toList();
    assertThat(new Table(six, deck(1), 5).currentPlayerId()).isEqualTo(six.get(5));
    assertThatThrownBy(() -> new Table(List.of(ANA, BETO), deck(1), -1))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new Table(List.of(ANA, BETO), deck(1), 2))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void hydrateRestoresTurnFlags() {
    Table t = twoPlayers(0, 6, 9);
    t.hydrate(java.util.Map.of(BETO, List.of(new Card(6))), java.util.Map.of(), List.of(new Card(2)),
        true, false, 6);
    assertThat(t.lastDrawnValue()).isEqualTo(6);
    assertThat(t.discarded()).containsExactly(new Card(2));
    // acted=true → ya no puede guardar; pero sí robar el 6 de Beto.
    assertThatThrownBy(t::stashCurrent).isInstanceOf(DomainException.class);
    assertThat(t.stealCurrent(6).count()).isEqualTo(1);
  }

  private static final UUID ANA = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID BETO = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final UUID CECI = UUID.fromString("00000000-0000-0000-0000-000000000003");

  private static Table threePlayers(int... deck) {
    return new Table(List.of(ANA, BETO, CECI), deck(deck), 0);
  }

  /** Cada jugador saca una carta y se planta; la última agota el mazo. */
  private static void playOneEach(Table t) {
    t.drawCurrent();
    t.standCurrent();
    t.drawCurrent();
    t.standCurrent();
    t.drawCurrent();
    assertThat(t.status()).isEqualTo(GameStatus.FINISHED);
  }

  @Test
  void actionsAfterFinishFail() {
    Table t = twoPlayers(0, 5, 1);
    t.drawCurrent();
    t.standCurrent();
    t.drawCurrent(); // fin
    assertThatThrownBy(t::drawCurrent)
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("GAME_FINISHED");
    for (Runnable action : List.<Runnable>of(t::standCurrent, t::stashCurrent, () -> t.stealCurrent(1))) {
      assertThatThrownBy(action::run)
          .isInstanceOf(DomainException.class)
          .extracting(e -> ((DomainException) e).getCode())
          .isEqualTo("GAME_FINISHED");
    }
  }
}
