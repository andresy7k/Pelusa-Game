# LEARNING_LOG.md — Bitácora de aprendizaje just-in-time

> Después de cada decisión importante: concepto, problema, solución, por qué, alternativas, riesgos, cómo defenderlo. Nada de relleno: solo lo que te sirva para modificar y defender el sistema.

---

### 2026-10-06 — Phase 0 Discovery: por qué el backend es la fuente de verdad
**Concepto:** Autoridad de reglas (server-authoritative) + máquina de estados + invariantes.
**Problema:** Si la UI decide "puedo robar / es mi turno / perdí", un usuario (o un bug) puede romper o trampear la partida y el tribunal lo va a notar.
**Solución:** Toda acción pasa por `GameEngine` en backend dentro de una transacción que valida turno, estado, polvo y frente; la UI solo refleja `GET /games/{id}` y maneja 409/422 con elegancia.
**Por qué:** Un solo lugar donde las reglas viven = un solo lugar para testear, mutar y explicar. Es lo que permite 100% coverage honesto.
**Alternativas:** Validar en frontend y "confirmar" en backend (duplica lógica, diverge); backend tonto que persiste lo que le mandan (indefendible).
**Riesgos:** Latencia percibida — se mitiga con estados optimistas reconciliados por el servidor.
**Cómo defenderlo:** "¿Qué pasa si abro dos tabs y saco dos veces? El segundo recibe 409 por versionado optimista. La regla no está en el botón, está en `TurnPolicy` con 12 tests parametrizados. Les muestro el test."

### 2026-10-06 — Phase 0: por qué 110 cartas exactas importan (13×1–5, 9×6–10)
**Concepto:** Distribución no uniforme como balance de juego + invariante testeable.
**Problema:** Generar "cantidades iguales" cambia probabilidades: valores altos (6–10) deben ser más escasos para que guardar/robar/persistir tenga tensión.
**Solución:** `DeckFactory` construye 65+45 exactas y baraja con `ShufflePort` inyectable (seed fijo en tests).
**Por qué:** Si el mazo está mal, TODAS las partidas están mal y ningún test posterior tiene sentido. Es el primer test de oro.
**Alternativas:** `Collections.shuffle` directo sin puerto — no determinista, tests flaky.
**Riesgos:** Off-by-one en conteo — mitigado con test `assertThat(deck).hasSize(110)` + conteo por valor.
**Cómo defenderlo:** "Miren `DeckFactoryTest`: falla si alguien cambia un 13 por un 12. Y Pitest lo confirma mutando el 13."

### 2026-10-06 — Phase 0: por qué monolito modular y no microservicios
**Concepto:** YAGNI + límites claros (dominio puro sin Spring).
**Problema:** CQRS/Kafka/Redis suenan "enterprise" pero añaden red, consistencia eventual y jerga que no podrás defender cuando te pidan cambiar el desempate en vivo.
**Solución:** Monolito con regla de dependencias `domain ← application ← infrastructure`. Todo cambio de regla = 1 clase + N tests.
**Por qué:** Explicable en 2 minutos, testeable sin contenedor, modificable en sustentación.
**Alternativas:** Ver ADR-001.
**Riesgos:** Que el dominio se contamine con `@Entity` — se revisa en PR y con regla ArchUnit futura (Phase 11 si da tiempo).
**Cómo defenderlo:** "Les dibujo 3 cajas y les muestro que `GameEngine` no importa nada de Spring. Puedo cambiar la DB sin tocar reglas."

### 2026-10-06 — Phase 0: qué significa "pérdida con ≥3 + repetido"
**Concepto:** Condición compuesta (conjunción) con efecto atómico.
**Problema:** El enunciado se puede leer mal como "pierde si repite O si tiene 3". Es Y, no O. Y el efecto (descarte total sin puntos + rotación) debe ser atómico.
**Solución (propuesta a cerrar Phase 1):** `bust = front.contains(value) && front.size() >= 3` evaluado DESPUÉS de colocar la carta. Si `size()<3` aunque repita → sigue jugando.
**Por qué:** Es el caso que el tribunal va a probar en vivo (Caso 2 Playwright).
**Alternativas:** Evaluar antes de colocar — cambia el conteo en el borde (2→3). Hay que fijarlo con test.
**Riesgos:** Ambigüedad del disparador de robo (R-01) — no codificar robo hasta cerrarlo.
**Cómo defenderlo:** "Les muestro la tabla de verdad 2×2 (repite/no-repite × <3/≥3) con 4 tests, y el Caso 2 e2e donde el descarte queda vacío de puntos."

