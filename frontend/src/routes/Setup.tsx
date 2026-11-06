import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { recall, remember } from '../api/identity';
import { ApiException, friendlyMessage, type GameState } from '../api/types';
import { Avatar, AvatarPicker, avatarOf } from '../components/Avatar';

// Setup con dos caminos:
// - "Un dispositivo" (hotseat): los nombres se cargan acá y la UI hace de todos.
// - "Online": se abre una sala con código o se entra con uno. El lobby se
//   refresca solo (polling 2 s) y muestra quiénes van entrando; el host decide
//   cuándo empezar. El enlace compartible es /setup?code=CODIGO.
// Rutas de esta pantalla:
//   /setup              → elegir modo (hotseat u online)
//   /setup?code=ABC234  → unirse con el código precargado
//   /setup?game=<uuid>  → lobby de esa sala (reload-safe vía localStorage)
export function Setup() {
  const [search] = useSearchParams();
  // Mientras se escriben los nombres, se baja en segundo plano el código del
  // tablero: al tocar "Crear y empezar" ya está listo y no hay espera extra.
  useEffect(() => {
    void import('./Board');
  }, []);
  const gameId = search.get('game');
  const codeParam = search.get('code') ?? '';

  if (gameId) return <Lobby gameId={gameId} />;
  const startOnline = codeParam !== '' || search.get('modo') === 'online';
  return <Chooser initialMode={startOnline ? 'online' : 'local'} initialCode={codeParam} />;
}

type Mode = 'local' | 'online';

function Chooser({ initialMode, initialCode }: { initialMode: Mode; initialCode: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <main className="page narrow">
      <p className="kicker">Mesa nueva</p>
      <h1>¿Cómo juegan?</h1>
      <div className="mode-tabs" role="tablist" aria-label="Modo de juego">
        <button
          type="button"
          role="tab"
          className="ghost"
          aria-selected={mode === 'local'}
          onClick={() => setMode('local')}
        >
          Un dispositivo
        </button>
        <button
          type="button"
          role="tab"
          className="ghost"
          aria-selected={mode === 'online'}
          onClick={() => setMode('online')}
        >
          Online
        </button>
      </div>
      {mode === 'local' ? <LocalSetup /> : <OnlineSetup initialCode={initialCode} />}
    </main>
  );
}

