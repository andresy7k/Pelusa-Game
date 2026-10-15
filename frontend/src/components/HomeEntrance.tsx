import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { CardView } from './CardView';
import './home-entrance.css';

// Entrada del home: la baraja cae carta a carta al centro de la mesa con
// tumble 3D, cada aterrizaje golpea el mazo (micro-bote + micro-shake +
// puff de polvo de fieltro) y la última carta sacude toda la pantalla antes
// de que el título se abra y el overlay se retire. Aquí SOLO se animan
// transform y opacity (sin layout). Las cartas que caen son las reales del
// juego: cada .fall-card envuelve una CardView (76×104) sin pintarla.

// Trazado propio de cada carta: origen fuera de pantalla, tumble 3D,
// aterrizaje imperfecto (mazo real) y duración de caída (0.45-0.6s).
type Carta = {
  valor: number;
  x0: number; // x inicial (arriba, fuera de pantalla)
  z0: number; // rotación 2D inicial (tumble)
  tiltY: number; // rotateY final, distinto por carta (±8°)
  x1: number; // x final en el mazo
  y1: number; // y final en el mazo
  z1: number; // rotación 2D final
  dur: number; // duración de la caída
};

const CARTAS: readonly Carta[] = [
  { valor: 7, x0: -240, z0: -24, tiltY: -7, x1: -5, y1: -2, z1: -6, dur: 0.5 },
  { valor: 3, x0: -180, z0: 20, tiltY: 5, x1: 6, y1: 3, z1: 8, dur: 0.55 },
  { valor: 9, x0: -120, z0: -16, tiltY: 8, x1: -4, y1: -3, z1: -3, dur: 0.47 },
  { valor: 2, x0: -60, z0: 26, tiltY: -4, x1: 7, y1: 2, z1: 5, dur: 0.58 },
  { valor: 5, x0: 0, z0: -22, tiltY: 7, x1: -6, y1: -4, z1: -7, dur: 0.52 },
  { valor: 8, x0: 70, z0: 14, tiltY: -6, x1: 5, y1: 3, z1: 4, dur: 0.56 },
  { valor: 1, x0: 130, z0: -26, tiltY: 2, x1: -7, y1: -2, z1: -4, dur: 0.46 },
  { valor: 4, x0: 195, z0: 22, tiltY: -8, x1: 8, y1: 4, z1: 7, dur: 0.57 },
  { valor: 6, x0: 250, z0: -12, tiltY: 3, x1: 2, y1: 0, z1: 1, dur: 0.6 },
];

const STAGGER = 0.08; // ritmo entre caídas
const TITULO = 'PELUSAS';
const PASO_LETRA = 7; // px que cada letra se comprime antes de abrirse
const CENTRO_TITULO = (TITULO.length - 1) / 2;

