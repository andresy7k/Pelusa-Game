ALTER TABLE games ADD COLUMN mode           VARCHAR(8) NOT NULL DEFAULT 'LOCAL';
ALTER TABLE games ADD COLUMN code           VARCHAR(12);
ALTER TABLE games ADD COLUMN capacity       INT NOT NULL DEFAULT 6;
ALTER TABLE games ADD COLUMN host_player_id UUID;

ALTER TABLE games ADD CONSTRAINT chk_mode
  CHECK (mode IN ('LOCAL', 'ONLINE'));

ALTER TABLE games ADD CONSTRAINT chk_capacity
  CHECK (capacity BETWEEN 2 AND 6);

ALTER TABLE games ADD CONSTRAINT chk_code_consistency
  CHECK ((mode = 'ONLINE' AND code is NOT NULL) OR (mode = 'LOCAL' AND code is NULL));

ALTER TABLE games ADD CONSTRAINT uq_games_code UNIQUE (code);

ALTER TABLE games ADD CONSTRAINT fk_games_host  
  FOREIGN KEY (host_player_id) REFERENCES players(id);
