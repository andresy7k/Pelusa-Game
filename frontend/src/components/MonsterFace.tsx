// Monstruos de acuarela: un SVG inline por valor (1..10), sin dependencias.
// Siluetas y caras calibradas contra las fotos reales de las cartas
// (docs/superpowers/specs/2026-10-16-monstruos-referencia.md): cuerpos
// esponjosos o con picos, brillo arriba a la izquierda, sombra inferior y
// contorno blanco grueso (sticker). El dorso de carta reusa el valor 1 en
// blanco: sobreescribe el stroke de `.monster-body` y `.monster-eye` desde
// card.css.
import { useId, type ReactNode } from 'react'
import { CAMINOS } from './monsterPaths'

const TINTA = '#26303A'
const LENGUA = '#E9819C'

// Atributos comunes del cuerpo (el dorso sobrescribe el stroke desde card.css).
const cuerpo = {
  fill: 'var(--c-monster)',
  stroke: '#fff',
  strokeWidth: 6,
  strokeLinejoin: 'round',
} as const

// Los contornos de cuerpo viven en CAMINOS (monsterPaths.ts): fuente única
// compartida con la geometría 3D, para que ambas siluetas sean el mismo `d`.

// Ojo clásico: esclerótica blanca, pupila tinta y chispa.
function Ojo({ cx, cy, r, dx = 0, dy = 0 }: { cx: number; cy: number; r: number; dx?: number; dy?: number }) {
  return (
    <>
      <circle className="monster-eye" cx={cx} cy={cy} r={r} fill="#fff" />
      <circle cx={cx + dx} cy={cy + dy} r={r * 0.44} fill={TINTA} />
      <circle cx={cx + dx + r * 0.2} cy={cy + dy - r * 0.24} r={r * 0.16} fill="#fff" />
    </>
  )
}

