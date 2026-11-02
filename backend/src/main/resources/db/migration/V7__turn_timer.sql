-- V7__turn_timer.sql — Sección 3: reloj de turno para salas ONLINE.
-- El plazo vive en el TURNO (no en el juego): cada turno tiene su ventana.
-- NULL = sin límite (partidas hotseat y turnos anteriores a esta migración).
-- Autoridad: el servidor. El cliente solo pinta la cuenta atrás con este dato.
ALTER TABLE turns ADD COLUMN deadline_at TIMESTAMP WITH TIME ZONE NULL;

-- Turnos abiertos al migrar: les damos una ventana nueva para no bloquear la mesa.
UPDATE turns
   SET deadline_at = started_at + INTERVAL '15' SECOND
 WHERE ended_at IS NULL;
