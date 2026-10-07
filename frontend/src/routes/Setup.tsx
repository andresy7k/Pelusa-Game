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
    <main className="page">
      <h1>Nueva partida</h1>
      <form onSubmit={submit}>
        <label>
          Jugadores (2 a 6, separados por coma)
          <input value={names} onChange={(e) => setNames(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>
          Crear y empezar
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
