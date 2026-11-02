# DECISIONS.md — Registro de decisiones técnicas

> Cada decisión: contexto, decisión, alternativas, consecuencias. Si una decisión cambia, se agrega entrada nueva, no se borra historia.

---

## ADR-001 — Arquitectura: monolito modular con dominio puro (2026-10-06, Phase 0 propuesta)
**Contexto:** Juego por turnos, un equipo de 1, evaluación por claridad, reglas testeables y capacidad de modificar en vivo. Sin necesidad de escala distribuida.
**Decisión:** Monolito Spring + React desacoplado vía REST. Backend en 3 paquetes con regla de dependencias estricta: `domain` (Java puro, cero dependencias Spring/JPA) ← `application` (casos de uso transaccionales, puertos) ← `infrastructure` (controllers, JPA, config). Frontend nunca decide reglas.
**Alternativas:** (a) Capas clásicas controller→service→repository con lógica en services — descartada porque mezcla reglas con Spring y dificulta mutación/testing puro. (b) Microservicios / CQRS / eventos / Redis — descartados: sin justificación, matan defendibilidad y velocidad. (c) Lógica en frontend validada por backend — descartada: viola "backend fuente de verdad".
**Consecuencias:** + Testeable sin contenedor, + Explicable en 2 minutos, + Cambios de regla en un solo lugar. − Requiere disciplina para no filtrar anotaciones JPA al dominio (revisión en PRs).

## ADR-002 — Stack backend: Java 17 LTS + Spring Boot 3.3 + JPA/Hibernate + Flyway (2026-10-06, CONFIRMADO por el autor)
**Contexto:** Requisito obligatorio Java+Spring+REST+DB+tests. Sustentación exige explicar cada pieza.
**Decisión:** Java 17 (LTS, records, sealed si hace falta), Spring Boot 3.3, Spring Data JPA, Bean Validation, Actuator, Flyway versionado (`V1__init.sql`), Jackson, ProblemDetails RFC7807.
**Alternativas:** (a) JDBC puro / jOOQ — más control SQL, pero más código y más superficie de error para 1 dev. (b) MongoDB — pierde FKs/constraints/transacciones relacionales que el tribunal espera ver. (c) Java 21 virtual threads — atractivo, pero toolchain universitario y Pitest más maduros en 17.
**Consecuencias:** + Estándar defendible, + Pool Hikari y validación out-of-box. − JPA exige cuidar N+1 y mapeos (mitigado con EntityGraph + tests de queries).

## ADR-003 — Base de datos: PostgreSQL 16 (dev/prod Docker) + H2 (tests) (2026-10-06, propuesta)
**Contexto:** Necesitamos constraints reales + persistencia seria, pero tests rápidos y demo portable.
**Decisión:** Postgres 16 en `docker-compose.yml` para dev/prod; H2 en memoria para unit/integración/CI. Migraciones Flyway idénticas en ambos. Histórico de finalizadas en tablas relacionales (no borrado).
**Alternativas:** (a) Solo H2 archivo — simple pero poco creíble en defensa ("¿y en prod?"). (b) Solo Postgres + Testcontainers — más fiel, pero exige Docker en CI y en máquina del profe. Posible evolución Phase 11 si hay tiempo. (c) SQLite — fricción con Hibernate/Flyway.
**Consecuencias:** + `health` real chequea `DataSource`, + Índices/FKs evaluables. − Divergencia dialectos (mitigado: SQL estándar en migraciones, tipos simples, CI corre ambos perfiles desde Phase 10 si da tiempo).

## ADR-004 — Frontend: React 18 + Vite + TypeScript + GSAP (2026-10-06, CONFIRMADO por el autor)
**Contexto:** Brief exige videojuego premium + Liquid Glass + hero físico de cartas + motion con propósito, más Playwright JS.
**Decisión:** React 18 + Vite + TS estricto, data con React Query (caché/reintentos solo en GETs idempotentes), animación GSAP 3 timelines + CSS transforms, Playwright para e2e.
**Alternativas:** (a) Vue — igual de válido, menos material GSAP+Playwright en el curso. (b) Angular — más ceremonia para 1 dev y animaciones menos directas. (c) Solo CSS animations — insuficiente para hero con masa/contacto/stagger físico.
**Consecuencias:** + Ecosistema y ejemplos defendibles, + TS evita "la UI creyó que era su turno". − Hay que imponer disciplina: ningún `if (canDraw)` en cliente sin refrendo 409/422 del backend.

