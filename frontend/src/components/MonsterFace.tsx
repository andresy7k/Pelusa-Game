// Monstruos de acuarela: un SVG inline por valor (1..10), sin dependencias.
// Look sticker: cuerpo var(--c-monster) con contorno blanco grueso; ojos
// blancos con pupila tinta y brillito; bocas, cejas y rasgos en tinta.
const TINTA = '#26303A';
const LENGUA = '#E9819C';

// Atributos comunes del cuerpo (el dorso sobrescribe el stroke desde card.css).
const cuerpo = {
  fill: 'var(--c-monster)',
  stroke: '#fff',
  strokeWidth: 5,
  strokeLinejoin: 'round',
} as const;

export function MonsterFace({ value, className }: { value: number; className?: string }) {
  switch (value) {
    case 1:
      // Blob regordete, un ojo grande y sonrisita.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <ellipse className="monster-body" cx="50" cy="56" rx="40" ry="37" {...cuerpo} />
          <circle className="monster-eye" cx="50" cy="46" r="15" fill="#fff" />
          <circle cx="53" cy="48" r="7" fill={TINTA} />
          <circle cx="56" cy="44" r="2.6" fill="#fff" />
          <path d="M 36 66 Q 50 78 64 66" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      );
    case 2:
      // Ancho y bajito, ceño fruncido, dos ojos y dos dientes: gruñón.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <ellipse className="monster-body" cx="50" cy="62" rx="45" ry="31" {...cuerpo} />
          <path d="M 24 38 L 43 45" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 76 38 L 57 45" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
          <circle className="monster-eye" cx="36" cy="54" r="8" fill="#fff" />
          <circle className="monster-eye" cx="64" cy="54" r="8" fill="#fff" />
          <circle cx="37.5" cy="55.5" r="3.6" fill={TINTA} />
          <circle cx="62.5" cy="55.5" r="3.6" fill={TINTA} />
          <path d="M 34 63 Q 50 71 66 63 Q 64 81 50 81 Q 36 81 34 63 Z" fill={TINTA} />
          <rect x="43" y="65" width="6" height="7" rx="1.5" fill="#fff" />
          <rect x="52" y="65" width="6" height="7" rx="1.5" fill="#fff" />
        </svg>
      );
    case 3:
      // Alto, dos ojos redondos y boca abierta sonriente.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <ellipse className="monster-body" cx="50" cy="52" rx="33" ry="43" {...cuerpo} />
          <circle className="monster-eye" cx="38" cy="40" r="9.5" fill="#fff" />
          <circle className="monster-eye" cx="62" cy="40" r="9.5" fill="#fff" />
          <circle cx="39.5" cy="41.5" r="4.4" fill={TINTA} />
          <circle cx="60.5" cy="41.5" r="4.4" fill={TINTA} />
          <circle cx="41" cy="39" r="1.7" fill="#fff" />
          <circle cx="62" cy="39" r="1.7" fill="#fff" />
          <path d="M 36 58 Q 50 68 64 58 Q 61 78 50 78 Q 39 78 36 58 Z" fill={TINTA} />
        </svg>
      );
    case 4:
      // Peludo (borde superior ondulado tipo nube), un ojo cíclope y boquita "w".
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <path
            className="monster-body"
            d="M 12 62 Q 8 44 22 37 Q 24 22 38 27 Q 50 13 62 27 Q 76 22 78 37 Q 92 44 88 62 Q 88 88 50 88 Q 12 88 12 62 Z"
            {...cuerpo}
          />
          <circle className="monster-eye" cx="50" cy="48" r="14" fill="#fff" />
          <circle cx="53" cy="50" r="6.5" fill={TINTA} />
          <circle cx="56" cy="46" r="2.4" fill="#fff" />
          <path d="M 39 68 Q 44.5 75 50 68 Q 55.5 75 61 68" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      );
    case 5:
      // Blob con un ojo grande y boca riendo con lengua.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <ellipse className="monster-body" cx="50" cy="56" rx="41" ry="38" {...cuerpo} />
          <circle className="monster-eye" cx="47" cy="43" r="16" fill="#fff" />
          <circle cx="50" cy="46" r="7.5" fill={TINTA} />
          <circle cx="54" cy="41" r="2.8" fill="#fff" />
          <path d="M 30 62 Q 50 74 70 62 Q 68 84 50 84 Q 32 84 30 62 Z" fill={TINTA} />
          <ellipse cx="50" cy="79" rx="9" ry="5" fill={LENGUA} />
        </svg>
      );
    case 6:
      // Aplastado, dos ojos pequeños juntos y sonrisota ancha.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <ellipse className="monster-body" cx="50" cy="62" rx="45" ry="32" {...cuerpo} />
          <circle className="monster-eye" cx="43" cy="52" r="6.5" fill="#fff" />
          <circle className="monster-eye" cx="57" cy="52" r="6.5" fill="#fff" />
          <circle cx="44" cy="53.5" r="3" fill={TINTA} />
          <circle cx="56" cy="53.5" r="3" fill={TINTA} />
          <path d="M 22 63 Q 50 88 78 63" fill="none" stroke={TINTA} strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case 7:
      // Fantasma: base inferior ondulada, ojos ovalados y boca abierta feliz.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <path
            className="monster-body"
            d="M 14 80 L 14 52 Q 14 20 50 20 Q 86 20 86 52 L 86 80 Q 74 68 62 80 Q 50 92 38 80 Q 26 68 14 80 Z"
            {...cuerpo}
          />
          <ellipse className="monster-eye" cx="38" cy="45" rx="6.5" ry="9.5" fill="#fff" />
          <ellipse className="monster-eye" cx="62" cy="45" rx="6.5" ry="9.5" fill="#fff" />
          <ellipse cx="39" cy="46.5" rx="3.2" ry="4.6" fill={TINTA} />
          <ellipse cx="61" cy="46.5" rx="3.2" ry="4.6" fill={TINTA} />
          <path d="M 43 60 Q 50 56 57 60 Q 57 71 50 71 Q 43 71 43 60 Z" fill={TINTA} />
        </svg>
      );
    case 8:
      // Tres pelitos, un ojo y sonrisa pícara sesgada.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <path
            className="monster-body"
            d="M 13 64 Q 10 38 30 31 Q 29 16 40 23 Q 47 9 56 22 Q 68 14 69 30 Q 90 36 87 64 Q 87 89 50 89 Q 13 89 13 64 Z"
            {...cuerpo}
          />
          <circle className="monster-eye" cx="51" cy="51" r="13.5" fill="#fff" />
          <circle cx="54" cy="53" r="6.2" fill={TINTA} />
          <circle cx="57" cy="49" r="2.4" fill="#fff" />
          <path d="M 37 71 Q 51 79 65 67" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      );
    case 9:
      // Dos ojos de distinto tamaño y boca ondulada.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <ellipse className="monster-body" cx="50" cy="56" rx="41" ry="38" {...cuerpo} />
          <circle className="monster-eye" cx="37" cy="45" r="12" fill="#fff" />
          <circle className="monster-eye" cx="64" cy="47" r="8" fill="#fff" />
          <circle cx="38.5" cy="46.5" r="5.4" fill={TINTA} />
          <circle cx="65" cy="48.5" r="3.6" fill={TINTA} />
          <circle cx="41" cy="43" r="2.2" fill="#fff" />
          <circle cx="66.5" cy="46" r="1.6" fill="#fff" />
          <path d="M 30 70 Q 37 63 44 70 Q 51 77 58 70 Q 65 63 72 70" fill="none" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      );
    case 10:
      // Dos ojos juntos arriba y bocaza con lengua y dos dientes.
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <ellipse className="monster-body" cx="50" cy="56" rx="43" ry="40" {...cuerpo} />
          <circle className="monster-eye" cx="40" cy="34" r="8.5" fill="#fff" />
          <circle className="monster-eye" cx="60" cy="34" r="8.5" fill="#fff" />
          <circle cx="41" cy="35.5" r="3.8" fill={TINTA} />
          <circle cx="59" cy="35.5" r="3.8" fill={TINTA} />
          <circle cx="42.5" cy="33" r="1.6" fill="#fff" />
          <circle cx="60.5" cy="33" r="1.6" fill="#fff" />
          <path d="M 21 53 Q 50 47 79 53 Q 77 88 50 88 Q 23 88 21 53 Z" fill={TINTA} />
          <rect x="35" y="52" width="7" height="9" rx="2" fill="#fff" />
          <rect x="58" y="52" width="7" height="9" rx="2" fill="#fff" />
          <ellipse cx="50" cy="75" rx="12" ry="5" fill={LENGUA} />
        </svg>
      );
    default:
      return null;
  }
}
