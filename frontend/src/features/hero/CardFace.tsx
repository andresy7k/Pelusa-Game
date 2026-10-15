// frontend/src/features/hero/CardFace.tsx
// Carta del hero: acuarela con manchas, número con contorno sticker y leve
// rotación, y el monstruo PINTADO (fallback sin WebGL y bajo el 3D).
import { HERO, type HeroValue } from './config'
import { MonsterFace } from '../../components/MonsterFace'
import './CardFace.css'

export function CardFace({ value, active }: { value: HeroValue; active: boolean }) {
  const d = HERO.cards[value]
  return (
    <div
      className={`card-face${active ? ' card-face--active' : ''}`}
      style={{
        ['--c-bg' as string]: d.bg,
        ['--c-num' as string]: d.num,
        ['--c-monster' as string]: d.monster,
        ['--c-tilt' as string]: `${d.numTilt}deg`,
      }}
      data-v={value}
    >
      {/* data-v: el ::after repite el número con content: attr(data-v) */}
      <span className="card-face__num" data-v={value} aria-hidden="true">{value}</span>
      <div className="card-face__monster" aria-hidden="true">
        <MonsterFace value={value} />
      </div>
      {active && <span className="card-face__rings" aria-hidden="true" />}
    </div>
  )
}
