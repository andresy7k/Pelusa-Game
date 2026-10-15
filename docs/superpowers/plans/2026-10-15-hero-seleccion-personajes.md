# Hero · Selección de personajes 3D — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el hero del Home en una pantalla de selección de personajes estilo videojuego: vórtice violeta, textos del shot, carrusel de las 10 cartas reales en orden 1→10 y monstruos 3D procedurales sincronizados, con intro, cursor, sonido y modos de rendimiento.

**Architecture:** Enfoque A — las cartas son DOM (accesibles, reusan el sistema visual actual); un único canvas React Three Fiber fijo, `pointer-events:none`, dibuja los monstruos + partículas anclados al `rect` de cada carta (medido solo cuando algo se mueve). Vórtice en capas CSS con parallax. Todo parametrizado en `features/hero/config.ts`.

**Tech Stack:** React 18.3.1, Vite 5.4, TypeScript 5.5, GSAP 3.15 (ya presentes) + `three@^0.170`, `@react-three/fiber@^8.18`, `@react-three/drei@^9.122`, `@react-three/postprocessing@^2.19` (nuevas; línea compatible con React 18 — las majors fiber 9 / drei 10 / postprocessing 3 exigen React 19 y fallan ERESOLVE).

**Spec:** `docs/superpowers/specs/2026-10-15-hero-seleccion-personajes-design.md` — leerlo completo antes de empezar. Este plan argumenta desde el spec; viajan juntos.

## Global Constraints

