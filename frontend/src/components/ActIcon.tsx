// Íconos de las 4 decisiones del turno. Los usa la barra de acciones y el
// aviso que aparece sobre la cabeza de quien decidió (como las fichas de
// "Hit / Stand" en el blackjack online), así todos leen el mismo símbolo.

export type ActKind = 'draw' | 'stand' | 'steal' | 'stash';

export const ACT_LABEL: Record<ActKind, string> = {
  draw: 'Pidió',
  stand: 'Se plantó',
  steal: 'Robó',
  stash: 'Guardó',
};

/** Tipo de evento del backend → decisión (null si no es una decisión). */
export function actKindOf(ev: { type?: string; bust?: boolean } | null | undefined): ActKind | null {
  switch (ev?.type) {
    case 'DRAW':
      return ev.bust ? null : 'draw'; // el bust tiene su propia animación
    case 'STAND':
      return 'stand';
    case 'STEAL':
      return 'steal';
    case 'STASH':
      return 'stash';
    default:
      return null;
  }
}

export function ActIcon({ kind }: { kind: ActKind }) {
  if (kind === 'steal') {
    // SVG en vez de 🥷: U+1F977 no existe en fuentes emoji viejas (Windows 10).
    return (
      <svg viewBox="0 0 32 32" className="ninja-svg" aria-hidden="true">
        <path
          d="M16 4.5c6 0 10 3.9 10 9v4.1c0 5.2-4.4 8.4-10 8.4s-10-3.2-10-8.4V13.5c0-5.1 4-9 10-9Z"
          fill="oklch(0.14 0.05 292)"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M7.5 13.8c2.5-1.4 5.2-2.1 8.5-2.1s6 .7 8.5 2.1v3.4c-2.5 1.3-5.2 2-8.5 2s-6-.7-8.5-2Z"
          fill="var(--parchment)"
        />
        <ellipse cx="12.7" cy="15.5" rx="1.55" ry="1.85" fill="oklch(0.14 0.05 292)" />
        <ellipse cx="19.3" cy="15.5" rx="1.55" ry="1.85" fill="oklch(0.14 0.05 292)" />
      </svg>
    );
  }
  return <>{kind === 'draw' ? '+' : kind === 'stand' ? '−' : '★'}</>;
}
