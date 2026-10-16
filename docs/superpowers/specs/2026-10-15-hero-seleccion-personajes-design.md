# Hero · Selección de personajes 3D — Spec de diseño

- **Fecha**: 2026-10-15
- **Estado**: para revisión del usuario
- **Rama**: `feature/mazo-y-visual` (la rama de implementación se decide en el plan)
- **Autor**: agente (lead) + Andréss

---

## 1 · Objetivo

Convertir el hero del Home de Pelusas en una **pantalla de selección de personajes de videojuego**: inmersiva, con la atmósfera del shot de referencia y las 10 cartas reales del juego, cada monstruo parado delante de su carta. El resto del sitio (setup, tablero, historial) no se toca.

**Criterios de éxito**

1. Las 10 cartas del hero son fieles a la foto (colores, número, monstruo) — aprobación visual del usuario lado a lado.
2. Los 10 monstruos 3D se reconocen como los de las cartas (silueta, color, ojos, boca, contorno sticker).
3. 60 fps en laptop media; modos Lite (móvil) y Sin-WebGL funcionando.
4. Navegación completa: flechas/A-D, rueda, drag/swipe, clic; Enter selecciona; focus visible.
5. `tsc` + build + CI verdes en cada fase; cero errores de consola en uso normal.
6. `prefers-reduced-motion` y teclado cubiertos sin excepciones.

## 2 · Fuentes de verdad

| # | Fuente | Manda para |
|---|---|---|
| 1 | Foto de las **10 cartas** (adjunta hoy) | Diseño de cartas, colores, monstruos, dorso, caja |
| 2 | Shot "Game Website UI · Dark Mode" (Xplode) | Atmósfera, fondo, layout, tipografía, estilo de animación |
| 3 | Brief del usuario (rol del 2026-10-15) | Requisitos, animaciones individuales, sonido, cursor, atajos |
| 4 | Correcciones del usuario | **10 cartas (no 8), orden 1→10**, la 6 y la 8 incluidas |

Del shot NO se replican: personajes, logo, textos, ni el marco violeta con cuadrícula del mockup (el sitio es full-bleed).

## 3 · Alcance

**Dentro**: hero del Home — fondo vórtice, navbar re-estilada, textos, carrusel de 10 cartas, monstruos 3D procedurales, preloader + intro, cursor propio, sonido sintetizado, atajos, modos de rendimiento y accesibilidad.

**Fuera (follow-ups, no en este trabajo)**

- Alinear `MonsterFace` del tablero para 6 (naranja) y 8 (índigo) con los diseños reales (hoy el juego tiene 6 verde-oliva y 8 naranja: nuestros dibujos viejos).
- Dorso real de las cartas del mazo en el tablero (violeta con pelusas y ojitos).
- Modelos `.glb` reales (la arquitectura queda lista).
- Shader fbm para el vórtice (la capa CSS queda aislada para poder reemplazarla).
- Buscador global (feature que hoy no existe; no se inventa UI muerta).
- Música ambiente con archivos de audio.

## 4 · Decisiones (aprobadas / con desvío marcado)

1. **Enfoque A** (aprobado — "solo a"): cartas en DOM; un único canvas R3F fijo, `pointer-events:none`, dibuja monstruos + partículas sobre el DOM. Sin build de fallback C separado: la degradación natural es "DOM sin canvas".
2. **Vórtice en capas CSS** (permitido por el brief como alternativa): gradientes cónicos/radiales `#7C3AED`, `#C026D3`, `#3B1D8F` gigantes y desenfocados sobre `#07050F`, rotación 60–90 s, grano SVG ~5%, parallax ±14 px con lerp. *Desvío 1*: sin fragment shader por ahora.
3. **Navbar sin UI muerta** (*desvío 2*): el shot tiene buscador/campana/avatar que el producto no tiene. Queda: marca + links en píldoras + **toggle de sonido** a la derecha.
4. **Auto-avance lento** (~3.2 s, pausa en hover/drag/focus, reanuda a los 5 s) (*desvío 3*; el shot es manual — se puede apagar en config).
5. **Sin nombre ni rating inventados** en las cartas (*desvío 4*): borde inferior limpio, como la carta física.
6. **HomeEntrance actual se retira** (*desvío 5*): lo reemplaza preloader + intro nuevos.
7. **Audio con WebAudio sintetizado** (*desvío 6*): sin archivos; off por defecto; toggle visible; preferencia persistida.
8. Copy con los textos reales del sitio (placeholder hasta copy final): badge "UN JUEGO DE MESA · VERSIÓN DIGITAL" (dos tonos), h1 "Pelusas, bajo la lámpara.", subtítulo recortado del lede actual, CTAs "Nueva partida" / "Historial".
9. El monstruo **pintado** de la carta DOM se oculta cuando el canvas 3D está activo (lo cubre el 3D); visible como fallback sin WebGL o durante la carga.