- **No tocar el backend** ni los tests del backend; los jobs de CI actuales (backend + frontend) deben quedar verdes en cada tarea.
- **Sin framework de test frontend nuevo** (spec §11): la verificación de cada tarea = `npx tsc --noEmit` + `npm run build` + chequeos concretos en el navegador con los flags `?hero=full|lite|off`.
- **Todas las constantes visuales/temporales viven en `frontend/src/features/hero/config.ts`** — sin números mágicos en componentes (colores de cartas, orden `[1..10]`, tiempos, easings, pelaje, cámara, copy, sonido).
- **Solo `transform`/`opacity`** en animaciones DOM; GSAP siempre con cleanup (`gsap.context`/`kill()`) al desmontar.
- **a11y en cada tarea**: teclado navegable, `prefers-reduced-motion` respetado, `aria` correctos, foco visible.
- **Todo el código y comentarios en español**, como el resto del proyecto.
- **Copy del hero** (spec §4.8): badge "UN JUEGO DE MESA" (ámbar) · "VERSIÓN DIGITAL" (blanco); h1 "Pelusas, bajo la lámpara."; subtítulo "Sacá cartas del mazo, guardá tus pelusas y robale al resto. Vos jugás; las reglas las decide el servidor."; CTAs "Nueva partida" (`/setup`) y "Historial" (`/history`).
- **Dependencias permitidas**: solo `three@^0.170`, `@react-three/fiber@^8.18`, `@react-three/drei@^9.122`, `@react-three/postprocessing@^2.19` (línea React 18: el frontend usa React 18.3.1; instalar las majors nuevas SIN versión falla con ERESOLVE — `npm install` sin pin NO sirve). Nada más.
- **Rama de implementación**: `feature/hero-seleccion` creada desde `feature/mazo-y-visual` (PR #8 sigue abierto; si el usuario lo mergea antes de terminar, rebasar sobre `main`). Push/PR solo con autorización explícita del usuario.
- **Monstruos pintados** (`CardView`/`MonsterFace` actuales + `card.css`) se **conservan** para el tablero del juego. El hero tiene sus propios `CardFace` y monstruos 3D.

## Review Focus

Clases de entrada/fallos que el spec implica y que los chequeos deben cubrir (cada una queda pinchada en su tarea):

1. **Resize de ventana a mitad de una transición del carrusel** → los monstruos terminan alineados con sus cartas, sin deriva (T4, chequeo con resize durante slide).
2. **Pestaña en segundo plano durante el auto-avance** → al volver, sin saltos visuales ni desincronización DOM↔canvas (T3).
3. **Zoom del navegador 50/150/200 % y DPI distinto** → alineación canvas/DOM se mantiene (T4).
4. **Fuentes web lentas o bloqueadas** → el layout no se rompe y la intro no se cuelga (`document.fonts.ready` con timeout de 2.5 s) (T2 y T7).
5. **Contexto WebGL perdido** (driver reset, suspensión prolongada) → degrada a Sin-WebGL sin romper el hero (T9).

---

### Task 1: Setup del feature (deps, config, modos, esqueleto)

**Files:**
- Modify: `frontend/package.json` (vía `npm install`)
- Create: `frontend/src/features/hero/config.ts`
- Create: `frontend/src/features/hero/mode.ts`
- Create: `frontend/src/features/hero/README.md` (placeholder mínimo que crecerá en T10)

**Interfaces:**
- Consumes: nada.
- Produces: `HERO` (const), tipos `HeroValue`, `HeroMode`, `CardDesign`, `HeroConfig`; `heroMode(search, env)` y `hasWebGL()`. Todas las tareas siguientes importan desde acá.

- [ ] **Step 1: Crear la rama**

```powershell
git checkout feature/mazo-y-visual
git checkout -b feature/hero-seleccion
```

- [ ] **Step 2: Instalar dependencias**

```powershell
cd frontend
npm install three@^0.170.0 @react-three/fiber@^8.18.0 @react-three/drei@^9.122.0 @react-three/postprocessing@^2.19.1
```

Esperado: sin errores; `package.json` con las 4 dependencias nuevas. (Pin obligatorio: el frontend es React 18.3.1; `@react-three/fiber@9`/`drei@10`/`postprocessing@3` requieren React 19 → ERESOLVE.)

- [ ] **Step 3: Crear `config.ts` con el esqueleto completo**

```ts
// frontend/src/features/hero/config.ts
// Fuente única de verdad del hero: colores de cartas (calibrados contra la
// foto real), orden del carrusel, tiempos, easings, copy y sonido.
// Los monstruos 3D agregan su bloque `monsters` en la Task 5.

export type HeroValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export const HERO_VALUES: HeroValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export interface CardDesign {
  /** Fondo de acuarela de la carta */
  bg: string
  /** Relleno del número */
  num: string
  /** Color del monstruo (pintado y, luego, tinte 3D/glow) */
  monster: string
  /** Rotación juguetona del número en grados */
  numTilt: number
}

export interface HeroConfig {
  order: HeroValue[]
  cards: Record<HeroValue, CardDesign>
  timings: {
    autoAdvanceMs: number
    resumeAfterMs: number
    slideMs: number
    introStaggerMs: number
    preloaderMinMs: number
  }
  easings: { slide: string; slideCss: string; pop: string }
  fur: { shells: number; rootDarken: number; tipLighten: number; thickness: number }
  camera: { fov: number; y: number }
  copy: {
    badgeGold: string
    badgeWhite: string
    h1: [string, string]
    sub: string
    ctaPrimary: string
    ctaGhost: string
  }
  sound: { enabledByDefault: boolean }
}

// Colores calibrados a ojo sobre la foto de las 10 cartas (2026-10-15).
// Se afinan en la Task 3 con comparación lado a lado.
export const HERO: HeroConfig = {
  order: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  cards: {
    1: { bg: '#5E8BD8', num: '#E8F4FF', monster: '#56B7F0', numTilt: -4 },
    2: { bg: '#8A63C9', num: '#3B2A8C', monster: '#38335F', numTilt: 3 },
    3: { bg: '#E08A5C', num: '#D9332F', monster: '#D93A30', numTilt: -2 },
    4: { bg: '#C96FB5', num: '#A044A8', monster: '#C93E9F', numTilt: 4 },
    5: { bg: '#9ACB5A', num: '#43B02A', monster: '#58BE3A', numTilt: -5 },
    6: { bg: '#EFA23F', num: '#E87830', monster: '#F08A2E', numTilt: 3 },
    7: { bg: '#F2E36B', num: '#F7E96F', monster: '#F6E34A', numTilt: -3 },
    8: { bg: '#7A79D0', num: '#33368C', monster: '#2E2E6E', numTilt: 2 },
    9: { bg: '#5BC8BE', num: '#1FA79C', monster: '#35B3A8', numTilt: -4 },
    10: { bg: '#F08FB8', num: '#E64A8D', monster: '#F0559E', numTilt: 5 },
  },
  timings: {
    autoAdvanceMs: 3200,
    resumeAfterMs: 5000,
    slideMs: 650,
    introStaggerMs: 90,
    preloaderMinMs: 600,
  },
  easings: { slide: 'expo.out', slideCss: 'cubic-bezier(0.16, 1, 0.3, 1)', pop: 'back.out(1.7)' },
  fur: { shells: 20, rootDarken: 0.12, tipLighten: 0.18, thickness: 0.06 },
  camera: { fov: 32, y: 0.4 },
  copy: {
    badgeGold: 'UN JUEGO DE MESA',
    badgeWhite: 'VERSIÓN DIGITAL',
    h1: ['Pelusas,', 'bajo la lámpara.'],
    sub: 'Sacá cartas del mazo, guardá tus pelusas y robale al resto. Vos jugás; las reglas las decide el servidor.',
    ctaPrimary: 'Nueva partida',
    ctaGhost: 'Historial',
  },
  sound: { enabledByDefault: false },
}
```

- [ ] **Step 4: Crear `mode.ts`**

```ts
// frontend/src/features/hero/mode.ts
// Decide cómo se renderiza el hero: full (todo), lite (sin pelaje pesado
// ni postproceso), off (sin canvas). El flag ?hero=... pisa la detección.
// Sin imports: no necesita config (tsconfig tiene noUnusedLocals activo).

export type HeroMode = 'full' | 'lite' | 'off'

export function heroMode(
  search: string,
  env: { reducedMotion: boolean; coarsePointer: boolean; width: number },
): HeroMode {
  const q = new URLSearchParams(search).get('hero')
  if (q === 'full' || q === 'lite' || q === 'off') return q
  if (env.reducedMotion) return 'lite'
  if (env.coarsePointer || env.width < 768) return 'lite'
  return 'full'
}

export function envFromWindow(): { reducedMotion: boolean; coarsePointer: boolean; width: number } {
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    width: window.innerWidth,
  }
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Crear `README.md` mínimo**

```md
# Hero · Selección de personajes 3D

Feature del hero del Home. Spec: `docs/superpowers/specs/2026-10-15-hero-seleccion-personajes-design.md`.
Config única: `config.ts`. Modos: `?hero=full|lite|off`.

(Cómo agregar un monstruo o reemplazarlo por un .glb: se completa en la Task 10.)
```

- [ ] **Step 6: Verificar**

```powershell
cd frontend
npx tsc --noEmit   # Esperado: 0 errores
npm run build      # Esperado: build OK
```

- [ ] **Step 7: Commit**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src/features/hero/
git commit -m "feat(hero): feature skeleton, config unico, modos full/lite/off"
```

---

### Task 2: Atmósfera, navbar, textos y preloader básico

**Files:**
- Create: `frontend/src/features/hero/HeroStage.tsx`
- Create: `frontend/src/features/hero/HeroStage.css`
- Create: `frontend/src/features/hero/VortexBackground.tsx`
- Create: `frontend/src/features/hero/HeroNav.tsx`
- Create: `frontend/src/features/hero/HeroCopy.tsx`
- Create: `frontend/src/features/hero/Preloader.tsx`
- Create: `frontend/src/features/hero/Preloader.css`
- Modify: `frontend/src/routes/Home.tsx` (monta `HeroStage`, retira `HomeEntrance`)
- Modify: `frontend/index.html` (fuente Bowlby One como candidata display)
- Delete: `frontend/src/components/HomeEntrance.tsx`, `frontend/src/components/home-entrance.css`
- Modify: `frontend/src/styles/tokens.css` (token `--font-hero`)

**Interfaces:**
- Consumes: `HERO`, `heroMode()`, `envFromWindow()` de T1.
- Produces: `<HeroStage />` (composición completa del hero; T3/T4 enchufan el carrusel y el canvas dentro de él); `<Preloader done={boolean} onDone={() => void} />` (T4 le conecta el `done` real del canvas vía el `onReady` interno de HeroStage).

- [ ] **Step 1: Agregar la fuente candidata a `index.html` y el token**

En `index.html`, sumar `Bowlby+One` al link de Google Fonts:

```html
family=Bowlby+One&
```

En `tokens.css`, agregar:

```css
  /* Display del hero: candidata evaluada contra el shot (cae a Baloo 2 800) */
  --font-hero: 'Bowlby One', 'Baloo 2', system-ui, sans-serif;
```

- [ ] **Step 2: Crear `VortexBackground.tsx`** (capas + parallax; el grano va aparte)

```tsx
// frontend/src/features/hero/VortexBackground.tsx
// Vórtice CSS: capas gigantes desenfocadas que rotan lentísimo, con paralaje
// de mouse lerpeado. Decorativo puro (aria-hidden). El acento lo pisa el
// carrusel vía --hero-accent (color de la carta activa).
import { useEffect, useRef } from 'react'

export function VortexBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const loop = () => {
      x += (tx - x) * 0.06
      y += (ty - y) * 0.06
      ref.current?.style.setProperty('--px', x.toFixed(4))
      ref.current?.style.setProperty('--py', y.toFixed(4))
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="hero-vortex" ref={ref} aria-hidden="true">
      <div className="hero-vortex__layer hero-vortex__layer--a" />
      <div className="hero-vortex__layer hero-vortex__layer--b" />
      <div className="hero-vortex__layer hero-vortex__layer--c" />
    </div>
  )
}
```

- [ ] **Step 3: Estilos del vórtice + grano en `HeroStage.css`**

```css
/* frontend/src/features/hero/HeroStage.css */
.hero-stage {
  position: relative;
  --hero-accent: oklch(0.6 0.22 300);
  --px: 0;
  --py: 0;
}

/* Capa 0: vórtice */
.hero-vortex {
  position: fixed;
  inset: -25%;
  z-index: 0;
  background: #07050f;
  overflow: hidden;
  pointer-events: none;
}
.hero-vortex__layer {
  position: absolute;
  inset: -30%;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.75;
  will-change: transform;
  transform: translate3d(calc(var(--px) * 14px), calc(var(--py) * 14px), 0);
}
.hero-vortex__layer--a {
  background: radial-gradient(closest-side, oklch(0.5 0.24 295 / 85%), transparent 70%);
  animation: hero-spin 75s linear infinite;
}
.hero-vortex__layer--b {
  background: radial-gradient(closest-side, oklch(0.55 0.26 330 / 55%), transparent 68%);
  animation: hero-spin 95s linear infinite reverse;
}
.hero-vortex__layer--c {
  background: radial-gradient(closest-side, #3b1d8f99, transparent 72%);
  animation: hero-spin 120s linear infinite;
}
@keyframes hero-spin {
  to { transform: rotate(360deg); }
}

/* Capa 1: grano */
.hero-grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* Capa 2: contenido DOM del hero */
.hero-content {
  position: relative;
  z-index: 10;
}
```

- [ ] **Step 4: Crear `HeroNav.tsx`** (navbar real adaptado; el toggle de sonido se conecta en T8, hoy botón inerte con `aria-pressed`)

```tsx
// frontend/src/features/hero/HeroNav.tsx
import { Link } from 'react-router-dom'

export function HeroNav() {
  return (
    <header className="hero-nav">
      <Link className="hero-nav__brand" to="/">
        <span className="hero-nav__logo" aria-hidden="true" />
        Pelusas
      </Link>
      <nav className="hero-nav__links" aria-label="Principal">
        <Link className="hero-nav__pill" to="/">Inicio</Link>
        <Link className="hero-nav__pill" to="/history">Historial</Link>
        <a className="hero-nav__pill" href="#como-se-juega">Cómo se juega</a>
      </nav>
      <button className="hero-nav__sound" type="button" aria-pressed="false" aria-label="Sonido">
        <span aria-hidden="true">♪</span>
      </button>
    </header>
  )
}
```

Estilos en `HeroStage.css`: transparente, sticky, blur, logo = pelusa simple (círculo con sombra radial + puntitos), píldoras con hover suave. (Copiar lenguaje visual de `.topbar` actual de `styles.css` y adaptarlo; el `.topbar` viejo queda para las otras páginas.)

- [ ] **Step 5: Crear `HeroCopy.tsx`** (badge, h1 por palabras, subtítulo, CTAs)

```tsx
// frontend/src/features/hero/HeroCopy.tsx
// Cada palabra del h1 va en su span (.hero-h1__w) para la intro escalonada.
import { Link } from 'react-router-dom'
import { HERO } from './config'

export function HeroCopy() {
  return (
    <div className="hero-copy">
      <p className="hero-badge">
        <span className="hero-badge__dot" aria-hidden="true">✦</span>
        <span className="hero-badge__gold">{HERO.copy.badgeGold}</span>
        <span className="hero-badge__white">{HERO.copy.badgeWhite}</span>
      </p>
      <h1 className="hero-h1">
        {HERO.copy.h1.map((line, i) => (
          <span className="hero-h1__line" key={i}>
            {line.split(' ').map((w, j) => (
              <span className="hero-h1__w" key={j}>{w}{' '}</span>
            ))}
          </span>
        ))}
      </h1>
      <p className="hero-sub">{HERO.copy.sub}</p>
      <nav className="hero-ctas" aria-label="Acciones">
        <Link className="btn-primary" to="/setup">{HERO.copy.ctaPrimary}</Link>
        <Link className="btn-ghost" to="/history">{HERO.copy.ctaGhost}</Link>
      </nav>
    </div>
  )
}
```

Estilos: h1 con `font-family: var(--font-hero)`, `clamp(40px, 6vw, 96px)`, `line-height: .95`, blanco, `text-shadow: 0 10px 30px rgb(0 0 0 / 60%)`; badge mayúsculas espaciadas con dorado `var(--amber)`; sub máx 520px centrado. (Los `reveal` actuales de Home se retiran con el swap de Step 7.)

- [ ] **Step 6: Crear `Preloader.tsx` + CSS**

```tsx
// frontend/src/features/hero/Preloader.tsx
// Pantalla de carga real: espera fuentes (fonts.ready con timeout de 2.5s),
// primer render del canvas (lo reporta T4 vía onReady) y un mínimo visible.
// Saltable con clic o tecla. Con reduced-motion: instantánea.
import { useEffect, useRef, useState } from 'react'
import { HERO } from './config'

export function Preloader({ done, onDone }: { done: boolean; onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const started = useRef(Date.now())
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    let alive = true
    const tick = () => {
      if (!alive) return
      const elapsed = Date.now() - started.current
      const timePart = Math.min(1, elapsed / HERO.timings.preloaderMinMs)
      const realPart = done ? 1 : 0.85 // las fuentes pesan ~0.85 hasta que el canvas avise
      setProgress(Math.min(1, timePart * realPart))
      if (timePart === 1 && done) {
        onDone()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    // Las fuentes no bloquean: si tardan, el timeout de abajo arranca igual.
    const timeout = window.setTimeout(() => onDone(), 2500)
    return () => {
      alive = false
      window.clearTimeout(timeout)
    }
  }, [done, onDone])

  if (reduced) return null

  return (
    <div
      className="hero-preloader"
      role="status"
      aria-label="Cargando"
      onClick={onDone}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDone() }}
      tabIndex={0}
    >
      <span className="hero-preloader__logo" aria-hidden="true" />
      <div className="hero-preloader__bar"><div style={{ transform: `scaleX(${progress})` }} /></div>
      <small className="hero-preloader__hint">Clic para saltar</small>
    </div>
  )
}
```

CSS: overlay `position: fixed; inset: 0; z-index: 40;` fondo `#07050F`, logo pelusa latiendo (`animation` sutil), barra = div con `transform-origin: left` y `scaleX` (solo transform).

- [ ] **Step 7: Crear `HeroStage.tsx` y montar en Home**

```tsx
// frontend/src/features/hero/HeroStage.tsx
import { useCallback, useState } from 'react'
import { envFromWindow, hasWebGL, heroMode } from './mode'
import { Preloader } from './Preloader'
import { HeroCopy } from './HeroCopy'
import { HeroNav } from './HeroNav'
import { VortexBackground } from './VortexBackground'
import './HeroStage.css'

export function HeroStage() {
  const [loaded, setLoaded] = useState(false)
  const [entered, setEntered] = useState(false)
  // Lazy: se detectan una sola vez. Ojo: hasWebGL() crea un canvas —
  // nunca llamarlo en cada render (HeroStage re-renderiza al cambiar de carta).
  const [mode] = useState(() => heroMode(window.location.search, envFromWindow()))
  const [webgl] = useState(() => hasWebGL())
  const showPreloader = !entered

  const onReady = useCallback(() => setLoaded(true), [])
  const onDone = useCallback(() => setEntered(true), [])

  return (
    <section className={`hero-stage${entered ? ' hero-stage--entered' : ''}`} data-hero-mode={mode} data-webgl={webgl}>
      <VortexBackground />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-content">
        <HeroNav />
        <HeroCopy />
        {/* T3 monta aquí <HeroCarousel />; T4, el portal del canvas */}
      </div>
      {showPreloader && <Preloader done={loaded} onDone={onDone} />}
    </section>
  )
}
```

En `Home.tsx`: reemplazar `HomeEntrance` + kicker/h1/lede/actions por `<HeroStage />` conservando debajo la `howto` (con `id="como-se-juega"`), y retirar el `HomeCarousel` actual en la T3 (por ahora queda montado debajo del hero hasta que T3 lo reemplace). Borrar `HomeEntrance.tsx` y `home-entrance.css`.

Nota: hasta T3, `<HeroCarousel />` (el actual, que vive en `components/`) se mantiene dentro de `Home.tsx` debajo del hero para no perder el carrusel; T3 lo reemplaza.

- [ ] **Step 8: Verificar (incluye Review Focus #4)**

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

En el navegador (`npm run dev`):
1. `http://localhost:5173/` → preloader → navbar, badge, titular en dos líneas, subtítulo, CTAs; vórtice visible y girando lento; grano sutil.
2. DevTools → Network → bloquear `fonts.googleapis.com` y recargar → el layout no se rompe y el preloader termina igual (timeout 2.5 s).
3. Mouse sobre la página → el vórtice se desplaza con lerp (parallax).
4. `prefers-reduced-motion` (DevTools → Rendering → Emulate CSS media) → sin preloader, sin parallax.
5. La página `Home` sigue mostrando el carrusel viejo debajo (temporal) y la sección "Cómo se juega".
6. Otras páginas (`/setup`, `/history`) intactas con su topbar normal.

- [ ] **Step 9: Commit**

```powershell
git add frontend/index.html frontend/src/features/hero/ frontend/src/routes/Home.tsx frontend/src/styles/tokens.css
git add -u frontend/src/components/   # borra HomeEntrance.tsx / home-entrance.css
git commit -m "feat(hero): vortice, navbar, textos y preloader; retira HomeEntrance"
```

---

### Task 3: Cartas fieles y carrusel 1→10

**Files:**
- Create: `frontend/src/features/hero/CardFace.tsx`
- Create: `frontend/src/features/hero/CardFace.css`
- Create: `frontend/src/features/hero/HeroCarousel.tsx`
- Create: `frontend/src/features/hero/HeroCarousel.css`
- Modify: `frontend/src/features/hero/HeroStage.tsx` (monta `<HeroCarousel />`)
- Modify: `frontend/src/routes/Home.tsx` (quita el carrusel viejo)
- Delete: `frontend/src/components/HomeCarousel.tsx`, `frontend/src/components/home-carousel.css`

**Interfaces:**
- Consumes: `HERO`, `HERO_VALUES`, `HeroValue`, `CardDesign`.
- Produces: `<CardFace value active? />` y `<HeroCarousel onActiveChange={(v: HeroValue) => void} />`; **función pura exportada** `ringOffset(i, center, n)` (la reusa T4 para saber qué monstruos son visibles). `HeroCarousel` emite el valor activo hacia arriba (T6 lo usa para tintar el vórtice; T4 para el canvas).

- [ ] **Step 1: Función pura de offsets + estado del carrusel en `HeroCarousel.tsx`**

```ts
// Offset circular del anillo: rango -n/2 < off <= n/2 (con n=10: -4..5).
// Los saltos del anillo (4 -> -5) siempre caen en |off| >= 3, donde la
// ranura está oculta: por eso el loop no se ve "saltar".
export function ringOffset(i: number, center: number, n: number): number {
  const raw = ((i - center) % n + n) % n
  return raw > n / 2 ? raw - n : raw
}
```

Estado: `const [center, setCenter] = useState(0)` (índice en `HERO.order`), `const [paused, setPaused] = useState(false)`; auto-avance con `useEffect` + `setInterval(HERO.timings.autoAdvanceMs)` que incrementa `(c+1) % n`; se pausa en `pointerenter`/`focusin`/drag y reanuda con timeout de `HERO.timings.resumeAfterMs` (guardar timeout en ref y limpiar). Llamar `onActiveChange(HERO.order[center])` en un `useEffect([center])`.

- [ ] **Step 2: Posicionamiento por carta (CSS vars) y visibilidad**

Por cada valor `v` (índice `i`), calcular:

```ts
const off = ringOffset(i, center, HERO.order.length)
const abs = Math.abs(off)
// escala: 1.15 activa · 1.0 vecinas · 0.82 a ±2 · 0.6 lejanas
const scale = off === 0 ? 1.15 : abs === 1 ? 1 : abs === 2 ? 0.82 : 0.6
const lift = off === 0 ? -40 : 0          // px de elevación de la activa
const rot = abs === 1 ? Math.sign(off) * 3 : abs === 2 ? Math.sign(off) * 6 : 0
const op = off === 0 ? 1 : abs === 1 ? 0.8 : abs === 2 ? 0.38 : 0
```

Aplicar como vars `--hc-tx/--hc-scale/--hc-lift/--hc-rot/--hc-op/--hc-z` en el slot vía `style` (números SIN unidad: el CSS los convierte con `calc`), con `--hc-z: 100 - abs` (la activa arriba de todo):

```tsx
// en cada slot del map
style={{
  ['--hc-tx' as string]: off,
  ['--hc-scale' as string]: scale,
  ['--hc-lift' as string]: lift,
  ['--hc-rot' as string]: rot,
  ['--hc-op' as string]: op,
  ['--hc-z' as string]: 100 - abs,
}}
```

```css
.hero-carousel {
  /* --hc-slide y --hc-ease los setea HeroCarousel inline desde config.ts */
  --hc-slide: 650ms;
  --hc-ease: cubic-bezier(0.16, 1, 0.3, 1);
}
.hc-slot {
  position: absolute;
  left: 50%;
  bottom: 44px;
  margin-left: -38px; /* mitad del ancho base de 76px */
  transform: translateX(calc(var(--hc-tx) * var(--hc-step)))
             translateY(calc(var(--hc-lift, 0) * 1px))
             scale(var(--hc-scale)) rotate(calc(var(--hc-rot) * 1deg));
  transform-origin: bottom center;
  opacity: var(--hc-op);
  z-index: var(--hc-z);
  transition: transform var(--hc-slide) var(--hc-ease), opacity var(--hc-slide);
  will-change: transform;
}
.hc-slot--far { visibility: hidden; }
.hero-carousel .hc-slot { --hc-step: clamp(120px, 16vw, 190px); }
```

`--hc-slide` y `--hc-ease` se setean inline desde `HERO.timings.slideMs` y `HERO.easings.slideCss` — cero números duplicados fuera de `config.ts`.

- [ ] **Step 3: `CardFace.tsx` — la carta fiel a la foto**

```tsx
// frontend/src/features/hero/CardFace.tsx
// Carta del hero: acuarela con manchas, número con contorno sticker y leve
// rotación, y el monstruo PINTADO (fallback sin WebGL y bajo el 3D).
import { HERO, type HeroValue } from './config'
import { MonsterFace } from '../../components/MonsterFace'
import './CardFace.css'

export function CardFace({ value, active }: { value: HeroValue; active: boolean }) {
  const d = HERO.cards[value]
  return (
    <div
      className={`card-face${active ? ' card-face--active' : ''}`}
      style={{
        ['--c-bg' as string]: d.bg,
        ['--c-num' as string]: d.num,
        ['--c-monster' as string]: d.monster,
        ['--c-tilt' as string]: `${d.numTilt}deg`,
      }}
      data-v={value}
    >
      <span className="card-face__num" aria-hidden="true">{value}</span>
      <div className="card-face__monster" aria-hidden="true">
        <MonsterFace value={value} />
      </div>
      {active && <span className="card-face__rings" aria-hidden="true" />}
    </div>
  )
}
```

`CardFace.css` — claves (reusar técnicas ya probadas en `components/card.css`):
- `.card-face` 76×104 base, radio 14px, sin borde duro; fondo = `--c-bg` con dos radiales internos (`color-mix(in oklab, var(--c-bg), white 18%)` arriba-izq, `color-mix(..., black 14%)` abajo) + `background-blend-mode: multiply` y viñeta interna por `box-shadow: inset 0 0 18px rgb(0 0 30 / 25%)`.
- `.card-face__num`: `font-family: var(--font-hero); font-size: 40px;` con doble capa: `::before` = copia con `-webkit-text-stroke: 6px #fff` (contorno sticker) detrás; texto con `background: linear-gradient(180deg, color-mix(in oklab, var(--c-num), white 35%), var(--c-num)); background-clip: text; color: transparent;` y `transform: rotate(var(--c-tilt))`.
- `.card-face__monster`: `position: absolute; inset: auto 6px 4px; height: 60%;` con `filter: drop-shadow(0 2px 0 rgb(255 255 255 / 90%)) drop-shadow(0 0 1px rgb(255 255 255));` (halo sticker; el SVG del MonsterFace ya aporta la forma).
- `.card-face--active`: glow externo `box-shadow: 0 0 0 1px rgb(255 255 255 / 25%), 0 24px 70px -18px var(--c-monster);`.
- `.card-face__rings` (solo activa): 3 elipses concéntricas con `border: 1px solid rgb(255 255 255 / 15%)`, `border-radius: 50%`, aplastadas (`scaleY(.35)`), posicionadas bajo el monstruo.

- [ ] **Step 4: Navegación completa + a11y**

- Teclado (en el stage del carrusel, `tabIndex={0}`, `role="listbox"` + `aria-label="Pelusas"`): `ArrowLeft`/`a` → anterior; `ArrowRight`/`d` → siguiente; `Home`/`End` → 1/10. Con `prefers-reduced-motion`: `setCenter` directo sin pausa de auto-avance.
- Rueda: `wheel` con `e.preventDefault()` no pasivo; acumular `deltaY` en ref; cada 60px → paso. (Registrar con `{ passive: false }` y limpiar en cleanup.)
- Drag/swipe: `pointerdown` guarda x; `pointermove` con delta > 40px → paso y reset; `pointerup` limpia. `touch-action: pan-y` en el escenario.
- Clic/Enter/Espacio en carta lateral → `setCenter` a esa carta; carta activa → misma acción que el CTA primario de T8 (por ahora navega a `/setup`).
- Dots: fila de 10 botones (patrón del carrusel actual), activo con `aria-current="true"`; son el punto accesible principal.

- [ ] **Step 5: Integrar y borrar el carrusel viejo**

`HeroStage.tsx`: montar `<HeroCarousel onActiveChange={...} />` dentro de `.hero-content` (guarda el valor activo en estado local por ahora; en T6 se usa para el tinte). `Home.tsx`: quitar el `HomeCarousel` viejo. Borrar `components/HomeCarousel.tsx` y `components/home-carousel.css`.

- [ ] **Step 6: Verificar (incluye Review Focus #2)**

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

En el navegador:
1. Las 10 cartas con colores de la foto; la activa (1) al centro, más grande y elevada, con glow y elipses; las vecinas atenuadas; las lejanas ocultas.
2. Auto-avance 1→2→…→10→1; al entrar el mouse sobre el carrusel se pausa; 5 s después de salir, reanuda.
3. Flechas / A-D / rueda / drag / clic en carta lateral / dots: todos cambian de carta con transición suave.
4. **Review Focus #2**: dejar la pestaña en segundo plano 30 s (el auto-avance sigue) y volver → el carrusel está en una carta correcta, alineado, sin saltos.
5. Tab desde el inicio de la página → focus visible en dots/carrusel; con teclado se navega igual que con mouse.
6. `prefers-reduced-motion` → sin auto-avance; cambios de carta instantáneos.
7. Comparación lado a lado con la foto: ajustar los hex de `HERO.cards` si algún color canta (editar solo `config.ts`).

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/features/hero/ frontend/src/routes/Home.tsx
git add -u frontend/src/components/HomeCarousel.tsx frontend/src/components/home-carousel.css
git commit -m "feat(hero): cartas fieles a la foto y carrusel 1-10 con navegacion completa"
```

---

### Task 4: Canvas R3F + anclas + Pelusa 1 a calidad final

**Files:**
- Create: `frontend/src/features/hero/monsters/anchors.ts`
- Create: `frontend/src/features/hero/monsters/MonsterCanvas.tsx`
- Create: `frontend/src/features/hero/monsters/Character.tsx`
- Create: `frontend/src/features/hero/monsters/geometry.ts`
- Create: `frontend/src/features/hero/monsters/furMaterial.ts`
- Create: `frontend/src/features/hero/monsters/outline.ts`
- Create: `frontend/src/features/hero/monsters/faces.ts`
- Modify: `frontend/src/features/hero/config.ts` (agrega `FaceSpec`)
- Modify: `frontend/src/features/hero/HeroCarousel.tsx` (publica anclas a `anchors.ts`)
- Modify: `frontend/src/features/hero/HeroStage.tsx` (monta el portal del canvas + reporta `onReady` al Preloader)

**Interfaces:**
- Consumes: `HERO`, `HeroMode`, `ringOffset` de T3.
- Produces (lo que T5/T6 usan):
  - `anchors.ts`: `attachAnchor(v, el)`, `measureAnchor(v)`, `measureAllAnchors()`, `readAnchor(v)`.
  - `MonsterCanvas.tsx`: `<MonsterCanvas mode={HeroMode} activeValue={HeroValue} onReady={() => void} />`.
  - `Character.tsx`: props `{ value, active, hovered, quality: 'full'|'lite' }`, imperativo `ref` con `{ setState(s: 'idle'|'hover'|'active'|'special'): void }`.
  - `geometry.ts`: `makeBlobGeometry(seed: number, scale: [number, number, number]): THREE.BufferGeometry`.
  - `furMaterial.ts`: `createFurMaterial(color: string, quality: 'full'|'lite')` + `<FurMesh geometry color seed quality />`.
  - `outline.ts`: `<StickerOutline geometry color? />` (blanco por defecto).
  - `faces.ts`: `makeFace(spec: FaceSpec): FaceHandle` con `FaceHandle = { group: THREE.Group; pupils: THREE.Object3D[]; lids: THREE.Object3D[]; mouth: THREE.Object3D }`. `FaceSpec` se define en `config.ts` (fuente única) y T5 lo embebe en `MonsterDesign`.

- [ ] **Step 1: `anchors.ts` (medición solo-cuando-se-mueve)**

```ts
// frontend/src/features/hero/monsters/anchors.ts
// Publica el rect CSS de cada carta y lo lee el canvas. Política: medir
// solo cuando algo se mueve (montaje, resize, transición) — nunca en idle.
import { HERO_VALUES, type HeroValue } from '../config'

export interface AnchorRect { x: number; y: number; w: number; h: number }

const els = new Map<HeroValue, HTMLElement>()
const rects = new Map<HeroValue, AnchorRect>()

export function attachAnchor(v: HeroValue, el: HTMLElement | null): void {
  if (el) els.set(v, el)
  else els.delete(v)
  measureAnchor(v)
}

export function measureAnchor(v: HeroValue): void {
  const el = els.get(v)
  if (!el) return
  const r = el.getBoundingClientRect()
  rects.set(v, { x: r.left, y: r.top, w: r.width, h: r.height })
}

export function measureAllAnchors(): void {
  HERO_VALUES.forEach(measureAnchor)
}

export function readAnchor(v: HeroValue): AnchorRect | undefined {
  return rects.get(v)
}

// Rastreo temporal durante transiciones del carrusel (rAF durante `ms`).
let trackingUntil = 0
let trackRaf = 0
export function trackAnchorsFor(ms: number): void {
  trackingUntil = Math.max(trackingUntil, performance.now() + ms)
  if (trackRaf) return
  const loop = () => {
    measureAllAnchors()
    if (performance.now() < trackingUntil) trackRaf = requestAnimationFrame(loop)
    else trackRaf = 0
  }
  trackRaf = requestAnimationFrame(loop)
}
```

En `HeroCarousel.tsx`: `attachAnchor` en el ref de cada `.hc-slot > .card-face` (via `ref={el => attachAnchor(v, el)}`), `ResizeObserver` sobre el stage llamando `measureAllAnchors()`, y `trackAnchorsFor(HERO.timings.slideMs + 120)` en cada cambio de `center`.

- [ ] **Step 2: `geometry.ts` — blob con ruido por semilla**

```ts
// frontend/src/features/hero/monsters/geometry.ts
import * as THREE from 'three'

// Ruido 3D barato (value noise con hash), determinista por semilla.
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 13.7) * 43758.5453
  h = h - Math.floor(h)
  return h
}

export function makeBlobGeometry(seed: number, scale: [number, number, number]): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 5) // 10242 vértices: suficiente para pelaje
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    // deformación de baja frecuencia: la silueta única del monstruo
    const n =
      hash3(Math.floor(v.x * 2.2), Math.floor(v.y * 2.2), Math.floor(v.z * 2.2), seed) * 0.5 +
      hash3(Math.floor(v.x * 4.5), Math.floor(v.y * 4.5), Math.floor(v.z * 4.5), seed + 7) * 0.25
    const r = 1 + (n - 0.35) * 0.35
    pos.setXYZ(i, v.x * r * scale[0], v.y * r * scale[1], v.z * r * scale[2])
  }
  geo.computeVertexNormals()
  return geo
}
```

- [ ] **Step 3: `furMaterial.ts` — shell texturing**

```ts
// frontend/src/features/hero/monsters/furMaterial.ts
// Pelaje por shells: N capas de la MISMA geometría, cada una desplazada a lo
// largo de la normal, con alpha por ruido y gradiente raíz->punta + fresnel.
// LOD: `lite` = una sola malla con MeshPhysicalMaterial clearcoat/sheen.
import * as THREE from 'three'

