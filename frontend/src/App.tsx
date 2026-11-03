import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';

const Board = lazy(() => import('./routes/Board').then((m) => ({ default: m.Board })));
const History = lazy(() => import('./routes/History').then((m) => ({ default: m.History })));
const Home = lazy(() => import('./routes/Home').then((m) => ({ default: m.Home })));
const Setup = lazy(() => import('./routes/Setup').then((m) => ({ default: m.Setup })));

// El topbar global se oculta solo en el home: el hero tiene su propio nav.
// El resto de las páginas lo conservan tal cual.
function Shell() {
  const { pathname } = useLocation();

  return (
    <>
      {pathname !== '/' && (
        <>
          {/* Navbar global: mismo liquid glass que el home (hijos con las
              clases hero-nav__*). El nombre queda centrado, la vuelta al
              inicio a la izquierda y las links a la derecha. */}
          <header className="topbar">
            <Link to="/" className="topbar-back" aria-label="Volver al inicio">
              <span aria-hidden="true">←</span>
            </Link>
            <Link to="/" className="hero-nav__brand">
              <span className="hero-nav__logo" aria-hidden="true" />
              Pelusas
            </Link>
            <nav className="hero-nav__links" aria-label="Principal">
              <Link className="hero-nav__pill" to="/setup">
                Nueva
              </Link>
              <Link className="hero-nav__pill" to="/history">
                Historial
              </Link>
            </nav>
          </header>
        </>
      )}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/game/:id" element={<Board />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Suspense>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