## ADR-005 — Modelado de cartas: una fila por carta con `location` + `pileOrder` (2026-10-06, propuesta)
**Contexto:** Trazabilidad total (histórico, auditoría, re-jugabilidad) vs tabla compacta de contadores.
**Decisión:** `cards(id, game_id FK, value 1–10 CHECK, location CHECK[DECK,FRONT,STASHED,DISCARDED], owner_player_id NULLABLE FK, pile_order INT, created_at)`. Índices: `(game_id, location)`, `(game_id, owner_player_id, location)`. Mazo barajado = `pile_order` aleatorio persistido.
**Alternativas:** (a) Solo contadores por valor — ahorra filas pero pierde orden/auditoría y complica robo/descarte. (b) JSON del frente en columna — rápido pero sin constraints ni queries.
**Consecuencias:** + Invariante 110 verificable con `COUNT`, + Historia completa. − 110 inserts por partida (trivial para Postgres; batch en una transacción).

## ADR-006 — Concurrencia e idempotencia: transacción + `@Version` + Idempotency-Key (2026-10-06, propuesta Phase 4/11)
**Contexto:** Doble-click en "sacar" o doble request pueden corromper turno/mazo.
**Decisión:** Cada acción (draw/stand/stash/steal) en una transacción; `Game.version` optimista → concurrente recibe 409; `Idempotency-Key` header en POSTs de acción (reintento seguro). Reintentos solo en errores transitorios (deadlock/500), nunca en 4xx de regla.
**Alternativas:** Bloqueo pesimista siempre — simple pero serializa de más. Sin nada — inaceptable.
**Consecuencias:** + Defendible ("¿qué pasa si hago doble click?"), − Un 409 más que la UI debe manejar con elegancia.

## ADR-007 — Errores REST: RFC 7807 ProblemDetails + `errorCode` de dominio (2026-10-06, propuesta)
**Contexto:** La UI y el tribunal necesitan distinguir "no es tu turno" de "no hay cartas" de "500".
**Decisión:** `GlobalExceptionHandler` → `application/problem+json` con `type, title, status, detail, instance, errorCode(NOT_YOUR_TURN, DECK_EMPTY, GAME_FINISHED, ...)`, más `requestId` correlacionado en logs. Status: 201 crear, 200 acciones, 400 validación, 404 no existe, 409 conflicto de turno/concurrencia, 422 regla violada, 429 rate-limit.
**Alternativas:** Strings sueltos o stacktraces — indefendibles.
**Consecuencias:** + Tests MockMvc asertan `errorCode`, + UI muestra mensajes sin adivinar.

## ADR-008 — Testing: pirámide sin tests basura, Pitest como juez (2026-10-06, propuesta)
**Contexto:** Meta 100% coverage / ≥90% mutación, pero prohibido inflar con tests inútiles.
**Decisión:** Unit (dominio puro, parametrizados) → Integración JPA real → REST MockMvc (contrato+reglas) → Playwright Caso 1 (turno feliz) y Caso 2 (bust con 3+repetida). JaCoCo + Pitest (solo `domain` al inicio, luego global) como gates CI. Nada de tests a getters/setters.
**Alternativas:** Solo e2e — lento y frágil. Solo unit con mocks de DB — no prueba persistencia.
**Consecuencias:** + Cada test prueba comportamiento, + Mutación mata "tests que no asertan nada".

## ADR-009 — Git: trunk corta con PRs (`main` protegida) + `develop` opcional (2026-10-06, propuesta)
**Contexto:** Trazabilidad obligatoria, 1 dev, fases pequeñas.
**Decisión:** `main` protegida (PR + CI verde). Ramas `feature/fix/test/refactor/docs/chore/*` de vida <2 días. Commits convencionales pequeños. `develop` solo si aparecen releases paralelas; si no, directo a `main` vía PR para no duplicar burocracia.
**Alternativas:** GitFlow completo desde día 1 — overkill para 1 dev.
**Consecuencias:** + Historia legible para el tribunal (`git log --oneline`), − Requiere no trabajar en `main` ni pushear sin permiso (regla dura).

