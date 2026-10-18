// frontend/src/features/mesa3d/config.ts
// Fuente única de verdad de la mesa 3D (paso 2: mesa + lámpara + cámara
// fija). Dimensiones, paleta muestreada del render 2D real, luces, cámara y
// texturas: todo lo que se pueda afinar vive acá (cero números visuales
// sueltos en los componentes).

export type MesaCameraPreset = 'seat' | 'wide' | 'top' | 'detail'

export const MESA_CAMERA_PRESETS: MesaCameraPreset[] = ['seat', 'wide', 'top', 'detail']

export const MESA3D = {
  /** Mesa oval 2:1 (4.4 × 2.2 unidades). La superficie de juego está en y = 0. */
  table: {
    rx: 2.19,
    ry: 1.15,
    rim: { width: 0.26, height: 0.13 }, // cenefa de madera (~12% del radio menor)
    fillet: { width: 0.022, height: 0.045 }, // filete ámbar entre fieltro y cenefa
    pedestal: { rTop: 0.95, rBottom: 1.25, height: 0.85 },
  },
  /** Hex muestreados pixel a pixel del render 2D actual (no de memoria). */
  colors: {
    void: '#07051A', // fondo del vacío (la sala llega en el paso 3)
    feltEdge: '#150F2B',
    feltMid: '#2E214F',
    feltLit: '#37285C',
    strandDark: '#140E28',
    strandLight: '#6E57A8',
    thread: '#8A76C8', // hilo lila de las costuras
    threadAmber: '#EFA831',
    wood: '#180D1E',
    woodDark: '#120A1C',
    amber: '#EFA831',
    parchment: '#F2E7D4',
    ambient: '#3A2A66',
    hemisphereSky: '#4A3677',
    hemisphereGround: '#120C24',
    lamp: '#FFD9A8',
    shade: '#2A1936',
    shadeGlow: '#241433',
    bulb: '#FFE3B8',
    rimViolet: '#C026D3',
    rimIndigo: '#6D4AFF',
  },
  felt: {
    /** La textura se cachea por cantidad de jugadores (cambian los "nidos"). */
    size: [4096, 2048] as [number, number],
    strands: 60000, // hebras de pelaje
    whorlEye: 0.34, // radio (unidades) del ojo del remolino: ahí irá el mazo
    hemRadius: 0.44, // radio de la costura alrededor del ojo
  },
  seats: {
    /** El local es el asiento 0, SIEMPRE abajo (frente a la cámara); el resto
     *  reparte en sentido horario visto desde arriba. */
    startAngle: Math.PI / 2,
    rx: 1.5, // semieje x del anillo de asientos
    rz: 0.65, // semieje z (más chico: la mesa es 2:1)
    nido: 0.42, // radio del nido aplastado/cosido de cada asiento
  },
  /** Etiqueta de tela cosida del "juguete" (lado lejano, corrida para no
   *  pisar el nido del asiento de arriba). */
  label: { x: 1.05, z: -0.5, rot: -0.08 },
  /** Cartas 3D (paso 5): objeto de 5:7 con esquinas redondeadas y grosor de
   *  juguete; el mazo vive en el ojo del remolino y cada frente se despliega
   *  sobre su nido. Unidades de mundo (la mesa mide 4.4 de ancho). */
  cards: {
    size: { w: 0.15, h: 0.21, t: 0.0085, cornerR: 0.018 },
    baseY: 0.0095, // altura de reposo (fieltro en 0.004 + medio grosor)
    deck: {
      total: 110, // mazo completo (13× valores 1-5 + 9× valores 6-10, DeckFactory)
      maxPile: 26, // cartas visibles del montón (la pileza baja con el conteo)
      step: 0.0105, // separación entre cartas del mazo
      jitterXZ: 0.013,
      rotJitter: 0.09,
      /** Chip flotante con las cartas restantes (paridad con .deck-count 2D). */
      countChip: { x: -0.3, y: 0.13, z: 0.16 },
    },
    /** Vuelo mazo→jugador en 3D (espejo del FlightLayer 2D: 0.55s inOut). */
    flight: { dur: 0.55, lift: 0.36 },
    fronts: {
      perRow: 4, // filas de a 4 con leve solape (nunca pila)
      spacing: 0.115,
      rowGap: 0.235, // entre filas, hacia el centro
      fan: 1.2, // abanico: rad por unidad de desplazamiento
      jitterZ: 0.007,
    },
    turnRing: { inner: 0.47, outer: 0.545, y: 0.005 }, // aro ámbar del turno
    hoverLift: 0.03,
  },
  /** Sillas de cuero (paso 6): anillo FUERA de la cenefa (la mesa llega a
   *  ~2.48/1.38; las sillas se apoyan contra ese borde sin meterse) y asiento
   *  alto para que los personajes miren por encima del rim. */
  chairs: {
    rx: 3.15,
    rz: 1.98,
    seat: { r: 0.33, top: -0.05, thickness: 0.16 },
    back: { r: 0.36, inner: 0.305, top: 0.42, arc: 2.4 },
    column: { rTop: 0.05, rBottom: 0.065, top: -0.21, bottom: -0.94 },
    base: { r: 0.3, rBottom: 0.34, h: 0.05 },
    colors: { leather: '#4A2E7E', wine: '#6E2145', column: '#5C1F35', base: '#170E28' },
  },
  /** Jugadores (paso 6): un monstruo R3F por asiento (roster determinista,
   *  el anfitrión vive aparte) + la Pelusa 10 rosa como crupier diminuto
   *  junto al mazo. LOD lite: 7 personajes a 60fps. */
  players: {
    roster: [1, 2, 3, 4, 5, 6],
    quality: 'lite',
    host: { monster: 10, x: -0.62, z: -0.05, rot: 0.35, scale: 0.5 },
    /** Chapa de nombre (sprite con canvas) flotando sobre cada sentado;
     *  lift 0.18 libre para pelos/cuernos de los monstruos. */
    namePlate: { h: 0.14, lift: 0.18 },
  },
  /** Sala cerrada (paso 3): tapiz, alfombra, friso, columnas, cuadros y
   *  apliques. Ángulos en radianes (0 = +x; el fondo de la escena es -z). */
  room: {
    radius: 6.2,
    floorY: -0.99,
    wallTop: 6.4,
    carpetRadius: 7.6,
    stone: '#241C38',
    damask: { repeatX: 16, repeatY: 3 },
    frieze: { y: 4.25, tube: 0.09 },
    /** Apliques en las cuatro esquinas (45/135/225/315°). Altura baja para
     *  que entren en cuadro con los presets (miran mucho hacia la mesa). */
    sconces: {
      radius: 6.08,
      y: 2.1,
      angles: [Math.PI / 4, (Math.PI * 3) / 4, (Math.PI * 5) / 4, (Math.PI * 7) / 4],
      intensity: 3.2,
      distance: 7.5,
      bulb: 0.085,
    },
    /** Columnas flanqueando el fondo (232° y 308°). */
    columns: {
      radius: 5.75,
      half: 0.24,
      angles: [4.05, 5.38],
    },
    /** Cuadros del fondo (255°, 270°, 285°). */
    pictures: {
      radius: 6.02,
      y: 1.5,
      angles: [(Math.PI * 17) / 12, (Math.PI * 3) / 2, (Math.PI * 19) / 12],
      frame: [1.34, 1.04, 0.07] as const,
      canvas: [1.12, 0.86] as const,
    },
    /** Brillo propio: la sala está a oscuras y sin esto no se lee en cámara. */
    glow: {
      wall: { color: '#8A78D0', intensity: 0.45 },
      carpet: { color: '#5A4A90', intensity: 0.3 },
      painting: { color: '#B0A0E0', intensity: 0.85 },
    },
  },
  camera: {
    fov: 42,
    near: 0.1,
    far: 80,
    presets: {
      seat: { pos: [0, 3.2, 2.6] as const, target: [0, 0, 0.1] as const },
      wide: { pos: [0, 5.3, 5.8] as const, target: [0, 1.15, -0.9] as const },
      top: { pos: [0, 6.2, 3.0] as const, target: [0, 0, 0] as const },
      detail: { pos: [1.0, 1.8, 1.2] as const, target: [-0.15, 0, -0.6] as const },
    },
    /** Cámara libre (paso 4): límites de órbita/zoom/pan y duración del
     *  travelling entre vistas. */
    controls: {
      minDistance: 2.2,
      maxDistance: 7,
      minPolarAngle: 0.05, // casi en picada (cenital)
      maxPolarAngle: 1.05, // elevación mínima ≈30° sobre la mesa
      panLimit: 1.2,
      tweenMs: 900,
    },
  },
  lamp: {
    y: 2.85, // altura del foco de luz (la pantalla queda encima)
    shade: { rTop: 0.16, rBottom: 0.54, height: 0.52 },
    spot: {
      angle: 0.66,
      penumbra: 0.55,
      intensity: 34,
      decay: 1.6,
      distance: 10,
      shadows: 2048,
    },
    cone: { rBottom: 1.4, h: 2.35, opacity: 0.05 },
    cableTop: 4.4,
  },
  lights: {
    ambient: 0.3,
    hemisphere: 0.55,
    fill: { pos: [-4, 2.2, 3.5] as const, color: '#6D4AFF', intensity: 0.45 },
    rim: { pos: [3.2, 2.4, -4] as const, color: '#C026D3', intensity: 0.7 },
  },
  exposure: 1.2,
} as const

/** Ángulo (rad) del asiento `i` de `n` en el anillo de asientos. */
export function seatAngle(i: number, n: number): number {
  return MESA3D.seats.startAngle - (i * Math.PI * 2) / n
}

/** Posición (unidades de mundo, x/z) del asiento `i` de `n` jugadores. */
export function seatPoint(i: number, n: number): { x: number; z: number } {
  const a = seatAngle(i, n)
  return { x: Math.cos(a) * MESA3D.seats.rx, z: Math.sin(a) * MESA3D.seats.rz }
}
