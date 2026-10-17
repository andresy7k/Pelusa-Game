// frontend/src/features/hero/HeroCopy.tsx
// Cada palabra del h1 va en su span (.hero-h1__w) para la intro escalonada.
import { Link } from 'react-router-dom'
import { HERO } from './config'

export function HeroCopy() {
  return (
    <div className="hero-copy">
      <p className="hero-badge">
        <span className="hero-badge__dot" aria-hidden="true">✦</span>
        <span className="hero-badge__gold">{HERO.copy.badgeGold}</span>
        <span className="hero-badge__white">{HERO.copy.badgeWhite}</span>
      </p>
      <h1 className="hero-h1">
        {HERO.copy.h1.map((line, i) => (
          <span className="hero-h1__line" key={i}>
            {line.split(' ').map((w, j) => (
              <span className="hero-h1__w" key={j}>{w}{' '}</span>
            ))}
          </span>
        ))}
      </h1>
      <p className="hero-sub">{HERO.copy.sub}</p>
      <nav className="hero-ctas" aria-label="Acciones">
        <Link className="btn-primary" to="/setup">{HERO.copy.ctaPrimary}</Link>
        <Link className="btn-ghost" to="/history">{HERO.copy.ctaGhost}</Link>
      </nav>
    </div>
  )
}