## ADR-010 — Alcance: sin auth/login en v1 (2026-10-06, propuesta — a confirmar Phase 1)
**Contexto:** Cada feature debe aportar a producto/evaluación/aprendizaje sin disparar complejidad.
**Decisión propuesta:** Partidas con jugadores nominales (nombres), sin login/password. Sin hasheo que defender porque no hay credenciales. Si el tribunal exige auth, se añade en Phase 11 como `playerToken` opaco, nunca contraseña en claro.
**Alternativas:** JWT + passwords + rate-limit login desde el inicio — suma hashing, secretos, sesiones, y roba tiempo a reglas/coverage/mutación que sí evalúan.
**Consecuencias:** + Foco en reglas/persistencia/API/tests. − Hay que defenderlo explícitamente ("mínimo privilegio y YAGNI; auth fuera de alcance v1, diseñado para añadirse sin romper dominio").

## ADR-011 — Robo (steal): solo en tu turno (2026-10-06, CERRADO por el autor)
**Contexto:** R-01 bloqueaba diseñar `StealPolicy` y sus tests.
**Decisión:** Solo el jugador con el turno puede robar. Precondiciones: `status=IN_PROGRESS` + es tu turno + existe al menos una carta boca arriba del valor X en frente ajeno. Efecto: esas cartas pasan a tu frente (no a puntos). Todo en la misma transacción del turno.
**Alternativas:** Robar fuera de turno como reacción — descartada: rompe "un solo turno activo" y complica concurrencia.
**Consecuencias:** + Regla simple de explicar y testear (`NOT_YOUR_TURN` → 409, `NO_STEALABLE_CARDS` → 422). − La UI debe deshabilitar robo fuera de turno pero SIEMPRE refrendado por backend.

## ADR-012 — Pérdida (bust): repetido + ≥3 post-colocación, si no sigue (2026-10-06, CERRADO por el autor)
**Contexto:** R-02, borde 2→3 cartas.
**Decisión:** Evaluar DESPUÉS de colocar la carta recién sacada: `bust ⟺ front.contains(value) && front.size() >= 3`. Con <3 aunque repita, sigue jugando.
**Alternativas:** Evaluar antes de colocar — cambia el borde y confunde en sustentación.
**Consecuencias:** + Tabla de verdad 2×2 testeable con 4+ casos parametrizados. Efecto atómico frente→descarte + rotación.

## ADR-013 — Puntuación y desempate lexicográfico 1→10 (2026-10-06, CERRADO por el autor)
**Contexto:** R-03, resultado defendible y determinista.
**Decisión:** Puntos = Σ valores guardados (`STASHED`). Gana mayor suma. Desempate: comparar conteo de 1s guardados; si empate, 2s; … hasta 10s. Si empate total, empate declarado (Phase 1 definirá si se usa orden de turno como último criterio).
**Alternativas:** "Más cartas totales" o "menor max robado" — descartadas por el autor por ser menos fieles al espíritu de Pelusas.
**Consecuencias:** + `ScoringService.compare(a,b)` puro y testeable con tests de oro (ej: [3×1 vs 1×3], cadenas de empates hasta el 10). − Requiere guardar conteo por valor en el resultado/histórico, no solo la suma.

