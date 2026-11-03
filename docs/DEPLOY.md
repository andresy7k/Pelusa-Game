# Deploy

Guía de despliegue gratis de Pelusas: **frontend y backend juntos en Render Free**
(un solo Blueprint) y PostgreSQL en **Neon Free**. Todo lo sensible llega por
variables de entorno; en el repo no hay secretos.

La alternativa con el frontend en Vercel está al final (paso 6).

## Topología (Render)

```text
navegador
   │ 1. carga la SPA
   ▼
pelusa-frontend (static site, CDN)
   │ 2. fetch cross-origin a /api/**
   ▼
pelusa-backend (Spring Boot, Docker) ──► Neon Postgres
   ▲
   └── CORS_ALLOWED_ORIGINS = URL del front (auto)
```

Claves del diseño:

- **Un solo `render.yaml` crea los dos servicios** en el mismo proyecto/dashboard.
- **Las URLs se autoconectan** con `fromService: RENDER_EXTERNAL_URL`:
  `VITE_API_URL` (front) apunta al backend y `CORS_ALLOWED_ORIGINS` (backend)
  permite el origen del front. No hay URLs hardcodeadas.
- **El navegador habla cross-origin**: el backend solo acepta el origen exacto
  del static site (`https`, sin `/` final).
- **El backend sigue siendo la única fuente de verdad**: los clientes leen
  `GET /api/games/{id}` y actúan con `playerId` + `Idempotency-Key`.
- **Flyway corre V1…V7 al arrancar**: no se ejecuta SQL a mano en producción.
- **La DB va en Neon** porque el Postgres free de Render se elimina a los 30 días.
- **El health check de Render pega a `/api/health` (sin DB)**: usar
  `/actuator/health` en cada probe despertaría Neon y consumiría sus 100
  CU-hours/mes antes de tiempo. `/actuator/health` queda para verificación manual.

## 0. Requisitos

- Repo en GitHub con la rama a deployar. Para probar antes del merge, elegí
  `feature/10-multijugador-online` al crear el Blueprint; para producción, `main`.
