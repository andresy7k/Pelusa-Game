import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ApiException, friendlyMessage } from '../api/types';

// Setup por pasos: primero cuántos juegan (2-6), después un campo por jugador.
// Nada de comas: cada nombre tiene su campo, su label y su validación visible.
export function Setup() {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function changeCount(next: number) {
    const n = Math.min(6, Math.max(2, next));
    setCount(n);
    setNames((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ''));
  }

  function setName(i: number, value: string) {
    setNames((prev) => prev.map((n, j) => (j === i ? value : n)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = names.map((n) => n.trim());
    if (list.some((n) => n.length === 0)) {
      setError('Falta el nombre de algún jugador.');
      return;
    }
    if (new Set(list).size !== list.length) {
      setError('Los nombres no pueden repetirse.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const game = await api.create(list, 0);
      await api.start(game.id);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof ApiException ? friendlyMessage(err.apiError.errorCode) : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <p className="kicker">Mesa nueva · paso 1 de 2</p>
      <h1>¿Cuántos juegan?</h1>
      <div className="stepper" role="group" aria-label="Cantidad de jugadores">
        <button type="button" className="ghost" onClick={() => changeCount(count - 1)} disabled={count <= 2}>
          −
        </button>
        <span className="stepper-count" aria-live="polite">
          {count}
        </span>
        <button type="button" className="ghost" onClick={() => changeCount(count + 1)} disabled={count >= 6}>
          +
        </button>
      </div>

      <p className="kicker">Paso 2 de 2 · nombres</p>
      <form onSubmit={submit} className="panel">
        {names.map((n, i) => (
          <label key={i}>
            Jugador {i + 1}
            <input
              value={n}
              onChange={(e) => setName(i, e.target.value)}
              placeholder={`Nombre del jugador ${i + 1}`}
              maxLength={60}
              autoFocus={i === 0}
            />
          </label>
        ))}
        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Repartiendo…' : 'Crear y empezar'}
          </button>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
