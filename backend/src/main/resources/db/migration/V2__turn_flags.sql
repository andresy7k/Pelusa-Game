-- V2: flags del turno en curso (evitan reconstruir estado transitorio).
-- acted = ya sacó o robó este turno (bloquea stash). stashed = ya guardó.
ALTER TABLE turns ADD COLUMN acted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE turns ADD COLUMN stashed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE action_keys (
  id         UUID PRIMARY KEY,
  game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  action_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_game_key UNIQUE (game_id, action_key)
);
