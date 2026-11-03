# Pelusa Game

Juego web de cartas **Pelusas**. El backend (Java 25 + Spring Boot 3.5) es la
única fuente de verdad de las reglas; el frontend (React 18 + TypeScript) solo
muestra el estado que devuelve la API REST. Modos: **un dispositivo** (hotseat)
y **multijugador online por código de sala**, sin cuentas.

## Integrantes

| Nombre | Rol |
|---|---|
| Andrés Cáliz | Desarrollo completo (backend, frontend, pruebas, despliegue) |

## Tecnologías

| Capa | Tecnología |
|---|---|
| Backend | Java 25 LTS, Spring Boot 3.5 (Web, Validation, Data JPA, Actuator), Flyway 11 |
| Base de datos | PostgreSQL 16 (Docker local) / Neon PostgreSQL (deploy) / H2 en memoria (tests y e2e) |
| Frontend | React 18, TypeScript 5, Vite 5, React Router, GSAP, three.js / R3F (vista 3D opcional) |
| Pruebas | JUnit 5, AssertJ, Mockito 5, MockMvc, JaCoCo 0.8.14, PIT 1.30.1, Playwright 1.64 (JavaScript) |
| CI/Deploy | GitHub Actions, Docker, Render (Blueprint `render.yaml`) |

## Arquitectura (resumen)

```
React (routes, hooks, api/client.ts) ──REST/JSON──▶ GameController ──▶ GameService ──▶ Table + políticas (dominio puro)
                                                        │                   │
                                          GlobalExceptionHandler      Repositorios JPA ──▶ PostgreSQL / H2 (Flyway V1…V7)
```

- `domain/` — reglas puras sin Spring: `Table` (motor de turnos), `BustPolicy`,
  `StashPolicy`, `StealPolicy`, `ScoringService` (puntos + desempate 1→10), `DeckFactory` (110 cartas).
- `application/GameService` — casos de uso transaccionales: reconstruye la `Table`
  desde la BD, ejecuta la regla y persiste.
- `infrastructure/` — controllers REST + DTOs, manejo de errores RFC 7807, entidades JPA, CORS, request-id.

## Requisitos

- JDK 25 LTS en `JAVA_HOME` (o en el `PATH`), Maven 3.9+, Node 20+ (CI usa 22).
- Docker opcional (Postgres local). Sin Docker el backend puede correr con H2.

## Ejecutar

### Backend

```bash
docker compose up -d postgres        # Postgres local pelusa/pelusa en :5432
cd backend
mvn spring-boot:run                  # http://localhost:8080
```

Sin Docker (H2 en archivo, persiste en `backend/data/`):

```bash
cd backend
mvn -DskipTests package
java -jar target/pelusa-game-0.1.0-SNAPSHOT.jar --spring.profiles.active=local
```

Configuración por variables de entorno (ver `.env.example`):
`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`,
`CORS_ALLOWED_ORIGINS`, `PORT`. Las migraciones Flyway (`backend/src/main/resources/db/migration`)
crean el esquema; Hibernate solo valida (`ddl-auto: validate`).

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxy /api → :8080)
npm run build        # typecheck + build de producción
```

Flujo: inicio → `/setup` (un dispositivo u online) → `/game/:id` → `/history`.

## Pruebas

| Qué | Comando | Reporte |
|---|---|---|
| Unitarias + integración (MockMvc + H2) + cobertura con gate 100 % | `cd backend && mvn verify` | `backend/target/site/jacoco/index.html` |
| Mutación (PIT, umbral 90 %) | `cd backend && mvn test-compile org.pitest:pitest-maven:mutationCoverage` | `backend/target/pit-reports/index.html` |
| Funcionales Playwright (JS) | `cd backend && mvn -DskipTests package` y luego `cd frontend && npx playwright install chromium && npm run test:e2e` | `frontend/playwright-report/index.html` |

- Playwright levanta solo el backend con perfil **`e2e`** (H2 en memoria, puerto 8081)
  y Vite en el 5174. El perfil `e2e` agrega `POST /api/test/games/{id}/deck`, que
  **ordena** el mazo (sin cambiar su composición) para que los escenarios sean
  reproducibles. No existe fuera de ese perfil.
- **PIT en Windows con usuario no-ASCII** (ej. `C:\Users\Andréss`): los procesos hijos de PIT
  no arrancan desde rutas con tildes (`MINION_DIED`). Este script lo corre desde una copia en
  `C:\Temp` y deja el reporte en `backend/target/pit-reports/`:
  `powershell -ExecutionPolicy Bypass -File backend\scripts\pit-windows.ps1`. En Linux/CI no hace falta.

Copias de los reportes de la entrega (cobertura, mutación y Playwright): `docs/entrega/reportes/`.

## API

Todos los endpoints con ejemplos CURL: [`docs/entrega/CURL.md`](docs/entrega/CURL.md).
Errores en formato RFC 7807 (`application/problem+json`) con `errorCode`: 400 validación,
404 no existe, 409 conflicto de turno o de estado, 422 regla de juego violada.

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/games` | Crear partida hotseat (201) |
| POST | `/api/games/online` · `/api/games/join` | Sala online: crear (201) / unirse (200) |
| POST | `/api/games/{id}/start` | Iniciar |
| GET | `/api/games/{id}` · `/api/games/{id}/players` | Estado / jugadores |
| POST | `/api/games/{id}/draw` · `/stand` · `/stash` · `/steal` | Sacar, plantarse, guardar, robar |
| GET | `/api/games/{id}/result` · `/api/games/history` | Resultado / histórico |
| GET | `/api/health` · `/api/ping` · `/actuator/health` | Salud |

## Reglas implementadas

- Mazo: 110 cartas (13 × valores 1–5, 9 × valores 6–10), barajado con `SecureRandom`.
- Turno: guardar (opcional, solo antes de sacar) → sacar una o más cartas → robar (opcional) → plantarse.
  Para plantarse hay que haber sacado **al menos una carta** (`MUST_DRAW_FIRST`).
- Robo: solo en tu turno y solo el **valor de la última carta que sacaste**; esas cartas de todos los rivales pasan a tu frente.
- Pérdida: la carta sacada repite un valor de tu frente **y** el frente tiene ≥ 3 cartas (contando la recién sacada) → todo tu frente al descarte, no puntúa, pasa el turno.
- Fin: mazo vacío → los frentes se guardan solos → puntos = suma de guardadas → desempate por cantidad de 1s, luego 2s… hasta 10s; si todo coincide, empate.
- Online: cada turno tiene 15 s y **cada carta sacada reinicia el reloj**; si vence, el servidor pasa el turno.
  La UI muestra la cuenta atrás en verde (15–10 s), amarillo (9–5 s) y rojo (< 5 s).

## Documentación

- `docs/entrega/CURL.md` — prueba manual de todos los endpoints.
- `docs/entrega/reportes/` — reportes de cobertura (JaCoCo), mutación (PIT) y Playwright.
- `docs/DEPLOY.md` — despliegue en Render + Neon.

## Deploy

Render Free (backend Docker + frontend estático en un Blueprint) + Neon Postgres. Ver `docs/DEPLOY.md`.
