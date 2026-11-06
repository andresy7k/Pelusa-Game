-- V9: avatar de cada jugador = uno de los 10 monstruos de las cartas (1..10).
-- Se elige al crear/unirse y es el personaje del jugador en la mesa 2D y 3D.
-- Jugadores existentes: un monstruo por asiento (1, 2, 3…), como se veían antes.
ALTER TABLE players ADD COLUMN avatar INT;
UPDATE players SET avatar = MOD(seat, 10) + 1 WHERE avatar IS NULL;
ALTER TABLE players ALTER COLUMN avatar SET NOT NULL;
ALTER TABLE players ADD CONSTRAINT chk_avatar CHECK (avatar BETWEEN 1 AND 10);
