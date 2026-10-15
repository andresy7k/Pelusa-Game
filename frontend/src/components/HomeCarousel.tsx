import { useEffect, useState } from 'react';
import { CardView } from './CardView';
import { MonsterFace } from './MonsterFace';
import './home-carousel.css';

// Escena-carruel del home al estilo "character select" de un juego AAA:
// las 10 pelusas del juego (una por valor del 1 al 10), cada una parada
// delante de SU carta; la central más grande (con su monstruo gigante
// delante, como el personaje sobre su carta en la referencia) y las
// laterales más chicas, inclinadas y desvanecidas. El carrusel avanza solo
// en loop 1→2→…→10→1. Los offsets se calculan en anillo para que dar la
// vuelta (5 → 4) ocurra siempre fuera de vista. Solo transform/opacity.

const VALORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// Color del monstruo por valor (los mismos de card.css): el héroe del frente
// lo inyecta como CSS var --c-monster, de donde MonsterFace lee su cuerpo.
const COLORES: Readonly<Record<number, string>> = {
  1: '#6FB4E8',
  2: '#5A5FA0',
  3: '#E0715C',
  4: '#9256B5',
  5: '#6FBC57',
  6: '#A9BC3E',
  7: '#E8C84A',
  8: '#E8823A',
  9: '#46B4A6',
  10: '#E0559E',
};

const PASO_MS = 1400; // ritmo del auto-avance (el CSS transiciona 650ms)

export function HomeCarousel() {
  const [center, setCenter] = useState(0); // índice 0..9 de la carta central

  // Auto-avance en loop; con movimiento reducido no se programa intervalo
  // y la escena queda estática en el valor 1.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setCenter((c) => (c + 1) % 10), PASO_MS);
    return () => window.clearInterval(id);
  }, []);

  const valorCentro = center + 1;

  return (
    <div className="home-carousel">
      <div className="hc-glow" aria-hidden="true" />

      {/* Escenario decorativo: cartas en anillo + héroe del centro. */}
      <div className="hc-stage" aria-hidden="true">
        {VALORES.map((v, i) => {
          // Offset circular (rango -5..4): los saltos del anillo caen todos
          // en |off| >= 3, donde la ranura ya está invisible.
          const raw = (i - center + 10) % 10;
          const off = raw > 4 ? raw - 10 : raw;
          const abs = Math.abs(off);
          const escala = off === 0 ? 1.35 : abs === 1 ? 1 : abs === 2 ? 0.8 : 0.6;
          const giro = abs === 1 ? Math.sign(off) * 4 : abs === 2 ? Math.sign(off) * 7 : 0;
          const opacidad = off === 0 ? 1 : abs === 1 ? 0.85 : abs === 2 ? 0.45 : 0;
          return (
            <div
              key={v}
              className={`hc-slot${abs >= 3 ? ' hc-slot--far' : ''}`}
              style={{
                ['--hc-tx' as string]: `calc(${off} * var(--hc-step))`,
                ['--hc-scale' as string]: escala,
                ['--hc-rot' as string]: `${giro}deg`,
                ['--hc-op' as string]: opacidad,
                ['--hc-z' as string]: 10 - abs,
              }}
            >
              <CardView value={v} />
            </div>
          );
        })}

        {/* Héroe del centro: parado DELANTE de su carta; key={center} remonta
            el SVG y reinicia hc-pop cada vez que el carrusel lo trae al frente. */}
        <span
          key={center}
          className="hc-hero"
          style={{ ['--c-monster' as string]: COLORES[valorCentro] }}
        >
          <MonsterFace value={valorCentro} className="hc-hero-monster" />
        </span>
      </div>

      {/* Dots reales (foco visible global): único punto accesible de la
          escena decorativa; el activo se marca con aria-current. */}
      <div className="hc-dots" role="group" aria-label="Elegir pelusa">
        {VALORES.map((v, i) => (
          <button
            key={v}
            type="button"
            className={`hc-dot${center === i ? ' active' : ''}`}
            aria-label={`Ver pelusa ${v}`}
            aria-current={center === i ? 'true' : undefined}
            onClick={() => setCenter(i)}
          />
        ))}
      </div>
    </div>
  );
}