### 2026-10-06 — Cierre R-01/R-02/R-03: robo, pérdida y desempate confirmados por vos
**Concepto:** Cerrar ambigüedad antes de codificar evita tests inútiles y retrabajo.
**Problema:** Sin disparador de robo, sin borde de pérdida y sin fórmula de desempate no se podía diseñar `StealPolicy`, `TurnPolicy` ni `ScoringService`.
**Solución:** R-01: robar solo en tu turno (cartas del frente ajeno → tu frente). R-02: `bust = repetido && size>=3` post-colocación, si no sigue. R-03: gana mayor suma guardada; desempate lexicográfico contando 1s, luego 2s… hasta 10s. Stack confirmado: React+TS frontend, Java+Spring Boot backend.
**Por qué:** Cada regla cerrada = una clase pura + tests parametrizados + un `errorCode` (`NOT_YOUR_TURN`, `BUST`, `TIEBREAK_BY_ONES`…). Así el tribunal puede pedirte cambiar el desempate y lo hacés en 1 función.
**Alternativas:** Dejarlo "para después" y codificar igual — garantizaba reescribir dominio y tests.
**Riesgos:** Si el profe interpreta robo distinto (ej: robar solo el valor recién sacado), hay que ajustar `StealPolicy` — pero el diseño lo aísla en un solo punto.
**Cómo defenderlo:** "Estas 3 reglas las cerramos antes de codificar y están en ADR-011/012/013 con su tabla de verdad. Si quieren, cambio el desempate en vivo y los tests me dicen si rompí algo."

### 2026-10-06 — Phase 1: por qué dominio puro + JPA separada + una fila por carta
**Concepto:** Separar "qué está permitido" (memoria, determinista) de "cómo se persiste/publica" (transacción, HTTP).
**Problema:** Si `GameEngine` conoce `EntityManager`, cada test necesita Spring y no puedes enseñar la regla sin mocks. Si la carta es un contador, pierdes orden y auditoría.
**Solución:** `domain` sin Spring; `GameService` transaccional llama al dominio y mapea a `*Entity`. `cards` 1 fila/carta con `location+owner+pile_order` + índices justificados + `version` optimista.
**Por qué:** Pitest rápido en dominio, N+1 evitado con EntityGraph, doble-draw → 409 demostrable.
**Alternativas:** Entidades como dominio (ahorra mappers, contamina reglas); contadores por valor (pierde trazabilidad).
**Riesgos:** Mappers aburridos y divergencia Postgres/H2 — mitigado con SQL estándar y CI dual en Phase 10.
**Cómo defenderlo:** "Les muestro `domain/` sin un solo import Spring, luego el test de 110 cartas y el 409 concurrente. El cambio de desempate es 1 función."

### 2026-10-06 — Phase 2: esqueleto antes que reglas + honestidad del build
**Concepto:** Foundation primero (compila, migra, health real) y dominio después. Y nunca afirmar un verde que no corrió.
**Problema:** Esta máquina tiene JRE 8 sin Maven/Docker/winget; Spring Boot 3 exige JDK 17. Descargar el JDK aquí iba a 40KB/s.
**Solución:** Esqueleto completo (`pom`, `PelusaApplication`, `application.yml` + perfil `test` H2, V1, 4 entidades mínimas, `GameRepository`, `RequestIdFilter`, `GlobalExceptionHandler` RFC7807, `/api/health`, 2 tests, `docker-compose` Postgres 16, `ci.yml` Temurin 17, `README` con instalación). Revisión estática en vez de `mvn verify`, marcado explícito como pendiente.
**Por qué:** La revisión estática cazó 4 bugs reales de portabilidad H2: `TIMESTAMPTZ`, `DEFERRABLE`, índice parcial `WHERE`, columnas `POSITION`/`VALUE` reservadas → `seat`/`card_value` solo en SQL+`@Column`.
**Alternativas:** Afirmar "compila" sin compilar (deshonesto, prohibido); o bloquear todo hasta tener JDK (pierde la fase entera por entorno).
**Riesgos:** Puede quedar un error de compilación menor hasta correr CI — mitigado con `ci.yml` que corre `mvn verify` en cada push.
**Cómo defenderlo:** "El build está pendiente de JDK 17 por entorno, no por código; la V1 ya es portable H2↔Postgres y el CI es el juez. Les muestro el `diff` y el checklist."

---
<!-- Plantilla para próximas entradas:
### Fecha — Título
**Concepto:**
**Problema:**
**Solución:**
**Por qué:**
**Alternativas:**
**Riesgos:**
**Cómo defenderlo:**
-->
