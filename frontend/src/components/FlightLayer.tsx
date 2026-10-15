import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { CardView } from './CardView';

export interface FlightPoint {
  x: number;
  y: number;
}

export interface Flight {
  id: number;
  from: FlightPoint;
  to: FlightPoint;
  value: number;
  delay: number;
}

// Capa de vuelo: cada carta sacada/robada viaja de su origen (mazo o frente
// ajeno) a su destino (mi frente), como moviendo la carta de verdad.
// Solo transform; se limpia sola al aterrizar.
export function FlightLayer({ flights, onDone }: { flights: Flight[]; onDone: (id: number) => void }) {
  return (
    <div className="flight-layer" aria-hidden="true">
      {flights.map((f) => (
        <FlightCard key={f.id} flight={f} onDone={onDone} />
      ))}
    </div>
  );
}

function FlightCard({ flight, onDone }: { flight: Flight; onDone: (id: number) => void }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      doneRef.current(flight.id);
      return;
    }
    const tween = gsap.to(el, {
      x: flight.to.x - flight.from.x,
      y: flight.to.y - flight.from.y,
      rotation: flight.to.x >= flight.from.x ? 9 : -9,
      duration: 0.55,
      delay: flight.delay / 1000,
      ease: 'power2.inOut',
      onComplete: () => doneRef.current(flight.id),
    });
    return () => {
      tween.kill();
    };
  }, [flight]);

  return (
    <div className="flight-card" style={{ left: flight.from.x, top: flight.from.y }}>
      <div ref={innerRef} className="flight-card-inner">
        <CardView value={flight.value} small />
      </div>
    </div>
  );
}
