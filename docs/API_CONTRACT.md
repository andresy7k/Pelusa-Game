# API_CONTRACT.md — Phase 1

> Contrato primero, código después. Cada endpoint: propósito, método/path, request/response, errores, reglas, auth, impacto BD. La UI nunca decide reglas; si el backend dice 409/422, la UI obedece con elegancia.

**Base:** `/api` · JSON · `Idempotency-Key: uuid` requerido en POST de acción · `X-Request-Id` correlación · Auth v1: ninguna (partidas nominales, ADR-010). Rate-limit: crear 10/min/IP, acciones 60/min/IP → 429.

**Response de estado (canónica, la que la UI renderiza):**
```json
{
  "id": "uuid", "status": "IN_PROGRESS",
  "currentPlayerId": "uuid", "deckRemaining": 87,
  "players": [{"id":"uuid","name":"Ana","position":0}],
  "fronts": {"<playerId>": [{"value":4},{"value":4}]},
  "stashed": {"<playerId>": {"sum": 12, "countsByValue": {"1":2,"4":1}}},
  "lastEvent": {"type":"DRAW","playerId":"uuid","value":4,"bust":false},
  "result": null
}
```
`result` solo si `FINISHED`: `{ "winnerId":"uuid", "tiebreak":"ONES_THEN_TWOS...", "scores":[{"playerId":"uuid","sum":34,"countsByValue":{...}}], "reason":"DECK_EMPTY" }`.

**Error canónico (RFC7807):**
```json
{ "type":"https://pelusa/errors/NOT_YOUR_TURN", "title":"Not your turn", "status":409,
  "detail":"Es turno de Ana", "instance":"/api/games/uuid/draw",
  "errorCode":"NOT_YOUR_TURN", "requestId":"req_abc" }
```

---

## 1. `POST /api/games` — crear/configurar partida
**Propósito:** crear juego + jugadores + mazo de 110 barajado.
**Request:**
```json
{ "names": ["Ana","Beto","Ceci"], "firstPlayerIndex": 0 }
```
Validación: 2–6 nombres, 1–60 chars, únicos, `firstPlayerIndex` en rango (o `null` = posición 0).
**Response 201:** estado canónico con `status: CREATED`, `deckRemaining: 110`, frentes vacíos.
**Errores:** 400 `VALIDATION_FAILED` (nombres inválidos/duplicados), 429 rate-limit.
**Reglas:** ninguna de turno aún. Genera 110 `cards(DECK)` con `pile_order` aleatorio persistido.
**Impacto BD:** 1 transacción: 1 game + N players + 110 cards.

## 2. `POST /api/games/{id}/start` — iniciar
**Propósito:** `CREATED→IN_PROGRESS`, fija `currentPlayerId`.
**Request:** `{}` + `Idempotency-Key`.
**Response 200:** estado con `IN_PROGRESS`.
**Errores:** 404 `GAME_NOT_FOUND`, 409 `ALREADY_STARTED` / `GAME_FINISHED`, 422 si sin jugadores (imposible si crear valida).
**Impacto BD:** update games + 1 turn abierto.

## 3. `GET /api/games/{id}` — estado
**Propósito:** única fuente para render (turno, mazo, frentes, puntos).
**Response 200:** estado canónico.
**Errores:** 404. Sin rate-limit estricto (GET cacheable 1s en React Query).
**Impacto BD:** 3 selects con EntityGraph (sin N+1).

## 4. `POST /api/games/{id}/stash` — guardar pelusas
**Propósito:** mover mi `FRONT` (de turnos anteriores) a `STASHED`. Solo inicio de mi turno, una vez por turno.
**Request:** `{ "playerId":"uuid" }` + key.
**Response 200:** estado + `lastEvent: {type:STASH, count, sum}`.
**Errores:** 404, 409 `NOT_YOUR_TURN` / `GAME_FINISHED` / `ALREADY_STASHED_THIS_TURN`, 422 `NO_STASHABLE_CARDS` (frente vacío o cartas del turno en curso — el backend distingue por `turn_id` de cada carta; v1 simplificado: solo permite stash si no has sacado aún este turno).
**Reglas:** I-05. No puntúa el rival, no roba.
**Impacto BD:** `UPDATE cards SET location='STASHED' WHERE game+owner+FRONT` + turn detail.