const FUR_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vShell; varying vec3 vPos;
  uniform float uShell; uniform float uThickness;
  void main() {
    vShell = uShell; vPos = position;
    vec3 p = position + normal * uShell * uThickness;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`

const FUR_FRAG = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vShell; varying vec3 vPos;
  uniform vec3 uRoot; uniform vec3 uTip;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    float n = hash(floor(vPos * 42.0));
    if (n < vShell) discard;                       // pelos: alpha por capa
    vec3 base = mix(uRoot, uTip, vShell);          // gradiente raíz -> punta
    float fres = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 2.0);
    vec3 col = base + fres * 0.25;                 // rim suave
    gl_FragColor = vec4(col, 1.0);
  }`

export function createFurMaterial(root: THREE.Color, tip: THREE.Color, shell: number, thickness: number) {
  return new THREE.ShaderMaterial({
    vertexShader: FUR_VERT,
    fragmentShader: FUR_FRAG,
    uniforms: {
      uRoot: { value: root },
      uTip: { value: tip },
      uShell: { value: shell },
      uThickness: { value: thickness },
    },
  })
}
```

`<FurMesh>` (en el mismo archivo): si `quality === 'lite'` → una malla `MeshPhysicalMaterial({ color, roughness: .6, sheen: 1, sheenColor: tip })`; si `full` → `HERO.fur.shells` mallas (la i-ésima con `uShell = i/shells`), todas con `castShadow`.

- [ ] **Step 4: `outline.ts` — contorno sticker (casco invertido)**

```ts
// frontend/src/features/hero/monsters/outline.ts
// Contorno blanco tipo sticker: copia con BackSide, escala 1.04, y una
// ondulación de ruido en el vertex para que parezca dibujado a mano.
import * as THREE from 'three'

export function createOutlineMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      uniform float uScale;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main() {
        vec3 wob = normal * (hash(floor(position * 6.0)) - 0.5) * 0.02;
        vec3 p = (position + wob) * uScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); }`,
    uniforms: { uScale: { value: 1.04 } },
  })
}
```

