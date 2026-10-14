# Pelusa Game — PROJECT_PLAN.md

> Fuente de verdad del alcance, fases y criterios de terminado.
> Regla: trabajamos UNA fase por vez. Cada fase termina con código funcionando + tests + docs actualizadas + diff revisado + PR. No se avanza sin aprobación.

**Última actualización:** 2026-10-06 — Phase 1 Architecture (ejecutada en rama docs/phase1-architecture, pendiente tu revisión para commit/PR)
**Stack confirmado:** Java 17 + Spring Boot 3 + Spring Data JPA + Flyway + PostgreSQL (dev/prod) / H2 (tests) + React + Vite + TypeScript + GSAP + Playwright
**Arquitectura propuesta:** Monolito modular con núcleo de dominio puro (testeable sin Spring) + capa application + infraestructura. Ver `DECISIONS.md` ADR-001.
**Repo:** `C:\Users\Andréss\Desktop\UNAC\Calidad de Software\Pelusa-Game` — actualmente vacío, sin git. Primer paso: `git init` + estructura base.

---

## 0. Descubrimiento — Síntesis (Phase 0)

### Objetivo del producto
Juego web completo de Pelusas de principio a fin. Backend = fuente de verdad de reglas. Frontend = experiencia premium tipo videojuego + Apple/Liquid Glass, con hero de cartas físicas que caen y se apilan.

### Objetivo de aprendizaje
El autor debe poder defender, modificar y explicar arquitectura, reglas, persistencia, API, tests, cobertura y mutación durante la sustentación. Enseñanza just-in-time, no teoría prematura.

### Requisitos funcionales (RF)
- **RF-01 Crear/configurar partida:** nombre, nº jugadores (mín 2, máx propuesto 6), nombres, jugador inicial (elegible o aleatorio).
- **RF-02 Inicializar mazo:** exactamente 110 cartas (13× valores 1–5 = 65, 9× valores 6–10 = 45), mezclado con `SecureRandom`, orden persistido.
- **RF-03 Estado de partida:** `CREATED → IN_PROGRESS → FINISHED`. Exponer turno actual, mazo restante, frente de cada jugador, puntos guardados, descartes.
- **RF-04 Guardar pelusas (stash):** si el jugador tiene cartas boca arriba de un turno anterior al inicio de su turno, puede moverlas a su montón de puntos. Solo una vez por turno, antes de sacar.
- **RF-05 Buscar pelusas (draw):** sacar carta superior del mazo, queda visible delante del jugador. Backend valida: es su turno, partida en curso, quedan cartas.
- **RF-06 Agrupación visual:** cartas del mismo valor identificables/agrupadas (responsabilidad UI, dato provisto por API).
- **RF-07 Continuar / finalizar voluntario:** después de cada draw sin pérdida, el jugador puede seguir sacando o plantarse y pasar turno.
- **RF-08 Robar (steal) — CERRADO 2026-10-06:** solo en tu turno. El jugador en turno puede tomar cartas del mismo valor que estén boca arriba delante de otros jugadores. Backend valida: es tu turno + valor presente en frente ajeno. Efecto: esas cartas pasan a tu frente (no directo a puntos).
- **RF-09 Pérdida de turno — CERRADA 2026-10-06:** `bust = frenteContiene(valorRecienSacado) && frente.size() >= 3` evaluado DESPUÉS de colocar la carta. Si repite con <3, SIGUE jugando. Efecto atómico: frente → descarte (no puntúa), turno rota.
- **RF-10 Finalización:** cuando se agota el mazo. Auto-stash de frentes restantes → calcular puntuaciones → ganador + desempate → persistir histórico.
- **RF-11 Resultado + ranking:** puntos por jugador, cartas acumuladas, ganador, motivo de fin.
- **RF-12 Histórico de partidas:** listar + detalle de finalizadas (id, jugadores, resultado, cartas, puntuación, ganador, fechas).

