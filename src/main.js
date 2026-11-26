import { Ridge } from './ridge/ridge.js';
import { PARAMS } from './ridge/params.js';
import { FrameRing } from './audio/frame-ring.js';
import { createCapture } from './audio/capture.js';
import { createDemo } from './audio/demo-source.js';
import { createIntro } from './ui/intro.js';
import { createPoster } from './ui/poster.js';
import { createStatus } from './ui/status.js';
import { createDiagnostics } from './ui/diagnostics.js';
import { createStage } from './scene/stage.js';
import { HistoryRows } from './scene/history-rows.js';
import { posterWidth } from './scene/view-math.js';
import { createRidgeMesh, WIDTH as ROW_WIDTH } from './scene/ridge-mesh.js';
import { createPanel } from './ui/panel.js';
import { OPENING_THEME, SETTINGS, decode, defaults, encode } from './settings.js';
import { THEMES, findTheme, findGradient } from './themes.js';

const BANDS = 64;
const WIDTH = BANDS * 2;
// A share that has been silent this long gets a hint, in ms.
const SILENT_HINT_MS = 4000;
// How long a notice about the link stays in the status line, in ms.
const LINK_NOTICE_MS = 2000;
// How long after the music starts the camera begins to drift, in ms.
const DRIFT_AFTER_MS = 600;
// How long the camera takes to return to the cover, in seconds.
const TO_COVER_SECONDS = 1.4;
// World height the cover allows for peaks above its back row, for the poster's shape.
const PEAK_ROOM = 1.5;

const $ = (id) => document.getElementById(id);
const canvas = $('ridge');
const query = new URLSearchParams(location.search);

// Sharing a tab with its sound exists only in Chromium browsers on a computer.
const brands = navigator.userAgentData ? navigator.userAgentData.brands : [];
const canShare =
  query.get('as') !== 'other' &&
  brands.some((entry) => entry.brand === 'Chromium') &&
  !navigator.userAgentData.mobile &&
  !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

const ring = new FrameRing(WIDTH);
const params = { ...PARAMS };
const ridge = new Ridge(params, BANDS);
let stage = null;
let mesh = null;
let panel = null;
// Every setting's value by name; changed only through set().
const values = defaults();
// What the ridge draws while nothing is shared.
const demo = createDemo(values, BANDS);
// Set when a change should show on the cover at once instead of row by row.
let refill = false;
// The look and view carried in the address after `#`.
const link = decode(location.hash.slice(1));
// A view from the link, waiting for the music to start: the cover has its own.
let linkView = link.view;
let optionsOpen = false;
// The introduction opens on its last step once a share has worked.
let hasShared = false;

const stats = { frames: 0, paints: 0, peak: 0, quietSince: null };

// What each source is called in the status line.
const LISTENING = {
  tab: 'Listening to a shared tab',
  screen: 'Listening to this computer’s sound',
  mic: 'Listening through the microphone',
  test: 'Playing the test signal',
};

// ---- modules -------------------------------------------------------------------------

// The capture needs a log before the panel that shows it exists.
const log = (text) => diagnostics.log(text);

const capture = createCapture({
  log,
  onEnded: () => end(),
  onFrames({ positions, levels, peak }) {
    const at = performance.now() / 1000;
    for (let f = 0; f < positions.length; f++) ring.push(positions[f], levels, f * WIDTH, at);
    stats.frames += positions.length;
    if (peak > stats.peak) stats.peak = peak;
  },
});
const intro = createIntro({ canShare, onStart: (route) => begin(route), onClose: () => toCover() });
const status = createStatus({ onStop: () => end() });
createPoster({ onPrompt: () => openIntro() });
const diagnostics = createDiagnostics({
  capture,
  onTestSignal: () => begin('test'),
  onStart: (route) => begin(route),
  onStop: () => end(),
});

// ---- the page ------------------------------------------------------------------------

// cover: the ridge between its two lines of type, moving to a made-up signal.
// intro: the introduction over it. asking: the same, while the browser's picker is open.
// live: the ridge alone, moving to what is shared, with a line of tips under it.
function setView(view) {
  document.body.dataset.view = view;
  // Dragging is for the live ridge only.
  if (stage) stage.controls.enabled = view === 'live';
  if (view !== 'live') {
    status.hide();
    setOptions(false);
  }
  if (view === 'cover' || view === 'live') intro.hide();
}

