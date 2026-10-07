# Pelusa Game

Juego web de Pelusas. Backend = fuente de verdad (Java + Spring Boot). Frontend = React + TS (fases 5+).

Docs: `docs/PROJECT_PLAN.md` (fases) · `docs/ARCHITECTURE.md` · `docs/DATA_MODEL.md` · `docs/API_CONTRACT.md` · `docs/DECISIONS.md` · `docs/LEARNING_LOG.md`.

## Requisitos

- JDK 17 + Maven 3.9 (backend). Esta máquina aún tiene solo JRE 8 → ver "Instalar JDK".
- Docker Compose (Postgres 16 local). Sin Docker, los tests usan H2 en memoria.

## Backend (Phase 2)

```bash
cp .env.example .env          # opcional: exporta las vars en tu shell
docker compose up -d postgres # DB local pelusa/pelusa
cd backend
mvn spring-boot:run           # http://localhost:8080/api/health y /actuator/health
mvn verify                    # tests: contexto + Flyway V1 sobre H2 real
```

## Instalar JDK 17 (Windows, sin winget en esta máquina)

1. Descargar Microsoft Build of OpenJDK 17 (x64 ZIP) desde
   https://learn.microsoft.com/java/openjdk/download#openjdk-17
2. Descomprimir en `C:\Java\jdk-17` y añadir `C:\Java\jdk-17\bin` al PATH.
3. `java -version` debe decir 17. Luego `mvn -version` (instalar Maven desde
   https://maven.apache.org/download.cgi si falta).

## Frontend (Phase 5)

```bash
cd frontend
cp .env.example .env   # opcional; vacío = proxy /api al backend local
npm install
npm run dev            # http://localhost:5173 (proxy /api → :8080)
npm run build          # typecheck + build prod (lo corre el CI)
```

Flujo: home → setup (nombres) → board (`/game/:id`: elegir "jugar como",
sacar/plantarse/guardar/robar, ver frentes y resultado) → history.

## Reglas cerradas

- Robo: solo en tu turno, roba **todas** las del valor del frente ajeno → tu frente.
- Pérdida: `repetido && frente>=3` post-colocación; si no, sigue.
- Puntos: Σ guardadas; desempate lexicográfico 1→10.