(En React: `<mesh geometry={geo} material={outlineMat} />` junto a las capas de pelaje.)

- [ ] **Step 5: `faces.ts` — ojos y bocas paramétricos**

`FaceSpec` se agrega a `config.ts` (fuente única: T5 lo reutiliza dentro de `MonsterDesign`) y `faces.ts` lo importa como tipo:

```ts
// En config.ts
export interface FaceSpec {
  eyes: { count: 1 | 2; size: number; lookUp?: number; sides?: boolean; sleepy?: number; ring?: string; white?: boolean }
  mouth: 'o' | 'tinySmile' | 'tinyOpen' | 'wideSmile' | 'bigSmile' | 'crookedTooth' | 'grinTeeth2' | 'fangs' | 'openTeeth' | 'neutral'
  tongue?: string
  mouthInner?: string
}
```

`makeFace(spec: FaceSpec)` arma un `THREE.Group`: ojos = esferas blancas (o del color `ring`) con pupila esfera oscura; `sleepy` = semiesfera superior (párpado) que se escala en Y animable; `sides` = ojos afuera del cuerpo (±0.55); boca por tipo: `fangs`/`openTeeth` = toro/esfera interior oscura + dientes (cajas redondeadas), `wideSmile` = toro aplastado, `tongue` = esfera achatada del color. Todo en `renderOrder` alto y montado al frente (`z = 0.86`). Devuelve el `FaceHandle` para animar.