function toCover() {
  setView('cover');
  if (stage) stage.showCover(TO_COVER_SECONDS);
}

function openIntro(options = {}) {
  setView('intro');
  intro.open({ at: hasShared ? 3 : undefined, ...options });
}

function toLive(route) {
  setView('live');
  status.show(LISTENING[route], route === 'mic' || route === 'test' ? 'stop' : 'stop sharing');
  hasShared = hasShared || route === 'tab';
  // The tips stay up until the ridge has been handled.
  document.body.classList.remove('handled');
  if (stage) stage.goLive({ view: linkView, drift: values.drift, delayMs: DRIFT_AFTER_MS });
  linkView = null;
}

function setOptions(open) {
  optionsOpen = open;
  if (open) panel?.show();
  else panel?.hide();
  status.setOpen(open);
  document.body.classList.toggle('options', open);
}

// The options open over the live ridge, and over the cover for tuning its look.
function toggleOptions() {
  const view = document.body.dataset.view;
  if (view !== 'live' && view !== 'cover') return;
  if (view === 'live') document.body.classList.add('handled');
  setOptions(!optionsOpen);
}

async function begin(route) {
  // A start from the introduction keeps it up, busy, while the browser asks.
  const asked = document.body.dataset.view === 'intro';
  if (asked) setView('asking');
  intro.setBusy(true);
  // The silence timer restarts with every new capture.
  stats.quietSince = null;
  let result;
  try {
    if (route === 'mic') result = await capture.microphone();
    else if (route === 'test') result = await capture.testSignal();
    else result = await capture.share(route);
  } catch (error) {
    log(`start failed: ${error.name}: ${error.message}`);
    capture.stop();
    result = { ok: false, why: 'error', error };
  }
  if (result.ok) {
    toLive(route);
    return;
  }
  if (route === 'tab' || route === 'screen') intro.showGuide(route);
  openIntro({ notice: intro.explain(route, result), at: route === 'tab' || route === 'screen' ? 3 : undefined });
}

function end() {
  capture.stop();
  stats.quietSince = null;
  toCover();
}

// Nothing draws after the graphics device is lost, so the page stops and says so.
function lost(info) {
  log(`graphics lost: ${info && info.message}`);
  end();
  setView('intro');
  intro.fail('The graphics stopped. Reload the page to start again.');
}

// The one way a setting changes: from the panel, a key or the link.
function set(name, value) {
  if (name === 'theme') {
    const theme = findTheme(value);
    // Moving to or from the opening theme swaps every other setting for that side's defaults.
    const crossed = (values.theme === OPENING_THEME) !== (theme.name === OPENING_THEME);
    values.theme = theme.name;
    values.gradient = theme.gradients[0].name;
    if (crossed) {
      const base = defaults(theme.name);
      // Only what differs is set, so a setting that holds its value is not started afresh.
      for (const s of SETTINGS) if (s.kind !== 'choice' && values[s.name] !== base[s.name]) set(s.name, base[s.name]);
    }
  } else if (name === 'gradient') {
    values.gradient = findGradient(findTheme(values.theme), value).name;
  } else {
    values[name] = value;
  }
  if (name === 'speed') ridge.setParams({ rowMs: 1000 / values.speed });
  else if (name in PARAMS) ridge.setParams({ [name]: values[name] });
  if (name === 'theme' || name === 'gradient') applyTheme();
  if (name in PARAMS || name === 'speed' || name.startsWith('demo')) refill = true;
  if (name === 'rows' || name === 'spacing' || name === 'tilt' || name === 'theme') applyLayout();
  if (name === 'fov' && stage) stage.setFov(values.fov);
  if (name === 'drift' && stage && document.body.dataset.view === 'live') stage.setDrift(values.drift);
  applyValues();
  if (panel) panel.refresh();
}

// Under the opening theme the ridge is laid out as a sleeve: fitted to the poster and seen
// flat on the cover. Under any other it is laid out as pulsr's own.
const isSleeve = () => values.theme === OPENING_THEME;

// On the sleeve the line setting is the width at a poster of this many pixels; it is scaled
// with the poster, within limits, so the ridge keeps its weight from a phone to a large screen.
const LINE_AT_POSTER = 560;

