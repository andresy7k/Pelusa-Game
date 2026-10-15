import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import './home-entrance.css';

// Baraja física cayendo: 9 cartas caen desde arriba con trayectoria propia
// y aterrizan apiladas como un mazo real (offsets imperfectos).
// El padre desmonta con `!entered && <HomeEntrance/>`; onDone se llama una vez.
const VALUES: number[] = [7, 3, 9, 2, 5, 8, 1, 4, 6];

// X inicial distinta por carta (fuera de pantalla, arriba).
const START_X: number[] = [-220, -160, -110, -55, 0, 60, 115, 170, 230];
// Rotación inicial propia, entre -25 y 25deg.
const START_ROT: number[] = [-22, 18, -14, 24, -20, 12, -25, 20, -10];
// Duración de caída propia, entre 0.55 y 0.8s.
const DUR: number[] = [0.62, 0.75, 0.58, 0.8, 0.66, 0.72, 0.55, 0.78, 0.7];

// Stack final: leve offset/rotación por carta (mazo real, no alineado perfecto).
const END: Array<{ x: number; y: number; r: number }> = [
  { x: -10, y: 6, r: -12 },
  { x: 9, y: -5, r: 10 },
  { x: -7, y: -9, r: -7 },
  { x: 11, y: 4, r: 15 },
  { x: -13, y: -3, r: -17 },
  { x: 7, y: 9, r: 8 },
  { x: -5, y: -7, r: -5 },
  { x: 12, y: -1, r: 19 },
  { x: 2, y: 1, r: 3 },
];

export function HomeEntrance({ onDone }: { onDone: () => void }) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useLayoutEffect(() => {
    onDoneRef.current = onDone;
    const fireDone = (): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    };

    // Movimiento reducido: sin animación, avisar de inmediato.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fireDone();
      return;
    }

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.fall-card');
      const overlay = scopeRef.current;
      if (overlay === null || cards.length === 0) {
        fireDone();
        return;
      }
      const dropY: number = window.innerHeight + 200;
      cards.forEach((card, i) => {
        gsap.set(card, {
          x: START_X[i % START_X.length],
          y: -dropY,
          rotation: START_ROT[i % START_ROT.length],
          opacity: 1,
        });
      });
      const tl = gsap.timeline({ onComplete: fireDone });
      cards.forEach((card, i) => {
        const end = END[i % END.length];
        tl.to(
          card,
          {
            x: end.x,
            y: end.y,
            rotation: end.r,
            duration: DUR[i % DUR.length],
            ease: 'expo.out',
          },
          i * 0.09,
        );
      });
      // Pausa legible con el stack completo, luego fade+scale del overlay.
      tl.to({}, { duration: 0.35 });
      tl.to(overlay, { opacity: 0, scale: 0.96, duration: 0.4, ease: 'power2.inOut' });
    }, scopeRef);
    return () => {
      ctx.revert();
    };
    // Intencionado: la secuencia corre una sola vez al montar;
    // onDone se sirve vía ref para no reiniciar la animación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scopeRef} className="home-entrance" aria-hidden="true">
      <div className="home-entrance-stage">
        <div className="home-entrance-stack">
          {VALUES.map((v, i) => (
            <div key={`${v}-${i}`} className="fall-card">
              <span className="fall-card-value">{v}</span>
            </div>
          ))}
        </div>
        <p className="home-entrance-title">PELUSAS</p>
      </div>
    </div>
  );
}
