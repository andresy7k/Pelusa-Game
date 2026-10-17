# Avatares de jugador — Diseño (2026-10-16)

Cada jugador elige, al crear la mesa, cuál de las 10 pelusas lo representa.
Decidido con el autor: **sin repetir** (una pelusa = un jugador por partida).

## Reglas (el servidor manda)

- Avatar entero en `[1, 10]`.
- Único dentro de la partida: dos jugadores no pueden llevar la misma pelusa.
- El servidor valida rango + unicidad y persiste; la UI solo facilita la elección.
- Si el cliente no envía avatares (compatibilidad), el servidor asigna distintos
  por asiento (`seat + 1`).

## Contrato (API)

- `POST /api/games`: el body suma `avatars: number[]` — mismo orden que `names`,
  opcional.
  - fuera de rango o tamaño distinto a `names` → 400 `VALIDATION_FAILED`
  - duplicado → 400 `VALIDATION_FAILED` con detalle "Ese avatar ya está elegido"
- `GameView.PlayerView` suma `avatar: int` (siempre presente).
- `frontend/src/api/types.ts` espeja el cambio (si no compila, el contrato cambió).

## Datos (`V6__player_avatar.sql`)

```sql
ALTER TABLE players ADD COLUMN avatar INTEGER;
-- backfill: cada jugador recibe un número distinto dentro de su partida
UPDATE players p SET avatar = (
  SELECT rn FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY seat) AS rn
    FROM players
  ) x WHERE x.id = p.id
);
ALTER TABLE players ALTER COLUMN avatar SET NOT NULL;
ALTER TABLE players ADD CONSTRAINT chk_player_avatar CHECK (avatar BETWEEN 1 AND 10);
ALTER TABLE players ADD CONSTRAINT uq_game_avatar UNIQUE (game_id, avatar);
```

V1..V5 no se tocan (Flyway valida checksums). Mismo patrón que
`uq_game_position` / `uq_game_name` en `PlayerEntity`.

## UI

- **Setup (paso 2)**: por jugador, un grupo de 10 chips (`role=radiogroup`,
  radios nativos ocultos + label con `MonsterFace` y color de su carta).
  - preselección automática: el primer avatar libre (se cambia con un clic);
  - el chip ya elegido por otro jugador queda deshabilitado ("Ya elegido por X");
  - validación antes de enviar; el body manda `avatars`.
- **Mesa (Board)**: avatar chico junto al nombre en cada asiento, en «Turno de»
  y en el resultado final.
- Paleta: reusar `--c-monster` (card.css). Para el picker, una constante
  compartida en `frontend/src/components/monsters.ts` como fuente única nueva
  (sin duplicar hex sueltos por componente).

## Pruebas

- `GameApiTest`: creación feliz con avatares; duplicado → 400; fuera de rango
  → 400; sin avatares → asignados distintos automáticamente.
- `FlywayMigrationTest` sigue verde con V6 (backfill sobre DB existente).
- Frontend: tsc + build + captura del picker + mesa con avatares.

## Fuera de alcance

- Cambiar avatar a mitad de partida; perfiles persistentes; historial con
  avatares (las partidas viejas muestran el asignado por el backfill).
