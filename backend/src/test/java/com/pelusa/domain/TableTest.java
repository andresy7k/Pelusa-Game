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
    // Regresión del bug reportado: Ana sacó 7 y Beto tiene un 4 boca arriba.
    // Antes se robaba el 4 igual; ahora solo vale el valor de la última sacada.
    Table t = twoPlayers(0, 4, 4, 4, 9, 7, 7);
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
  void actionsAfterFinishFail() {
    Table t = twoPlayers(0, 5, 1);
    t.drawCurrent();
    t.standCurrent();
    t.drawCurrent(); // fin
    assertThatThrownBy(t::drawCurrent)
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("GAME_FINISHED");
  }
}