## 5. `POST /api/games/{id}/draw` — buscar pelusa
**Propósito:** sacar superior del mazo a mi frente; puede causar bust o agotar el mazo (auto-finish).
**Request:** `{ "playerId":"uuid" }` + key.
**Response 200:** estado + `lastEvent: {type:DRAW, value, bust, gameFinished}`. Si agota el mazo, `status:FINISHED` + `result` incluido.
**Errores:** 404, 409 `NOT_YOUR_TURN` / `GAME_FINISHED` / `CONCURRENT_TURN`, 422 `DECK_EMPTY`.
**Reglas:** I-02/03/04. Evaluación bust post-colocación. Si `deckRemaining` llega a 0 → auto-stash global + scoring + finish en la MISMA transacción.
**Impacto BD:** 1 card `DECK→FRONT` (+ posible cascada finish: N updates FRONT→STASHED + update games).

## 6. `POST /api/games/{id}/stand` — continuar/finalizar voluntario
**Propósito:** plantarse y pasar turno sin sacar más.
**Request:** `{ "playerId":"uuid" }` + key.
**Response 200:** estado con `currentPlayerId` rotado + `lastEvent:{type:STAND}`.
**Errores:** 404, 409 `NOT_YOUR_TURN` / `GAME_FINISHED`.
**Impacto BD:** cierra turn, rota `current_player_id`, abre siguiente turn.

## 7. `POST /api/games/{id}/steal` — robar (R-01: solo en tu turno)
**Propósito:** tomar del frente ajeno todas las del valor X a mi frente.
**Request:** `{ "playerId":"uuid", "value":4 }` + key. `value` 1–10.
**Response 200:** estado + `lastEvent:{type:STEAL, value, count, fromPlayerIds}`.
**Errores:** 404, 400 `value` fuera de rango, 409 `NOT_YOUR_TURN` / `GAME_FINISHED`, 422 `NO_STEALABLE_CARDS` (nadie tiene ese valor boca arriba) / `CANNOT_STEAL_FROM_SELF`.
**Reglas:** ADR-011. No va a puntos directo; queda en mi frente (y por tanto me expone a bust si repito).
**Impacto BD:** `UPDATE cards SET owner=yo WHERE game+value+FRONT+owner!=yo`.

## 8. `GET /api/games/history` + `GET /api/games/{id}/result` — histórico
**Propósito:** listar finalizadas + detalle con ganador.
**Query:** `?page=0&size=20` (max 50).
**Response 200:**
```json
{"page":0,"size":20,"total":3,"items":[{"id":"uuid","finishedAt":"...","playerNames":["Ana","Beto"],"winnerName":"Ana","scores":[{"name":"Ana","sum":34,"countsByValue":{"1":3}}]}]}
```
**Errores:** 400 paginación inválida. `result` de no-finalizada → 409 `GAME_NOT_FINISHED`.
**Impacto BD:** select paginado + agregación `STASHED` por jugador (usa índice).

## 9. Salud y meta
- `GET /actuator/health` (interno, con chequeo `SELECT 1` a DB).
- `GET /api/health` → `{"status":"UP"}` para la UI.
- OpenAPI en `/v3/api-docs` + Swagger UI solo perfil dev.

## 10. Matriz de status (para tests MockMvc)

| Caso | Esperado |
|---|---|
| Crear válido | 201 + `CREATED`, 110 de mazo |
| Crear nombres duplicados | 400 `VALIDATION_FAILED` |
| Draw fuera de turno | 409 `NOT_YOUR_TURN` |
| Draw sin mazo | 422 `DECK_EMPTY` (o auto-finish si fue la última) |
| Doble draw concurrente | uno 200, otro 409 `CONCURRENT_TURN` |
| Stash sin cartas | 422 `NO_STASHABLE_CARDS` |
| Steal sin ese valor afuera | 422 `NO_STEALABLE_CARDS` |
| Acción en `FINISHED` | 409 `GAME_FINISHED` |
| Juego inexistente | 404 `GAME_NOT_FOUND` |
| Reintento misma `Idempotency-Key` | 200 mismo estado, sin duplicar carta |

## 11. Lo que la UI tiene prohibido (para tu defensa)

Nunca `GET` para mutar, nunca `playerId` del body sin validar que es el `currentPlayerId` (v1 nominal: el body dice quién actúa y el servidor lo autoriza contra el turno; Phase 11 añadiría `playerToken`), nunca exponer `pile_order` futuro (solo `deckRemaining`, no qué valor viene).
