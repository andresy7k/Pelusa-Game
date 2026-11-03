package com.pelusa.infrastructure.testsupport;

import com.pelusa.infrastructure.persistence.CardEntity;
import com.pelusa.infrastructure.persistence.CardRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * SOLO perfil {@code e2e} (Playwright): ordena el mazo de una partida para que
 * los escenarios sean reproducibles (ej. "sacar 2, 5, 9 y luego un 5 repetido").
 * No toca reglas ni turnos: solo el orden ({@code pile_order}) de cartas que ya
 * están en el mazo, así la composición 13×(1-5) + 9×(6-10) se conserva.
 * Con {@code truncate=true} descarta el resto del mazo para probar el final
 * de partida sin jugar 110 cartas. En prod el bean no existe (404).
 */
@RestController
@Profile("e2e")
public class E2eDeckController {
  private final CardRepository cards;

  public E2eDeckController(CardRepository cards) {
    this.cards = cards;
  }

  public record RigRequest(@NotNull List<@NotNull @Min(1) @Max(10) Integer> values, boolean truncate) {}

  @PostMapping("/api/test/games/{id}/deck")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void rig(@PathVariable UUID id, @Valid @RequestBody RigRequest req) {
    List<CardEntity> deck = new ArrayList<>(cards.findByGameId(id).stream()
        .filter(c -> "DECK".equals(c.getLocation()))
        .sorted(Comparator.comparingInt(CardEntity::getPileOrder))
        .toList());
    List<CardEntity> top = new ArrayList<>();
    for (int value : req.values()) {
      CardEntity pick = deck.stream().filter(c -> c.getValue() == value).findFirst()
          .orElseThrow(() -> new IllegalArgumentException("No quedan cartas " + value + " en el mazo"));
      deck.remove(pick);
      top.add(pick);
    }
    if (req.truncate()) {
      cards.deleteAll(deck); // el resto del mazo desaparece
    } else {
      top.addAll(deck); // el resto queda detrás, en su orden original
    }
    for (int i = 0; i < top.size(); i++) {
      top.get(i).setPileOrder(i);
    }
  }
}
