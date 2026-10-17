# Spec de diseño: Mesa cósmica (rediseño del tablero)

Fecha: 2026-10-16 · Estado: aprobado en diseño por el usuario (pendiente revisión del archivo)
Rama: `feature/hero-seleccion` · Frontend puro: **cero cambios de API ni backend**.

## Objetivo

Rediseñar la vista de mesa del tablero (`routes/Board.tsx`): cámara en **primera
persona** (la cabeza del jugador activo), mesa redonda **cósmica Pelusas** (fieltro
morado, anillo luminoso, estrellitas) y **barra de decisiones estilo blackjack
virtual** (botones redondos con símbolo + texto chico). El usuario odia el diseño y
la vista actuales (anillo 2D que gira + acciones de texto).

Referencia visual: foto de mesa de blackjack real (fieltro, arco de jugadores,
cartas y chips sobre la mesa) — misma sensación de "estar sentado en la mesa",
pero con la identidad cósmica del juego (opción B del usuario: no verde casino).

## Decisiones de diseño (aprobadas)

### 1. Modelo de cámara: "gira tu cabeza" (primera persona, hotseat)

- Los asientos quedan **fijos en el mundo** (mesa redonda); la mesa NO gira.
- **Hotseat intacto**: la UI actúa siempre como el jugador del turno (contrato
  vigente del backend). La cámara = la cabeza del jugador activo: encuadra SU
  asiento abajo al centro, con su mano al frente y el mazo al centro de la mesa.
- Al cambiar de turno la cámara **planea en horizontal** (yaw, ~700 ms,
  `cubic-bezier` suave) hasta el nuevo asiento activo. Es el "pase de turno"
  viajando alrededor de la mesa.
- **Arrastre libre**: pointer horizontal sobre el escenario rotra la cámara para
  espiar a cualquier rival; se suma como offset al yaw del turno. Al cambiar de
  turno el offset se anima a 0 (re-centra en el activo).
- Click vs drag: umbral de 6 px de movimiento antes de empezar a rotar; por
  debajo se trata como click (las cartas siguen siendo clicables).
- `prefers-reduced-motion`: sin transición de cámara (salto) y sin planeo.
- Valores de partida (tunables con capturas): `perspective: 1400px`,
  `perspective-origin` levemente sobre el centro del escenario, `--pitch ≈ 54deg`
  (cámara algo elevada, tipo foto), `--yaw` calculado (ver fórmula abajo).

Fórmula de encuadre: asiento i en ángulo de mundo `a_i = (360/n)·i` (medido desde
el sur, sentido horario, en el plano de la mesa). La cámara en el sur mira al
centro; para encuadrar el asiento activo `k`: `--yaw = a_k` (signo según
convención CSS de rotateY, se confirma en implementación con la primera
captura). Drag agrega `--yaw-drag`; total `rotateY(calc(var(--yaw) + var(--yaw-drag)))`.

### 2. Mesa y asientos (cósmico Pelusas)

- **Fieltro**: disco redondo, radial-gradient morado profundo (centro
  `#2b1d55` → borde `#17102e`), **anillo luminoso** violeta en el borde
  (doble box-shadow/glow suave violeta `#8b6cf0`). El **fondo de la página
  detrás de la mesa** es el espacio cósmico con estrellitas (tiny
  radial-gradients, mismo lenguaje que el héroe); el fieltro lleva solo un
  sprinkle muy sutil de estrellas encima, sin competir con las cartas.
- **Mazo**: al centro de la mesa (norte del asiento activo en el encuadre
  habitual), con `CardBack` apiladas y contador de cartas; sigue siendo
  `<button>` clickeable (además del botón **+** del HUD).
- **Asientos** (n = jugadores, 2+; la matemática de círculo soporta cualquier
  n, se prueba con 2, 3 y 6): repartidos en el círculo completo;
  el activo queda al sur (abajo, cerca de la cámara). Cada asiento:
  - **Cartas del frente** sobre el fieltro, ligeramente levantadas hacia la
    cámara (`rotateX(-22deg)` local) para leerse igual que en la foto.
  - **Chapa del jugador**: nombre + puntos + punto de turno; parada con
    inclinación (~`rotateX(-70deg)` respecto del fieltro) detrás de sus cartas.
  - **Activo**: halo pulsante (anillo violeta) bajo el asiento + punto de
    turno brillante en la chapa.
