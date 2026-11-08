import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../api/types';

/** Lo que el backend cuenta de la última jugada (lastEvent). */
export interface TableEvent {
  type?: string;
  value?: number;
  count?: number;
  bust?: boolean;
  lost?: number;
  playerId?: string;
}

/**
 * Identidad de una jugada: el mismo evento con otro mazo/turno es otra jugada
 * (dos "Pidió" seguidos del mismo jugador cambian el mazo).
 */
export function eventKey(s: GameState): string | null {
  if (!s.lastEvent) return null;
  return `${JSON.stringify(s.lastEvent)}|${s.deckRemaining}|${s.currentPlayerId}|${s.status}`;
}

/**
 * Jugada NUEVA vista en esta pantalla (propia o de otro jugador vía sondeo).
 * La que ya estaba al abrir la página no cuenta: recargar no repite animaciones.
 */
export function useFreshEvent(state: GameState | null): { key: string; ev: TableEvent } | null {
  const seen = useRef<string | null | undefined>(undefined);
  const [fresh, setFresh] = useState<{ key: string; ev: TableEvent } | null>(null);
  const key = state ? eventKey(state) : undefined;

  useEffect(() => {
    if (key === undefined) return;
    if (seen.current === undefined) {
      seen.current = key; // primera lectura: es historia, no una jugada en vivo
      return;
    }
    if (key && key !== seen.current) {
      seen.current = key;
      setFresh({ key, ev: (state?.lastEvent ?? {}) as TableEvent });
    }
    // `state` va implícito en `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return fresh;
}
