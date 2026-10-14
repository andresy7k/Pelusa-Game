import './card.css';

// Carta física: marfil, valor en display grande, elevación real.
// Hover = promesa de agarre (sube 4px, sombra profunda). Sin color por valor:
// la jerarquía la da el tamaño, no el arcoíris (daltonismo + sobriedad).
export function CardView({ value, small = false }: { value: number; small?: boolean }) {
  return (
    <div className={small ? 'card small' : 'card'} aria-label={`Carta ${value}`}>
      <span className="card-value">{value}</span>
      <span className="card-pip">●</span>
    </div>
  );
}

// Grupo del mismo valor: las cartas se solapan como en la mano real.
export function CardGroup({ values }: { values: number[] }) {
  if (values.length === 0) return <span className="empty-front">—</span>;
  return (
    <div className="card-group">
      {values.map((v, i) => (
        <div key={i} className="card-slot" style={{ ['--i' as string]: i }}>
          <CardView value={v} small />
        </div>
      ))}
    </div>
  );
}
