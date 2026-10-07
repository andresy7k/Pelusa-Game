import { Link } from 'react-router-dom';

export function Home() {
  return (
    <main className="page">
      <h1>Pelusas</h1>
      <p>El juego de mesa, en versión digital. Las reglas las decide el backend.</p>
      <nav>
        <Link to="/setup">Nueva partida</Link> · <Link to="/history">Historial</Link>
      </nav>
    </main>
  );
}