- [ ] **Step 6: `Character.tsx` — montaje + ancla + máquina de estados vacía**

```tsx
// frontend/src/features/hero/monsters/Character.tsx
export interface CharacterHandle { setState(s: MonsterState): void }
export type MonsterState = 'idle' | 'hover' | 'active' | 'special'
```

Estructura: `group` externo (posición/scale los fija `MonsterCanvas` por frame), y dentro un `inner` group con el `FurMesh` + `StickerOutline` + `makeFace`. El bob y los tweens de estado se aplican al `inner` (nunca al externo, que el canvas pisa cada frame). En T4 solo la Pelusa 1 con estética final: `useImperativeHandle` con `setState` que por ahora mueve `inner.rotation.y` (idle) y `face.pupils` (lookUp de la 1) con GSAP; los demás estados se completan en T6. `useFrame` (idle, salvo reduced-motion): `inner.position.y = Math.sin(t * 1.6) * 0.015` — asignación, nunca `+=` (se acumularía).

- [ ] **Step 7: `MonsterCanvas.tsx` — el canvas anclado**

```tsx
// frontend/src/features/hero/monsters/MonsterCanvas.tsx
// Canvas fijo transparente encima del DOM (pointer-events:none). Cada
// monstruo visible se posiciona en world coords a partir del rect CSS de
// su carta (medido solo cuando algo se mueve).
```

