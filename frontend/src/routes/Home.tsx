import { HeroStage } from '../features/hero/HeroStage';

// El hero (humo, navbar, textos, carrusel y preloader) reemplaza a la entrada
// vieja HomeEntrance, ya retirada. "Cómo se juega" queda debajo del hero.
export function Home() {
  return (
    <main>
      <HeroStage />
      <div className="page home">
        <section className="howto" id="como-se-juega">
          <h2 className="howto-title">Cómo se juega</h2>
          <div>
            <strong>1 · Sacá</strong>
            <p>Sacá una carta del mazo. <span className="howto-hl howto-hl--red">Cuidado</span>, si tenes 2 o más y la siguiente es repetida, <span className="howto-hl howto-hl--red">perdiste</span>, te ganó la avaricia.</p>
          </div>
          <div>
            <strong>2 · Guardá</strong>
            <p>Al empezar tu turno guardá las cartas que no te robaron. <span className="howto-hl howto-hl--amber">Guardá</span> antes de pedir. </p>
          </div>
          <div>
            <strong>3 · Robá</strong>
            <p>¿Sacaste una carta y cualquiera de tus rivales tiene una del mismo valor? <span className="howto-hl howto-hl--amber">Podes robarla</span>, es toda tuya.</p>
          </div>
          <div>
            <strong>4 · Ganá</strong>
            <p>Se acaba el mazo, <span className="howto-hl howto-hl--green">gana</span> quien más sume con lo que guardó.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
