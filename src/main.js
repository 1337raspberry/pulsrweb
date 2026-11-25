import { Ridge } from './ridge/ridge.js';
import { PARAMS } from './ridge/params.js';
import { FrameRing } from './audio/frame-ring.js';
import { createCapture } from './audio/capture.js';
import { createIntro } from './ui/intro.js';
import { createStatus } from './ui/status.js';
import { createDiagnostics } from './ui/diagnostics.js';
import { createStage } from './scene/stage.js';
import { HistoryRows } from './scene/history-rows.js';
import { createRidgeMesh } from './scene/ridge-mesh.js';
import { createPanel } from './ui/panel.js';
import { SETTINGS, decode, defaults, encode } from './settings.js';
import { THEMES, findTheme, findGradient } from './themes.js';

const BANDS = 64;
const WIDTH = BANDS * 2;
// A share that has been silent this long gets a hint, in ms.
const SILENT_HINT_MS = 4000;
// How long a notice about the link stays in the status line, in ms.
const LINK_NOTICE_MS = 2000;

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
// The look and view carried in the address after `#`.
const link = decode(location.hash.slice(1));

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
  onEnded: () => end('Sharing stopped.'),
  onFrames({ positions, levels, peak }) {
    const at = performance.now() / 1000;
    for (let f = 0; f < positions.length; f++) ring.push(positions[f], levels, f * WIDTH, at);
    stats.frames += positions.length;
    if (peak > stats.peak) stats.peak = peak;
  },
});
const intro = createIntro({ canShare, onStart: (route) => begin(route) });
const status = createStatus({ onStop: () => end() });
const diagnostics = createDiagnostics({
  capture,
  onTestSignal: () => begin('test'),
  onStart: (route) => begin(route),
  onStop: () => end(),
});

// ---- the page ------------------------------------------------------------------------

// idle: the opening text. asking: the same, while the browser's picker is open.
// live: only the ridge and a status line. `text` is the notice shown in the opening
// text, or the status line's words when live.
function show(view, text = '', stopLabel = 'stop sharing') {
  document.body.dataset.view = view;
  // Dragging is ignored while the opening text is up.
  if (stage) stage.controls.enabled = view === 'live';
  if (view === 'live') {
    intro.hide();
    status.show(text, stopLabel);
    panel?.show();
  } else {
    status.hide();
    panel?.hide();
    intro.show(text);
    intro.setBusy(view === 'asking');
  }
}

async function begin(route) {
  if (route === 'tab' || route === 'screen') intro.showGuide(route);
  show('asking');
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
  if (result.ok) show('live', LISTENING[route], route === 'mic' || route === 'test' ? 'stop' : 'stop sharing');
  else show('idle', intro.explain(route, result));
}

function end(notice = '') {
  capture.stop();
  stats.quietSince = null;
  show('idle', notice);
}

// Nothing draws after the graphics device is lost, so the page stops and says so.
function lost(info) {
  log(`graphics lost: ${info && info.message}`);
  end();
  intro.fail('The graphics stopped. Reload the page to start again.');
}

// The one way a setting changes: from the panel, a key or the link.
function set(name, value) {
  if (name === 'theme') {
    const theme = findTheme(value);
    values.theme = theme.name;
    values.gradient = theme.gradients[0].name;
  } else if (name === 'gradient') {
    values.gradient = findGradient(findTheme(values.theme), value).name;
  } else {
    values[name] = value;
  }
  if (name === 'speed') ridge.setParams({ rowMs: 1000 / values.speed });
  else if (name in PARAMS) ridge.setParams({ [name]: values[name] });
  if (name === 'theme' || name === 'gradient') applyTheme();
  if (name === 'fov' && stage) stage.setFov(values.fov);
  if (mesh) mesh.setValues(values);
  if (panel) panel.refresh();
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

function togglePanel() {
  if (panel && document.body.dataset.view === 'live') panel.toggle();
}

let linkNotice = null;

// Puts the current look and view in the address bar, then on the clipboard.
async function copyLink() {
  const text = encode(values, stage.getView());
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
}

function fullScreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

// ---- frames --------------------------------------------------------------------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function frame(stamp) {
  // With nothing to hear, the lines only scroll: hold them still for reduced motion.
  if (!(reducedMotion.matches && capture.kind === 'none' && ridge.peak === 0)) ridge.advance(stamp / 1000, ring);
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

// Sets every setting to the link's value, or its default where the link has none, in
// table order so a theme comes before its gradient.
function applyLink(given) {
  const base = defaults();
  for (const s of SETTINGS) set(s.name, s.name in given.values ? given.values[s.name] : base[s.name]);
}

applyLink(link);
// A link pasted into this tab changes only the fragment, which does not reload the page.
window.addEventListener('hashchange', () => {
  const next = decode(location.hash.slice(1));
  applyLink(next);
  if (next.view && stage) stage.setView(next.view);
});
if (canShare) show('idle');
else show('idle', 'Sharing a tab’s sound needs Chrome or Edge on a computer. Here, pulsr can only listen through the microphone.');
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
  mesh.setValues(values);
  stage.setFov(values.fov);
  stage.controls.enabled = document.body.dataset.view === 'live';
  applyTheme();
  if (link.view) stage.setView(link.view);
  panel = createPanel({ values, onChange: set, onResetView: () => stage.resetView(), onCopyLink: copyLink });
  if (document.body.dataset.view === 'live') panel.show();

  status.addKey('t', 'theme', nextTheme);
  status.addKey('g', 'gradient', nextGradient);
  status.addKey('r', 'rising', toggleRising);
  status.addKey('f', 'full screen', fullScreen);
  status.addKey('v', 'view', () => stage.resetView());
  status.addKey('p', 'panel', togglePanel);

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    // Letters typed into a text or number field are the field's.
    if (event.target.closest?.('textarea, input:not([type="checkbox"])')) return;
    status.stir();
    const key = event.key.toLowerCase();
    // A hotkey on a focused list replaces the list's own jump to a matching entry.
    if (key.length === 1 && 'rtgpfvds'.includes(key) && event.target instanceof HTMLSelectElement) {
      event.preventDefault();
      event.target.blur();
    }
    if (key === 'r') toggleRising();
    else if (key === 't') nextTheme();
    else if (key === 'g') nextGradient();
    else if (key === 'p') togglePanel();
    else if (key === 'f') fullScreen();
    else if (key === 'v') stage.resetView();
    else if (key === 'd') diagnostics.toggle();
    else if (key === 's' && document.body.dataset.view === 'live') end();
  });
  window.addEventListener('pointermove', status.stir);
  setInterval(showStats, 500);
  stage.renderer.setAnimationLoop(frame);

  // A hook for checking the page from a console.
  window.pulsr = { ring, ridge, stats, stage, mesh, values, set, panel, report: diagnostics.report, show, explain: intro.explain, showGuide: intro.showGuide };
}
