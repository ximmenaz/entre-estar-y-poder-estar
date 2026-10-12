'use strict';

// Archivos disponibles en audio/. Añade aquí nuevas grabaciones con rutas relativas.
const sounds = [
  "audio/Fierro-viejo.mp3",
  "audio/metrobus.mp3",
  "audio/mundial-mexico.mp3",
  "audio/musica-calle.mp3",
  "audio/pan-bici.mp3",
  "audio/paseo-parque.mp3",
  "audio/RioLerma.mp3",
  "audio/vendedor-paca.mp3",
  "audio/venta-mercado.mp3",
  "audio/venta-metro.mp3"
];
const colors = ['yellow', 'orange', 'pink', 'aqua', 'red', 'purple'];
const EXPERIENCE_MS = 7000;
const State = Object.freeze({ IDLE: 'IDLE', HOLDING: 'HOLDING', COMPLETED_WAITING_RELEASE: 'COMPLETED_WAITING_RELEASE', READY_AGAIN: 'READY_AGAIN' });
let state = State.IDLE;
const button = document.querySelector('.sound-button');
const status = document.querySelector('#status');
const instructions = document.querySelector('#instructions');
const progress = document.querySelector('.progress-trace');
const root = document.documentElement;
const initialMessage = 'Mantén presionado para escuchar un sonido de la alcaldía Cuauhtémoc.';
let colorIndex = 4;
let lastSound = -1;
let selectedSound = -1;
let press = null;
let player = null;
let frame = 0;
let experienceTimer;
let startedAt = 0;
let previousTime = 0;
let activeRoutes = [];
let routeNumber = 0;

function setMessage(message) {
  instructions.textContent = message;
}
function setProgress(fraction) {
  progress.style.strokeDashoffset = 100 * (1 - fraction);
}

