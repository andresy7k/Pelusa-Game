# ARCHITECTURE.md — Phase 1

> Decisión madre: ADR-001. Monolito modular. El dominio no sabe que existe Spring ni JPA. Todo lo que el tribunal te pida cambiar (desempate, robo, bust) vive en 1 clase pura + tests.

**Stack confirmado 2026-10-06:** Java 17 + Spring Boot 3.3 + Data JPA + Flyway + PostgreSQL 16 (Docker) / H2 (tests) · React 18 + Vite + TS + GSAP · Playwright.

---

## 1. Qué problema resuelve esta arquitectura

Un juego por turnos con dinero de por medio no hay, pero sí hay **trampa y corrupción de estado**: doble-click en "sacar", dos tabs abiertas, UI desincronizada que cree que es su turno. Si la regla vive en React, pierdes. Si vive en un `Service` mezclado con `@Transactional` + `EntityManager`, no la puedes testear sin levantar Spring y no la puedes explicar en 2 minutos.

Por eso separamos:
- **Qué está permitido** (dominio puro, sin I/O, determinista) de
- **Cuándo se persiste y se publica** (application + infrastructure, con transacciones y HTTP).

## 2. Mapa de paquetes (backend)

```
backend/src/main/java/com/pelusa/
├── domain/                  ← Java puro. CERO imports spring/jakarta.persistence
│   ├── model/               ← Game, Player, Card, Turn, Front, DustPile, GameResult
│   ├── policy/              ← TurnPolicy, StealPolicy, StashPolicy, BustPolicy
│   ├── service/             ← DeckFactory, GameEngine, ScoringService
│   └── port/                ← ShufflePort, ClockPort (interfaces)
├── application/             ← casos de uso, orquesta dominio + puertos
│   ├── GameService          ← @Transactional, carga entidades, llama GameEngine, guarda
│   ├── dto/                 ← comandos internos (no son el contrato HTTP)
│   └── ApplicationErrors     ← NotYourTurn, DustPileEmpty, GameFinished, etc.
├── infrastructure/
│   ├── web/                 ← controllers, request/response DTOs, mappers
│   │   ├── GameController
│   │   ├── dto/             ← CreateGameRequest, DrawResponse, ErrorResponse (RFC7807)
│   │   └── GlobalExceptionHandler
│   ├── persistence/         ← JPA entities, repositories, adapters
│   │   ├── GameEntity, PlayerEntity, CardEntity, TurnEntity
│   │   ├── SpringData repos
│   │   └── RandomShuffleAdapter, SystemClockAdapter
│   └── config/              ← seguridad base, rate-limit, requestId filter, OpenAPI, health
└── resources/db/migration/  ← V1__init.sql (Flyway)
```

**Regla de dependencias (se revisa en PR, Phase 11 con ArchUnit si da tiempo):**
`domain` no importa nada de `application` ni `infrastructure`. `application` solo conoce `domain` + puertos. `infrastructure.web` y `persistence` conocen `application` + `domain`, nunca al revés.

```
domain ← application ← infrastructure
```

## 3. Responsabilidad de cada componente (qué aprenderás)

| Componente | Responsabilidad | Qué NO hace |
|---|---|---|
| `DeckFactory` | Construir las 110 exactas (13×1–5, 9×6–10) y ordenar vía `ShufflePort`. | No baraja con `new Random()` directo (inyecta puerto para seed fijo en tests). |
| `TurnPolicy` / `BustPolicy` | `bust = front.contains(v) && front.size()>=3` post-colocación. | No toca DB ni turnos, solo listas en memoria. |
| `StashPolicy` | Solo al inicio de tu turno, solo cartas de turnos anteriores. | No decide puntos, solo mueve `FRONT→STASHED` en memoria. |
| `StealPolicy` (R-01 cerrado) | Solo en tu turno: `valor X existe en frente ajeno → esas cartas a tu frente`. | No roba fuera de turno, no manda a puntos directo. |
| `GameEngine` | Orquesta un turno: `stash? → draw → {bust? | steal? | stand} → next`. Devuelve eventos, no persiste. | No abre transacciones, no llama repos. |
| `ScoringService` | `Σ guardadas`, ganador = mayor suma; desempate lexicográfico 1→10 (ADR-013). | No decide fin de partida, solo compara. |
| `GameService` | Carga `GameEntity` + cartas con `EntityGraph`, llama `GameEngine`, guarda en 1 transacción, publica resultado. Maneja `@Version` → 409. | No contiene `if (value==...)` de reglas; delega. |
| `GameController` | Traduce HTTP↔DTO, valida con Bean Validation, mapea errores a RFC7807. | No contiene ni una regla; si la contiene, es bug. |
| Adapters | `RandomShuffleAdapter(SecureRandom)`, `SystemClockAdapter`. | En tests se sustituyen por fakes con seed/reloj fijo. |

## 4. Alternativas descartadas (para defender)

1. **Lógica en `Service` con `@Entity` mezcladas:** más rápido al inicio, pero cada test necesita Spring + H2, Pitest se vuelve lento y no puedes mostrar `GameEngine` sin mocks de JPA.
2. **Entidades JPA como modelo de dominio:** tienta por ahorrar mappers, pero filtra `@Column` al corazón y te impide cambiar de DB sin tocar reglas. Por eso hay `domain.model` + `infrastructure.persistence.*Entity` + mapper explícito (aburrido pero defendible).
3. **Microservicios/CQRS/Redis/event-sourcing:** cero justificación con 1 dev y turnos secuenciales. Añaden consistencia eventual a un problema que exige consistencia fuerte por turno.

