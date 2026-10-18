# Deploy

Guía de despliegue de Pelusas: frontend en **Vercel** + backend Spring Boot en
**Render** + Postgres. Todo lo sensible llega por variables de entorno; en el
repo no hay secretos.

## Topología

```text
navegador (Vercel, estático)
   │  mismo origen: /api/* y /game/*
   ▼
vercel.json rewrite  ──►  backend Spring Boot (Render)  ──►  Postgres
        │                        /api/**                            │
        └── /game/* → index.html (SPA)              players, games, fronts, deck
```

Claves del diseño:

- **El navegador nunca habla cross-origin**: `vercel.json` reescribe `/api/*` al
  backend. Por eso no hay CORS ni variables de entorno en Vercel.
- **El backend sigue siendo la única fuente de verdad**: los clientes leen
  `GET /api/games/{id}` y actúan con `playerId` + `Idempotency-Key`.

## 1. Frontend en Vercel

1. Importa el repo en Vercel con:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (build `npm run build`, output `dist`)
2. **Edita `frontend/vercel.json`** y reemplaza el placeholder por la URL real
   del backend:

   ```json
   { "source": "/api/:path*", "destination": "https://TU-BACKEND.onrender.com/api/:path*" }
   ```

   Sin este paso, `/api/*` da 404: Vercel no tiene a quién reescribir.
3. **No hace falta ninguna variable de entorno.** `VITE_API_URL` queda vacío a
   propósito (ver `frontend/.env.example`).
4. Deploy. Verifica:
   - `https://<tu-dominio>/setup` responde (si da 404, falta la regla de SPA).
   - Crear una partida localmente → si el backend no está arriba verás el error
     de conexión; con el backend ya desplegado, la mesa funciona igual.

## 2. Backend en Render

Render construye el jar con su runtime de Java (no hay Dockerfile ni wrapper
de Maven en el repo).

1. New → Web Service → connect repo. Configuración:
   - **Runtime**: Java 17
   - **Build command**: `mvn -B -DskipTests package`
   - **Start command**: `java -jar target/pelusa-game-0.1.0-SNAPSHOT.jar`
   - **Instance type**: Free (duerme tras ~15 min sin tráfico; el primer
     request tras dormir tarda medio minuto)
2. Variables de entorno (obligatorias):

   | Variable | Ejemplo |
   | --- | --- |
   | `SPRING_DATASOURCE_URL` | `jdbc:postgresql://ep-xxx.sa-east-1.aws.neon.tech/pelusa?sslmode=require` |
   | `SPRING_DATASOURCE_USERNAME` | `pelusa` |
   | `SPRING_DATASOURCE_PASSWORD` | *(la de tu Postgres)* |

3. Flyway corre las migraciones solo al arrancar; `ddl-auto=validate` hace que
   la app falle si el esquema no coincide (no uses `update`).
4. Health check: Render usa `/actuator/health` (ya está expuesto). Si lo
   configuras, usa esa ruta.

### Postgres en producción

Cualquier Postgres accesible por HTTPS sirve. Opciones gratuitas:

- **Neon** (recomendado): plan free con connection string directo.
- **Supabase**: plan free (usar el pooler en modo `transaction`).
- **Postgres de Render**: ya no tiene plan gratuito.

En local: `docker compose up -d postgres` (ya está en `docker-compose.yml`) y
`mvn spring-boot:run` con las variables de `.env.example`.

## 3. Checklist de humo

1. `GET /actuator/health` → `UP`.
2. Crear partida desde `/setup` → debería repartir y abrir `/game/<id>`.
3. Recargar `/game/<id>` en Vercel → **no** debe dar 404 (regla SPA).
4. Sacar una carta → el evento aparece (confirma que el proxy `/api` funciona).

## Notas y trampas

- **Vercel no tiene variables en `vercel.json`**: la URL del backend va
  hardcodeada en el archivo. Si cambias de host, edita esa línea y redeploya.
- **WebSocket no viaja por el proxy de Vercel** (no hay upgrade). Si el
  multijugador necesita WS, el navegador tendría que conectarse directo a
  `wss://TU-BACKEND.onrender.com` (y entonces sí, CORS no aplica a WS pero
  VITE_API_URL sí hace falta). SSE sí pasa por el proxy.
- **El plan free de Render duerme**: con la página abierta (polling) no duerme;
  con la mesa quieta, el primer click tras un rato puede tardar.
- `frontend/vercel.json` solo aplica al deploy de Vercel: en dev local manda el
  proxy de Vite (`vite.config.ts`).