## ADR-014 — Robo refinado: solo el valor de la última carta sacada (2026-10-15, CERRADO por el autor)
**Contexto:** ADR-011 dejó el robo como "cualquier valor presente en frente ajeno". Probando la partida real, el autor corrigió la regla: el robo debe estar atado al draw del turno (sacaste un 2 → solo se roban 2s). Reproducido por API antes de tocar código: Ana sacó 5 y el backend aceptó robar el 3 de Beto.
**Decisión:** Además de las precondiciones de ADR-011, `steal` exige `value == last_drawn_value` del turno en curso (la última carta sacada ESTE turno). Sin draw previo también rechaza. Nuevo `errorCode STEAL_VALUE_MISMATCH` → 422. El valor vive en `turns.last_drawn_value` (migración V5) y arranca NULL al rotar el turno.
**Alternativas:** (a) robar cualquier valor (estado previo) — permite robar sin relación con tu draw; (b) robar solo "inmediatamente después del draw" — más rígido que la regla del autor ("la última que saqué").
**Consecuencias:** + Regla fiel al juego físico; la UI resalta SOLO las cartas robables. − 1 columna + V5; los tests de robo deben amañar el mazo para sacar el valor correcto primero.
**Defensa:** "El riesgo estaba previsto en ADR-011; el cambio fue quirúrgico: 1 método de dominio, 1 columna, 1 errorCode, tests de tabla (sin draw / valor distinto / valor igual)."

## ADR-015 — Salas online por código, sin cuentas (2026-11-02, CERRADO por el autor)
**Contexto:** Sección 1–2 del multijugador: jugar entre dispositivos sin auth (ADR-010) y sin fricción de registro. WebSockets no atraviesan el rewrite de Vercel.
**Decisión:** salas con `code` de 6 caracteres (alfabeto sin 0/O/1/I/L), UNIQUE en DB y generación con SecureRandom + reintento ante colisión. El creador es host (silla 0) y único que puede iniciar. La identidad del jugador vive en `localStorage` por id de partida; no hay login. Quien entra con la partida empezada queda **espectador** (`playerId:null`) y no ocupa cupo.
**Alternativas:** UUID en la URL (fea para dictar por voz), cuentas con auth (fuera de alcance v1), WebSockets (no pasan por Vercel rewrites).
**Consecuencias:** + Enlace compartible y cero registro; defensa clara de "el servidor sigue siendo la autoridad". − Identidad "de navegador": borrar storage o cambiar de dispositivo te deja espectador (aceptado y documentado).

## ADR-016 — Polling 2.5 s + keep-alive, sin WebSockets (2026-11-02, CERRADO por el autor)
**Contexto:** El front debe ver turnos ajenos en vivo con el stack gratis (Vercel + Render Free). WS exige conexión persistente; Render Free duerme a los 15 min.
**Decisión:** `GET /api/games/{id}` cada 2.5 s con la pestaña visible (document.hidden pausa), `GET /api/ping` cada 60 s desde el front y un workflow de GitHub cada 10 min para despertar Render. El estado se re-renderiza tal como llega: no hay merge optimista ni predicción local.
**Alternativas:** WebSockets (bloqueado por Vercel/rewrites y por el plan free), SSE (posible, pero más complejo que el problema que resuelve hoy).
**Consecuencias:** + Simple, stateless, barato y fácil de defender; el servidor no guarda conexiones. − Latencia de hasta 2.5 s y requests periódicos (entran holgados en los límites free).

## ADR-017 — Timer de 15 s autoritativo con expiración perezosa (2026-11-02, CERRADO por el autor)
**Contexto:** Salas online necesitan límite de turno para que nadie congele la mesa; un timer de cliente es trivialmente burlable.
**Decisión:** `turns.deadline_at` (V7) marca el plazo; al abrir turno se fija `now + 15 s` **solo en ONLINE** (hotseat no tiene reloj). No hay job ni hilo: cualquier lectura/acción ejecuta `expireIfDue` — si venció, cierra el turno (`outcome STAND`, evento `TURN_EXPIRED`), rota y abre el siguiente. La acción del jugador vencido en el mismo request recibe 409 `TURN_EXPIRED`; si otro request ya rotó, `NOT_YOUR_TURN`. `turnDeadlineAt` se expone en la vista y el front solo pinta la cuenta atrás.
**Alternativas:** `@Scheduled` cada segundo (consume CPU con la instancia dormida y complica el arranque), timer en el navegador (sin autoridad), sin timer (mesas congeladas).
**Consecuencias:** + Sin estado extra ni jobs; el estado siempre converge en la próxima lectura. − Si todos cierran la pestaña, la expiración se aplica cuando alguien vuelve a leer (documentado; los clientes polléan mientras juegan).