## 5. Flujos (contrato con DATA_MODEL + API_CONTRACT)

```
CREATED --start()--> IN_PROGRESS --draw/stand/stash/steal/bust--> IN_PROGRESS --mazo vacío--> FINISHED
```

- **Crear:** `GameService.create(nombres, jugadorInicial)` → 1 `GameEntity` + N `PlayerEntity` + 110 `CardEntity(DECK, pile_order)` en 1 transacción. Sin cartas en frentes.
- **Start:** `CREATED→IN_PROGRESS`, fija `currentPlayerId`. Idempotente: si ya iniciado, 409.
- **Turno típico:** `stash?` (inicio) → N×`draw` (cada draw: saca `MIN(pile_order)` de `DECK` → `FRONT` dueño actual; evalúa bust post-colocación) → `stand` o `bust` o `steal` → rota `currentPlayerId`. Cada acción = 1 transacción + incremento `@Version`.
- **Bust:** `FRONT(activo)→DISCARDED` (mismo `game_id`, `owner` se conserva para auditoría, `location` cambia), `Turn.outcome=BUST`, rota. Nada a puntos.
- **Finish:** trigger = `COUNT(DECK)==0` después de un draw/steal/stand. Efecto atómico: todos los `FRONT→STASHED`, `ScoringService` calcula, `status=FINISHED, winnerId, finishedAt` se fijan. Irreversible: cualquier acción posterior → 409/422 `GAME_FINISHED`.
- **Steal (solo tu turno):** `POST .../steal {value}` → todas las `FRONT` ajenas con ese valor → `FRONT` del ladrón (mismo `game_id`, cambia `owner_player_id`). Si no hay → 422.

## 6. Transacciones, concurrencia, idempotencia

- Cada acción de juego: `@Transactional` única. Lectura con `SELECT ... FOR UPDATE` o versionado optimista en `GameEntity(@Version)` — elegido **optimista** (menos bloqueo, turnos son secuenciales humanos). Concurrente perdedor → `ObjectOptimisticLockingFailureException` → 409 `CONCURRENT_TURN`.
- **Idempotency-Key** (header, Phase 4/11): el cliente genera UUID por intención ("sacar carta"). Reintento con misma key no duplica. Reintentos solo ante 5xx/timeout, nunca ante 4xx de regla.
- **No N+1:** carga de estado usa `@EntityGraph(cards, players)` + `fetch join`. Test de regresión cuenta queries (Phase 9).

## 7. Errores, logs, observabilidad

- `GlobalExceptionHandler` → `application/problem+json` con `errorCode` máquina-legible: `NOT_YOUR_TURN, DECK_EMPTY, GAME_FINISHED, GAME_NOT_FOUND, VALIDATION_FAILED, CONCURRENT_TURN, NO_STEALABLE_CARDS, NO_STASHABLE_CARDS`.
- `OncePerRequestFilter` genera `X-Request-Id` (o respeta el entrante), lo pone en MDC; logs estructurados (timestamp, level, requestId, gameId, playerId, action) sin PII ni secretos.
- `GET /actuator/health` verifica `DataSource` con `SELECT 1` (health real, no "UP" hardcodeado). `GET /api/health` público ligero para la UI.
- Rate-limit (Bucket4j o filtro simple, Phase 11): `POST /api/games` 10/min por IP; acciones 60/min por IP. Excedido → 429 con `Retry-After`.

## 8. Frontend (límites para no romper la autoridad)

- React Query solo cachea `GET` (estado, histórico). Mutaciones (`draw/stand/stash/steal`) siempre van al servidor y reconcilian con lo que el servidor devuelve. Prohibido `if (canSteal)` local sin refrendo: el botón puede predecir, pero el servidor decide.
- Estado UI: `useGame(id)` → `GET /api/games/{id}` → `{ status, currentPlayer, deckRemaining, fronts{playerId:[cards]}, stashed{playerId:{sum, countsByValue}}, lastEvent }`. Agrupación por valor es solo render.
- Animaciones GSAP en capa de presentación, nunca bloquean la mutación ni guardan estado de juego.

## 9. Qué podría salir mal (riesgos vivos)

- Contaminar dominio con anotaciones Spring/JPA por pereza → mitigado con revisión PR + regla "cero imports".
- Mappers manuales tediosos → aceptado; MapStruct solo si el tribunal lo pide (añade magia difícil de explicar).
- Divergencia Postgres/H2 (tipos, `FOR UPDATE`) → SQL estándar en V1, tipos simples, CI corre ambos perfiles desde Phase 10.
- Hero/animaciones rompen 60fps → presupuesto: solo `transform/opacity`, `prefers-reduced-motion`, timelines GSAP con `will-change` mínimo.

## 10. Cómo se prueba esta arquitectura

- Dominio: JUnit5 + AssertJ parametrizados, sin Spring (milisegundos, Pitest ≥90%).
- Persistencia: `@DataJpaTest` con H2 real, verifica FKs/constraints e índices por `EXPLAIN` manual en revisión.
- API: MockMvc verifica status + `errorCode` + transición de estado en DB.
- E2E: Playwright Caso 1 (feliz) y Caso 2 (bust 3+repetida) contra backend real + Postgres Docker.
- Puertos fake: `FixedShuffle(seed)` + `FixedClock` hacen determinista lo aleatorio/temporal.
