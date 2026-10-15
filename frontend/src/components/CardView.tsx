import './card.css';
import { MonsterFace } from './MonsterFace';

// Carta de acuarela: cada valor trae su propio color (card.css, .card[data-v])
// y su propio monstruo (MonsterFace). `stealable` = se puede robar: brilla en
// ámbar e invita al click. `onPick` convierte la carta en botón accesible.
export function CardView({
  value,
  small = false,
  stealable = false,
  onPick,
}: {
  value: number;
  small?: boolean;
  stealable?: boolean;
  onPick?: () => void;
}) {
  const cls = `card${small ? ' small' : ''}${stealable ? ' stealable' : ''}`;
  const inner = (
    <>
      <span className="card-stitch" aria-hidden="true" />
      <span className="card-value" data-v={value} aria-hidden="true">
        {value}
      </span>
      <MonsterFace value={value} className="card-monster" />
    </>
  );
  if (onPick) {
    return (
      <button
        type="button"
        className={`${cls} as-button`}
        data-v={value}
        aria-label={`Robar carta ${value}`}
        onClick={onPick}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} data-v={value} aria-label={`Carta ${value}`}>
      {inner}
    </div>
  );
}

// Dorso: peluche blanco sobre índigo, sin número. El mazo de Board.tsx lo
// apila boca abajo asumiendo 48×66 en tamaño small.
export function CardBack({ small = false }: { small?: boolean }) {
  return (
    <div className={`card-back${small ? ' small' : ''}`}>
      <span className="card-stitch" aria-hidden="true" />
      <MonsterFace value={1} className="card-monster" />
    </div>
  );
}

// Frente desplegado: todas las cartas a la vista, con wrap. Nada se apila:
// el rival debe ver en todo momento qué se le puede robar.
export function CardGroup({
  values,
  stealable = false,
  onPick,
}: {
  values: number[];
  stealable?: boolean;
  onPick?: (value: number) => void;
}) {
  if (values.length === 0) return <span className="empty-front">Sin cartas a la vista</span>;
  return (
    <div className="card-group spread">
      {values.map((v, i) => (
        <div key={`${v}-${i}`} className="card-slot pop-in" style={{ ['--d' as string]: `${i * 45}ms` }}>
          <CardView value={v} small stealable={stealable} onPick={onPick ? () => onPick(v) : undefined} />
        </div>
      ))}
    </div>
  );
}