function applyValues() {
  if (!mesh) return;
  const fitted = Math.min(1.6, Math.max(0.7, posterWidth(window.innerWidth, window.innerHeight) / LINE_AT_POSTER));
  mesh.setValues({ ...values, lineWidth: values.lineWidth * (isSleeve() ? fitted : 1) });
}

// The camera's front view follows the layout, and on the sleeve the poster's shape follows
// the rows' reach and the tilt.
function applyLayout() {
  const sleeve = isSleeve();
  const depth = (values.rows - 1) * values.spacing;
  const tilt = (values.tilt * Math.PI) / 180;
  const ratio = sleeve ? (depth * Math.sin(tilt) + PEAK_ROOM * Math.cos(tilt)) / ROW_WIDTH : 1;
  document.documentElement.style.setProperty('--poster-ratio', ratio.toFixed(4));
  document.body.classList.toggle('sleeve', sleeve);
  if (stage) stage.setLayout({ depth, tilt: values.tilt, sleeve });
}

// Runs the made-up signal for as long as the rows hold, ending now, so the whole ridge
// shows the current settings.
function fillFromDemo() {
  const now = performance.now() / 1000;
  for (let t = now - (ridge.capacity * params.rowMs) / 1000; t < now; t += 1 / 60) ridge.advance(t, demo);
  refill = false;
}

function applyTheme() {
  const t = findTheme(values.theme);
  const gradient = findGradient(t, values.gradient);
  const style = document.documentElement.style;
  style.setProperty('--background', t.background);
  style.setProperty('--text', t.text);
  gradient.stops.forEach((colour, i) => style.setProperty(`--c${i + 1}`, colour));
  if (stage) stage.setBackground(t.background);
  if (mesh) mesh.setTheme(t, gradient);
}

function nextTheme() {
  const i = THEMES.indexOf(findTheme(values.theme));
  set('theme', THEMES[(i + 1) % THEMES.length].name);
}

function nextGradient() {
  const gradients = findTheme(values.theme).gradients;
  const i = gradients.indexOf(findGradient(findTheme(values.theme), values.gradient));
  set('gradient', gradients[(i + 1) % gradients.length].name);
}

function toggleRising() {
  set('rising', !values.rising);
}

let linkNotice = null;

// Puts the current look in the address bar, then on the clipboard. The view goes with it
// only when the camera is not drifting, since a drifting camera has no view to keep.
async function copyLink() {
  const text = encode(values, stage.isDrifting() ? null : stage.getView());
  const url = location.origin + location.pathname + (text ? `#${text}` : '');
  let notice = 'Link copied';
  try {
    history.replaceState(null, '', url);
    await navigator.clipboard.writeText(url);
  } catch {
    notice = 'Link is in the address bar';
  }
  status.hint(notice);
  status.stir();
  clearTimeout(linkNotice);
  linkNotice = setTimeout(() => {
    if ($('hint').textContent === notice) status.hint('');
  }, LINK_NOTICE_MS);
  return notice.toLowerCase();
}

function fullScreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

// ---- frames --------------------------------------------------------------------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function frame(stamp) {
  const idle = capture.kind === 'none';
  if (idle && refill) fillFromDemo();
  // With nothing shared the ridge only plays its made-up signal: hold it still for reduced motion.
  if (!(reducedMotion.matches && idle)) ridge.advance(stamp / 1000, idle ? demo : ring);
  mesh.frame(ridge);
  stage.render(stamp);
  stats.paints += 1;
}

function showStats() {
  const now = performance.now();
  const peak = stats.peak;
  diagnostics.tick({
    paints: stats.paints,
    frames: stats.frames,
    peak,
    lateMs: ring.takeLateness(),
    kind: capture.kind,
    sampleRate: capture.context ? capture.context.sampleRate : 0,
  });

  // A share that delivers nothing but zeros gets a line of direction.
  if (capture.stream && capture.kind !== 'none') {
    if (peak > 0) {
      if (stats.quietSince !== null && !$('hint').hidden) status.hint('');
      stats.quietSince = null;
    } else if (stats.quietSince === null) {
      stats.quietSince = now;
    } else if ($('hint').hidden && now - stats.quietSince > SILENT_HINT_MS) {
      log('the capture has delivered only silence for 4 s');
      status.hint('Nothing is coming through yet. Is it playing?');
    }
  }
  stats.paints = 0;
  stats.frames = 0;
  stats.peak = 0;
}