## 5 · Biblia de cartas (fuente: foto)

Estilo común: carta vertical 5:7 · radio ~14 px · fondo de acuarela con manchas y bordes moteados · número arriba, gruesa/redondeada, **leve rotación juguetona por carta**, relleno con degradado del tono, contorno blanco sticker grueso, bisel/sombra suave · monstruo abajo con contorno blanco **irregular** (dibujado a mano).

Colores calibrados a ojo sobre la foto — **se afinan en implementación con comparación lado a lado**.

| # | Fondo | Número | Monstruo (cuerpo) | Rasgos clave |
|---|---|---|---|---|
| 1 | azul `#5E8BD8` | blanco-celeste `#E8F4FF` | celeste `#56B7F0` | bola esponjosa; UN ojo grande mirando arriba; boca "o" |
| 2 | violeta `#8A63C9` | índigo `#3B2A8C` | navy `#38335F` | ancho y bajo; ojos verdes con párpados caídos; lengua amarilla `#F4D420` colgando al costado |
| 3 | salmón `#E08A5C` | rojo `#D9332F` | rojo `#D93A30` | babosa aplastada; cola arrastrando a la izquierda; ojos claros arriba |
| 4 | rosa-magenta `#C96FB5` | morado `#A044A8` | magenta `#C93E9F` | cúpula; UN ojo (anillo amarillo-verde); boca abierta oscura con 2 colmillos |
| 5 | verde `#9ACB5A` | verde `#43B02A` | verde `#58BE3A` (puntas lima `#8FD14F`) | peludo puntiagudo e inclinado; UN ojo (amarillo-verde); sonrisa torcida con un diente |
| 6 | naranja `#EFA23F` | naranja `#E87830` | naranja `#F08A2E` | ancho y bajo; dos ojitos con párpado medio; GRAN sonrisa pícara con dos dientes cuadrados |
| 7 | amarillo `#F2E36B` | amarillo claro `#F7E96F` | amarillo `#F6E34A` | fantasma con mechones-brazos; ojos arriba; sonrisa enorme; lengua rosa `#F06292` |
| 8 | índigo `#7A79D0` | índigo oscuro `#33368C` | navy `#2E2E6E` | ancho y redondeado; UN ojo grande blanco mirando al frente; expresión curiosa |
| 9 | turquesa `#5BC8BE` | teal `#1FA79C` | turquesa `#35B3A8` | bajo y ancho; DOS ojos grandes con anillo amarillo `#F2D33C` salidos a los costados; boquita curva |
| 10 | rosa `#F08FB8` | rosa fuerte `#E64A8D` | rosa `#F0559E` | dos cuernitos; ojos arriba; bocaza con dientes e interior azul `#3E7BD6` (el "jefe") |

- **Orden del carrusel**: `[1,2,3,4,5,6,7,8,9,10]` (corrección del usuario; una línea en `config.ts`).
- **Ojo con 2 vs 8**: misma familia navy/índigo pero distinta personalidad (2 = dormilón con ojos verdes; 8 = curioso con ojo blanco grande). En 3D deben leerse distintos.
- **Dorso (follow-up del tablero)**: violeta con pompoms blancos peludos dispersos, varios con ojitos.
- **Caja**: logo "PELUSAS" en letras burbuja naranja con contorno blanco sobre azul — opción para el wordmark del navbar (opcional).

