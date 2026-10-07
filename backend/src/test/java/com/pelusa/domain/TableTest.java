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

  private static Table twoPlayers(int first, int... dust) {
    UUID ana = UUID.fromString("00000000-0000-0000-0000-000000000001");
    UUID beto = UUID.fromString("00000000-0000-0000-0000-000000000002");
    return new Table(List.of(ana, beto), deck(dust), first);
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
  void stealTakesAllOfValueFromOtherFronts() {
    // Ana: 4 | Beto: 4,4,7 → Ana roba los dos 4
    Table t = twoPlayers(0, 4, 4, 4, 7, 8, 9);
    t.drawCurrent(); // Ana 4
    t.standCurrent();
    t.drawCurrent(); // Beto 4
    t.drawCurrent(); // Beto 4 (frente 2, sin bust)
    t.drawCurrent(); // Beto 7
    t.standCurrent(); // turno Ana
    var steal = t.stealCurrent(4);
    assertThat(steal.count()).isEqualTo(2);
    assertThat(t.fronts().get(t.currentPlayerId()))
        .containsExactly(new Card(4), new Card(4), new Card(4));
  }

  @Test
  void stealWithoutValueFails() {
    Table t = twoPlayers(0, 4, 5, 6);
    t.drawCurrent();
    t.standCurrent();
    t.drawCurrent();
    t.standCurrent();
    assertThatThrownBy(() -> t.stealCurrent(9))
        .isInstanceOf(DomainException.class)
        .extracting(e -> ((DomainException) e).getCode())
        .isEqualTo("NO_STEALABLE_CARDS");
  }

  @Test
  void emptyDustFinishesGameAndDeclaresWinner() {
    // Polvo: [5, 1] → Ana 5, Beto 1 → gana Ana (5>1), auto-stash aplicado
    Table t = twoPlayers(0, 5, 1);
    t.drawCurrent(); // Ana 5
    t.standCurrent();
    DrawResult last = t.drawCurrent(); // Beto 1, polvo vacío → fin
    assertThat(last.gameFinished()).isTrue();
    assertThat(t.status()).isEqualTo(GameStatus.FINISHED);
    assertThat(t.isTie()).isFalse();
    assertThat(t.winnerId()).isEqualTo(UUID.fromString("00000000-0000-0000-0000-000000000001"));
  }

  @Test
  void bustOnLastDustCardAlsoFinishes() {
    // Polvo [4,5,4]: Ana saca las 3 y revienta con la última → fin igual
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
