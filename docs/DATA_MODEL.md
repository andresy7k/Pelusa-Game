# DATA_MODEL.md — Phase 1

> Diseñada desde el dominio, no desde "guardar esto". Cada carta es una fila para tener orden, auditoría e histórico. 110 inserts por partida en 1 transacción = trivial para Postgres.

## 1. ER (texto — suficiente para defensa sin diagrama pesado)

```
games 1──N players
games 1──N cards
games 1──N turns
players 1──N cards (owner, nullable; DUST_PILE no tiene dueño)
players 1──N turns (quién jugó el turno)
```

## 2. Tablas (Flyway V1 — SQL estándar Postgres+H2)

```sql
-- V1__init.sql (orden real: players primero sin su FK a games por la
-- referencia circular games.current_player_id ↔ players.game_id; la FK se
-- añade con ALTER después. Ver backend/.../db/migration/V1__init.sql)
CREATE TABLE players (
  id         UUID PRIMARY KEY,
  game_id    UUID NOT NULL,
  name       VARCHAR(60) NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  seat       INT NOT NULL CHECK (seat >= 0),   -- orden de turno (0-based)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_game_position UNIQUE (game_id, seat),
  CONSTRAINT uq_game_name UNIQUE (game_id, name)
);

CREATE TABLE games (
  id            UUID PRIMARY KEY,
  status        VARCHAR(16) NOT NULL CHECK (status IN ('CREATED','IN_PROGRESS','FINISHED')),
  current_player_id UUID NULL,               -- NULL hasta start()
  winner_id     UUID NULL,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at    TIMESTAMP WITH TIME ZONE NULL,
  finished_at   TIMESTAMP WITH TIME ZONE NULL,
  version       BIGINT NOT NULL DEFAULT 0,   -- optimista
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
  pile_order      INT NOT NULL,                    -- orden en polvo; irrelevante fuera de DUST_PILE
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT chk_owner CHECK (
    (location = 'DUST_PILE' AND owner_player_id IS NULL) OR
    (location IN ('FRONT','STASHED','DISCARDED') AND owner_player_id IS NOT NULL)
  )
);

CREATE TABLE turns (
  id          UUID PRIMARY KEY,
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at   TIMESTAMP WITH TIME ZONE NULL,
  outcome    VARCHAR(16) NULL CHECK (outcome IN ('STAND','BUST','STEAL','AUTO_FINISH')),
  detail     TEXT NULL,                           -- JSON serializado (portable: H2 no tiene JSONB)
  CONSTRAINT chk_turn_end CHECK (ended_at IS NULL OR outcome IS NOT NULL)
);

-- Índices justificados (solo los usados en filtros/joins/orden):
CREATE INDEX ix_cards_game_location ON cards(game_id, location);                    -- polvo restante, frentes, puntos
CREATE INDEX ix_cards_game_owner_location ON cards(game_id, owner_player_id, location); -- frente/puntos por jugador
CREATE INDEX ix_cards_dust_order ON cards(game_id, pile_order); -- MIN(pile_order) del draw (sin WHERE: H2 no soporta índices parciales)
CREATE INDEX ix_turns_game ON turns(game_id, started_at);
CREATE INDEX ix_players_game ON players(game_id);
```

> Notas de portabilidad Postgres↔H2 (revisión estática Phase 2, sin JDK 17 en esta máquina):
> `TIMESTAMP WITH TIME ZONE` (no `TIMESTAMPTZ`), `detail TEXT` (H2 no tiene `JSONB`),
> sin `DEFERRABLE` (H2 no lo soporta; el orden de inserts lo evita),
> sin índices parciales `WHERE` (H2 no los soporta), columnas `seat`/`card_value`
> (evitan palabras reservadas `POSITION`/`VALUE` en H2). El dominio sigue hablando
> de `position`/`value`; el mapeo vive solo en SQL + `@Column`.

## 3. Invariantes a nivel DB (defensa)

- `I-01` 110 por partida: no se pone CHECK numérico (sería trigger), se verifica en `GameService.create` + test `COUNT(*)=110` + conteo por valor `13×1–5, 9×6–10`. La DB aporta FKs + CHECKs de rango.
- `chk_owner`: impide "carta en polvo con dueño" o "carta en frente sin dueño" — el bug clásico si la UI manda lo que quiere.
- `uq_game_position` + `uq_game_name`: orden determinista y nombres únicos por partida (evita "dos Ana").
- `version`: base del 409 ante doble-draw.
- Borrado: `ON DELETE CASCADE` desde games (una partida se puede purgar en dev), pero `RESTRICT` desde players hacia cards/turns (no borrar un jugador con cartas — historia intacta).

## 4. Consultas calientes (con plan de índices)

- `draw`: `SELECT * FROM cards WHERE game_id=? AND location='DUST_PILE' ORDER BY pile_order LIMIT 1 FOR UPDATE SKIP LOCKED` → usa `ix_cards_dust_order`. Alternativa sin `SKIP LOCKED` en H2: `ORDER BY pile_order LIMIT 1` dentro de la transacción optimista (documentar diferencia en Phase 9).
- `estado`: 1 query games + 1 players + 1 cards con `WHERE game_id=?` (cubierto por índices) vía `EntityGraph`. Sin N+1.
- `puntos`: `SELECT card_value, COUNT(*) FROM cards WHERE game_id=? AND location='STASHED' GROUP BY owner_player_id, card_value` → `ix_cards_game_owner_location`. De aquí sale suma + conteo 1→10 para desempate sin recalcular en Java.
- `histórico`: `SELECT ... FROM games WHERE status='FINISHED' ORDER BY finished_at DESC LIMIT 20 OFFSET ?` + join agregado de puntos. Paginado obligatorio.

## 5. Ciclo de vida de una carta

```
DUST_PILE(owner NULL, pile_order=N)
  --draw--> FRONT(owner=yo)
  --stash (inicio de mi próximo turno)--> STASHED(owner=yo)
  --bust--> DISCARDED(owner=yo, conservado para auditoría)
  --steal (solo en mi turno, valor X en frente ajeno)--> FRONT(owner=yo)
  --auto-finish--> STASHED(owner=quien la tenía en frente)
```

Nunca se hace `DELETE` de cartas; el histórico es la tabla misma filtrada por `location`.

## 6. Migraciones y evolución

- Flyway `resources/db/migration/V1__init.sql` única fuente. Nada de `ddl-auto=update` en prod (solo `validate`).
- Estrategia expand/contract si Phase 11 añade columnas (ej: `steal_from`): V2 añade nullable → código escribe ambos → V3 backfill + NOT NULL. No se elimina columna y código en el mismo deploy.
- Seeds: `V999__demo.sql` solo perfil `demo`, nunca prod.