Claves:
- `<Canvas orthographic={false} camera={{ fov: HERO.camera.fov, position: [0, HERO.camera.y, 14] }} gl={{ alpha: true, antialias: true }} dpr={mode === 'full' ? [1, 1.75] : 1} onCreated={onReady} style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }} aria-hidden>`.
- Luces: `<ambientLight intensity={0.6} />`, `<directionalLight position={[-3, 6, 6]} intensity={1.2} />`, rim `<pointLight position={[4, 2, -4]} color="#C026D3" intensity={1.4} />`.
- Por cada valor visible (`|off| <= 2`, con `const idx = HERO.order.indexOf(activeValue)` y `off = ringOffset(i, idx, HERO.order.length)` — reusa la función pura de T3): `<Character value active={v === activeValue} … />` con su grupo posicionado en `useFrame`:

```ts
const px = rect.x + rect.w / 2
const py = rect.y + rect.h * 0.62          // los pies, un poco sobre el borde inferior
const world = ndcToWorld(px, py, camera)
group.position.set(world.x, world.y, 0)
const s = rect.w / 76                       // 76px = ancho de diseño; el rect YA incluye
                                            // el scale CSS (la activa mide 76*1.15) — no reescalar
group.scale.setScalar(s)
```

con:

```ts
const ndc = new THREE.Vector3((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1, 0.5)
ndc.unproject(camera)
const dir = ndc.sub(camera.position).normalize()
const world = camera.position.clone().add(dir.multiplyScalar(-camera.position.z / dir.z))
```

- Montaje condicional en `HeroStage`: `{mode !== 'off' && webgl && <MonsterCanvas … />}`; si `mode === 'off'` o sin WebGL, no se monta y quedan los monstruos pintados (ya visibles por defecto).
- Cuando el canvas está montado y listo: ocultar los pintados con la clase `hero-stage--has-3d` (CSS: `.hero-stage--has-3d .card-face__monster { opacity: 0; transition: opacity .4s }`).

- [ ] **Step 8: Verificar — PUNTO DE CONTROL DE CALIDAD DEL PIPELINE**

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

En el navegador:
1. La Pelusa 1 3D parada sobre su carta: pelaje con volumen, contorno blanco ondulado, ojos mirando arriba, boca "o". **Comparar con la carta de la foto** — este es el gate de calidad: si no se reconoce, iterar ANTES de seguir.
2. Al avanzar el carrusel, la 1 viaja pegada a su carta y se desvanece al alejarse (no queda "colgada").
3. **Review Focus #1**: redimensionar la ventana **durante** una transición → al terminar, el monstruo queda centrado en su carta.
4. **Review Focus #3**: zoom del navegador a 50 %, 150 % y 200 % → alineación se mantiene.
5. `?hero=off` → sin canvas, se ven los monstruos pintados; `?hero=lite` → versión sin shells.
6. FPS: abrir DevTools Performance 10 s en idle → sin jank visible; GPU < ~60 % en laptop media.

- [ ] **Step 9: Commit**

```powershell
git add frontend/src/features/hero/
git commit -m "feat(hero): canvas R3F anclado a las cartas + pelusa 1 a calidad final"
```

---

### Task 5: Los 10 monstruos (cuerpos, caras, LOD)

**Files:**
- Modify: `frontend/src/features/hero/config.ts` (bloque `monsters` + `MonsterDesign`)
- Modify: `frontend/src/features/hero/monsters/Character.tsx` (usa la spec del valor)
- Modify: `frontend/src/features/hero/monsters/faces.ts` (ajustar primitivas a la biblia del spec)

**Interfaces:**
- Consumes: `fit` de T4 (`makeBlobGeometry`, `makeFace`, `FurMesh`, `StickerOutline`).
- Produces: `HERO.monsters: Record<HeroValue, MonsterDesign>` y `MonsterDesign` (lo usa T6 para animar por personalidad).

- [ ] **Step 1: Agregar el bloque `monsters` a `config.ts`**

Sumar `monsters: Record<HeroValue, MonsterDesign>` a la interfaz `HeroConfig` y el bloque completo a `HERO`:

```ts
export interface MonsterDesign {
  seed: number
  scale: [number, number, number]
  /** Cara paramétrica (la misma interfaz FaceSpec que consume faces.ts) */
  face: FaceSpec
  appendages: Array<'tailLeft' | 'tufts' | 'horns'>
  /** Efecto del special (T6) */
  special: 'bounce' | 'puff' | 'spring' | 'roar' | 'shake' | 'laugh' | 'confetti' | 'pulse' | 'dance' | 'stars'
}
```

Valores (calibrados contra la biblia del spec §5):

```ts
  monsters: {
    1: { seed: 11, scale: [1.0, 1.0, 1.0], face: { eyes: { count: 1, size: 0.34, lookUp: 0.35 }, mouth: 'o' }, appendages: [], special: 'bounce' },
    2: { seed: 22, scale: [1.18, 0.72, 1.0], face: { eyes: { count: 2, size: 0.24, sleepy: 0.7, ring: '#7BC86C' }, mouth: 'wideSmile', tongue: '#F4D420' }, appendages: [], special: 'puff' },
    3: { seed: 33, scale: [1.05, 0.6, 1.0], face: { eyes: { count: 2, size: 0.2, lookUp: 0.45 }, mouth: 'tinySmile' }, appendages: ['tailLeft'], special: 'spring' },
    4: { seed: 44, scale: [0.95, 1.08, 1.0], face: { eyes: { count: 1, size: 0.36, ring: '#E8C84A' }, mouth: 'fangs' }, appendages: [], special: 'roar' },
    5: { seed: 55, scale: [1.0, 1.0, 1.0], face: { eyes: { count: 1, size: 0.34, ring: '#D7E84A' }, mouth: 'crookedTooth' }, appendages: [], special: 'shake' },
    6: { seed: 66, scale: [1.22, 0.68, 1.0], face: { eyes: { count: 2, size: 0.16, sleepy: 0.45 }, mouth: 'grinTeeth2' }, appendages: [], special: 'laugh' },
    7: { seed: 77, scale: [1.0, 1.05, 1.0], face: { eyes: { count: 2, size: 0.15, lookUp: 0.5 }, mouth: 'bigSmile', tongue: '#F06292' }, appendages: ['tufts'], special: 'confetti' },
    8: { seed: 88, scale: [1.12, 0.8, 1.0], face: { eyes: { count: 1, size: 0.4, white: true }, mouth: 'neutral' }, appendages: [], special: 'pulse' },
    9: { seed: 99, scale: [1.26, 0.62, 1.0], face: { eyes: { count: 2, size: 0.28, sides: true, ring: '#F2D33C' }, mouth: 'tinyOpen' }, appendages: [], special: 'dance' },
    10: { seed: 101, scale: [1.0, 0.9, 1.0], face: { eyes: { count: 2, size: 0.18, lookUp: 0.3 }, mouth: 'openTeeth', mouthInner: '#3E7BD6' }, appendages: ['horns'], special: 'stars' },
  },
```

(`FaceSpec` ya está definida en `config.ts` desde T4; no se duplica nada.)

- [ ] **Step 2: Apéndices en `Character.tsx`**

- `tailLeft` (3): cilindro achatado curvado con 3 huesos, sale del lateral izquierdo, arrastrado sobre el "piso" de la carta.
- `tufts` (7): 5 conos romos alrededor del borde superior.
- `horns` (10): 2 esferas achatadas con pelaje corto en la parte alta.
Los tres con el mismo `FurMesh` de su color.

- [ ] **Step 3: Usar la spec por valor**

`Character.tsx` deja de estar hardcodeado a la 1: `const spec = HERO.monsters[value]`, geometría `makeBlobGeometry(spec.seed, spec.scale)`, cara `makeFace(spec.face)`, pelaje del color `HERO.cards[value].monster`.

- [ ] **Step 4: Verificar**

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

