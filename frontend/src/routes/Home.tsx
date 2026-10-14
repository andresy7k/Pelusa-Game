import { Link } from 'react-router-dom';

// Home editorial asimétrica: titular a la izquierda, el mazo como objeto.
// La jerarquía funciona sin color: tamaño, peso y espacio primero.
export function Home() {
  return (
    <main className="page home">
      <p className="kicker">Un juego de mesa · versión digital</p>
      <h1>
        Pelusas,
        <br />
        bajo la lámpara.
      </h1>
      <p className="lede">
        Sacá cartas del mazo, guardá tus pelusas y robale al resto — sin que se note.
        Las reglas las decide el backend; vos solo jugá.
      </p>
      <nav className="actions">
        <Link className="btn-primary" to="/setup">
          Nueva partida
        </Link>
        <Link className="btn-ghost" to="/history">
          Historial
        </Link>
      </nav>
      <div className="deck-teaser" aria-hidden="true">
        <div className="deck-teaser-card" />
        <div className="deck-teaser-card" />
        <div className="deck-teaser-card" />
      </div>
    </main>
  );
}
