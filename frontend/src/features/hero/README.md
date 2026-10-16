# Hero · Selección de personajes 3D

Pantalla de selección de personajes del Home: carrusel con las 10 cartas
reales del juego, cada una con su monstruo 3D procedural parado delante,
fondo de humo violeta, preloader de baraja cayendo, cursor propio y sonido
sintetizado. Vive en `frontend/src/features/hero/` y se monta desde
`HeroStage.tsx` (lo usa el Home).

Spec de diseño (fuente de verdad visual y de comportamiento):
`docs/superpowers/specs/2026-10-15-hero-seleccion-personajes-design.md`.

## 1. Qué es y dónde está cada cosa

- `config.ts` — fuente única de verdad: orden del carrusel, colores de
  cartas, los 10 diseños de monstruo, tiempos, easings, pelaje, cámara,
  luces, copy y sonido. Ningún hex ni tiempo visual vive fuera de acá
  (excepción: constantes internas de los shaders GLSL, documentadas en su
  archivo).
- `HeroStage.tsx` — compone las capas y es el único dueño del `keydown`
  (flechas/A-D, Home/End, Enter). `HeroCarousel.tsx` — las 10 cartas,
  navegación, auto-avance y a11y. `CardFace.tsx` — la carta DOM (usa el
  pintado de `components/MonsterFace.tsx`, compartido con el tablero).
- `monsters/` — canvas R3F fijo (`MonsterCanvas.tsx`), personaje procedural
  (`Character.tsx`: blob + pelaje + contorno sticker + cara paramétrica),
  caras (`faces.ts`), geometría (`geometry.ts`), pelaje (`furMaterial.tsx`),
  contorno (`outline.tsx`), partículas (`Particles.tsx`) y máquina de
  estados GSAP (`stateAnimations.ts`: `idle`/`hover`/`active`/`special`).
- `mode.ts`, `Preloader.tsx`, `intro.ts`, `Cursor.tsx`, `sound.ts`,
  `SmokeBackground.tsx`, `HeroNav.tsx`, `HeroCopy.tsx`.

## 2. Recetario de `config.ts`: orden, colores y copy

Todo se cambia en el objeto `HERO` de `config.ts`, sin tocar componentes.

**Orden del carrusel** — `order: [1, 2, 3, ...]`. El orden del array es el
orden del carrusel (índice 0 = primera carta); para reordenar basta
reordenar el array. Los dots, el anillo y el canvas 3D lo leen de acá.

**Colores de una carta** — `cards[v]` con cuatro campos:

```ts
6: { bg: '#EFA23F', num: '#E87830', monster: '#F08A2E', numTilt: 3 },
```

- `bg`: fondo de acuarela de la carta (variable `--c-bg`).
- `num`: relleno del número con contorno sticker (`--c-num`).
- `monster`: color del cuerpo del monstruo. Tiñe el pintado 2D
  (`--c-monster`), el pelaje 3D y, en la carta activa, el rim del canvas,
  el polvo de partículas y el humo (`--hero-accent`, con transición de
  ~0,8 s).
- `numTilt`: rotación juguetona del número, en grados (negativo = a la
  izquierda).

**Copy** — bloque `copy`: `badgeGold` + `badgeWhite` (insignia en dos
tonos), `h1` (una línea por elemento del array), `sub`, `ctaPrimary`
("Nueva partida" → `/setup`) y `ctaGhost` ("Historial"). Sonido:
`sound.enabledByDefault` (hoy `false`; el toggle del navbar persiste en
`localStorage` bajo la clave `pelusa.hero.sound`).

## 3. Agregar un monstruo nuevo

Para los valores 1–10 alcanza con dos entradas en `config.ts`; el monstruo
**aparece solo** en la carta DOM, el carrusel (dots incluidos), el canvas 3D
y el tablero (si se agrega el SVG, ver abajo):

1. `cards[v]` (`CardDesign`): `bg`, `num`, `monster`, `numTilt` (ver §2).
2. `monsters[v]` (`MonsterDesign`):
   - `seed`: semilla del ruido del blob → silueta única del cuerpo.
   - `scale: [x, y, z]`: proporciones (p. ej. `[1.22, 0.68, 1.0]` para
     ancho y bajo como el 6).
   - `face` (`FaceSpec`): `eyes: { count: 1|2, size, lookUp?, sides?,
     sleepy?, ring?, white? }` (medidas en unidades del cuerpo de radio 1;
     `sides` saca los ojos del cuerpo como el 9; `ring` tiñe el iris),
     `mouth`: `'o' | 'tinySmile' | 'tinyOpen' | 'wideSmile' | 'bigSmile' |
     'crookedTooth' | 'grinTeeth2' | 'fangs' | 'openTeeth' | 'neutral'`,
     más `tongue` y `mouthInner` opcionales.
   - `appendages`: `'tailLeft'` (cola del 3), `'tufts'` (mechones del 7),
     `'horns'` (cuernos del 10); `[]` si no lleva.
   - `special`: la firma que corre al llegar al centro y con Enter
     (`'bounce' | 'puff' | 'spring' | 'roar' | 'shake' | 'laugh' |
     'confetti' | 'pulse' | 'dance' | 'stars'`, una por monstruo).