### Requisitos no funcionales (RNF)
- **RNF-01 Corrección > velocidad.** Backend valida todo, nunca confía en frontend.
- **RNF-02 Testabilidad:** dominio puro sin Spring; meta 100% coverage líneas críticas, ≥90% mutación, sin tests basura.
- **RNF-03 API REST correcta:** DTOs, validación, errores consistentes (RFC 7807 ProblemDetails), status correctos, no exponer entidades.
- **RNF-04 Persistencia con migraciones Flyway**, constraints/FKs, transacciones atómicas, sin N+1, pool Hikari por defecto.
- **RNF-05 Seguridad base:** validar todo input, no concatenar SQL (JPA), sin secretos en repo, config por entorno, rate-limit en creación de partidas, no loggear sensible, health check real con DB.
- **RNF-06 UX premium + a11y + perf:** `prefers-reduced-motion`, solo `transform/opacity` en animaciones críticas, sin layout thrashing, 60fps, GSAP con timelines.
- **RNF-07 CI verde = terminado:** build + unit + integración + REST (MockMvc) + frontend + Playwright + JaCoCo + Pitest + lint. Nada es "done" sin pipeline verde.

### Reglas de negocio — invariantes críticas
1. `I-01` Mazo siempre 110 cartas al crear; composición exacta 13×(1–5), 9×(6–10).
2. `I-02` Solo el jugador con turno puede actuar; un solo turno activo por partida.
3. `I-03` Draw solo si `status=IN_PROGRESS` y quedan cartas en el mazo.
4. `I-04` Pérdida ⟺ (valor repetido en frente propio) ∧ (total frente ≥3). Efecto atómico: frente→descarte, turno rota, nada puntúa.
5. `I-05` Stash solo al inicio del turno propio y solo de cartas de turnos anteriores.
6. `I-06` Fin ⟺ mazo vacío. Efecto: auto-stash de todos los frentes, cálculo, ganador, `status=FINISHED` irreversible.
7. `I-07` Puntuación = suma de valores guardados. Ganador = mayor suma. Desempate lexicográfico por conteo — CERRADO 2026-10-06: comparar nº de 1s guardados, si empate nº de 2s, luego 3s… hasta 10. Si persiste empate total, empate declarado (o primer jugador en orden de turno según se defina en Phase 1).

### Entidades del dominio (borrador Phase 1)
`Game {id, status, currentPlayerIndex/turnPlayerId, createdAt, finishedAt, winnerId}` · `Player {id, gameId, name, position/order}` · `Card {id, gameId, value 1–10, location: DECK|FRONT|STASHED|DISCARDED|STOLEN?, ownerPlayerId?, pileOrder}` · `Turn {id, gameId, playerId, startedAt, endedAt, outcome: STAND|BUST|STOLEN_FROM?}` · `GameHistory` (vista/materialización de finalizadas: participantes, puntuación, cartas, ganador). Relaciones: Game 1—N Player, Game 1—N Card, Game 1—N Turn. Ciclo de vida Card: `DECK → FRONT → (STASHED | DISCARDED | FRONT(otro jugador) si robo)`.

### Estados del juego (máquina de estados)
```
CREATED --start()--> IN_PROGRESS --draw/stand/stash/steal/bust--> IN_PROGRESS
IN_PROGRESS --deck empty--> FINISHED (terminal)
```
Turno dentro de IN_PROGRESS: `START_TURN [stash opcional] → DRAW* → {STAND | BUST | (STEAL cuando aplique)} → NEXT_PLAYER`. Toda transición validada en backend, en transacción.

