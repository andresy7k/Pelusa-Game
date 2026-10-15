import { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { HomeCarousel } from '../components/HomeCarousel';

// La entrada cinematográfica (baraja que cae y se apila) vive en
// HomeEntrance y solo se muestra al entrar; al terminar avisa con onDone
// y el contenido del home aparece de forma dinámica y escalonada.
const HomeEntrance = lazy(() =>
  import('../components/HomeEntrance').then((m) => ({ default: m.HomeEntrance })),
);

export function Home() {
  const [entered, setEntered] = useState(false);

  return (
    <>
      <Suspense fallback={null}>
        {!entered && <HomeEntrance onDone={() => setEntered(true)} />}
      </Suspense>
      <main className={`page home${entered ? ' entered' : ''}`} aria-hidden={!entered}>
        <p className="kicker reveal">Un juego de mesa · versión digital</p>
        <h1 className="reveal">
          Pelusas,
          <br />
          bajo la lámpara.
        </h1>
        <p className="lede reveal">
          Sacá cartas del mazo, guardá tus pelusas y robale al resto — sin que se note.
          Las reglas las decide el backend; vos solo jugá.
        </p>
        <nav className="actions reveal">
          <Link className="btn-primary" to="/setup">
            Nueva partida
          </Link>
          <Link className="btn-ghost" to="/history">
            Historial
          </Link>
        </nav>
        <div className="reveal home-visual">
          <HomeCarousel />
        </div>
        <section className="howto reveal" aria-label="Cómo se juega">
          <div>
            <strong>1 · Sacá</strong>
            <p>Carta del mazo a tu frente. ¿Repetida con 3+? Reventás.</p>
          </div>
          <div>
            <strong>2 · Guardá o robá</strong>
            <p>Asegurá tus pelusas o robale el valor a otro frente.</p>
          </div>
          <div>
            <strong>3 · Ganá</strong>
            <p>Se acaba el mazo, suma más quien más guardó.</p>
          </div>
        </section>
      </main>
    </>
  );
}