export function HomeEntrance({ onDone }: { onDone: () => void }) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useLayoutEffect(() => {
    onDoneRef.current = onDone;
    const avisarFin = (): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    };

    // Movimiento reducido: sin animación, avisar de inmediato.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      avisarFin();
      return;
    }

    const ctx = gsap.context(() => {
      const overlay = scopeRef.current;
      const cartas = gsap.utils.toArray<HTMLElement>('.fall-card');
      const stack = scopeRef.current?.querySelector<HTMLElement>('.home-entrance-stack') ?? null;
      const letras = gsap.utils.toArray<HTMLElement>('.home-entrance-title-char');
      if (overlay === null || cartas.length === 0) {
        avisarFin();
        return;
      }

      const caidaY = window.innerHeight + 220;
      const ultima = CARTAS.length - 1;

      // Estado inicial: cartas arriba fuera de pantalla y título plegado.
      // La perspectiva va por carta (transformPerspective) para que el
      // apilado final siga pintándose en orden de documento, sin que el
      // ordenamiento 3D compartido mezcle las cartas del mazo.
      cartas.forEach((carta, i) => {
        const d = CARTAS[i % CARTAS.length];
        gsap.set(carta, {
          x: d.x0,
          y: -caidaY,
          rotation: d.z0,
          rotateX: -40,
          rotateY: d.tiltY * -2,
          transformPerspective: 900,
        });
      });
      gsap.set(letras, {
        x: (i) => (CENTRO_TITULO - i) * PASO_LETRA,
        opacity: 0,
      });

      const tl = gsap.timeline({ onComplete: avisarFin });
      tlRef.current = tl;

      cartas.forEach((carta, i) => {
        const d = CARTAS[i % CARTAS.length];
        const t0 = i * STAGGER;
        const aterriza = t0 + d.dur;

        // 1) Caída rápida con aceleración y tumble 3D (rotateX -40° -> 0°,
        // tumbada lo justo para que el monstruo no se vuelva ilegible).
        tl.to(
          carta,
          {
            x: d.x1,
            y: d.y1,
            rotation: d.z1,
            rotateX: 0,
            rotateY: d.tiltY,
            duration: d.dur,
            ease: 'power3.in',
          },
          t0,
        );

        // 2) Micro-bote al aterrizar: sube 7px y se asienta (0.18s).
        tl.to(carta, { y: d.y1 - 7, duration: 0.07, ease: 'power2.out' }, aterriza)
          .to(carta, { y: d.y1, duration: 0.11, ease: 'power2.out' }, aterriza + 0.07);

        // 2b) Puff de polvo de fieltro en la base: nace pequeño y se disipa
        // justo con el impacto; el de la última carta es más grande.
        // immediateRender en false para que el CSS (opacity: 0) aguante hasta
        // el aterrizaje y el puff no asome durante la caída.
        const puff = carta.querySelector<HTMLElement>('.fall-puff');
        if (puff !== null) {
          const esUltima = i === ultima;
          tl.fromTo(
            puff,
            { scale: 0.3, opacity: 0.55 },
            {
              scale: esUltima ? 2 : 1.6,
              opacity: 0,
              duration: esUltima ? 0.35 : 0.28,
              ease: 'power1.out',
              immediateRender: false,
            },
            aterriza,
          );
        }

        // 3) Micro-shake del mazo con cada impacto (x ±2px, 0.08s).
        if (stack !== null) {
          tl.to(stack, { x: 2, duration: 0.03, ease: 'none' }, aterriza)
            .to(stack, { x: -2, duration: 0.03, ease: 'none' }, aterriza + 0.03)
            .to(stack, { x: 0, duration: 0.02, ease: 'none' }, aterriza + 0.06);
        }
      });

      // Momento del golpe final (≈1.24s con estos datos).
      const tImpacto = ultima * STAGGER + CARTAS[ultima].dur;

      // 4) La última carta golpea: screen shake de todo el overlay
      // (x/y ±4px, 3 oscilaciones, 0.25s) y el título se abre en paralelo.
      tl.to(
        overlay,
        {
          keyframes: [
            { x: -4, y: 2, duration: 0.035 },
            { x: 4, y: -2, duration: 0.035 },
            { x: -3, y: 2, duration: 0.035 },
            { x: 3, y: -2, duration: 0.035 },
            { x: -2, y: 1, duration: 0.03 },
            { x: 2, y: -1, duration: 0.03 },
            { x: 0, y: 0, duration: 0.05 },
          ],
          ease: 'none',
        },
        tImpacto,
      );
      // Fade + espaciado abriéndose: las letras viajan en x (transform).
      tl.to(
        letras,
        {
          x: 0,
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
          stagger: { each: 0.03, from: 'center' },
        },
        tImpacto + 0.02,
      );

      // 5) Pausa breve, la carta superior se suelta (8°) y el overlay se
      // retira con fade + scale(0.96); onComplete cierra la secuencia.
      const tSuelta = tImpacto + 0.61;
      tl.to(
        cartas[ultima],
        {
          x: CARTAS[ultima].x1 + 30,
          y: CARTAS[ultima].y1 - 6,
          rotation: 8,
          duration: 0.3,
          ease: 'power2.inOut',
        },
        tSuelta,
      );
      tl.to(
        overlay,
        { opacity: 0, scale: 0.96, duration: 0.45, ease: 'power2.inOut' },
        tSuelta + 0.35,
      );
    }, scopeRef);

    return () => {
      tlRef.current = null;
      ctx.revert();
    };
    // Intencionado: la secuencia corre una sola vez al montar;
    // onDone se sirve vía ref para no reiniciar la animación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click en cualquier parte: acelera la secuencia; el final sigue siendo
  // el mismo onComplete (onDone se dispara una sola vez).
  const saltarSecuencia = (): void => {
    tlRef.current?.timeScale(5);
  };

  return (
    <div ref={scopeRef} className="home-entrance" aria-hidden="true" onClick={saltarSecuencia}>
      <div className="home-entrance-stage">
        <div className="home-entrance-stack">
          {CARTAS.map((d, i) => (
            <div key={`${d.valor}-${i}`} className="fall-card">
              <CardView value={d.valor} />
              <span className="fall-puff" aria-hidden="true" />
            </div>
          ))}
        </div>
        <p className="home-entrance-title">
          {TITULO.split('').map((letra, i) => (
            <span key={`${letra}-${i}`} className="home-entrance-title-char">
              {letra}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
