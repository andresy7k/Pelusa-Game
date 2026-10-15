import { HeroStage } from '../features/hero/HeroStage';

// El hero (humo, navbar, textos, carrusel y preloader) reemplaza a la entrada
// vieja HomeEntrance, ya retirada. "Cómo se juega" queda debajo del hero.
export function Home() {
  return (
    <main>
      <HeroStage />
      <div className="page home">
        <section className="howto" id="como-se-juega" aria-label="Cómo se juega">
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
      </div>
    </main>
  );
}