## 6 · Monstruos 3D

**Pipeline** (por monstruo, desde params de `config.ts`):

- Cuerpo: esfera deformada por ruido de baja frecuencia, semilla por monstruo → silueta única igual a su carta.
- Pelaje: shell texturing (~20 capas, gradiente raíz→punta, fresnel rim). **LOD**: shells completas solo activa + vecinos; resto `MeshPhysicalMaterial` + sheen; móvil = sin shells.
- Contorno sticker: casco invertido blanco (escala ~1.04) con ondulación leve de ruido.
- Ojos: esferas con iris/pupila/párpados animables (parpadeo, seguimiento de cursor donde corresponda).
- Bocas: mesh paramétrico por tipo (abierta/cerrada, dientes, lenguas) con morph/escala.
- Luces: key arriba-izquierda + rim violeta/magenta; sombra de contacto; el rig se tiñe del color activo.
- Estados: `idle` / `hover` / `active` (entrada con pop al llegar al centro) / `special` (su firma, una vez por selección).

**GLB-ready**: si existe `/assets/characters/{id}.glb` se carga con `AnimationMixer` mapeando estados a clips; si no, procedural. Añadir un monstruo = un bloque en config.

**Animaciones** (8 primeras del brief; 6 y 8 son propuesta nuestra, ajustables):

| # | idle | hover | special |
|---|---|---|---|
| 1 | flota rueda suave, mira arriba | salta atrás sorprendida | se infla como globo y rebota por la carta |
| 2 | respira lento, párpados y lengua se mueven | abre un ojo y saca la lengua ("bleh") | bostezo gigante → "pfff" con lengua vibrando |
| 3 | se estira/contrae como oruga, ojos inquietos | se asusta, se aplasta, ojos grandes | salto en arco como resorte con rebote |
| 4 | rebota suave, la boca se mueve | ojo se dilata, abre la boca | rugido: se infla, pelaje erizado, onda de choque magenta |
| 5 | se balancea, el ojo escanea | ojo sigue al cursor y guiña | se sacude como perro mojado, chispas verdes |
| 6 | hamaca la sonrisa pícara, mirada de reojo | se ríe mostrando los dientes y se agacha | carcajada que lo sacude + chispas naranjas |
| 7 | flota y rebota, mechones oscilan | agita los brazos saludando | salto con giro y confeti amarillo |
| 8 | gira la cabeza despacio, el ojo grande explora | se acerca (zoom del ojo), parpadea | se infla y suelta un pulso de luz índigo |
| 9 | respira, cada ojo se mueve independiente | ojos se estiran hacia el cursor (caracol) | ojos giran, se cruzan y hace mini baile |
| 10 | rebota feliz, orejas se mueven | se ríe temblando | salto potente con estallido de estrellas rosas (el "jefe": el más grande) |

## 7 · Arquitectura

**Capas (z-index)**

1. `z0` — Vórtice CSS + grano (fixed, parallax).
2. `z10` — DOM: navbar, textos, carrusel de cartas, dots.
3. `z20` — Canvas R3F (monstruos + partículas), `pointer-events:none`, `aria-hidden`.
4. `z30` — Cursor propio (solo `pointer:fine`).

**Sincronización DOM↔canvas**: las cartas publican su `rect`; el canvas ancla cada monstruo a su carta. Política: **leer rects solo cuando algo se mueve** (transición de carrusel, resize, tilt) y cachear el resto; la flotación/bobbing del monstruo es interna al canvas y no depende del rect. Flotación de carta: estática (solo slide + tilt), como en el shot.

**Archivos (objetivo)**

