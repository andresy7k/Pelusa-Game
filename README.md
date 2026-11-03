# Pelusa Game

Juego web de Pelusas. Backend = fuente de verdad (Java + Spring Boot); frontend = React + TS.
Hotseat (un dispositivo) y **multijugador online por código de sala**, sin cuentas.

Docs: `docs/PROJECT_PLAN.md` (fases) · `docs/ARCHITECTURE.md` · `docs/DATA_MODEL.md` ·
`docs/API_CONTRACT.md` · `docs/DECISIONS.md` · `docs/LEARNING_LOG.md` · `docs/DEPLOY.md`.

## Requisitos

- JDK 17 (es el del CI; con JDKs más nuevos los tests pueden fallar por JaCoCo/Mockito).
- Maven 3.9+, Node 20+.
- Docker opcional: Postgres 16 local. Sin Docker, el backend corre con H2 en memoria.

## Backend

```bash
docker compose up -d postgres   # DB local pelusa/pelusa
cd backend
mvn spring-boot:run             # http://localhost:8080
```

Sin Docker (H2 en memoria, se pierde al reiniciar):

```bash
cd backend
mvn spring-boot:run \
  -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:h2:mem:pelusa;MODE=PostgreSQL;DB_CLOSE_DELAY=-1 --spring.datasource.driver-class-name=org.h2.Driver --spring.datasource.username=sa"
```

- Salud: `GET /api/health` (200, sin DB; health check de Render), `GET /actuator/health` (DataSource real) y `GET /api/ping` (204, keep-alive gratuito).
- Tests: `mvn verify` con JDK 17 (el CI los corre en cada push).
- Migraciones Flyway V1…V7 en `backend/src/main/resources/db/migration/`.

## Frontend

```bash
cd frontend
cp .env.example .env   # opcional; vacío = proxy /api al backend local
npm install
npm run dev            # http://localhost:5173 (proxy /api → :8080)
npm run build          # typecheck + build prod (lo corre el CI)
```

Flujo: home → setup → board (`/game/:id`) → history.
En setup se elige **Un dispositivo** (hotseat) u **Online**.

## Multijugador online (resumen)

- Crear sala genera un **código de 6 caracteres** (alfabeto sin letras ambiguas).
  El enlace para invitar es `/setup?code=CODIGO`.
- Lobby con polling cada 2 s: muestra quiénes entran y el host decide cuándo
  empezar (mínimo 2). Al arrancar, todos saltan solos al tablero.
- El `playerId` vive en `localStorage` por partida: recargar no pierde la silla.
- Quien llega con la partida empezada entra como **espectador** (sin silla).
- Turnos ONLINE con **reloj de 15 s**: al vencer, el backend rota el turno
  (expiración perezosa al leer o actuar) y emite `TURN_EXPIRED`.
- Tablero con polling de 2,5 s (pestaña visible); no hay WebSockets.

## Deploy (gratis)

Render Free: **frontend static + backend Docker en un mismo Blueprint**
(`render.yaml`) y Neon Free (Postgres). Render autoconecta `VITE_API_URL` y
`CORS_ALLOWED_ORIGINS`; `BACKEND_URL` activa el keep-alive.
Pasos, la alternativa con Vercel y troubleshooting: ver **`docs/DEPLOY.md`**.
El backend expone `$PORT` y el CI valida con JDK 17.

## Reglas cerradas

- Robo: solo en tu turno y solo el **valor de la última carta que sacaste**;
  esas cartas (todas, de todos los frentes ajenos) van a tu frente.
- Pérdida: `repetido && frente>=3` post-colocación; si no, sigue.
- Puntos: Σ guardadas; desempate lexicográfico 1→10.