- Cuentas gratis en [neon.tech](https://neon.tech) y [render.com](https://render.com).
  El plan free no requiere pago; Render puede pedir verificación de cuenta.
- Nada de secretos en el repo: solo variables de entorno.

## 1. Neon (PostgreSQL)

1. New Project → nombre `pelusa` → región cercana (ej. `us-east-1`).
2. Dashboard → Connect → copiá la connection string:
   `postgresql://USER:PASSWORD@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
3. Convertila a **JDBC** (Spring necesita prefijo `jdbc:` y credenciales aparte):
   - `SPRING_DATASOURCE_URL=jdbc:postgresql://ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - `SPRING_DATASOURCE_USERNAME=USER`
   - `SPRING_DATASOURCE_PASSWORD=PASSWORD`
4. Usá la conexión **directa** (sin `-pooler`) para el backend: es una app
   long-lived y evita sorpresas de Flyway con el pooler.
5. Flyway crea/actualiza el esquema solo. `ddl-auto=validate` hace fallar el boot
   si el esquema no coincide (no uses `update`).

> Neon Free suspende el compute por inactividad: el primer request puede tardar
> 0.5–2 s (despierta solo). No es un error.

## 2. Blueprint en Render (backend + frontend)

El repo trae `render.yaml`, `backend/Dockerfile` y el build del front.

1. Render → **New → Blueprint** → elegí este repo y la rama.
2. Render detecta `render.yaml` y muestra **dos servicios**:
   `pelusa-backend` (Docker) y `pelusa-frontend` (static).
3. Completá las tres variables `sync: false` de Neon del paso 1.
4. **Apply / Deploy**. El backend tarda unos minutos (Maven + Docker); el front
   build con `npm ci --include=dev && npm run build` (fuerza Vite/TypeScript
   aunque el entorno de build tenga `NODE_ENV=production`).
5. Verificá (usá las URLs reales del dashboard):
   - `https://<backend>.onrender.com/api/health` → `200 {"status":"UP"}`
     (es el health check de Render; no toca la DB).
   - `https://<backend>.onrender.com/actuator/health` → `UP` (manual; sí
     consulta la DB y por eso no se usa como health check).
   - `https://<frontend>.onrender.com/setup` responde (si da 404, falta la
     regla SPA).
   - En el dashboard, `pelusa-backend` → Environment: `CORS_ALLOWED_ORIGINS`
     debe tener la URL real del front; `pelusa-frontend` → Environment:
     `VITE_API_URL` debe tener la URL real del backend.
   - Si Render le agregó un slug aleatorio a alguna URL, no la hardcodees:
     `fromService` ya trae la URL correcta.

> Si creaste el Blueprint sobre la rama del PR, después del merge cambiá la rama
> del Blueprint a `main` (Settings → Build & Deploy) para que producción siga a main.

> `server.port=${PORT:8080}`: Render inyecta `PORT` y Spring lo respeta.
> El plan free del backend duerme tras ~15 min sin tráfico; el primer request
> tarda ~50 s. El paso 3 lo mitiga.

### Alternativa manual (sin Blueprint)

New → Web Service → runtime **Docker**, Dockerfile `backend/Dockerfile`,
contexto `backend`, health check `/api/health`, plan Free, variables de Neon
y `CORS_ALLOWED_ORIGINS=<URL del front>`.
Luego New → Static Site → root `frontend`, build
`npm ci --include=dev && npm run build`, publish `dist`,
`VITE_API_URL=<URL del backend>`, rewrite `/*` → `/index.html`.

> El Dockerfile copia `target/pelusa-game-0.1.0-SNAPSHOT.jar`: si cambia la
> versión en `backend/pom.xml`, actualizá esa línea.

## 3. Keep-alive (evitar el sueño de Render)

1. GitHub → Settings → Secrets and variables → Actions → **Variables** → New:
   - `BACKEND_URL=<URL real del backend en el dashboard>` (sin `/` final).
2. `.github/workflows/keepalive.yml` hace `GET /api/ping` cada 10 min.
3. El front además pinguea cada 60 s mientras hay un tablero abierto y la
   pestaña visible.
4. Las 750 h/mes de Render alcanzan para 24/7 (744 h).

> `*/10` es el mínimo práctico de GitHub Actions; puede retrasarse unos minutos.
> Si `BACKEND_URL` no está definida, el workflow no falla: se salta el ping.

## 4. Checklist de humo en producción

- [ ] `GET /api/health` → `200` (health check de Render, sin DB).
- [ ] `GET /api/ping` → `204`.
- [ ] `GET /actuator/health` → `UP` (manual; readiness con DB).
- [ ] `POST /api/games/online` con `{"name":"Ana","capacity":4}` → `201` + código de 6 chars.
- [ ] Abrir `/setup?code=CODE` en otro dispositivo → unirse y ver el lobby.
- [ ] El host pulsa “Empezar partida”; ambos tableros aparecen solos (polling 2,5 s).
- [ ] Turno sin jugar 15 s → rota con aviso `TURN_EXPIRED`.
- [ ] Tercer dispositivo con el enlace durante la partida → banner de espectador.
- [ ] Sacar una carta → el evento aparece (CORS y `VITE_API_URL` funcionando).
- [ ] Recargar `/game/<id>` → no da 404 (regla SPA).

## 5. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| 502 / timeout en el primer request | cold start de Render | esperar ~50 s; el health check usa `/api/health` (no la DB) |
| `blocked by CORS policy` | `CORS_ALLOWED_ORIGINS` no coincide con el origen exacto | revisar la env del backend (https, sin `/` final); si renombraste el front, actualizá `fromService.name` y re-aplicá el Blueprint |
| El front recibe HTML en vez de JSON (`Unexpected token '<'`) | `VITE_API_URL` vacío: el rewrite SPA devuelve `index.html` | revisar la env del front y **redeployar el front**; el bundle debe contener la URL del backend |
| `Uncaught TypeError: Failed to fetch` | backend dormido o URL mal formada | abrir `/api/health`; revisar `VITE_API_URL` en el bundle |
| 404 al recargar `/game/<id>` | falta el rewrite SPA | agregar `/*` → `/index.html` en el static site |
| `Connection refused` a Postgres | URL JDBC mal formada | debe empezar con `jdbc:postgresql://` y llevar `sslmode=require` |
| Flyway falla al boot | migración no portable o pooler | usar conexión directa de Neon; correr `mvn verify` (H2, JDK 17) antes de mergear |
| Neon deja de responder | se agotaron los 100 CU-hours/mes | evitar health checks que consulten la DB; `/api/health` no la toca |
| Render duerme igual | workflow sin `BACKEND_URL` | definir la variable y correr el workflow a mano una vez |
| El build del front falla en Render (`vite: not found`) | `npm ci` omitió devDependencies | el Blueprint usa `npm ci --include=dev`; revisá el lockfile |

## 6. Alternativa: frontend en Vercel

Si preferís Vercel para el front (CDN global, previews), el backend sigue en
Render y la DB en Neon:

1. Add New → Project → importá el repo.
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (build `npm run build`, output `dist`)
2. Editá `frontend/vercel.json` y reemplazá el placeholder por la URL real del
   backend (sin `/` final):
   ```json
   { "source": "/api/:path*", "destination": "https://TU-BACKEND.onrender.com/api/:path*" }
   ```
3. El rewrite hace que el navegador vea un solo origen, pero Vercel puede
   reenviar `Origin` al backend. Si las acciones fallan por CORS, configurá
   `CORS_ALLOWED_ORIGINS` con el origen de Vercel (y sus previews) usando un
   `value` explícito en `render.yaml`, o usá `VITE_API_URL` directo. Esta
   alternativa no está probada en esta configuración.
4. Deploy. Verificá `/setup`, `/game/<id>` recargado y crear sala online.

> El `CORS_ALLOWED_ORIGINS` auto-conectado al front de Render no alcanza para
> Vercel: si el proxy reenvía `Origin`, necesitás el origen de Vercel.

## 7. Límites de los planes gratis

- **Neon Free**: 1 GB/project y 100 CU-hours/mes; scale-to-zero a los 5 min.
- **Render Free (backend)**: 512 MB RAM, 0.1 CPU, duerme a los 15 min, 750 h/mes.
- **Render Static (frontend)**: gratis, CDN, sin sleeps.
- **Vercel Hobby** (solo alternativa): 100 GB/mes de tráfico; builds para uso personal.

Con 2–6 jugadores y polling de 2,5 s, el consumo entra holgado.

## Notas y trampas

- **Las envs de un static site son build-time**: cambiar `VITE_API_URL` exige un
  rebuild del front, no solo guardar la variable.
- **`fromService` se resuelve al aplicar el Blueprint**: si renombrás un
  servicio, actualizá los `name` de `fromService` en `render.yaml` y re-aplicá
  el Blueprint; un redeploy de código solo no alcanza.
- **No hardcodees las URLs de Render**: el slug puede llevar un sufijo; usá las
  URLs del dashboard y dejá que `fromService` haga el resto.
- **Si agregás un dominio propio al front**, reemplazá el bloque `fromService`
  de `CORS_ALLOWED_ORIGINS` por un `value` explícito con la URL de Render y el
  dominio propio (coma-separados), y re-sincronizá. Editarlo solo en el
  dashboard es temporal: el próximo sync lo pisa.
- **El plan free de Render duerme**: con una pestaña abierta (polling/ping) no
  duerme; con la mesa quieta, el primer click puede tardar.
- **`frontend/vercel.json` solo aplica en Vercel**: en dev local manda el proxy
  de Vite (`vite.config.ts`).
- Tests: `mvn verify` con JDK 17 (58 tests: dominio, API, Flyway y online). El CI
  los corre en cada push y sube el jar como artifact.
