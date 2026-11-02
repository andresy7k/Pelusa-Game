# Deploy

Guía de despliegue gratis de Pelusas: frontend en **Vercel**, backend Spring Boot
en **Render Free** (Docker) y PostgreSQL en **Neon Free**. Todo lo sensible llega
por variables de entorno; en el repo no hay secretos.

## Topología

```text
navegador (Vercel, estático)
   │  mismo origen: /api/* y /game/*
   ▼
vercel.json rewrite  ──►  backend Spring Boot (Render, Docker)  ──►  Neon Postgres
        │                        /api/**                                  │
        └── /game/* → index.html (SPA)              players, games, fronts, deck
```

Claves del diseño:

- **El navegador nunca habla cross-origin**: `vercel.json` reescribe `/api/*` al
  backend. Por eso no hace falta CORS ni variables de entorno en Vercel.
- **El backend sigue siendo la única fuente de verdad**: los clientes leen
  `GET /api/games/{id}` y actúan con `playerId` + `Idempotency-Key`.
- **Flyway corre V1…V7 al arrancar**: no se ejecuta SQL a mano en producción.

## 0. Requisitos

- Repo en GitHub con `main` actualizado.
- Cuentas gratis en [neon.tech](https://neon.tech), [render.com](https://render.com)
  y [vercel.com](https://vercel.com).
- Nada de secretos en el repo: solo variables de entorno.

## 1. Neon (PostgreSQL)

1. New Project → nombre `pelusa` → región cercana (ej. `us-east-1`).
2. Dashboard → Connect → copiá la connection string:
   `postgresql://USER:PASSWORD@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
3. Convertila a **JDBC** (Spring necesita prefijo `jdbc:` y credenciales aparte):
   - `SPRING_DATASOURCE_URL=jdbc:postgresql://ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - `SPRING_DATASOURCE_USERNAME=USER`
   - `SPRING_DATASOURCE_PASSWORD=PASSWORD`
4. Flyway crea/actualiza el esquema solo. `ddl-auto=validate` hace fallar el boot
   si el esquema no coincide (no uses `update`).

> Neon Free suspende el compute por inactividad: el primer request puede tardar
> 0.5–2 s (despierta solo). No es un error.

## 2. Backend en Render (Docker + blueprint)

El repo trae `render.yaml` y `backend/Dockerfile` (build JDK 17, runtime JRE 17).

1. Render → **New → Blueprint** → elegí este repo. Render detecta `render.yaml`.
2. Completá las variables marcadas `sync: false` (las tres de Neon del paso 1).
3. Deploy. Verificá `https://TU-BACKEND.onrender.com/actuator/health` → `UP`.
   - `server.port=${PORT:8080}`: Render inyecta `PORT` y Spring lo respeta.
   - El plan free duerme tras ~15 min sin tráfico; el primer request tarda ~50 s.
     El paso 4 lo mitiga.

Alternativa manual (si no usás Blueprint): New → Web Service → runtime **Docker**,
Dockerfile `backend/Dockerfile`, contexto `backend`, health check
`/actuator/health`, plan Free, mismas variables.

> El Dockerfile copia `target/pelusa-game-0.1.0-SNAPSHOT.jar`: si cambia la
> versión en `backend/pom.xml`, actualizá esa línea.

## 3. Frontend en Vercel

1. Add New → Project → importá el repo.
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (build `npm run build`, output `dist`)
2. **Editá `frontend/vercel.json`** y reemplazá el placeholder por la URL real
   del backend (sin `/` final):
   ```json
   { "source": "/api/:path*", "destination": "https://TU-BACKEND.onrender.com/api/:path*" }
   ```
   Sin este paso, `/api/*` da 404: Vercel no tiene a quién reescribir.
3. **No hace falta ninguna variable de entorno.** `VITE_API_URL` queda vacío a
   propósito (ver `frontend/.env.example`); el cliente usa `/api` relativo.
4. Deploy. Verificá:
   - `https://<tu-dominio>/setup` responde (si da 404, falta la regla SPA).
   - `/game/<id>` recargado no da 404.
   - Crear sala online funciona (confirma el proxy `/api`).

### Modo directo (opcional, sin proxy)

Si preferís que el navegador llame al backend cross-origin (por ejemplo, para
WebSockets más adelante): seteá `VITE_API_URL=https://TU-BACKEND.onrender.com`
en Vercel **y** `CORS_ALLOWED_ORIGINS=https://TU-APP.vercel.app` en Render.
En ese caso podés quitar el rewrite `/api/*` de `vercel.json`. El proxy es la
opción recomendada porque evita CORS y una variable menos.

## 4. Keep-alive (evitar el sueño de Render)

1. GitHub → Settings → Secrets and variables → Actions → **Variables** → New:
   - `BACKEND_URL=https://TU-BACKEND.onrender.com`
2. `.github/workflows/keepalive.yml` hace `GET /api/ping` cada 10 min.
3. El front además pinguea cada 60 s mientras hay una pestaña abierta.
4. Las 750 h/mes de Render alcanzan para 24/7 (744 h).

> `*/10` es el mínimo práctico de GitHub Actions; puede retrasarse unos minutos.
> Si `BACKEND_URL` no está definida, el workflow no falla: se salta el ping.

## 5. Checklist de humo en producción

- [ ] `GET /actuator/health` → `UP`.
- [ ] `GET /api/ping` → `204`.
- [ ] `POST /api/games/online` con `{"name":"Ana","capacity":4}` → `201` + código de 6 chars.
- [ ] Abrir `/setup?code=CODE` en otro dispositivo → unirse y ver el lobby.
- [ ] El host pulsa “Empezar partida”; ambos tableros aparecen solos (polling 2,5 s).
- [ ] Turno sin jugar 15 s → rota con aviso `TURN_EXPIRED`.
- [ ] Tercer dispositivo con el enlace durante la partida → banner de espectador.
- [ ] Sacar una carta → el evento aparece (proxy `/api` funcionando).
- [ ] Recargar `/game/<id>` → no da 404 (regla SPA).

## 6. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| 502 / timeout en el primer request | cold start de Render | esperar ~50 s o configurar keep-alive (paso 4) |
| `/api/*` da 404 en Vercel | `vercel.json` con placeholder | editar la URL real y redeployar |
| `blocked by CORS policy` | solo en modo directo | ajustar `CORS_ALLOWED_ORIGINS` y redeployar |
| `Connection refused` a Postgres | URL JDBC mal formada | debe empezar con `jdbc:postgresql://` y llevar `sslmode=require` |
| Flyway falla al boot | migración no portable | correr `mvn verify` (H2, JDK 17) antes de mergear |
| Render duerme igual | workflow sin `BACKEND_URL` | definir la variable y correr el workflow a mano una vez |
| La app carga pero las acciones fallan | proxy apuntando a otro host | revisar `vercel.json` y redeployar |

## 7. Límites de los planes gratis

- **Neon Free**: 0,5 GB de storage; compute con autosuspend.
- **Render Free**: 512 MB RAM, 0.1 CPU, duerme a los 15 min, 750 h/mes.
- **Vercel Hobby**: 100 GB/mes de tráfico; builds para uso personal.

Con 2–6 jugadores y polling de 2,5 s, el consumo entra holgado en los tres planes.

## Notas y trampas

- **Vercel no soporta variables dentro de `vercel.json`**: la URL del backend va
  hardcodeada. Si cambiás de host, editá esa línea y redeployá.
- **WebSocket no viaja por el proxy de Vercel** (no hay upgrade). Por eso el
  online usa polling; si algún día se migra a WS, ir directo a Render con
  `VITE_API_URL` y CORS. SSE sí pasa por el proxy.
- **El plan free de Render duerme**: con una pestaña abierta (polling/ping) no
  duerme; con la mesa quieta, el primer click puede tardar.
- `frontend/vercel.json` solo aplica en Vercel: en dev local manda el proxy de
  Vite (`vite.config.ts`).
- Tests: `mvn verify` con JDK 17 (58 tests: dominio, API, Flyway y online). El CI
  los corre en cada push y sube el jar como artifact.