En el navegador, uno por uno contra la foto (fila por fila):
1. 1 bola celeste 1 ojo · 2 ancho navy párpados+banda lengua · 3 babosa roja cola izquierda · 4 cúpula magenta ojo anillo + colmillos · 5 peludo inclinado 1 ojo + diente torcido.
2. 6 ancho naranja sonrisa 2 dientes · 7 fantasma amarillo mechones lengua rosa · 8 navy ojo blanco grande · 9 turquesa ojos a los costados · 10 rosa cuernos bocaza interior azul.
3. LOD: con `?hero=lite` los 10 se ven "planos con brillo" (sin shells) pero reconocibles.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/features/hero/
git commit -m "feat(hero): los 10 monstruos con siluetas, caras y apendices por config"
```

---

### Task 6: Estados, personalidad, partículas, tinte y postproceso

**Files:**
- Create: `frontend/src/features/hero/monsters/stateAnimations.ts`
- Create: `frontend/src/features/hero/monsters/Particles.tsx`
- Create: `frontend/src/features/hero/pointer.ts` (posición del mouse normalizada que consumen los estados hover)
- Modify: `frontend/src/features/hero/monsters/Character.tsx` (máquina de estados completa + refs a la cara)
- Modify: `frontend/src/features/hero/monsters/MonsterCanvas.tsx` (partículas + postproceso + tinte de luces)
- Modify: `frontend/src/features/hero/HeroStage.tsx` (`onActiveChange` → `--hero-accent` + prop al canvas)
- Modify: `frontend/src/features/hero/HeroStage.css` (glow del vórtice usa `--hero-accent`)

**Interfaces:**
- Consumes: `MonsterDesign.special`, `CharacterHandle.setState`, `MonsterCanvas` de T4/T5.
- Produces: `animateTo(handle, state, value, quality)` (usa T7 para el intro); eventos `play('select'|'special')` hook de T8 (dejar el punto de llamada con callback vacío `onSpecial?: (v: HeroValue) => void`).

- [ ] **Step 1: `stateAnimations.ts`**

Funciones por estado: `idle(handle)` (bob + parpadeo cada 3-6 s aleatorio), `hover(handle)` (por personalidad: 1 salta atrás, 2 bleh, 5 ojo sigue cursor — recibe `pointer` normalizado, 8 zoom del ojo, 9 ojos-caracol, 10 risa temblorosa, 6 se agacha, 7 saluda, 3 se aplasta), `active(handle)` (pop `back.out(1.7)` + aterrizaje), `special(handle, kind)` con las 10 firmas del spec §6 (bounce/puff/spring/roar/shake/laugh/confetti/pulse/dance/stars). Cada especial puede crear una onda/partícula efímera vía callback `spawnBurst(color, worldPos)` que `MonsterCanvas` provee.

- [ ] **Step 2: Máquina en `Character.tsx`**

`setState` mata el timeline anterior (`gsap.killTweensOf` de los refs) y arranca el nuevo; `active` al llegar al centro → corre `active` y a los 200 ms `special`; los ojos con `sides` (9) animan cada pupila por separado; eye-follow usa la posición del mouse normalizada (la publica `HeroStage` en un módulo simple `pointer.ts` con `getPointer()`).

- [ ] **Step 3: `Particles.tsx`**

`<points>` con ~120 partículas, `AdditiveBlending`, `size 0.05`, color `--hero-accent` convertido a `THREE.Color` (prop `accent`), ascenso lento con wrap; en `lite`: 30 partículas y sin blend aditivo.

- [ ] **Step 4: Tinte y postproceso**

- `HeroStage` setea `--hero-accent` con `HERO.cards[v].monster` y lo pasa al canvas. El canvas: `gsap.to(pointLight.color, { r,g,b, duration: .8 })` y a `accent` de partículas.
- Vórtice: agregar capa `.hero-vortex__layer--accent { background: radial-gradient(closest-side, color-mix(in oklab, var(--hero-accent) 60%, transparent), transparent 70%) }` con transición de opacidad.
- Postproceso (solo `mode === 'full'`):

```tsx
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
// …
{quality === 'full' && (
  <EffectComposer>
    <Bloom intensity={0.35} luminanceThreshold={0.6} mipmapBlur />
    <Vignette eskil={false} offset={0.25} darkness={0.75} />
    <Noise opacity={0.035} />
  </EffectComposer>
)}
```

- [ ] **Step 5: Verificar**

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

En el navegador:
1. Cambiar de carta: el monstruo entrante hace pop, corre su `special` una vez y queda en idle (probar 4 → rugido; 10 → estrellas; 7 → confeti).
2. Al cambiar de activa, la luz rim, el glow del vórtice y las partículas viran al color de la nueva carta en ~0.8 s.
3. Hover sobre la activa y laterales: cada uno responde con SU animación (breves, no molestas).
4. `?hero=lite`: sin postproceso, partículas mínimas; `?hero=off`: nada de esto.
5. Reduced-motion: solo el estado final, sin timelines.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/features/hero/
git commit -m "feat(hero): estados por personalidad, particulas, tinte al color activo y postproceso"
```

---

### Task 7: Intro completa

**Files:**
- Create: `frontend/src/features/hero/intro.ts`
- Modify: `frontend/src/features/hero/HeroStage.tsx` (timeline post-preloader; skip)
- Modify: `frontend/src/features/hero/Preloader.tsx` (conectar progreso real del canvas)

**Interfaces:**
- Consumes: `animateTo` de T6, palabras `.hero-h1__w` de T2, `monsters`/`Character` de T4/T5.
- Produces: `playIntro(scope, cursors): gsap.core.Timeline` y `INTRO_DURATION_S`.

- [ ] **Step 1: `intro.ts`** — timeline:

```ts
// Orden: badge (fade+y) -> palabras del h1 (stagger con rebote) ->
// subtítulo -> CTAs -> cartas suben (stagger) -> monstruos saltan (pop).
// Con reduced-motion no se llama: HeroStage aplica el estado final directo.
const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
tl.from('.hero-badge', { y: 14, autoAlpha: 0, duration: 0.4 })
  .from('.hero-h1__w', { y: 44, autoAlpha: 0, duration: 0.6, stagger: 0.09, ease: 'back.out(1.7)' }, '-=0.1')
  .from('.hero-sub', { y: 16, autoAlpha: 0, duration: 0.45 }, '-=0.25')
  .from('.hero-ctas > *', { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.07 }, '-=0.2')
  .from('.hc-slot', { y: 90, autoAlpha: 0, duration: 0.7, stagger: 0.06 }, '-=0.3')
  .add(() => charactersJumpIn(), '-=0.4')
```

`charactersJumpIn()`: cada `Character` visible hace su `special` corto (versión reducida, 400 ms) — se expone una prop `intro` a `MonsterCanvas` que dispara `animateTo(..., 'active')` una vez.

- [ ] **Step 2: Conectar en `HeroStage`**

`entered` (ya existe) dispara `playIntro()` en un `useEffect` con `gsap.context(stageRef)`; cleanup `ctx.revert()`. Skip: clic o cualquier tecla durante la intro → `tl.progress(1)`. Reduced-motion: no timeline; estados finales (`autoAlpha: 1` por CSS default).

- [ ] **Step 3: Progreso real del preloader**

`MonsterCanvas` ya llama `onReady`; en `HeroStage`: `showPreloader = !entered`; el `done` del Preloader = `loaded && fontsReady` (estado local seteado con `document.fonts.ready` + el timeout de 2.5 s de T2).

