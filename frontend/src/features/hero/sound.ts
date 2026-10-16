// frontend/src/features/hero/sound.ts
// Sonidos sintetizados (sin archivos): hover, clic, selección y especial.
// Off por defecto; preferencia persistida. Nunca lanza: el audio jamás
// bloquea la UI.
const KEY = 'pelusa.hero.sound'

// Lectura protegida (navegación privada): si falla, arranca apagado,
// coherente con `HERO.sound.enabledByDefault = false`.
function leerPreferencia(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

let ctx: AudioContext | null = null
let enabled = leerPreferencia()

export function isSoundEnabled(): boolean { return enabled }
export function toggleSound(): boolean {
  enabled = !enabled
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off')
  } catch {
    // Sin almacenamiento (modo privado): la sesión sigue con sonido en
    // memoria, simplemente no persiste.
  }
  return enabled
}

const SPECS: Record<string, { f: number; d: number; type: OscillatorType; gain: number }> = {
  hover: { f: 880, d: 0.05, type: 'sine', gain: 0.02 },
  click: { f: 520, d: 0.09, type: 'triangle', gain: 0.05 },
  select: { f: 660, d: 0.16, type: 'sine', gain: 0.06 },
  special: { f: 440, d: 0.3, type: 'sawtooth', gain: 0.03 },
}

export function play(kind: keyof typeof SPECS): void {
  if (!enabled) return
  try {
    if (ctx === null) ctx = new AudioContext()
    // Sin gesto del usuario el navegador deja el contexto suspendido (el
    // hover no cuenta como activación): se intenta reanudar y, si sigue sin
    // correr, se salta en silencio. El primer clic lo desbloquea y desde ahí
    // suenan también los hovers.
    if (ctx.state === 'suspended') void ctx.resume()
    if (ctx.state !== 'running') return
    const s = SPECS[kind]
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = s.type
    osc.frequency.setValueAtTime(s.f, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(s.f * 1.6, ctx.currentTime + s.d)
    g.gain.setValueAtTime(s.gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + s.d)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + s.d)
  } catch { /* silencio total, por diseño */ }
}