// Hotseat: primero cuántos juegan (2-6), después un campo por jugador.
// Nada de comas: cada nombre tiene su campo, su label y su validación visible.
function LocalSetup() {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(['', '']);
  // Monstruo de cada jugador: arranca distinto por asiento (1, 2, 3…).
  const [avatars, setAvatars] = useState<number[]>([1, 2]);
  // Fila con el selector abierto (uno a la vez: la lista no se vuelve eterna).
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function changeCount(next: number) {
    const n = Math.min(6, Math.max(2, next));
    setCount(n);
    setNames((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ''));
    // Los que entran reciben el primer monstruo que nadie tiene.
    setAvatars((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) {
        next.push([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((v) => !next.includes(v)) ?? 1);
      }
      return next;
    });
    setPicking((p) => (p !== null && p >= n ? null : p));
  }

  // Elegir uno que ya tiene otro: se intercambian (nunca dos iguales en la mesa).
  function pickAvatar(i: number, v: number) {
    setAvatars((prev) => {
      const next = [...prev];
      const j = next.indexOf(v);
      if (j >= 0 && j !== i) next[j] = next[i];
      next[i] = v;
      return next;
    });
  }

  function setName(i: number, value: string) {
    setNames((prev) => prev.map((n, j) => (j === i ? value : n)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const list = names.map((n) => n.trim());
    if (list.some((n) => n.length === 0)) {
      setError('Falta el nombre de algún jugador.');
      return;
    }
    if (new Set(list).size !== list.length) {
      setError('Los nombres no pueden repetirse.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Un solo request: el backend la crea ya iniciada. El estado viaja con la
      // navegación para que el tablero se pinte sin volver a pedirlo.
      // Quién empieza lo sortea el backend (firstPlayerIndex = null).
      const game = await api.create(list, null, true, avatars);
      navigate(`/game/${game.id}`, { state: { game } });
    } catch (err) {
      setError(err instanceof ApiException ? friendlyMessage(err.apiError.errorCode) : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="kicker">Paso 1 de 2</p>
      <h2>¿Cuántos juegan?</h2>
      <div className="stepper" role="group" aria-label="Cantidad de jugadores">
        <button type="button" className="ghost" onClick={() => changeCount(count - 1)} disabled={count <= 2}>
          −
        </button>
        <span className="stepper-count" aria-live="polite">
          {count}
        </span>
        <button type="button" className="ghost" onClick={() => changeCount(count + 1)} disabled={count >= 6}>
          +
        </button>
      </div>

      <p className="kicker">Paso 2 de 2 · nombres y monstruos</p>
      <form onSubmit={submit} className="panel">
        {names.map((n, i) => {
          const taken: Record<number, string> = {};
          avatars.forEach((v, j) => {
            if (j !== i) taken[v] = names[j].trim() || `Jugador ${j + 1}`;
          });
          const open = picking === i;
          return (
            <div key={i} className="player-row">
              <div className="player-row-main">
                <button
                  type="button"
                  className="avatar-trigger"
                  aria-expanded={open}
                  aria-controls={`picker-${i}`}
                  aria-label={`Monstruo del jugador ${i + 1}: Pelusa ${avatars[i]}. Cambiar`}
                  onClick={() => setPicking(open ? null : i)}
                >
                  <Avatar value={avatars[i]} size="md" />
                  <span className="avatar-trigger-edit" aria-hidden="true">
                    ✎
                  </span>
                </button>
                <label>
                  Jugador {i + 1}
                  <input
                    value={n}
                    onChange={(e) => setName(i, e.target.value)}
                    placeholder={`Nombre del jugador ${i + 1}`}
                    maxLength={60}
                    autoFocus={i === 0}
                  />
                </label>
              </div>
              {open && (
                <div id={`picker-${i}`} className="player-row-picker">
                  <AvatarPicker
                    legend={`Monstruo del jugador ${i + 1}`}
                    value={avatars[i]}
                    takenBy={taken}
                    onChange={(v) => {
                      pickAvatar(i, v);
                      setPicking(null);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        <p className="hint">Tocá el monstruo para cambiarlo: será tu personaje en la mesa.</p>
        <p className="hint">Quién empieza se decide por sorteo al repartir.</p>
        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Repartiendo…' : 'Crear y empezar'}
          </button>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function OnlineSetup({ initialCode }: { initialCode: string }) {
  const navigate = useNavigate();
  // Si llego con ?code=..., lo más probable es que venga a unirme.
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [capacity, setCapacity] = useState(4);
  // null = "el primero libre" (lo decide el servidor al sentarte).
  const [avatar, setAvatar] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Poné tu nombre.');
      return;
    }
    if (tab === 'join' && code.trim().length < 4) {
      setError('Escribí el código de la sala.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (tab === 'join') {
        const r = await api.join(code.trim().toUpperCase(), clean, avatar);
        if (r.spectator) {
          // La partida ya empezó: se mira, no se juega.
          navigate(`/game/${r.game.id}`, { state: { game: r.game } });
          return;
        }
        if (!r.playerId) throw new Error('sin playerId');
        remember(r.game.id, { playerId: r.playerId, name: clean, token: r.playerToken ?? undefined });
        navigate(`/setup?game=${r.game.id}`);
      } else {
        const r = await api.createOnline(clean, capacity, avatar);
        if (!r.playerId) throw new Error('sin playerId');
        remember(r.game.id, { playerId: r.playerId, name: clean, token: r.playerToken ?? undefined });
        navigate(`/setup?game=${r.game.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiException ? err.apiError.errorCode : 'UNKNOWN');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel">
      <div className="mode-tabs" role="tablist" aria-label="Sala online">
        <button
          type="button"
          role="tab"
          className="ghost"
          aria-selected={tab === 'join'}
          onClick={() => setTab('join')}
        >
          Unirme con código
        </button>
        <button
          type="button"
          role="tab"
          className="ghost"
          aria-selected={tab === 'create'}
          onClick={() => setTab('create')}
        >
          Crear sala
        </button>
      </div>

      <label>
        Tu nombre
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ana"
          maxLength={60}
          autoFocus
        />
      </label>

      <div className="online-avatar">
        <p className="kicker">Tu monstruo</p>
        <AvatarPicker legend="Tu monstruo" value={avatar} onChange={setAvatar} />
        <p className="hint">{avatar ? `Elegiste la Pelusa ${avatar}.` : 'Si no elegís, te toca el primero libre.'}</p>
      </div>

      {tab === 'join' ? (
        <label>
          Código de la sala
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC234"
            maxLength={12}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </label>
      ) : (
        <>
          <p className="kicker">Cupo máximo</p>
          <div className="stepper" role="group" aria-label="Cupo de la sala">
            <button
              type="button"
              className="ghost"
              onClick={() => setCapacity((c) => Math.max(2, c - 1))}
              disabled={capacity <= 2}
            >
              −
            </button>
            <span className="stepper-count" aria-live="polite">
              {capacity}
            </span>
            <button
              type="button"
              className="ghost"
              onClick={() => setCapacity((c) => Math.min(6, c + 1))}
              disabled={capacity >= 6}
            >
              +
            </button>
          </div>
        </>
      )}

      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Conectando…' : tab === 'join' ? 'Entrar a la mesa' : 'Crear sala'}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {friendlyMessage(error)}
        </p>
      )}
      <p className="hint">Sin cuentas: el código es la invitación. Quien llega tarde mira como espectador.</p>
    </form>
  );
}

// Lobby: polling cada 2 s; cuando el host arranca (o si ya empezó), todos
// saltan solos al tablero. Recargar la página no pierde la silla porque el
// playerId vive en localStorage con la clave del id de partida.
function Lobby({ gameId }: { gameId: string }) {
  const navigate = useNavigate();
  const me = useMemo(() => recall(gameId), [gameId]);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const next = await api.state(gameId);
        if (!alive) return;
        setState(next);
        setError(null);
        if (next.status !== 'CREATED') navigate(`/game/${gameId}`, { state: { game: next } });
      } catch (err) {
        if (alive && err instanceof ApiException) setError(err.apiError.errorCode);
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      if (!document.hidden) void tick();
    }, 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [gameId, navigate]);

  const code = state?.code ?? '';
  const link = code ? `${window.location.origin}/setup?code=${code}` : '';
  const isHost = me !== null && state?.hostPlayerId === me.playerId;
  const count = state?.players.length ?? 0;
  const capacity = state?.capacity ?? 0;

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('No se pudo copiar: seleccioná el enlace a mano.');
    }
  }

  async function start() {
    if (!me) return;
    setBusy(true);
    setError(null);
    try {
      const game = await api.start(gameId, me.playerId);
      navigate(`/game/${gameId}`, { state: { game } });
    } catch (err) {
      setError(err instanceof ApiException ? err.apiError.errorCode : 'UNKNOWN');
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    // Sin silla guardada: primero esperamos la respuesta para conocer el
    // código y ofrecer el enlace de invitación (evita el falso "no estás").
    if (!state && !error) {
      return (
        <main className="page narrow">
          <p className="kicker">Sala online</p>
          <h1>Cargando sala…</h1>
        </main>
      );
    }
    return (
      <main className="page narrow">
        <p className="kicker">Sala online</p>
        <h1>No estás en esta sala</h1>
        <p>Este navegador no tiene una silla en esta mesa. Abrí el enlace de invitación que te compartieron.</p>
        {code && (
          <p>
            <Link className="btn-primary" to={`/setup?code=${code}`}>
              Unirme con el código {code}
            </Link>
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {friendlyMessage(error)}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="page narrow">
      <p className="kicker">Sala online · esperando jugadores</p>
      <h1>Sala abierta</h1>

      <section className="panel">
        <p className="room-code" aria-label={`Código de la sala ${code}`}>
          {code || '······'}
        </p>
        <div className="room-link">
          <code>{link || 'Generando enlace…'}</code>
          <button type="button" className="ghost" onClick={copyLink} disabled={!link}>
            {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
        </div>

        <p className="kicker">
          Jugadores ({count}/{capacity || '…'})
        </p>
        <ul className="lobby-list">
          {state?.players.map((p) => (
            <li key={p.id}>
              <span className="lobby-who">
                <Avatar value={avatarOf(p)} size="sm" />
                {p.name}
                {p.id === me.playerId ? ' (vos)' : ''}
              </span>
              <span className="who">{p.id === state.hostPlayerId ? 'anfitrión' : `silla ${p.seat + 1}`}</span>
            </li>
          ))}
          {state && state.players.length < 2 && (
            <li>
              <span className="who">Falta al menos otra persona para poder empezar.</span>
            </li>
          )}
        </ul>

        {isHost ? (
          <div className="actions">
            <button type="button" className="primary" onClick={start} disabled={busy || count < 2}>
              {busy ? 'Empezando…' : 'Empezar partida'}
            </button>
          </div>
        ) : (
          <p className="hint" role="status">
            Esperando que el anfitrión empiece…
          </p>
        )}
        <p className="hint">Esta pantalla se actualiza sola: no hace falta recargar.</p>
      </section>

      {error && (
        <p className="error" role="alert">
          {friendlyMessage(error)}
        </p>
      )}
    </main>
  );
}