- [ ] **Step 4: Verificar (incluye Review Focus #4 en su parte final)**

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

En el navegador (recarga completa, cache limpia):
1. Preloader → intro completa sin saltos de layout (CLS ~0: todo con transform/opacity).
2. Clic/telca durante la intro → salta al estado final sin romper.
3. Recargar con red lenta (throttling) y fuentes bloqueadas → el preloader no cuelga más de 2.5 s y la intro corre igual.
4. Reduced-motion → sin preloader ni intro; contenido final directo.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/features/hero/
git commit -m "feat(hero): intro cinematografica con skip y progreso real de carga"
```

---

### Task 8: Cursor, sonido y atajos finales

**Files:**
- Create: `frontend/src/features/hero/Cursor.tsx`
- Create: `frontend/src/features/hero/Cursor.css`
- Create: `frontend/src/features/hero/sound.ts`
- Modify: `frontend/src/features/hero/HeroNav.tsx` (toggle real de sonido)
- Modify: `frontend/src/features/hero/HeroCarousel.tsx` (Enter sobre activa → special + `/setup`; A/D ya están)
- Modify: `frontend/src/features/hero/HeroStage.tsx` (monta `Cursor`; hooks de sonido)

**Interfaces:**
- Consumes: `HERO.sound`, `onSpecial` de T6, navegación de T3.
- Produces: `play(kind)`, `isSoundEnabled()`, `toggleSound()`; `<Cursor />` auto-desactivado en touch/reduced-motion.

- [ ] **Step 1: `sound.ts`** (síntesis WebAudio completa)

```ts
// frontend/src/features/hero/sound.ts
// Sonidos sintetizados (sin archivos): hover, clic, selección y especial.
// Off por defecto; preferencia persistida. Nunca lanza: el audio jamás
// bloquea la UI.
const KEY = 'pelusa.hero.sound'
let ctx: AudioContext | null = null
let enabled = localStorage.getItem(KEY) === 'on'

export function isSoundEnabled(): boolean { return enabled }
export function toggleSound(): boolean {
  enabled = !enabled
  localStorage.setItem(KEY, enabled ? 'on' : 'off')
  return enabled
}

const SPECS: Record<string, { f: number; d: number; type: OscillatorType; gain: number }> = {
  hover: { f: 880, d: 0.05, type: 'sine', gain: 0.02 },
  click: { f: 520, d: 0.09, type: 'triangle', gain: 0.05 },
  select: { f: 660, d: 0.16, type: 'sine', gain: 0.06 },
  special: { f: 440, d: 0.3, type: 'sawtooth', gain: 0.03 },
}

export function play(kind: keyof typeof SPECS): void {
  if (!enabled) return
  try {
    ctx ??= new AudioContext()
    const s = SPECS[kind]
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = s.type
    osc.frequency.setValueAtTime(s.f, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(s.f * 1.6, ctx.currentTime + s.d)
    g.gain.setValueAtTime(s.gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + s.d)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + s.d)
  } catch { /* silencio total, por diseño */ }
}
```

- [ ] **Step 2: Toggle en `HeroNav`** — `aria-pressed={isSoundEnabled()}`, ícono ♪ / ♪̶ (dos spans), `onClick={() => setOn(toggleSound())}`; persistir y reflejar al montar.

- [ ] **Step 3: `Cursor.tsx`** — halo + punto con lerp rAF (transform-only); escala 1.6 sobre `a, button, .hc-slot, .hc-dot`; montaje solo si `matchMedia('(pointer: fine)')` y sin reduced-motion; `cursor: none` solo en `.hero-stage` y sus hijos (`.hero-stage, .hero-stage * { cursor: none }`, nunca global); Cleanup al desmontar. Conectar `play('hover'|'click')` en los listeners.

- [ ] **Step 4: Atajos finales** en `HeroCarousel` + `HeroStage`: `ArrowLeft/Right`, `A/D` (T3) + **`Enter` sobre la activa** → `play('select')` + `onSpecial(active)` (corre el especial ~600 ms) → `navigate('/setup')`; con reduced-motion navega directo. El CTA "Nueva partida" navega igual (sin delay).

- [ ] **Step 5: Verificar**

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

En el navegador:
1. Desktop: cursor custom con estela suave; se agranda sobre interactivos; desaparece al salir del hero (cursor normal en el resto del sitio).
2. Toggle ♪ → on: hover/clic/selección suenan sutil; recargar → la preferencia persiste; dejarlo **off** por defecto en una sesión nueva (borrar localStorage).
3. Touch/reduced-motion: sin cursor custom.
4. Enter sobre la activa → corre el especial y navega a `/setup`; Esc/atrás vuelve bien.
5. A/D y flechas funcionan con foco en cualquier parte del hero.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/features/hero/
git commit -m "feat(hero): cursor custom, sonido sintetizado con toggle y atajos finales"
```

---

### Task 9: Modos, robustez, FPS y pasada de a11y

**Files:**
- Modify: `frontend/src/features/hero/monsters/MonsterCanvas.tsx` (contextlost + FPS guard)
- Modify: `frontend/src/features/hero/HeroStage.tsx` (estado `webglLost` → degrada a pintados)
- Modify: `frontend/src/features/hero/HeroStage.css` (transiciones de degradación)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: hero final robusto; ninguna API nueva.

- [ ] **Step 1: Pérdida de contexto WebGL**

En `MonsterCanvas`: `onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onContextLost() }) }}`. `HeroStage` guarda `webglLost` y al true: desmonta `MonsterCanvas` y quita `hero-stage--has-3d` (vuelven los pintados con fade). Aviso único en consola: `console.warn('[hero] WebGL perdido: modo sin 3D')`.

- [ ] **Step 2: FPS guard simple**

En `MonsterCanvas`, sampler de 60 frames: si el promedio baja de 35 fps dos veces seguidas y `mode === 'full'` → degradar en caliente: `quality` a `'lite'` (mata shells + postproceso) y `console.info('[hero] modo lite por FPS')`.

- [ ] **Step 3: Verificar (Review Focus #5 completa)**

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

En el navegador:
1. `?hero=off` → hero completo sin canvas; todo navegable; sin errores de consola.
2. `?hero=lite` → sin shells/postproceso/partículas pesadas; sigue lindo y fluido en móvil real (o emulación).
3. **Review Focus #5**: DevTools → `Rendering` → simular pérdida de contexto (`Lose context` con la extensión WebGL o `WEBGL_lose_context` desde consola: `gl.getExtension('WEBGL_lose_context').loseContext()`) → el hero sigue usable con los pintados.
4. FPS: 60 s en idle y 20 cambios rápidos de carta → sin caídas sostenidas < 35 fps en laptop media.
5. Tab-order completo por el hero (nav → copy → dots → carrusel): foco visible en todo; `aria-current` en la carta activa; sin trampas de foco.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/features/hero/
git commit -m "feat(hero): degradacion por contextlost y FPS, pasada de a11y"
```

---

### Task 10: README del feature, verificación final y rama

**Files:**
- Modify: `frontend/src/features/hero/README.md` (contenido completo)
- Modify: `docs/PROJECT_PLAN.md` (una línea de estado de la feature)

**Interfaces:**
- Consumes: todo.
- Produces: entregable pedido por el brief: "cómo agregar un monstruo nuevo o reemplazar uno por un `.glb`".

- [ ] **Step 1: README completo**

Contenido requerido (redactado de verdad, no bullets vacíos):
1. Qué es el feature y dónde vive el spec.
2. `config.ts`: cómo cambiar el orden del carrusel, los colores de una carta y el copy.
3. **Agregar un monstruo nuevo**: crear el `CardDesign` + `MonsterDesign` en config → aparece solo (carta, carrusel, 3D y pintado del tablero si se agrega el SVG en `MonsterFace`).
4. **Reemplazar por `.glb`**: crear `/frontend/public/assets/characters/{id}.glb`; `Character` lo detecta y usa `AnimationMixer` con clips `idle/hover/special` (nota: el loader GLB queda como hook opcional documentado; si el archivo existe pero el loader no está habilitado, cae al procedural con un aviso en consola).
5. Modos `?hero=` y debugging (FPS guard, contextlost).
6. Checklist de verificación visual rápida (5 puntos).

- [ ] **Step 2: Verificación final completa**

```powershell
cd frontend
npx tsc --noEmit
npm run build
cd ..
git status   # limpio salvo lo esperado
```

En el navegador: recorrido completo del spec §11 (checklist visual con la foto + shot; a11y; modos; intro; sin errores de consola). Pedirle al usuario la **aceptación visual final**.

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/features/hero/README.md docs/PROJECT_PLAN.md
git commit -m "docs(hero): guia para agregar monstruos y reemplazarlos por glb"
```

- [ ] **Step 4: Rama y PR (solo con autorización del usuario)**

```powershell
git log --oneline feature/mazo-y-visual..HEAD   # revisar los commits de la feature
git push --no-thin -u origin feature/hero-seleccion
```

Luego crear PR con `gh pr create` — **solo si el usuario lo autoriza explícitamente**; base: `feature/mazo-y-visual` (stacked) o `main` si el PR #8 ya fue mergeado. Nunca mergear.

---

## Notas de ejecución

- **Orden**: las tareas son secuenciales (cada una construye sobre las interfaces de la anterior). No empezar una sin que la previa tenga tsc/build verdes y commit.
- **Puntos de aceptación del usuario**: T2 (atmósfera/textos), T3 (cartas contra la foto), **T4 (calidad del pipeline 3D — gate)**, T5 (los 10), T6 (animaciones), T10 (final). En cada punto, capturar el feedback del usuario antes de seguir.
- **Dev server**: `cd frontend; npm run dev` (Vite en `:5173`). El backend local no es necesario para esta feature (el hero no toca la API).
- **Si algo del spec no alcanza**: parar y actualizar el spec primero (brainstorming), nunca improvisar diseño.
- **Números**: ningún hex/ms fuera de `config.ts` (excepción: constantes GLSL internas de los shaders, documentadas en su archivo).
