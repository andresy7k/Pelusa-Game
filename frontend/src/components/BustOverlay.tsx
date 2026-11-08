import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { CardView } from './CardView';
import './bust.css';

// Pérdida por carta repetida, a pantalla completa y para TODOS (online llega
// por el sondeo). Inspirada en el tótem de los juegos de bloques, pero con lo
// nuestro: la carta repetida sube girando y brillando en rojo, el monstruo
// del jugador tiembla y se deshace en pelusa. No bloquea la mesa
// (pointer-events: none) y se va sola.

const PUFFS = 14;
const DURATION_MS = 2800;

export function BustOverlay({
  name,
  avatar,
  value,
  lost,
  mine,
}: {
  name: string;
  avatar: number;
  value: number;
  lost: number;
  /** Fui yo: el texto habla en segunda persona. */
  mine: boolean;
}) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDone(true), DURATION_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (done) return null;
  return (
    <div className="bust-overlay" role="alert" data-v={avatar}>
      <div className="bust-flash" aria-hidden="true" />
      <div className="bust-stage" aria-hidden="true">
        <div className="bust-avatar">
          <Avatar value={avatar} size="lg" />
          {Array.from({ length: PUFFS }, (_, i) => (
            <span key={i} className="bust-puff" style={{ ['--i' as string]: i }} />
          ))}
        </div>
        <div className="bust-card">
          <CardView value={value} />
        </div>
      </div>
      <p className="bust-title">¡Pelusa repetida!</p>
      <p className="bust-sub">
        {mine ? 'Repetiste' : `${name} repitió`} el <strong>{value}</strong>
        {lost > 0 ? ` y ${mine ? 'perdés' : 'pierde'} ${lost} carta${lost === 1 ? '' : 's'}` : ''}
      </p>
    </div>
  );
}
