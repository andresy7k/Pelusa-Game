// frontend/src/features/hero/HeroNav.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isSoundEnabled, toggleSound } from './sound'

export function HeroNav() {
  // Estado inicial desde la preferencia persistida (apagado por defecto).
  const [sonido, setSonido] = useState(() => isSoundEnabled())
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
      <button
        className="hero-nav__sound"
        type="button"
        aria-pressed={sonido}
        aria-label="Sonido"
        onClick={() => setSonido(toggleSound())}
      >
        <span aria-hidden="true" hidden={!sonido}>
          ♪
        </span>
        <span aria-hidden="true" hidden={sonido}>
          ♪̶
        </span>
      </button>
    </header>
  )
}
