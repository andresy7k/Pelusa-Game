// frontend/src/features/hero/HeroNav.tsx
import { Link } from 'react-router-dom'

export function HeroNav() {
  return (
    <header className="hero-nav">
      <Link className="hero-nav__brand" to="/">
        <span className="hero-nav__logo" aria-hidden="true" />
        Pelusas
      </Link>
      <nav className="hero-nav__links" aria-label="Principal">
        <Link className="hero-nav__pill" to="/">Inicio</Link>
        <Link className="hero-nav__pill" to="/history">Historial</Link>
        <a className="hero-nav__pill" href="#como-se-juega">Cómo se juega</a>
      </nav>
      <button className="hero-nav__sound" type="button" aria-pressed="false" aria-label="Sonido">
        <span aria-hidden="true">♪</span>
      </button>
    </header>
  )
}
