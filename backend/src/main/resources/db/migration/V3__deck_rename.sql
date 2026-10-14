-- V3: el "montón de polvo" pasa a llamarse "mazo" en todo el producto.
-- V1/V2 NO se tocan (las migraciones aplicadas son historia; Flyway valida
-- checksums). Esta migración renombra valores + constraint + índice.
ALTER TABLE cards DROP CONSTRAINT chk_owner;
UPDATE cards SET location = 'DECK' WHERE location = 'DUST_PILE';
ALTER TABLE cards ADD CONSTRAINT chk_owner CHECK (
  (location = 'DECK' AND owner_player_id IS NULL) OR
  (location IN ('FRONT','STASHED','DISCARDED') AND owner_player_id IS NOT NULL)
);
DROP INDEX ix_cards_dust_order;
CREATE INDEX ix_cards_deck_order ON cards(game_id, pile_order);