- La perspectiva hace el trabajo de profundidad: los asientos lejos se ven
  más chicos solos. Sin lógica de escala por distancia.

### 3. HUD de decisiones (blackjack virtual)

Barra flotante fija abajo al centro (overlay DOM, no vive en la escena 3D),
4 botones redondos, símbolo grande + etiqueta chica debajo:

| Acción | API | Símbolo | Color | Label |
|---|---|---|---|---|
| Pedir carta | `api.draw` | **+** | verde `#2fbf71` | Pedir |
| Plantarse | `api.stand` | **−** | rojo `#e5484d` | Plantarse |
| Robar | modo robo → `api.steal` | **🥷** | naranja `#f2892f` | Robar |
| Guardar pelusas | `api.stash` | **★** | violeta `#7c6cf0` | Guardar |

- **Estado disabled** (opaco 40 %, sin pointer): fuera de tu turno, `busy`,
  o precondition de la acción (p. ej. Robar sin carta última o sin objetivo).
- **Modo robo**: tocá 🥷 (toggle, `aria-pressed`) → las cartas robables de los
  rivales se resaltan naranja y se hacen clickeables; el resto se atenúa; hint
  "Tocá una carta N…". 🥷 de nuevo = cancelar. Título nativo explica por qué
  está disabled (como hoy).
- Teclado: sin atajos (fuera de alcance, YAGNI).

### 4. Feedback y vuelos (sin regresiones)

- `FlightLayer` **no cambia**: vuelos por rect de pantalla (funcionan con la
  escena rotada). Se conservan `arrivals`/`hideTail`/snapshot de fuentes del
  robo (lógica existente intacta).
- **Chip de evento** (arriba): "Sacó N" / "Robó N × v" / "Guardó N" — restylo
  pastilla cósmica.
- **Bust banner** arriba, rojo, `role="alert"` (texto actual).
- **Resultado final**: panel cósmico (mismo contenido actual: ganador + tabla
  de puntos).

### 5. Alcance y no-alcance

- **Alcance**: `routes/Board.tsx` (reestructura del layout + estado de yaw
  drag), CSS de mesa (rewrite de la sección `.table*` de `styles/pages.css`
  o archivo nuevo `styles/board.css` si queda más limpio), restylo menor de
  `CardView` si hace falta (prop de inclinación). `useGame`, `api/*`,
  `FlightLayer`, backend: **intocados**.
- **Fuera de alcance**: avatares (chapas con nombre hasta que entre T1),
  sonido, atajos de teclado, spectator mode, cambios de reglas/backend,
  soporte touch avanzado (drag con mouse; touch queda best-effort como hoy).

## Validación

- `npm run build` verde (tsc + vite).
- Capturas puppeteer (harness estilo `pptr/*.js` ya usado):
  - Mesa con 2+ jugadores: encuadre inicial (activo abajo, mazo visible).
  - Cambio de turno: planeo horizontal (captura a mitad del vuelo).
  - Modo robo: resaltado naranja + hint.
  - Bust y resultado final.
  - 1500×900 y 1280×720 (zoomFix/layout).
  - `prefers-reduced-motion`: sin animación, todo funcional.
  - ERRORS de consola vacío.
- Sin regresiones de lógica: mismos `api.*` calls, mismos handlers.

## Riesgos conocidos

- **Lectura de rivales lejanos** con 5-6 jugadores: la perspectiva achica las
  cartas; se mitigará con el tilt hacia cámara y, si hace falta, subir el
  `pitch` o bajar la distancia (tuneo visual con capturas).
- **Drag vs scroll/click**: umbral de 6 px + `touch-action` correcto en el
  escenario; verificar que clics en cartas y botones no se coman por el drag.
- **Yaw en hotseat**: al pasar el turno "al rival de al lado", el planeo debe
  ir por el arco corto entre asientos adyacentes (con n asientos en círculo
  completo la diferencia de ángulo entre vecinos es 360/n; la fórmula de yaw
  directa ya produce el arco corto si se normaliza a ±180°).