### Riesgos
| ID | Riesgo | Impacto | Mitigación Phase 1 |
|----|--------|---------|--------------------|
| R-01 | Disparador exacto de "robar" ambiguo en enunciado | Lógica y tests bloqueados | ✅ CERRADO 2026-10-06: solo en tu turno (ver RF-08) |
| R-02 | Repetición con <3 cartas: ¿pierde o sigue? | Bug crítico de reglas | ✅ CERRADO 2026-10-06: sigue; bust solo si ≥3 + repetido post-colocación |
| R-03 | Cálculo puntuación/desempate no especificado | Resultado indefendible | ✅ CERRADO 2026-10-06: suma guardadas; desempate lexicográfico 1→10 |
| R-04 | Aleatoriedad no testeable | Tests flaky | `ShufflePort` inyectable + seed fijo en tests |
| R-05 | Concurrencia (doble draw) | Estado corrupto | Transacción + versionado optimista (`@Version`) + test de doble-click |
| R-06 | N+1 al cargar frentes/puntos | Perf | `fetch join` / `@EntityGraph` + test con `assertNoNPlusOne` o conteo queries |
| R-07 | Frontend desincronizado cree que puede actuar | Mala UX / trampas | Backend 409/422 con `errorCode` máquina-legible; UI solo refleja |
| R-08 | Hero/animaciones destruyen perf o a11y | Evaluación UX negativa | `prefers-reduced-motion`, transform-only, presupuesto 60fps |
| R-09 | Perseguir 100%/90% con tests basura | Falsa confianza | Política: cada test prueba comportamiento; Pitest como juez |
| R-10 | Sin git aún, sin CI | Sin trazabilidad | `git init` + ramas + PRs desde Phase 2 |

### Arquitectura inicial (resumen — detalle en DECISIONS ADR-001)
Monolito modular, 3 capas: `domain` (Java puro: `DeckFactory`, `GameEngine`, `TurnPolicy`, `ScoringService` — sin anotaciones Spring), `application` (`GameService` transaccional, puertos `ShufflePort`, `ClockPort`), `infrastructure` (`RestController`, DTOs + Bean Validation, JPA entities + repositories, Flyway, GlobalExceptionHandler RFC7807, `requestId` filter). Frontend desacoplado vía REST, nunca decide reglas.

### Stack propuesto (resumen — detalle en DECISIONS ADR-002/003/004)
Backend: Java 17 LTS, Spring Boot 3.3, Data JPA/Hibernate, Flyway, PostgreSQL 16 (Docker) + H2 (tests), JUnit5+Mockito+AssertJ, MockMvc, JaCoCo, Pitest. Frontend: React 18 + Vite + TypeScript, React Query o fetch tipado, GSAP 3 timelines, Playwright. CI: GitHub Actions. Todo versionado, sin secretos.

### Estructura de repositorio propuesta
```
/backend/ (pom.xml o build.gradle, src/main/java/com/pelusa/{domain,application,infrastructure}, resources/db/migration/)
/frontend/ (Vite React TS, src/{routes,components/game,state,animations}, e2e/)
/docs/ (PROJECT_PLAN, DECISIONS, LEARNING_LOG, API_CONTRACT futuro, ARCHITECTURE futuro)
/e2e/ o frontend/e2e (Playwright Caso 1 y 2)
/docker-compose.yml (postgres)
/.github/workflows/ci.yml
README.md
```

### Estrategia Git propuesta
`main` protegida (requiere PR + CI verde) · `develop` solo si hay releases paralelas (si no, trabajar contra `main` vía branches cortas) · ramas `feature/… fix/… test/… refactor/… docs/… chore/…` · commits convencionales (`feat(game): …`) pequeños y lógicos, nunca mezclar backend+frontend+DB sin necesidad · cada fase = branch(es) + PR + squash o merge con historia legible. Prohibido commitear/pushear sin autorización explícita.

---

## Phase 0 — Discovery
**Objetivo:** entender problema, cerrar ambigüedades críticas, fijar arquitectura/stack/fases.
**Dependencias:** ninguna. **Archivos probables:** `docs/*`, `README.md`, `.gitignore`.
**Criterio de terminado:** este plan + DECISIONS + LEARNING_LOG creados y aprobados por vos; repo con `git init`; R-01/R-02/R-03 con propuesta de cierre.
- [x] Analizar requisitos
- [x] Identificar reglas
- [x] Identificar entidades
- [x] Identificar flujos
- [x] Identificar riesgos
- [x] Definir stack (CONFIRMADO 2026-10-06: React+TS frontend, Java+Spring Boot backend)
- [x] `git init` + `.gitignore` + rama inicial (hecho 2026-10-06 en `docs/phase1-architecture`, sin commit aún)