// ---- wiring --------------------------------------------------------------------------

// Sets every setting to the link's value, or its theme's default where the link has none,
// in table order so a theme comes before its gradient.
function applyLink(given) {
  const base = defaults(given.values.theme ?? OPENING_THEME);
  for (const s of SETTINGS) set(s.name, s.name in given.values ? given.values[s.name] : base[s.name]);
}

applyLink(link);
// A link pasted into this tab changes only the fragment, which does not reload the page.
window.addEventListener('hashchange', () => {
  const next = decode(location.hash.slice(1));
  applyLink(next);
  if (!next.view) return;
  if (stage && document.body.dataset.view === 'live') stage.setView(next.view);
  else linkView = next.view;
});
toCover();
$('panel').hidden = !query.has('debug');

const supported = navigator.mediaDevices ? navigator.mediaDevices.getSupportedConstraints() : {};
log(navigator.userAgent);
log(
  `secure context: ${window.isSecureContext}, getDisplayMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)}, ` +
    `CaptureController: ${'CaptureController' in window}, tab sharing offered: ${canShare}`,
);
log(
  `constraints known: ${['displaySurface', 'suppressLocalAudioPlayback', 'restrictOwnAudio']
    .filter((name) => supported[name])
    .join(', ') || 'none of the capture ones'}`,
);

try {
  stage = await createStage(canvas, { forceWebGL: query.has('webgl'), onLost: lost });
} catch (error) {
  log(`graphics did not start: ${error && error.message}`);
  setView('intro');
  intro.fail('This browser could not start its graphics, so there is nothing to draw the ridge with.');
}
if (stage) start();

// Everything past here needs the stage.
function start() {
  log(`graphics backend: ${stage.backend}`);
  mesh = createRidgeMesh({
    history: new HistoryRows(ridge.fineCount, ridge.capacity),
    resolution: stage.resolution,
    pixelRatio: stage.pixelRatio,
  });
  stage.scene.add(mesh.object);
  applyValues();
  window.addEventListener('resize', applyValues);
  stage.setFov(values.fov);
  stage.controls.enabled = document.body.dataset.view === 'live';
  applyTheme();
  panel = createPanel({ values, onChange: set, onResetView: () => stage.resetView(), onCopyLink: copyLink });
  // A start that beat the graphics is already live.
  if (document.body.dataset.view === 'live') stage.goLive({ view: linkView, drift: values.drift });

  applyLayout();
  if (document.body.dataset.view !== 'live') stage.showCover();
  // The page opens on a full ridge.
  fillFromDemo();

  // Once the camera has been moved, the tips get out of the way while the pointer rests.
  stage.controls.addEventListener('start', () => document.body.classList.add('handled'));

  status.addKey('t', 'theme', nextTheme);
  status.addKey('g', 'gradient', nextGradient);
  status.addKey('r', 'rising', toggleRising);
  status.addKey('f', 'full screen', fullScreen);
  status.addKey('v', 'view', () => stage.resetView());
  status.addKey('p', 'options', toggleOptions);

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    // Letters typed into a text or number field are the field's.
    if (event.target.closest?.('textarea, input:not([type="checkbox"])')) return;
    status.stir();
    if (event.key === 'Escape' && document.body.dataset.view === 'intro') toCover();
    const key = event.key.toLowerCase();
    // A hotkey on a focused list replaces the list's own jump to a matching entry.
    if (key.length === 1 && 'rtgpfvds'.includes(key) && event.target instanceof HTMLSelectElement) {
      event.preventDefault();
      event.target.blur();
    }
    if (key === 'r') toggleRising();
    else if (key === 't') nextTheme();
    else if (key === 'g') nextGradient();
    else if (key === 'p') toggleOptions();
    else if (key === 'f') fullScreen();
    else if (key === 'v') stage.resetView();
    else if (key === 'd') diagnostics.toggle();
    else if (key === 's' && document.body.dataset.view === 'live') end();
  });
  window.addEventListener('pointermove', status.stir);
  setInterval(showStats, 500);
  stage.renderer.setAnimationLoop(frame);

  // A hook for checking the page from a console.
  window.pulsr = { ring, ridge, stats, stage, mesh, values, set, panel, report: diagnostics.report, toCover, openIntro, toLive, explain: intro.explain, showGuide: intro.showGuide };
}
