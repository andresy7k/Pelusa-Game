-- V5: ADR-014 (R-01 refinado por el autor): robar exige que el valor pedido
-- sea el de la última carta sacada en el turno en curso. Ese valor se
-- persiste en el turno abierto; al rotar el turno arranca en NULL.
ALTER TABLE turns ADD COLUMN last_drawn_value INTEGER;
