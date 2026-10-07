-- V1__init.sql — DATA_MODEL.md Phase 1. SQL estándar Postgres+H2.
-- `detail` es TEXT con JSON serializado (portable: evita JSONB solo-Postgres).

CREATE TABLE players (
  id         UUID PRIMARY KEY,
  game_id    UUID NOT NULL,
  name       VARCHAR(60) NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  seat       INT NOT NULL CHECK (seat >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_game_position UNIQUE (game_id, seat),
  CONSTRAINT uq_game_name UNIQUE (game_id, name)
);

CREATE TABLE games (
  id                UUID PRIMARY KEY,
  status            VARCHAR(16) NOT NULL CHECK (status IN ('CREATED','IN_PROGRESS','FINISHED')),
  current_player_id UUID NULL,
  winner_id         UUID NULL,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at        TIMESTAMP WITH TIME ZONE NULL,
  finished_at       TIMESTAMP WITH TIME ZONE NULL,
  version           BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_current FOREIGN KEY (current_player_id) REFERENCES players(id),
  CONSTRAINT fk_winner  FOREIGN KEY (winner_id) REFERENCES players(id),
  CONSTRAINT chk_dates CHECK (finished_at IS NULL OR started_at IS NOT NULL)
);

ALTER TABLE players
  ADD CONSTRAINT fk_player_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

CREATE TABLE cards (
  id              UUID PRIMARY KEY,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  card_value      INT NOT NULL CHECK (card_value BETWEEN 1 AND 10),
  location        VARCHAR(12) NOT NULL CHECK (location IN ('DUST_PILE','FRONT','STASHED','DISCARDED')),
  owner_player_id UUID NULL REFERENCES players(id) ON DELETE RESTRICT,
  pile_order      INT NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT chk_owner CHECK (
    (location = 'DUST_PILE' AND owner_player_id IS NULL) OR
    (location IN ('FRONT','STASHED','DISCARDED') AND owner_player_id IS NOT NULL)
  )
);

CREATE TABLE turns (
  id         UUID PRIMARY KEY,
  game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at   TIMESTAMP WITH TIME ZONE NULL,
  outcome    VARCHAR(16) NULL CHECK (outcome IN ('STAND','BUST','STEAL','AUTO_FINISH')),
  detail     TEXT NULL,
  CONSTRAINT chk_turn_end CHECK (ended_at IS NULL OR outcome IS NOT NULL)
);

CREATE INDEX ix_cards_game_location ON cards(game_id, location);
CREATE INDEX ix_cards_game_owner_location ON cards(game_id, owner_player_id, location);
CREATE INDEX ix_cards_dust_order ON cards(game_id, pile_order);
CREATE INDEX ix_turns_game ON turns(game_id, started_at);
CREATE INDEX ix_players_game ON players(game_id);
