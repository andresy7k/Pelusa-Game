# Referencia de monstruos y cartas (transcripción de las fotos reales)

Fecha: 2026-10-16
Origen: Andréss envió por chat dos fotos de las cartas físicas de Pelusas
("los monstruos son así"). Las imágenes no quedaron en disco; este documento
es la transcripción durable hecha al recibirlas y manda sobre cualquier
calibración previa (incluido el comentario "calibrados contra la foto real"
de `features/hero/config.ts`, que quedó desactualizado).

## Anatomía de la carta (de las fotos)

- Fondo acuarela: manchas suaves del color del valor, más oscuro en los
  bordes; luz suave arriba a la izquierda.
- Número sticker arriba (~40 % superior): glifo grueso redondeado, contorno
  blanco grueso, relleno con leve gradiente y brillo superior.
- Monstruo abajo (~60 %), casi todo el ancho (≈90 %), pegado al borde
  inferior y recortado levemente por la esquina de la carta.
- Contorno blanco grueso alrededor del cuerpo del monstruo (efecto sticker).
- Esquinas de carta bien redondeadas; se lee como objeto, no como rectángulo.

## Los 10 monstruos (color del cuerpo · silueta · ojos · boca)

1. Azul: pelota redonda esponjosa; UN ojo grande; sonrisita.
2. Morado: blob ancho y bajito; DOS ojos juntos y somnolientos; bocota
   sonriente.
3. Rojo: montículo esponjoso; DOS ojos grandes blancos; sonrisita.
   (Fondo de carta: naranja quemado.)
4. Ciruela (plum): bola MUY peluda; un ojo cíclope; sonrisa pícara mínima.
5. Verde: mango con picos; UN ojo grande; boca abierta sonriente con lengua
   roja.
6. Naranja-marrón: montículo ancho; ojos caídos de sueño; boca ancha con 2
   colmillos.
7. Amarillo: babosa lisa (sin pelo), base ondulada; dos ojos chicos; boca
   abierta feliz grande.
8. Azul marino: torre alta peluda; UN ojo grande; boca plana.
9. Turquesa: picos; DOS ojos (uno con anillo amarillo en el iris); sonrisa
   con un colmillo.
10. Rosa: MUY peludo; DOS ojos; bocaza enorme gritando.

Técnica de dibujo: cuerpo con lóbulos/ondas (silueta "pelusa") o picos
según el caso; brillo blanco arriba a la izquierda y sombra sutil abajo,
recortados con el propio contorno del cuerpo (clipPath); ojos blancos con
pupila tinta y chispa; bocas y rasgos en tinta `#26303A`; lengua `#E9819C`.

## Contrato de clases (no romper)

`MonsterFace` es compartido por el hero (`CardFace`), el tablero
(`CardView`) y el dorso (`CardBack`, monstruo blanco):

- `.monster-body`: cuerpo; el dorso sobreescribe `stroke` a tinta clara.
- `.monster-eye`: esclerótica; el dorso sobreescribe `stroke`.
- El resto (brillos, sombras, picos) son detalles internos.

## Paleta por valor (correcciones contra las fotos)

El doble lugar de la paleta (`components/card.css` para el tablero y
`features/hero/config.ts` para el hero) debe quedar sincronizado:

| Valor | Fondo | Número | Monstruo | Corrección hecha |
| --- | --- | --- | --- | --- |
| 1 | #5E8BD8 | #E8F4FF | #56B7F0 | — |
| 2 | #8A63C9 | #3B2A8C | #38335F | — |
| 3 | #E08A5C | #D9332F | #D93A30 | monstruo más rojo (era salmón) |
| 4 | #C96FB5 | #A044A8 | #A83B90 | ciruela más oscuro (era magenta claro) |
| 5 | #9ACB5A | #43B02A | #58BE3A | — |
| 6 | #EFA23F | #E87830 | #F08A2E | carta 6 pasa de oliva a NARANJA |
| 7 | #F2E36B | #F7E96F | #F6E34A | — |
| 8 | #7A79D0 | #33368C | #2E2E6E | carta 8 pasa de naranja a AZUL MARINO |
| 9 | #5BC8BE | #1FA79C | #35B3A8 | — |
| 10 | #F08FB8 | #E64A8D | #F0559E | — |

## Directivas de la misma sesión (2026-10-16)

- Quitar el SONIDO del special de los monstruos; los sonidos de navegación
  (hover, clic, selección) se mantienen.
- Quitar el cursor custom del hero (volver al cursor nativo); el seguimiento
  de ojos con el puntero (`pointer.ts`) se mantiene.
