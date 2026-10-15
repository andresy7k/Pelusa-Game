import './card.css';

// Carta física: marfil, valor en display grande, elevación real.
// `stealable` = se puede robar: brilla en ámbar e invita al click.
// `onPick` convierte la carta en botón accesible (teclado incluido).
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
      <span className="card-value">{value}</span>
      <span className="card-pip">●</span>
    </>
  );
  if (onPick) {
    return (
      <button
        type="button"
        className={`${cls} as-button`}
        aria-label={`Robar carta ${value}`}
        onClick={onPick}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} aria-label={`Carta ${value}`}>
      {inner}
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
