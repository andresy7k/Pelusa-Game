import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ApiException, friendlyMessage } from '../api/types';

export function Setup() {
  const [names, setNames] = useState('Ana,Beto');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = names.split(',').map((n) => n.trim()).filter(Boolean);
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
      <p className="kicker">Mesa nueva</p>
      <h1>¿Quién juega?</h1>
      <form onSubmit={submit} className="panel">
        <label>
          Jugadores · 2 a 6, separados por coma
          <input value={names} onChange={(e) => setNames(e.target.value)} autoFocus />
        </label>
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
