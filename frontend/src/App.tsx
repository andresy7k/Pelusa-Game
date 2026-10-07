import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Board } from './routes/Board';
import { History } from './routes/History';
import { Home } from './routes/Home';
import { Setup } from './routes/Setup';

export function App() {
  return (
    <BrowserRouter>
      <header>
        <Link to="/">Pelusas</Link>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/game/:id" element={<Board />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  );
}