// Los trazos quedan en los márgenes para conservar la legibilidad del título.
const paths = [
  'M-20 62 225 147 430 -10', 'M550 -10 665 115 701 210 820 180 960 380',
  'M140 112 23 505 123 600 38 830 168 930 0 1166',
  'M960 380 780 727 888 777 960 823',
  'M-20 1250 148 1327 296 1495 298 1549 390 1550 465 1685',
  'M950 1335 846 1318 690 1680', 'M140 0 334 251',
  'M463 185 Q610 158 676 154 T960 86',
  'M108 646 220 884', 'M889 780 745 1075 761 1038 956 970',
  'M-12 1470 171 1345 135 1510 289 1590 340 1685',
  'M950 1055 817 1126 782 1344', 'M520 1680 667 1450 950 1545',
  'M-15 1470 159 1670', 'M807 1405 950 1463', 'M165 930 264 978',
  'M-30 220 72 253 104 363 52 438 -20 464',
  'M960 242 867 287 900 396 846 471 970 510',
  'M-20 1030 Q95 1000 100 1120 T44 1260 L-20 1310',
  'M970 880 864 928 899 1032 837 1103 967 1140',
  'M245 -20 290 68 453 97 511 186 585 219',
  'M-20 1590 64 1535 187 1578 230 1700',
  'M980 1595 867 1554 808 1632 724 1688',
  'M960 650 Q873 611 856 698 T811 858',
  'M-20 720 64 759 27 870 112 935',
  'M520 1690 467 1591 526 1515 491 1450 555 1385',
  'M742 -20 791 80 873 106 956 36',
  'M-20 1194 83 1239 133 1324 89 1401 166 1463'
];
const svgNS = 'http://www.w3.org/2000/svg';
function svgElement(name, attributes) {
  const element = document.createElementNS(svgNS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}
function createRoute(seedIndex = null) {
  // Continúa acumulando recorridos con pequeñas variaciones al terminar la serie.
  const index = seedIndex === null ? routeNumber++ : seedIndex;
  const d = paths[index % paths.length];
  const shift = Math.floor(index / paths.length) * 13;
  const transform = `translate(${shift % 65} ${-(shift % 91)})`;
  const mask = svgElement('mask', { id: `${seedIndex === null ? "route" : "seed"}-${index}`, maskUnits: 'userSpaceOnUse', x: -100, y: -100, width: 1200, height: 2000 });
  const reveal = svgElement('path', { d, transform, fill: 'none', stroke: 'white', 'stroke-width': 8 });
  mask.append(reveal);
  document.querySelector('#route-masks').append(mask);
  const line = svgElement('path', { d, transform, fill: 'none', stroke: getComputedStyle(root).getPropertyValue(`--${colors[index % 6]}`).trim(), 'stroke-width': index % 3 === 0 ? 2.8 : 2, 'stroke-linecap': 'round', opacity: seedIndex === null ? .34 : .16, mask: `url(#${seedIndex === null ? "route" : "seed"}-${index})` });
  if (index % 3) line.setAttribute('stroke-dasharray', index % 3 === 1 ? '10 13' : '3 12');
  document.querySelector('#routes').append(line);
  const length = reveal.getTotalLength();
  reveal.style.strokeDasharray = `${length} ${length}`;
  reveal.style.strokeDashoffset = length;
  return { reveal, length, progress: 0 };
}
// Fragmentos abiertos sugieren el territorio antes de la primera escucha.
// Distribuidos arriba, abajo y a ambos lados; nunca una red completa inicial.
for (const index of [0, 1, 2, 3, 4, 5, 10, 12]) {
  const seed = createRoute(index);
  seed.reveal.style.strokeDashoffset = seed.length * .56;
}

function growTerritory(elapsed) {
  // Cuatro recorridos a la vez: cada grupo requiere 6,8 s de escucha efectiva.
  // Las cancelaciones conservan tanto los trazos como su avance pendiente.
  if (!activeRoutes.length) {
    activeRoutes = Array.from({ length: 4 }, () => createRoute());
  }
  for (const route of activeRoutes) {
    route.progress = Math.min(route.length, route.progress + route.length * elapsed / 6800);
    route.reveal.style.strokeDashoffset = route.length - route.progress;
  }
  if (activeRoutes.every(route => route.progress >= route.length)) activeRoutes = [];
}
function draw(time) {
  if (state !== State.HOLDING) return;
  const fraction = Math.min((time - startedAt) / EXPERIENCE_MS, 1);
  setProgress(fraction);
  const elapsed = Math.min(time - previousTime, 80);
  previousTime = time;
  growTerritory(elapsed);
  if (fraction >= 1) completeExperience();
  else frame = requestAnimationFrame(draw);
}
function stopAudio() {
  if (!player) return;
  const audio = player;
  player = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}
function stopActivity() {
  clearTimeout(experienceTimer);
  cancelAnimationFrame(frame);
  stopAudio();
  button.classList.remove('is-holding');
}
function completeExperience() {
  if (state !== State.HOLDING) return;
  stopActivity();
  setProgress(1);
  state = State.COMPLETED_WAITING_RELEASE;
  lastSound = selectedSound;
  setMessage('Ya puedes dejar de pulsar.');
}
function begin(source, id) {
  if (press || (state !== State.IDLE && state !== State.READY_AGAIN)) return;
  // Una cancelación reinicia el mismo fragmento; solo completar habilita otro.
  if (selectedSound < 0 || state === State.READY_AGAIN) {
    if (state === State.READY_AGAIN) colorIndex = (colorIndex + 1) % colors.length;
    const candidates = sounds.map((_, index) => index).filter(index => sounds.length === 1 || index !== lastSound);
    selectedSound = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : -1;
    root.style.setProperty('--accent', `var(--${colors[colorIndex]})`);
  }
  press = { source, id };
  state = State.HOLDING;
  status.textContent = '';
  setMessage('Continúa presionando…');
  setProgress(0);
  button.classList.add('is-holding');
  startedAt = performance.now();
  previousTime = startedAt;
  experienceTimer = setTimeout(completeExperience, EXPERIENCE_MS);
  frame = requestAnimationFrame(draw);
  if (selectedSound < 0) {
    status.textContent = 'Aún no hay sonidos disponibles.';
    return;
  }
  const audio = new Audio(sounds[selectedSound]);
  player = audio;
  audio.loop = false;
  const reportError = () => {
    if (player === audio && state === State.HOLDING) status.textContent = 'No pudimos reproducir este sonido.';
  };
  audio.addEventListener('error', reportError, { once: true });
  // play ocurre directamente en el gesto para permitir audio en móviles.
  audio.play().catch(reportError);
}
function finish(cancelled = false) {
  if (!press) return;
  if (!cancelled && state === State.HOLDING && performance.now() - startedAt >= EXPERIENCE_MS) completeExperience();
  press = null;
  if (state === State.COMPLETED_WAITING_RELEASE) {
    state = State.READY_AGAIN;
    setMessage('Vuelve a pulsar para escuchar otro sonido.');
    // El anillo completo permanece hasta la siguiente pulsación.
  } else {
    stopActivity();
    state = State.IDLE;
    setProgress(0);
    status.textContent = '';
    setMessage(initialMessage);
  }
}
button.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || press) return;
  event.preventDefault();
  button.focus({ preventScroll: true });
  button.setPointerCapture(event.pointerId);
  begin('pointer', event.pointerId);
});
button.addEventListener('pointerup', event => {
  if (press?.source === 'pointer' && press.id === event.pointerId) finish();
});
for (const type of ['pointercancel', 'lostpointercapture']) {
  button.addEventListener(type, event => {
    if (press?.source === 'pointer' && press.id === event.pointerId) finish(true);
  });
}
button.addEventListener('keydown', event => {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  event.preventDefault();
  if (!event.repeat) begin('keyboard', event.key);
});
button.addEventListener('keyup', event => {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  event.preventDefault();
  if (press?.source === 'keyboard' && press.id === event.key) finish();
});
button.addEventListener('contextmenu', event => event.preventDefault());
button.addEventListener('blur', () => finish(true));
window.addEventListener('blur', () => finish(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) finish(true); });