// Ojo somnoliento: media luna inferior (el párpado tapa la mitad de arriba).
function OjoDormido({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <path
        className="monster-eye"
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z`}
        fill="#fff"
      />
      <circle cx={cx + r * 0.1} cy={cy + r * 0.34} r={r * 0.38} fill={TINTA} />
    </>
  )
}

// Lienzo común: clip del propio cuerpo para brillo/sombra, contorno sticker y
// los rasgos encima. `gloss`/`shade` van en unidades del viewBox (cx, cy, rx, ry).
function Lienzo({
  d,
  uid,
  className,
  gloss,
  shade,
  children,
}: {
  d: string
  uid: string
  className?: string
  gloss?: [number, number, number, number]
  shade?: [number, number, number, number]
  children: ReactNode
}) {
  const id = `mf-${uid}`
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={d} />
        </clipPath>
      </defs>
      <path className="monster-body" d={d} {...cuerpo} />
      <g clipPath={`url(#${id})`}>
        {shade && (
          <ellipse cx={shade[0]} cy={shade[1]} rx={shade[2]} ry={shade[3]} fill="#000" opacity="0.06" />
        )}
        {gloss && (
          <ellipse
            cx={gloss[0]}
            cy={gloss[1]}
            rx={gloss[2]}
            ry={gloss[3]}
            fill="#fff"
            opacity="0.3"
            transform={`rotate(-24 ${gloss[0]} ${gloss[1]})`}
          />
        )}
      </g>
      {children}
    </svg>
  )
}

export function MonsterFace({ value, className }: { value: number; className?: string }) {
  // Id estable y único por instancia para el clipPath (varios monstruitos del
  // mismo valor conviven en la página: hero + tablero + dorso).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  switch (value) {
    case 1:
      // Pelota azul esponjosa, un ojo grande y sonrisita.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[1]} gloss={[35, 26, 15, 5]} shade={[50, 87, 30, 9]}>
          <Ojo cx={50} cy={47} r={16} dx={2.5} dy={2} />
          <path d="M 41 68 Q 50 76 59 68" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </Lienzo>
      )
    case 2:
      // Blob morado ancho y bajito: dos ojos juntos somnolientos y bocota.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[2]} gloss={[31, 35, 14, 4.5]} shade={[50, 84.5, 34, 8]}>
          <OjoDormido cx={42} cy={52} r={8.5} />
          <OjoDormido cx={58} cy={52} r={8.5} />
          <path d="M 32 65 Q 50 61 68 65 Q 66 79 50 79 Q 34 79 32 65 Z" fill={TINTA} />
          <ellipse cx="50" cy="75.5" rx="8" ry="4" fill="#F4D420" />
        </Lienzo>
      )
    case 3:
      // Montículo rojo esponjoso: dos ojos grandes y sonrisita.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[3]} gloss={[33, 28, 14, 4.5]} shade={[50, 85, 30, 9]}>
          <Ojo cx={38} cy={47} r={11} dx={1.5} dy={1.5} />
          <Ojo cx={62} cy={47} r={11} dx={-1.5} dy={1.5} />
          <path d="M 42 68 Q 50 75 58 68" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </Lienzo>
      )
    case 4:
      // Bola ciruela MUY peluda: un ojo cíclope y sonrisa pícara.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[4]} gloss={[34, 24, 14, 4.5]} shade={[50, 86, 28, 9]}>
          <Ojo cx={50} cy={46} r={15.5} dx={2} dy={1} />
          <path d="M 40 66 Q 52 75 63 63" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </Lienzo>
      )
    case 5:
      // Mango verde con picos: un ojo grande y boca abierta con lengua roja.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[5]} gloss={[33, 26, 12, 4]} shade={[50, 86, 27, 8]}>
          <Ojo cx={47} cy={43} r={15} dx={2} dy={2} />
          <path d="M 33 61 Q 50 56 67 61 Q 65 80 50 80 Q 35 80 33 61 Z" fill={TINTA} />
          <ellipse cx="50" cy="76" rx="9" ry="4.5" fill={LENGUA} />
        </Lienzo>
      )
    case 6:
      // Montículo anaranjado ancho: ojos caídos de sueño y boca con 2 colmillos.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[6]} gloss={[31, 34, 14, 4.5]} shade={[50, 85, 34, 8]}>
          <OjoDormido cx={40} cy={51} r={9} />
          <OjoDormido cx={60} cy={51} r={9} />
          <path d="M 27 64 Q 50 59 73 64 Q 71 81 50 81 Q 29 81 27 64 Z" fill={TINTA} />
          <path d="M 40 62.5 L 46 62.5 L 43 71 Z" fill="#fff" />
          <path d="M 54 62.5 L 60 62.5 L 57 71 Z" fill="#fff" />
        </Lienzo>
      )
    case 7:
      // Babosa amarilla lisa (base ondulada): dos ojos chicos y bocota feliz.
      return (
        <Lienzo
          uid={uid}
          className={className}
          d={CAMINOS[7]}
          gloss={[36, 29, 14, 4.5]}
          shade={[50, 80, 30, 7]}
        >
          <Ojo cx={40} cy={43} r={6.5} dx={1} dy={1} />
          <Ojo cx={60} cy={43} r={6.5} dx={-1} dy={1} />
          <path d="M 37 56 Q 50 51 63 56 Q 61 75 50 75 Q 39 75 37 56 Z" fill={TINTA} />
          <ellipse cx="50" cy="71" rx="8" ry="4" fill={LENGUA} />
        </Lienzo>
      )
    case 8:
      // Torre azul marino peluda: un ojo grande y boca plana.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[8]} gloss={[40, 24, 10, 4]} shade={[50, 88, 22, 7]}>
          <Ojo cx={50} cy={44} r={14} dy={1} />
          <path d="M 39 68 Q 50 71 61 68" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </Lienzo>
      )
    case 9:
      // Erizo turquesa: dos ojos (el derecho con anillo) y sonrisa con colmillo.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[9]} gloss={[32, 27, 12, 4]} shade={[50, 87, 27, 8]}>
          <Ojo cx={38} cy={47} r={10.5} dx={1.5} dy={1.5} />
          <circle className="monster-eye" cx={63} cy={49} r={8} fill="#fff" />
          <circle cx="64" cy="50" r="3.4" fill={TINTA} />
          <circle cx="64" cy="50" r="5.2" fill="none" stroke="#F2D33C" strokeWidth="2.6" />
          <circle cx="65.5" cy="48" r="1.3" fill="#fff" />
          <path d="M 35 67 Q 50 76 65 67" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 44 70 L 50 70 L 47 79 Z" fill="#fff" />
        </Lienzo>
      )
    case 10:
      // Pelusa rosa MUY peluda: dos ojos y bocaza enorme gritando.
      return (
        <Lienzo uid={uid} className={className} d={CAMINOS[10]} gloss={[34, 24, 14, 4.5]} shade={[50, 86, 30, 9]}>
          <Ojo cx={39} cy={35} r={9} dx={1.5} dy={2} />
          <Ojo cx={61} cy={35} r={9} dx={-1.5} dy={2} />
          <path d="M 26 53 Q 50 45 74 53 Q 78 73 50 87 Q 22 73 26 53 Z" fill={TINTA} />
          <ellipse cx="50" cy="80" rx="11" ry="4.5" fill={LENGUA} />
        </Lienzo>
      )
    default:
      return null
  }
}
