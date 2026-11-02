# API_CONTRACT.md — Phase 1

> Contrato primero, código después. Cada endpoint: propósito, método/path, request/response, errores, reglas, auth, impacto BD. La UI nunca decide reglas; si el backend dice 409/422, la UI obedece con elegancia.

**Base:** `/api` · JSON · `Idempotency-Key: uuid` requerido en POST de acción · `X-Request-Id` correlación · Auth v1: ninguna (partidas nominales, ADR-010). Rate-limit: crear 10/min/IP, acciones 60/min/IP → 429.

**Response de estado (canónica, la que la UI renderiza):**
```json
{
  "id": "uuid", "status": "IN_PROGRESS",
  "currentPlayerId": "uuid", "deckRemaining": 87, "lastDrawnValue": 4,
  "players": [{"id":"uuid","name":"Ana","seat":0}],
  "fronts": {"<playerId>": [4, 4]},
  "stashed": {"<playerId>": {"sum": 12, "countsByValue": {"1":2,"4":1}}},
  "lastEvent": {"type":"DRAW","playerId":"uuid","value":4,"bust":false},
  "result": null
}
```
`result` solo si `FINISHED`: `{ "winnerId":"uuid", "tie":false, "reason":"DECK_EMPTY", "scores":[{"playerId":"uuid","name":"Ana","sum":34,"countsByValue":{...}}] }`.

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

## 1.1 `POST /api/games/online` — abrir sala con código
**Propósito:** crear partida ONLINE en lobby (`CREATED`) con código de invitación único.
**Request:**
```json
{ "name": "Ana", "capacity": 4 }
```
Validación: `name` 1–60, `capacity` 2–6. El creador es el host (silla 0).
**Response 201:** `{ "game": {..., "mode":"ONLINE", "code":"ABC234", "hostPlayerId":"uuid", "capacity":4}, "playerId":"uuid", "spectator":false }`.
**Errores:** 400 `VALIDATION_FAILED`, 409 `CODE_COLLISION` (5 reintentos de código agotados).
**Reglas:** el código usa alfabeto sin 0/O/1/I/L (6 caracteres); UNIQUE en BD como red final.

## 1.2 `POST /api/games/join` — entrar por código
**Propósito:** unirse al lobby como jugador; si la partida ya empezó/terminó, mirar como espectador.
**Request:** `{ "code": "abc234", "name": "Beto" }` (el código se normaliza a mayúsculas).
**Response 200:** `{ "game": {...}, "playerId":"uuid", "spectator":false }`; en partida ya empezada `playerId:null, spectator:true` (no crea silla, aunque la sala esté llena).
**Errores:** 404 `CODE_NOT_FOUND`, 409 `GAME_FULL` (lobby sin cupo) / `NAME_TAKEN` / `CONCURRENT_TURN` (carrera al tomar asiento), 400 `VALIDATION_FAILED`.
**Reglas:** asiento = siguiente libre (0..capacity-1); nombre único por mesa (case-insensitive al validar).

## 2. `POST /api/games/{id}/start` — iniciar
**Propósito:** `CREATED→IN_PROGRESS`, fija `currentPlayerId` (y el plazo del primer turno).
**Request:** `{ "playerId":"uuid" }` opcional (hotseat lo omite; en sala ONLINE manda quién pide y debe ser el host) + `Idempotency-Key`.
**Response 200:** estado con `IN_PROGRESS`.
**Errores:** 404 `GAME_NOT_FOUND`, 409 `ALREADY_STARTED` / `GAME_FINISHED` / `NOT_HOST` (pidió alguien que no es el anfitrión) / `NOT_ENOUGH_PLAYERS` (sala ONLINE con 1 jugador), 400 `VALIDATION_FAILED` (playerId no-UUID).
**Impacto BD:** update games + 1 turn abierto con `deadline_at = now() + 15 s`.