## Phase 1 — Architecture
**Objetivo:** hacer defendible el sistema antes de codificar.
**Dependencias:** Phase 0 aprobada. **Archivos:** `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `DECISIONS.md`.
**Criterio de terminado:** máquina de estados + modelo ER + contrato REST de cada endpoint (método/path/request/response/errores/reglas/auth/impacto BD) + estrategia testing, todo revisado por vos.
- [x] Arquitectura (paquetes, dependencias permitidas, dónde vive cada regla) → `docs/ARCHITECTURE.md`
- [x] Modelo de dominio (clases, invariantes, diagrama) → `docs/ARCHITECTURE.md §3–5`
- [x] Modelo de datos (tablas, FKs, índices, migraciones V1) → `docs/DATA_MODEL.md`
- [x] API contract (endpoints draw/stand/stash/steal/start/finish/history + errores) → `docs/API_CONTRACT.md`
- [x] Testing strategy (qué se testea en cada nivel, thresholds JaCoCo/Pitest) → `docs/ARCHITECTURE.md §10`

## Phase 2 — Backend foundation
**Objetivo:** esqueleto Spring que compila, migra y responde health real.
**Dependencias:** Phase 1. **Archivos:** `backend/*`, `docker-compose.yml`, `ci.yml` básico.
**Estado 2026-10-06:** código completo en `feature/backend-foundation`, revisión estática OK.
⛔ Build SIN verificar en esta máquina (JRE 8, sin Maven/Docker/winget; descarga JDK 24MB/10min → inviable en sesión).
Ver `README.md` para instalar JDK 17. CI (`ci.yml` con Temurin 17) lo verificará.
**Criterio de terminado:** `GET /actuator/health` verifica DB, Flyway V1 aplica en Postgres y H2, CI build verde, PR mergeado.
- [x] Scaffold Spring Boot 3 + JPA + Validation + Actuator
- [x] Config por entorno (sin secretos), Hikari default, logs estructurados + requestId
- [x] Flyway V1 (games, players, cards, turns), índices justificados
- [x] GlobalExceptionHandler RFC7807 + HealthIndicator DB
- [x] CI: build + unit skeleton
- [ ] `mvn verify` en máquina con JDK 17 (BLOQUEADO aquí, pendiente)

## Phase 3 — Game domain
**Objetivo:** reglas puras 100% testeadas sin Spring ni DB.
**Dependencias:** Phase 2. **Archivos:** `backend/.../domain/*`, `*Test.java` unitarios.
**Estado 2026-10-06:** código + tests escritos en `feature/game-domain`, revisión estática OK.
⛔ Tests SIN correr aquí (sin JDK/Maven; `gh` sin login → sin CI aún). El CI será el juez al pushear.
**Criterio de terminado:** `DeckFactory` (110 exactas), `TurnPolicy` (pérdida/continuar), `ScoringService` + desempate, `GameEngine` (stash/draw/steal/stand/bust/finish) con tests parametrizados + Pitest alto en paquete domain, PR verde.
- [x] DeckFactory + ShufflePort (seed inyectable)
- [x] TurnPolicy (regla ≥3 + repetido) → `BustPolicy` + tabla de verdad 2×2
- [x] Stash / Draw / Steal / Bust / Finish → `Table` + `StashPolicy`/`StealPolicy`
- [x] Scoring + tiebreak → `ScoringService` lexicográfico 1→10
- [x] Unit tests JUnit5+AssertJ (normales, edge, errores, invariantes)
- [ ] `mvn test` verde + Pitest dominio (BLOQUEADO: pendiente JDK 17 / CI con remote)

## Phase 4 — REST API
**Objetivo:** exponer dominio vía REST validado, backend como juez.
**Dependencias:** Phase 3. **Archivos:** controllers, DTOs, services transaccionales, `MockMvc` tests.
**Estado 2026-10-07:** implementado en `feature/rest-api`, **CI verde 43/43** (35 dominio+f fundación + 8 API).
Bugs cazados por CI: orden FK en create, `current_player_id` sin rotar, `GAME_NOT_FINISHED` 422 vs contrato 409,
bulk updates que saltaban el contexto de persistencia.
**Criterio de terminado:** endpoints crean/inician/consultan/operan partida con 200/201/400/404/409/422 correctos, validación DTO, 409 en doble-draw concurrente, MockMvc cubre controller+service+persistencia, PR verde.
- [x] `POST /api/games`, `POST /api/games/{id}/start`, `GET /api/games/{id}`
- [x] `POST /api/games/{id}/draw`, `/stand`, `/stash`, `/steal`
- [x] `GET /api/games/history`, `GET /api/games/{id}/result`
- [x] Manejo errores consistente + idempotencia por clave (rate-limit: Phase 11)
- [x] REST tests (status, body, validación, transiciones ilegales)
- [ ] PR a main mergeado (requiere tu autorización)

## Phase 5 — Frontend foundation
**Objetivo:** shell navegable que habla con API real, sin lógica de reglas.
**Dependencias:** Phase 4 (API estable). **Archivos:** `frontend/*`, cliente API tipado.
**Estado 2026-10-07:** implementado en `feature/frontend-foundation`, build verde local (tsc + vite) y job CI.
**Criterio de terminado:** crear/unirse/ver estado/turno desde UI contra backend local, manejo de errores 4xx legible, skeleton responsive, PR verde.
- [x] Vite React TS + router + cliente API tipado + `useGame` (reconciliación por servidor)
- [x] Pantallas: home, setup, board (funcional), history, result (en board)
- [x] Manejo errores API (409/422 → mensajes, sin decidir reglas en cliente)

## Phase 6 — Visual system
**Objetivo:** identidad propia, no AI-slop. 2–4 direcciones visuales antes de implementar.
**Dependencias:** Phase 5. **Archivos:** `frontend/src/styles/tokens/*`, componentes base.
**Estado 2026-10-07:** elegida **A Mesa Nocturna** (fieltro, marfil, ámbar; Fraunces + Space Grotesk).
Tokens oklch, grano CSS, cartas físicas con elevación, jerarquía primaria/secundaria,
`prefers-reduced-motion`, foco visible. Hero físico = Phase 8.
**Criterio de terminado:** dirección elegida por vos (concepto/composición/tipo/color/materiales/motion), tokens + tipografía + materiales translúcidos + modo reduced-motion, PR con screenshots.
- [x] Proponer 2–4 direcciones (A Mesa Nocturna elegida)
- [x] Implementar elegida: tokens, tipografía, grano, sombras de elevación

## Phase 7 — Game UX
**Objetivo:** partida completa jugable con feedback de reglas.
**Dependencias:** Phase 6. **Archivos:** componentes juego, explicaciones contextuales.
**Criterio de terminado:** flujo crear→iniciar→draw→stand/stash/steal→bust→finish→ranking funciona contra API, agrupación por valor, explicación visual de repetición/pérdida/robo, Caso funcional 1 manual OK.
- [ ] Board, frentes, mazo, puntos, turnos
- [ ] Acciones con estados optimistas reconciliados por backend
- [ ] Reglas explicadas in-context + ejemplos animados

## Phase 8 — Advanced animation
**Objetivo:** hero "baraja que cae y se apila" + motion con propósito.
**Dependencias:** Phase 7. **Archivos:** `frontend/src/animations/*` (GSAP timelines).
**Criterio de terminado:** hero cinematográfico (trayectoria/rotación/velocidad/masa/contacto/stack final estable), animaciones carta/jugador/estado con razón UX, reduced-motion, 60fps sin layout thrash, PR con video/GIF.
- [ ] Hero stack físico (stagger, spring, blur/scale/rotación, parallax)
- [ ] Carta: draw/reveal/place/group/steal/discard/stash/hover/error
- [ ] Jugador/estado: turno activo, victoria/derrota, cambio turno, ranking

## Phase 9 — Testing
**Objetivo:** pirámide completa y métricas honestas.
**Dependencias:** Phases 3–8. **Archivos:** `backend/src/test/*`, `frontend/e2e/*`, thresholds CI.
**Criterio de terminado:** unit+integración+REST+Playwright Caso 1 y 2 verdes, JaCoCo 100% líneas críticas / ≥90% global, Pitest ≥90% en dominio, sin tests de getters, PR verde.
- [ ] Integration tests JPA real (no mock DB), @Transactional, conteo queries
- [ ] Playwright Caso 1 (turno feliz) + Caso 2 (pérdida 3+repetida→descarte→rotación)
- [ ] Coverage + mutación en CI como gate

## Phase 10 — CI/CD
**Objetivo:** pipeline que impide mergear roto.
**Dependencias:** Phase 9. **Archivos:** `.github/workflows/ci.yml`, badges, `SECURITY.md` básico.
**Criterio de terminado:** jobs build/unit/integration/REST/frontend/Playwright/coverage/mutación/lint secuenciados con caché, rama protegida, fallo bloquea merge, documentado qué queda para después y por qué.
- [ ] Jobs + caché + artefactos (reportes)
- [ ] Gates de cobertura/mutación
- [ ] Lints (Checkstyle/Spotless + ESLint/Prettier)

## Phase 11 — Hardening
**Objetivo:** listo para sustentación adversa.
**Dependencias:** Phase 10. **Archivos:** config prod, backups, runbook.
**Criterio de terminado:** rate-limit + timeouts + idempotencia (key en POST acciones) + índices verificados + backups/restore probado + health real + 429 correcto + secretos fuera del repo, checklist OWASP básico pasado.
- [ ] Rate limiting, timeouts, idempotencia, transacciones auditadas
- [ ] Índices, pool, migraciones expand/contract si hubo cambios
- [ ] Logs correlacionados sin PII, backups/restore drill

## Phase 12 — Final defense
**Objetivo:** poder explicar y mutar el sistema en vivo.
**Dependencias:** Phase 11. **Archivos:** `docs/DEFENSE.md`, demo seed, slides si aplica.
**Criterio de terminado:** guía de defensa (decisiones, trade-offs, qué cambiar si el profe pide X), demo reseteable, deuda técnica y riesgos sincerados, tag `v1.0-defensa`.
- [ ] Ensayo de preguntas (¿por qué monolito? ¿por qué JPA? ¿cómo probarías X?)
- [ ] Mutaciones en vivo practicadas (cambiar desempate, nº jugadores, composición mazo)
- [ ] Cierre + tag

---

## Deuda técnica / Pendientes vivos
- [x] Cerrar R-01/R-02/R-03 — CERRADOS 2026-10-06 (ver RF-08/RF-09/I-07)
- [ ] Decidir `develop` vs trunk-to-`main` — due: Phase 2 inicio (con `git init`)
- [ ] Confirmar nº jugadores mín/máx y jugador inicial aleatorio vs elegido — due: Phase 1
- [ ] Confirmar autenticación necesaria o partidas anónimas (propuesta: anónimas + `playerToken` opcional, sin login para no inflar alcance) — due: Phase 1

## Reglas de fase (recordatorio)
1. Mostrar objetivo + tareas + dependencias + archivos + qué aprenderás. 2. Esperar tu aprobación. 3. Ejecutar SOLO esa fase. 4. Al cerrar: tests, diff, arch, seguridad, deuda, actualizar estos 3 docs, preparar commit/PR, DETENERSE.
