import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { Board } from './routes/Board';
import { History } from './routes/History';
import { Home } from './routes/Home';
import { Setup } from './routes/Setup';

// El topbar global se oculta solo en el home: el hero tiene su propio nav.
// El resto de las páginas lo conservan tal cual.
function Shell() {
  const { pathname } = useLocation();

  return (
    <>
      {pathname !== '/' && (
        <header className="topbar">
          <Link to="/" className="brand">
            Pelusas
          </Link>
          <nav>
            <Link to="/setup">Nueva</Link>
            <Link to="/history">Historial</Link>
          </nav>
        </header>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/game/:id" element={<Board />} />
        <Route path="/history" element={<History />} />
      </Routes>
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