```
frontend/src/features/hero/
  config.ts            → cartas, colores, orden, tiempos, easings, pelaje, copy, sonido
  HeroStage.tsx        → compone capas + timeline de intro
  VortexBackground.tsx/.css
  HeroNav.tsx          → navbar + toggle de sonido
  HeroCopy.tsx         → badge, h1, subtítulo, CTAs
  HeroCarousel.tsx     → 10 cartas, navegación, auto-avance, a11y
  CardFace.tsx/.css    → carta fiel a la foto (núcleo visual compartido con el tablero)
  Preloader.tsx        → barra + logo latiendo
  Cursor.tsx/.css
  sound.ts             → WebAudio sintetizado (hover/clic/selección/ambiente)
  monsters/
    MonsterCanvas.tsx  → <Canvas> + luces + postproceso + partículas
    Character.tsx      → GLB o procedural; máquina de estados GSAP
    geometry.ts        → blob por ruido con semilla
    furMaterial.ts     → shells
    outline.ts         → casco invertido
    faces.ts           → ojos/bocas paramétricos
    useCardAnchors.ts  → publicación/lectura de rects
```

`Home.tsx` se simplifica (monta `HeroStage`); `HomeCarousel.tsx` actual se retira en favor de `HeroCarousel`. `CardView`/`MonsterFace` **se conservan para el tablero**.