## 3. `GET /api/games/{id}` — estado
**Propósito:** única fuente para render (turno, mazo, frentes, puntos, reloj).
**Response 200:** estado canónico + `lastDrawnValue` (ADR-014; `null` si aún no sacó) + `turnDeadlineAt` (ISO-8601; `null` en hotseat o sin turno abierto).
**Regla del reloj (Sección 3):** solo ONLINE. Cualquier lectura/acción aplica **expiración perezosa**: si el plazo ya pasó, el servidor cierra el turno (outcome `STAND`, evento `TURN_EXPIRED`), rota `currentPlayerId` y abre el siguiente con 15 s. El cliente solo pinta la cuenta atrás; nunca decide el tiempo.
**Errores:** 404. Acción del jugador vencido en el mismo request → 409 `TURN_EXPIRED`; si otro request ya rotó el turno → 409 `NOT_YOUR_TURN`.
**Impacto BD:** 4 selects (game, players, cards, turn abierto) con EntityGraph (sin N+1). En ONLINE, la lectura puede escribir el cierre/ apertura de turno.

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
**Reglas:** I-02/03/04. Evaluación bust post-colocación. Si `deckRemaining` llega a 0 → auto-stash global + scoring + finish en la MISMA transacción. Persiste `turns.last_drawn_value` (ADR-014): habilita robar exactamente ese valor.
**Impacto BD:** 1 card `DECK→FRONT` (+ posible cascada finish: N updates FRONT→STASHED + update games).

## 6. `POST /api/games/{id}/stand` — continuar/finalizar voluntario
**Propósito:** plantarse y pasar turno sin sacar más.
**Request:** `{ "playerId":"uuid" }` + key.
**Response 200:** estado con `currentPlayerId` rotado + `lastEvent:{type:STAND}`.
**Errores:** 404, 409 `NOT_YOUR_TURN` / `GAME_FINISHED`.
**Impacto BD:** cierra turn, rota `current_player_id`, abre siguiente turn.

## 7. `POST /api/games/{id}/steal` — robar (R-01/ADR-014: solo el valor de tu última carta sacada)
**Propósito:** tomar del frente ajeno todas las del valor X a mi frente. X debe ser la última carta sacada este turno.
**Request:** `{ "playerId":"uuid", "value":4 }` + key. `value` 1–10 (= `lastDrawnValue` del turno).
**Response 200:** estado + `lastEvent:{type:STEAL, value, count, fromPlayerIds}`.
**Errores:** 404, 400 `value` fuera de rango, 409 `NOT_YOUR_TURN` / `GAME_FINISHED`, 422 `STEAL_VALUE_MISMATCH` (sin draw en el turno o valor ≠ última sacada) / `NO_STEALABLE_CARDS` (nadie tiene ese valor boca arriba).
**Reglas:** ADR-011 refinado por ADR-014. No va a puntos directo; queda en mi frente (y por tanto me expone a bust si repito).
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
- `GET /api/ping` → **204 No Content**, sin tocar la base: lo usa el front cada 60 s para que Render Free no duerma la instancia.
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
| Steal sin haber sacado en el turno | 422 `STEAL_VALUE_MISMATCH` |
| Steal con valor ≠ última carta sacada | 422 `STEAL_VALUE_MISMATCH` |
| Steal sin ese valor afuera | 422 `NO_STEALABLE_CARDS` |
| Acción en `FINISHED` | 409 `GAME_FINISHED` |
| Juego inexistente | 404 `GAME_NOT_FOUND` |
| Reintento misma `Idempotency-Key` | 200 mismo estado, sin duplicar carta |
| Crear sala online válida | 201 + `mode:ONLINE`, `code` 6 chars, host sentado |
| Unirse con código en minúsculas | 200 + asiento siguiente, `spectator:false` |
| Unirse a partida ya empezada | 200 + `playerId:null`, `spectator:true` |
| Código inexistente | 404 `CODE_NOT_FOUND` |
| Sala sin cupo | 409 `GAME_FULL` |
| Nombre repetido en la mesa | 409 `NAME_TAKEN` |
| Start sin ser host | 409 `NOT_HOST` |
| Start ONLINE con 1 jugador | 409 `NOT_ENOUGH_PLAYERS` |
| Body con UUID malformado | 400 `VALIDATION_FAILED` (nunca 500) |
| Body con Content-Type no JSON | 415 `UNSUPPORTED_MEDIA_TYPE` |
| Turno ONLINE vencido (acción del lento, mismo request) | 409 `TURN_EXPIRED` (turno ya rotado) |
| Turno ONLINE vencido detectado por un GET | 200 con turno rotado y `lastEvent:TURN_EXPIRED` |

## 11. Lo que la UI tiene prohibido (para tu defensa)

Nunca `GET` para mutar, nunca `playerId` del body sin validar que es el `currentPlayerId` (v1 nominal: el body dice quién actúa y el servidor lo autoriza contra el turno; Phase 11 añadiría `playerToken`), nunca exponer `pile_order` futuro (solo `deckRemaining`, no qué valor viene).