3. Asegurarse de que `v` esté en `order` (si no, existe pero el carrusel no
   lo muestra).
4. Pintado del tablero: agregar el `case v:` con el SVG en
   `frontend/src/components/MonsterFace.tsx` (cuerpo con
   `fill: var(--c-monster)` y contorno sticker blanco). Ese pintado es el
   que se ve en la carta DOM y en el tablero, y el fallback cuando no hay
   WebGL. Sin ese `case`, la carta 3D existe pero la carta DOM y el tablero
   quedan sin dibujo.

Para un valor nuevo fuera del 1–10 (p. ej. el 11) además hay que extender
el tipo `HeroValue`, el array `HERO_VALUES` y agregarlo a `order`.

Ejemplo mínimo (un "moco" verde de un ojo, primo del 5):

```ts
// cards:
11: { bg: '#A8D85E', num: '#2F8A2A', monster: '#6CC24A', numTilt: -3 },
// monsters:
11: {
  seed: 111, scale: [1.0, 0.9, 1.0],
  face: { eyes: { count: 1, size: 0.3, lookUp: 0.4 }, mouth: 'tinySmile' },
  appendages: [], special: 'bounce',
},
// + case 11 en MonsterFace.tsx y 11 en order.
```

## 4. Reemplazar un monstruo por un `.glb`

Contrato futuro (documentado, sin implementar: el loader GLB queda como
hook opcional):

1. Crear el archivo `/frontend/public/assets/characters/{id}.glb`, donde
   `{id}` es el valor del monstruo (p. ej. `7.glb`).
2. Cuando el loader esté habilitado, `Character` detecta el `.glb` y lo usa
   en lugar del procedural, con `AnimationMixer` mapeando los estados a
   clips: `idle` (reposo en loop), `hover` (gesto al pasar el cursor) y
   `special` (firma al llegar al centro / Enter, una vez por selección).
   Los clips deben venir en loop salvo `special`, que corre una vez y
   vuelve a `idle` (igual que hoy hace `stateAnimations.ts`).
3. Si el archivo existe pero el loader no está habilitado, el monstruo cae
   al procedural con un aviso en consola. El procedural sigue siendo el
   fallback garantizado: ningún `.glb` faltante o corrupto rompe el hero.

## 5. Modos `?hero=` y debugging

**Modos.** El query `?hero=full|lite|off` pisa la detección automática; sin
flag: `prefers-reduced-motion` → `lite`, puntero grueso o ancho < 768 px →
`lite`, resto → `full` (`mode.ts`: `heroMode` + `envFromWindow`).

| Modo | Qué cambia |
|---|---|
| `full` | Todo: pelaje por shells (~20 capas), bloom + viñeta + ruido, partículas completas, DPR hasta 1,75. |
| `lite` | Sin pelaje pesado (material estándar con luz del rig de `config.lights`) ni postproceso, menos partículas, DPR 1. |
| `off` | El canvas no se monta: hero = cartas DOM con monstruos pintados, navegable igual (sirve para pruebas de degradación y a11y). |

Con `prefers-reduced-motion` además: sin preloader animado ni intro (estados
finales directos), sin auto-avance ni flotación, transiciones instantáneas
y Enter navega directo a `/setup` sin `special`.

**Debugging.**

- Guardia de FPS (`MonsterCanvas.tsx`): muestrea ventanas de 60 frames; dos
  seguidas por debajo de 35 fps degradan en caliente `full` → `lite` (una
  sola vía, sin vuelta) y avisan una vez en consola:
  `[hero] modo lite por FPS`.
- Contexto perdido: el canvas escucha `webglcontextlost` (con
  `preventDefault` para no dejar el canvas muerto), avisa una única vez
  `[hero] WebGL perdido: modo sin 3D` y desmonta el canvas — vuelven los
  pintados DOM, una sola vía sin restauración.
- Audio (`sound.ts`): WebAudio sintetizado, apagado por defecto; los errores
  de audio se tragan en silencio (el sonido nunca bloquea ni ensucia la
  consola).

## 6. Checklist de verificación visual rápida

1. **Cartas fieles**: las 10 cartas se parecen a la foto (fondo, número con
   su tilt, monstruo) y el carrusel recorre 1→10 con la activa al centro
   (escala 1.15, elevada, con glow).
2. **Monstruos 3D**: cada monstruo parado sobre su carta (no flotando
   aparte); al llegar al centro hace pop + su `special`; el humo, el rim y
   el polvo viran al color de la carta activa.
3. **Teclado y foco**: flechas/A-D/Home/End mueven, Enter celebra (~600 ms)
   y navega a `/setup`, el foco es visible en carrusel/dots/links/botón de
   sonido, y con `?hero=off` todo sigue navegable.
4. **Modos y consola**: `?hero=lite` se ve bien sin pelaje ni bloom;
   consola con cero errores (el 404 de `/favicon.ico` quedó cerrado con el
   `favicon.svg`).
5. **Reduced-motion**: con `prefers-reduced-motion` no hay auto-avance,
   flotación ni intro animada, y los cambios de carta son instantáneos.
