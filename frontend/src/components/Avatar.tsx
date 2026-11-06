import { useId } from 'react';
import './card.css';
import './avatar.css';
import { MonsterFace } from './MonsterFace';

// Avatar: el monstruo de cada jugador sobre su acuarela (misma paleta que su
// carta, .avatar[data-v] en card.css). Lo usan el setup, el lobby, las chapas
// de la mesa 2D y el indicador de turno (2D y 3D).

export const AVATARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Monstruo válido (1..10) o el de su asiento si el dato no llegó. */
export function avatarOf(p: { avatar?: number; seat: number }): number {
  return p.avatar && p.avatar >= 1 && p.avatar <= 10 ? p.avatar : (p.seat % 10) + 1;
}

export function Avatar({
  value,
  size = 'md',
  label,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  /** Texto para lectores de pantalla; sin él es decorativo. */
  label?: string;
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      data-v={value}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <MonsterFace value={value} className="avatar-monster" />
    </span>
  );
}

// Selector accesible: radios nativos (flechas del teclado, Tab entra una sola
// vez al grupo) con la cara del monstruo como etiqueta. `takenBy` atenúa los
// que ya tiene otro jugador y lo dice; elegir uno ocupado los intercambia
// (lo resuelve quien usa el selector).
export function AvatarPicker({
  value,
  onChange,
  legend,
  takenBy = {},
}: {
  value: number | null;
  onChange: (v: number) => void;
  legend: string;
  takenBy?: Record<number, string>;
}) {
  const name = useId();
  return (
    <fieldset className="avatar-picker">
      <legend className="sr-only">{legend}</legend>
      {AVATARS.map((v) => {
        const owner = takenBy[v];
        return (
          <label key={v} className={`avatar-option${owner ? ' taken' : ''}`} title={owner ? `Lo tiene ${owner}` : `Pelusa ${v}`}>
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            <Avatar value={v} size="md" />
            <span className="avatar-option-n" aria-hidden="true">
              {v}
            </span>
            <span className="sr-only">
              Pelusa {v}
              {owner ? ` (la tiene ${owner}: se intercambian)` : ''}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