**Dependencias nuevas**: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` (GSAP ya está).

**Config (esquema)**

```ts
export const HERO = {
  order: [1,2,3,4,5,6,7,8,9,10],
  cards: { 1: { bg:'#5E8BD8', num:'#E8F4FF', monster:'#56B7F0', ... }, /* ...10 */ },
  timings: { autoAdvanceMs: 3200, resumeAfterMs: 5000, slideMs: 650, introStaggerMs: 90 },
  easings: { slide:'expo.out', pop:'back.out(1.7)' },
  fur: { shells:20, shellsMobile:0, rootDarken:0.12, tipLighten:0.18 },
  camera: { fov:32, y:0.4 },
  copy: { /* textos */ },
  sound: { enabledByDefault:false },
}
```

## 8 · Flujos

- **Carga → intro**: preloader (progreso real: fuentes + warmup de renderer; mínimo ~600 ms; saltable) → badge, h1 palabra por palabra, subtítulo, cartas suben en stagger, monstruos saltan a su lugar con overshoot.
- **Navegación**: teclado (←/→, A/D), rueda, drag/swipe, clic en carta lateral; activa = centro, escala 1.15, elevada ~40 px, glow + elipses de plataforma. **Enter** sobre la activa y el CTA "Nueva partida" navegan a `/setup` (antes de navegar corre su `special` ~600 ms; con reduced-motion navega directo).
- **Cambio de activo**: slide con spring → monstruo entra con pop → corre su `special` → luz/vórtice/partículas viran al color de su carta.
- **Hover**: tilt 3D sutil de la carta; el monstruo se desplaza más que la carta (parallax interno) + animación de hover.
- **Debug**: `?hero=lite` fuerza modo lite; `?hero=off` desactiva canvas (pruebas de degradación y a11y).

## 9 · Errores y degradación

| Modo | Cuándo | Qué pasa |
|---|---|---|
| Full | Desktop con WebGL | Todo: shells, bloom suave, viñeta, grano, partículas |
| Lite | Móvil / `?hero=lite` / hardware débil | Sin shells ni postproceso, menos partículas, DPR 1, dpr clamp desktop ≤1.75 |
| Sin WebGL | WebGL no disponible o contexto perdido | Canvas no se monta; hero = cartas DOM con monstruos pintados (usable y navegable igual) |
| Reduced motion | `prefers-reduced-motion` | Sin auto-avance, sin flotación, sin intro animada, transiciones instantáneas |

Errores de audio: se tragan (el sonido nunca bloquea ni loguea ruido). `webglcontextlost`: cae a Sin WebGL con aviso mínimo en consola.

## 10 · Rendimiento y accesibilidad

- Presupuesto: 60 fps en laptop media; mantas de rendimiento = LOD de pelaje + shells apagables + postproceso solo desktop.
- Solo `transform`/`opacity` en animaciones DOM; GSAP limpio (contexts, cleanup al desmontar).
- A11y: texto real en DOM (h1/badge/subtítulo/CTAs), canvas `aria-hidden`, carrusel con tabindex móvil (roving), `aria-label` "Pelusa N" + `aria-current` en la activa, foco visible en todo, intro saltable con clic/tecla, cursor custom nunca reemplaza al foco de teclado.

## 11 · Pruebas y verificación

- Cada fase: `npx tsc --noEmit` + `npm run build` (CI ya lo corre; los jobs actuales deben seguir verdes; backend intacto).
- Checklist visual manual del usuario en el dev server (comparación lado a lado con la foto por carta; luego con el shot).
- A11y por teclado (tab/enter/flechas), reduced-motion, `?hero=off`, móvil real.
- Sin framework de test frontend nuevo en este trabajo (práctica actual del proyecto: tsc/build + verificación visual); si el usuario quiere, se evalúa Vitest después.

## 12 · Fases

1. **Setup**: deps + `config.ts` + esqueleto de carpeta + `?hero=` flags. (Sin cambios visibles.)
2. **Atmósfera y textos**: vórtice, grano, navbar, badge/h1/subtítulo/CTAs, preloader básico → hero usable.
3. **Cartas y carrusel**: `CardFace` fiel (las 10), carrusel en orden 1→10 con navegación completa, elipses, tilt, a11y.
4. **Canvas + primer monstruo**: R3F, sync de rects, la Pelusa 1 a calidad final (pelaje, contorno, ojos, boca, estados). *Punto de control de calidad del pipeline.*
5. **Los 10 monstruos**: geometría/siluetas propias + animaciones por estado + partículas + luces/tinte + postproceso.
6. **Intro, cursor, sonido, atajos**: timeline de intro final, cursor con estela, WebAudio + toggle, Enter/atajos.
7. **Optimización y cierre**: modos lite/off, contextlost, FPS, a11y final, rama/PR.

## 13 · Riesgos

| Riesgo | Mitigación |
|---|---|
| Fidelidad del pelaje/contorno 3D vs foto | Iteración visual con capturas del usuario; presupuesto de shells con LOD |
| FPS en laptops medias | Modos + LOD + medir con `?stats` en dev antes de cerrar cada fase |
| Jank en la sincronización rect/canvas | Rects solo durante transiciones; transform-only; pruebas con slides rápidos |
| Fidelidad de color al calibrar sin herramientas | Comparación lado a lado carta 3D vs foto en el dev server (fase de aceptación) |
| Scope creep (features fuera del hero) | Follow-ups explícitos en §3; cualquier extra se pide como trabajo nuevo |

## Enmienda � feedback de aceptaci�n T2 (2026-10-15)

Tras revisar el hero en el navegador, el usuario pidi� dos cambios sobre lo aprobado:

1. **Fondo.** El v�rtice c�nico se reemplaza por un fondo de **humo violeta** en deriva lenta, m�s oscuro y cohesivo con el negro (como la imagen de referencia). Capas suaves (gradientes sin \ilter: blur\), parallax de mouse lerpeado y vi�eta que funde a negro en los bordes. El acento (\--hero-accent\) ti�e una capa.
2. **Carga/entrada.** La carga (y la entrada) vuelven a ser la **baraja cayendo** de la vieja HomeEntrance, mejorada: 10 cartas (valores 1?10) con tumble 3D, squash & stretch al aterrizar, sombra del mazo que crece, puffs de polvo, screen shake final; despu�s aterriza la **mascota pelusa** (pomp�n violeta con ojos locos) sobre el mazo y se roba la carta 10 (glow �mbar, mismo lenguaje que "robar" en el tablero) antes de que el overlay se retire con fade. Sin logo ni barra de progreso (el \done\ real se reconecta en T7).

Los estilos ya aceptados (navbar, copy, tipograf�a, grano, CTAs) no cambian.

## Enmienda � feedback de aceptaci�n T2c (2026-10-15)

2� ronda sobre carga/entrada y fondo:

1. **Escala y ritmo.** La baraja es ~2� m�s grande (escala responsiva en \.pl-scene\) y la secuencia ~30-35% m�s lenta. Se suman **chispas** en el aterrizaje final, **rayos �mbar** en el robo y un pulso de anticipaci�n del glow.
2. **Cierre con el nombre.** Tras el robo aparece el **wordmark "Pelusas"** (Bowlby One, degradado violeta, letras que se abren desde el centro) y el overlay se retira en **crossfade simult�neo con el reveal del hero** (\onReveal\ nuevo en el Preloader; el copy entra con fade+rise escalonado v�a \.hero-stage--entered\, que antes no ten�a estilos). Se acab� el corte seco al home.
3. **Humo.** El color es el correcto, pero el movimiento no se percib�a: se sube la amplitud/velocidad de la deriva de los blobs y se agrega una **capa de turbulencia** (SVG fractalNoise, desaturada, soft-light) que se traslada lento � el humo ahora "hierve" visiblemente. Sigue todo en transform/opacity.


## Enmienda - feedback de aceptacion T3 (2026-10-15)

Gate de aceptacion del carrusel 1-10; cambios pedidos por el usuario y aprobados en el gate:

1. **Navbar.** El blur no se habia quitado: un bug de apilado (el reveal del copy deja transform: translateY(0) y el titular pasaba por encima del navbar al scrollear, tapando los links). Fix: z-index 30 en .hero-nav. (52e5d96)
2. **Titulo.** El h1 pasa de ['Pelusas,', 'bajo la lampara.'] a ['Pelusas']. (066b008)
3. **Hero en una pantalla.** Copy con padding compacto y piso del carrusel en 240px: nav + copy + carrusel entran en 100vh al revelar (verificado a 1920x1080, 1600x900, 1366x768 y 1366x640). (066b008)
4. **Como se juega.** Cuatro tarjetas (Saca/Guarda/Roba/Gana) en una linea con wrap centrado; palabras destacadas (rojo: Cuidado/perdiste; ambar: Guarda/Podes robarla; verde: gana) y luz al hover por tarjeta (azul/ambar/rojo/verde); en reposo quedan igual que antes. (8d33dd9)


## Enmienda - feedback de aceptacion T3, ronda 2 (2026-10-15)

1. **Cartas del carrusel.** Veredicto del usuario: 'horribles'. Se avanza a T4 igualmente; el rework visual de las cartas queda como follow-up (redisenarlas con el lenguaje final de los monstruos en T4/T5).
2. **Preloader.** Se elimina el 'click para saltar' (se veia feo): la secuencia corre completa, no se sale sola, y al cerrar el wordmark aparece el boton 'Jugar' (estilo CTA primario) cuyo clic hace el crossfade al hero. (04e2455)


## Enmienda - feedback de aceptacion T3, ronda 3 (2026-10-15)

1. **Preloader.** Se revierte el boton 'Jugar': vuelve el salto con clic/tecla y la salida automatica al terminar (sin boton ni textos). El wordmark gana presencia (letras con rise+bloom y pulso final) y la entrada es pantalla fija (sin barra de scroll). (4885786)
2. **'Como se juega'.** La seccion suma titulo y los rojos se intensifican a rojo puro (luz de Roba y palabras Cuidado/perdiste; glows a nth-of-type por el h2 nuevo). (a52418b)

## Enmienda - feedback de aceptacion del hero (2026-10-16)

1. **Cursor propio: ELIMINADO.** Pedido del usuario: 'quita el efecto del mouse, dejalo como estaba'. Se borran Cursor.tsx/Cursor.css (y su cursor: none); el hero usa el cursor nativo. Los sonidos de navegacion (hover/clic/seleccion) se conservan con un listener delegado en HeroStage. El seguimiento de ojos via pointer.ts queda. (4c75335)
2. **Sonido del special: ELIMINADO.** 'Quita el sonido de los monstruos, el de navegacion esta bien.' El special 3D sigue animando, pero sin audio. (4c75335)
3. **Monstruos y cartas: redisenados contra las fotos reales** que envio el usuario. Transcripcion vinculante: docs/superpowers/specs/2026-10-16-monstruos-referencia.md (siluetas peludas o con picos, caras por monstruo, paletas 6 naranja / 8 azul marino y ajustes 3/4; carta del hero con numero sticker brillante y monstruo mas grande). (3bc7c0a)