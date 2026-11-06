-- V8: tokens de asiento (seguridad). El playerId es público (sale en el estado
-- de la partida), así que no sirve como prueba de identidad. Cada dispositivo
-- recibe un token secreto al crear/unirse y la BD guarda SOLO su hash SHA-256
-- (64 caracteres hex): si alguien lee la tabla, no puede jugar por otro.
--   games.control_token_hash  → partidas de un dispositivo (LOCAL)
--   players.token_hash        → cada jugador de una sala ONLINE
-- NULL = partida creada antes de esta migración (se sigue aceptando sin token).
ALTER TABLE games ADD COLUMN control_token_hash VARCHAR(64);
ALTER TABLE players ADD COLUMN token_hash VARCHAR(64);
