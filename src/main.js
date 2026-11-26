import { Ridge } from './ridge/ridge.js';
import { PARAMS } from './ridge/params.js';
import { FrameRing, MOST_HOLD_SEC } from './audio/frame-ring.js';
import { createCapture } from './audio/capture.js';
import { dropped, picked, title } from './audio/files.js';
import { better, currentOf, isLoopback, plain } from './audio/inputs.js';
import { createDemo } from './audio/demo-source.js';
import { createIntro } from './ui/intro.js';
import { detect, named, offerFor } from './ways.js';
import { createPoster } from './ui/poster.js';
import { createStatus } from './ui/status.js';
import { createInputs } from './ui/inputs.js';
import { createTransport } from './ui/transport.js';
import { createDiagnostics } from './ui/diagnostics.js';
import { createStage } from './scene/stage.js';
import { HistoryRows } from './scene/history-rows.js';
import { posterWidth } from './scene/view-math.js';
import { createRidgeMesh, WIDTH as ROW_WIDTH } from './scene/ridge-mesh.js';
import { createPanel } from './ui/panel.js';
import { FLOWS, LAYOUTS, PRESET_COLOURS, SETTINGS, decode, defaults, encode } from './settings.js';
import { PALETTES, findPalette, findGradient } from './palettes.js';
import { findEntry } from './looks/index.js';
import { createShared } from './looks/shared.js';
import { createBackdrop } from './scene/backdrop.js';

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
// With `pause` on, the ridge holds still once nothing louder than this peak (about -60 dB)
// has arrived for this long, in ms.
const SILENT_PEAK = 0.001;
const PAUSE_AFTER_MS = 1000;
// How far an arrow key moves through a file.
const SEEK_STEP_SEC = 10;
// World height the cover allows for peaks above its back row, for the poster's shape.
const PEAK_ROOM = 1.5;

const $ = (id) => document.getElementById(id);
const canvas = $('ridge');
const query = new URLSearchParams(location.search);

// Where the page is and what works there. `?as=firefox-linux` and the like show the page
// as another setup sees it.
const seenAs = named(query.get('as'));
const where = seenAs ?? detect(navigator);
const offer = offerFor(where, { displayMedia: !!seenAs || !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) });
const canShare = offer.ways.includes('tab');

const ring = new FrameRing(WIDTH);
const params = { ...PARAMS };
const ridge = new Ridge(params, BANDS);
// The uniforms every part of a look reads: time, the sound's signals, the palette's colours.
const shared = createShared(BANDS);
let stage = null;
let mesh = null;
let backdrop = null;
let panel = null;
// Set when the look's slots changed, so the ridge or the filters are rebuilt once, on the
// next frame, however many settings a preset changed together.
let staleLook = false;
let staleFilters = false;
// The entries of the look in use, for those that do something of their own each frame.
let looking = [];
// What is behind the ridge at a screen point, as a colour node: the backdrop's picture, or
// the background colour.
let groundAt = () => shared.background;
let filtering = [];
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
// The status line's button for `pause`, which shows whether it is on.
let pauseKey = null;
// The cover and the introduction are the way in. Once something has played, stopping
// leaves the ridge up with its controls instead of going back to them.
let onboarded = false;
// What the start button starts: the last kind of source that worked.
let startRoute = canShare ? 'tab' : 'mic';
// Set while a start is waiting on the browser, so a second one cannot begin.
let starting = false;
// When sound was last heard, on the frame clock (ms).
let heardAt = -Infinity;

const stats = { frames: 0, paints: 0, peak: 0, quietSince: null };

// The file that is playing, as the player last told it: { name, index, count }.
let track = null;
// Set once this visit has moved to the computer's own sound unasked, so it happens once.
let moved = false;

// What each source is called in the status line.
const LISTENING = {
  tab: 'Listening to a shared tab',
  screen: 'Listening to this computer’s sound',
  mic: 'Listening through the microphone',
  test: 'Playing the test signal',
};
function listening(route) {
  if (route === 'files' && track) {
    const place = track.count > 1 ? ` (${track.index + 1} of ${track.count})` : '';
    return `Playing ${title(track)}${place}`;
  }
  if (route === 'mic' && capture.label) {
    const name = plain(capture.label);
    return isLoopback(name) ? `Listening to this computer through “${name}”` : `Listening through “${name}”`;
  }
  return LISTENING[route] ?? 'Listening';
}
// What the start button says for each source, and the stop button while it plays.
const START = { tab: 'share a tab', screen: 'share system audio', mic: 'listen', files: 'play' };
const STOP = { tab: 'stop sharing', screen: 'stop sharing', files: 'pause' };
// What the ridge draws once stopped: silence, so it is plain that nothing is heard.
const quiet = {
  read(t, out) {
    out.fill(0);
    return true;
  },
};

// ---- modules -------------------------------------------------------------------------

// The capture needs a log before the panel that shows it exists.
const log = (text) => diagnostics.log(text);

const capture = createCapture({
  log,
  onEnded: (notice) => end(notice),
  onTrack(next) {
    track = next;
    if (document.body.dataset.view === 'live' && capture.kind === 'files') status.say(listening('files'));
    showSourceKeys();
  },
  onFrames({ positions, levels, peak }) {
    const at = performance.now() / 1000;
    for (let f = 0; f < positions.length; f++) ring.push(positions[f], levels, f * WIDTH, at);
    stats.frames += positions.length;
    if (peak > stats.peak) stats.peak = peak;
    if (peak > SILENT_PEAK) heardAt = performance.now();
  },
});
const intro = createIntro({
  where,
  offer,
  // Files are picked first; the pick is what starts them.
  onStart: (route) => (route === 'files' ? openPicker() : begin(route)),
  onClose: () => toCover(),
});
const status = createStatus({ onToggle: () => startOrStop() });
const inputs = createInputs({ onPick: (input) => switchTo(input) });
const transport = createTransport({ onSeek: (seconds) => capture.seek(seconds) });
// The keys that belong to one kind of source, shown only while it plays.
let nextKey = null;
let backKey = null;
let inputKey = null;
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
// stopped: the ridge alone and silent, with the status line and its start button.
function setView(view) {
  document.body.dataset.view = view;
  const staged = view === 'live' || view === 'stopped';
  // Dragging is for the ridge on its own.
  if (stage) stage.controls.enabled = staged;
  if (!staged) {
    status.hide();
    setOptions(false);
  }
  if (view !== 'live') inputs.close();
  if (view !== 'intro' && view !== 'asking') intro.hide();
}

// Whether the ridge is up on its own, playing or stopped.
const onStage = () => document.body.dataset.view === 'live' || document.body.dataset.view === 'stopped';

function toCover() {
  setView('cover');
  if (stage) stage.showCover(TO_COVER_SECONDS);
}

function openIntro(options = {}) {
  setView('intro');
  intro.open(options);
}

function toLive(route) {
  // A restart finds the camera where it was left.
  const resumed = document.body.dataset.view === 'stopped';
  setView('live');
  status.show(listening(route), STOP[route] ?? 'stop');
  showSourceKeys();
  onboarded = true;
  if (route in START) startRoute = route;
  if (resumed) return;
  if (stage) stage.goLive({ view: linkView, drift: values.drift, delayMs: DRIFT_AFTER_MS });
  linkView = null;
}

// The ridge stays up, silent, with the status line offering a start. `notice` is a line
// about a start that just went wrong.
function toStopped(notice = '') {
  setView('stopped');
  // The nudge is for the first time sound plays; from here on the status line shows.
  document.body.classList.add('handled');
  // Files that are still in line carry on from where they stopped; with none left, the
  // start button opens the file picker.
  const paused = startRoute === 'files' && capture.queued > 0;
  status.show(paused ? 'Paused' : 'Not listening', startRoute === 'files' && !paused ? 'open files' : START[startRoute]);
  showSourceKeys();
  if (notice) status.hint(notice);
}

// Whether the visitor's own files are up: playing, or paused with some still in line.
function filesUp() {
  const view = document.body.dataset.view;
  return (view === 'live' && capture.kind === 'files') || (view === 'stopped' && startRoute === 'files' && capture.queued > 0);
}

// The keys for the next file, the one before and for choosing an input show while they
// have something to do, and the seek bar while files are up.
function showSourceKeys() {
  const live = document.body.dataset.view === 'live';
  if (nextKey) nextKey.hidden = !(live && capture.kind === 'files' && capture.queued > 1);
  if (backKey) backKey.hidden = !(live && capture.kind === 'files');
  if (inputKey) inputKey.hidden = !(live && capture.kind === 'microphone');
  document.body.classList.toggle('files', filesUp());
  showProgress();
}

function showProgress() {
  transport.update(filesUp() ? capture.progress : null);
}

// Moves the file that is up by `seconds`, forwards or back.
function seekBy(seconds) {
  const now = filesUp() && capture.progress;
  if (!now) return;
  capture.seek(now.time + seconds);
  showProgress();
}

function startOrStop() {
  const view = document.body.dataset.view;
  if (view === 'live') end();
  else if (view !== 'stopped') return;
  else if (startRoute === 'files' && capture.queued === 0) openPicker();
  else begin(startRoute);
}

function setOptions(open) {
  optionsOpen = open;
  if (open) panel?.show();
  else panel?.hide();
  document.body.classList.toggle('options', open);
}

// The options open over the ridge on its own, and over the cover for tuning its look.
function toggleOptions() {
  const view = document.body.dataset.view;
  if (!onStage() && view !== 'cover') return;
  if (view === 'live') document.body.classList.add('handled');
  setOptions(!optionsOpen);
}

// `payload` is what the source plays where it plays something of the visitor's: their files.
async function begin(route, payload) {
  if (starting) return;
  starting = true;
  // A start from the introduction keeps it up, busy, while the browser asks.
  const asked = document.body.dataset.view === 'intro';
  if (asked) setView('asking');
  intro.setBusy(true);
  // The silence timer restarts with every new capture.
  stats.quietSince = null;
  let result;
  try {
    if (route === 'mic') result = await capture.microphone();
    else if (route === 'files') result = await capture.files(payload);
    else if (route === 'test') result = await capture.testSignal();
    else result = await capture.share(route);
  } catch (error) {
    log(`start failed: ${error.name}: ${error.message}`);
    capture.stop();
    result = { ok: false, why: 'error', error };
  } finally {
    starting = false;
  }
  if (result.ok) {
    toLive(route);
    if (result.waiting) awaitClick();
    if (route === 'mic') offerInputs();
    return;
  }
  // Past the way in, a start that fails is explained in the status line.
  if (onboarded) {
    toStopped(intro.explain(route, result));
    return;
  }
  if (route === 'tab' || route === 'screen') intro.showGuide(route);
  openIntro({ notice: intro.explain(route, result), at: route === 'tab' || route === 'screen' ? 3 : undefined });
}

// `notice` is a line about why the sound stopped, where it stopped by itself.
function end(notice = '') {
  capture.stop();
  stats.quietSince = null;
  // A stop counts as silence at once, so a ridge that pauses keeps its last picture.
  heardAt = -Infinity;
  if (onboarded) toStopped(notice);
  else if (notice) openIntro({ notice });
  else toCover();
}

// ---- files and inputs ----------------------------------------------------------------

function openPicker() {
  $('picker').click();
}

// Plays what was picked or dropped, or says that none of it was music.
function playFiles(list) {
  if (list.length > 0) {
    begin('files', list);
    return;
  }
  const notice = intro.explain('files', { why: 'nofiles' });
  if (onStage()) status.hint(notice);
  else openIntro({ notice });
}

// A browser holds sound back until the page has been clicked, which a file dropped from
// another window is not. The next click or key lets it play.
function awaitClick() {
  status.hint('Click anywhere to start the music');
  const wake = () => {
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
    status.hint('');
    capture.wake().catch((error) => log(`wake failed: ${error.name}: ${error.message}`));
  };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
}

// Once an input is in use the browser names the others. Where one of them is the
// computer's own sound and a microphone was opened, it moves there, or says how to.
async function offerInputs() {
  const list = await capture.inputs();
  if (capture.kind !== 'microphone' || isLoopback(capture.label)) return;
  const target = moved ? null : better(list, capture.label);
  if (target) {
    moved = true;
    status.hint(`Moving to “${target.label}”, which is this computer’s own sound. Allow it if the browser asks`);
    await switchTo(target);
    return;
  }
  const loopback = list.find((input) => input.loopback);
  if (loopback) status.hint(`“${loopback.label}” is this computer’s own sound: press I to listen to it instead`);
}

async function switchTo(input) {
  if (capture.kind !== 'microphone' || input.id === capture.inputId || input.label === plain(capture.label)) return;
  const result = await capture.switchInput(input.id);
  if (document.body.dataset.view !== 'live') return;
  stats.quietSince = null;
  status.hint(result.ok ? '' : `“${input.label}” was not allowed, so nothing changed`);
  status.say(listening('mic'));
}

async function chooseInput() {
  if (inputs.isOpen) {
    inputs.close();
    return;
  }
  if (document.body.dataset.view !== 'live' || capture.kind !== 'microphone') return;
  const list = await capture.inputs();
  if (list.length > 0) inputs.open(list, currentOf(list, capture.inputId, capture.label)?.id);
}

$('picker').addEventListener('change', (event) => {
  const list = picked(event.target.files);
  // Emptied, so that picking the same files again counts as a change.
  event.target.value = '';
  playFiles(list);
});

// Files held over the page: the page says so while they are, and plays them when let go.
let dropTimer = null;
const carriesFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragover', (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  document.body.classList.add('dropping');
  // No event says the files have left the window, so the notice goes when these stop.
  clearTimeout(dropTimer);
  dropTimer = setTimeout(() => document.body.classList.remove('dropping'), 200);
});
window.addEventListener('drop', async (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  clearTimeout(dropTimer);
  document.body.classList.remove('dropping');
  playFiles(await dropped(event.dataTransfer));
});

// Nothing draws after the graphics device is lost, so the page stops and says so.
function lost(info) {
  log(`graphics lost: ${info && info.message}`);
  end();
  setView('intro');
  intro.fail('The graphics stopped. Reload the page to start again.');
}

// What a change of preset leaves alone, beside the preset itself.
const COLOUR = new Set(['preset', 'palette', 'colours']);

// The one way a setting changes: from the panel, a key or the link.
function set(name, value) {
  if (name === 'preset') {
    const changed = values.preset !== value;
    values.preset = value;
    if (changed) {
      // A preset brings its own defaults for everything but colour. Only what differs is
      // set, so a setting that holds its value is not started afresh.
      const base = defaults(value, values.palette);
      for (const s of SETTINGS) if (!COLOUR.has(s.name) && !s.sticky && values[s.name] !== base[s.name]) set(s.name, base[s.name]);
      // A scene brings its colours with it; the other presets leave the colours alone.
      if (PRESET_COLOURS[value]) {
        const own = defaults(value);
        set('palette', own.palette);
        set('colours', own.colours);
      }
    }
  } else if (name === 'palette') {
    const palette = findPalette(value);
    values.palette = palette.name;
    values.colours = palette.gradients[0].name;
  } else if (name === 'colours') {
    values.colours = findGradient(findPalette(values.palette), value).name;
  } else {
    values[name] = value;
  }
  if (name === 'speed') ridge.setParams({ rowMs: 1000 / values.speed });
  else if (name in PARAMS) ridge.setParams({ [name]: values[name] });
  if (name === 'palette' || name === 'colours') applyPalette();
  if (name in PARAMS || name === 'speed' || name.startsWith('demo')) refill = true;
  if (name === 'shape' || name === 'line' || name === 'tint' || name === 'backdrop') staleLook = true;
  if (name === 'filter' || name === 'filter2') staleFilters = true;
  if (name === 'rows' || name === 'spacing' || name === 'tilt' || name === 'preset' || name === 'shape') applyLayout();
  if (name === 'fov' && stage) stage.setFov(values.fov);
  if (name === 'drift' && stage && onStage()) stage.setDrift(values.drift);
  if (name === 'pause') pauseKey?.setAttribute('aria-pressed', String(values.pause));
  applyValues();
  if (panel) panel.refresh();
}

// A sleeve layout is fitted to the poster and seen flat on the cover; the others are open.
// A shape that is not the flat ridge brings its own.
const layout = () => findEntry('shape', values.shape).layout ?? LAYOUTS[values.preset] ?? LAYOUTS.division;
const isSleeve = () => layout().sleeve;

// On the sleeve the line setting is the width at a poster of this many pixels; it is scaled
// with the poster, within limits, so the ridge keeps its weight from a phone to a large screen.
const LINE_AT_POSTER = 560;

function applyValues() {
  if (!mesh) return;
  const fitted = Math.min(1.6, Math.max(0.7, posterWidth(window.innerWidth, window.innerHeight) / LINE_AT_POSTER));
  mesh.setValues({ ...values, flow: FLOWS.indexOf(values.flow), lineWidth: values.lineWidth * (isSleeve() ? fitted : 1) });
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
  const own = layout();
  if (stage) {
    stage.setLayout({
      depth, sleeve, framing: own.framing, target: own.target, orbit: own.orbit, spin: own.spin,
      tilt: own.tilt ?? values.tilt, ownTilt: own.tilt !== undefined,
    });
  }
}

// Puts the ridge together from the look's slots.
function applyLook() {
  staleLook = false;
  const look = { shape: findEntry('shape', values.shape), line: findEntry('line', values.line), tint: findEntry('tint', values.tint) };
  const behind = findEntry('backdrop', values.backdrop);
  // An entry may have changed the palette's colours as it went; with a change of entries
  // they start again from the palette's own.
  const entries = [...Object.values(look), behind];
  if (entries.some((entry, i) => entry !== looking[i])) applyPalette();
  looking = entries;
  staleLook = false;
  const set = backdrop.set(behind);
  groundAt = set.groundAt;
  mesh.setLook({ ...look, ground: set.ground, veil: set.veil, solid: set.solid, groundAt: set.pictured ? set.groundAt : null });
  // The filters read the backdrop's picture too.
  staleFilters = true;
  applyValues();
}

function applyFilters() {
  staleFilters = false;
  filtering = [findEntry('filter', values.filter), findEntry('filter', values.filter2)];
  stage.setFilters(filtering, { ...shared, ground: groundAt });
}

// The palette's colours as the look's parts see them. An entry's `frame` may move them
// away from the palette's own for as long as it is in use.
function setColours({ background, stops, ink }) {
  if (background !== undefined) {
    shared.background.value.set(background);
    const c = shared.background.value;
    const light = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.18 ? 1 : 0;
    // A look may be built differently for a light background and a dark one.
    if (light !== shared.light.value) staleLook = true;
    shared.light.value = light;
    if (stage) stage.setBackground(shared.background.value);
  }
  if (stops) stops.forEach((colour, i) => shared.stops[i].value.set(colour));
  if (ink !== undefined) shared.ink.value.set(ink);
}

// Runs the made-up signal for as long as the rows hold, ending now, so the whole ridge
// shows the current settings.
function fillFromDemo() {
  const now = performance.now() / 1000;
  for (let t = now - (ridge.capacity * params.rowMs) / 1000; t < now; t += 1 / 60) ridge.advance(t, demo);
  refill = false;
}

function applyPalette() {
  const palette = findPalette(values.palette);
  const gradient = findGradient(palette, values.colours);
  const style = document.documentElement.style;
  style.setProperty('--background', gradient.background);
  style.setProperty('--text', gradient.text);
  gradient.stops.forEach((colour, i) => style.setProperty(`--c${i + 1}`, colour));
  setColours({ background: gradient.background, stops: gradient.stops, ink: gradient.text });
}

function nextPalette() {
  const i = PALETTES.indexOf(findPalette(values.palette));
  set('palette', PALETTES[(i + 1) % PALETTES.length].name);
}

function nextColours() {
  const gradients = findPalette(values.palette).gradients;
  const i = gradients.indexOf(findGradient(findPalette(values.palette), values.colours));
  set('colours', gradients[(i + 1) % gradients.length].name);
}

function togglePause() {
  set('pause', !values.pause);
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

// Not every browser can fill the screen with a page (an iPhone's cannot).
function fullScreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

// ---- frames --------------------------------------------------------------------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// How fast the hold on the picture moves to a new value, in seconds of hold a second.
const HOLD_EASE = 0.5;
let lastStamp = 0;

function frame(stamp) {
  const idle = capture.kind === 'none';
  // Before anything has played the ridge moves to its made-up signal; once stopped it is silent.
  const made = idle && document.body.dataset.view !== 'stopped';
  if (made && refill) fillFromDemo();
  // The made-up signal is only for show: hold it still for reduced motion. What is real
  // holds still through silence when asked to.
  const held = made ? reducedMotion.matches : values.pause && stamp - heardAt > PAUSE_AFTER_MS;
  // The picture is held back to meet sound that is heard after it is analysed, easing to
  // a new delay so that a change of speakers does not make it jump.
  const heardAfter = capture.heardAfter;
  const hold = Math.min(Math.max(heardAfter + (heardAfter > 0 ? values.sync / 1000 : 0), 0), MOST_HOLD_SEC);
  const step = Math.max(stamp - lastStamp, 0) / 1000;
  lastStamp = stamp;
  ring.hold += Math.min(Math.max(hold - ring.hold, -step * HOLD_EASE), step * HOLD_EASE);
  if (!held) ridge.advance(stamp / 1000, made ? demo : idle ? quiet : ring);
  if (staleLook) applyLook();
  if (staleFilters) applyFilters();
  const seconds = stamp / 1000;
  const heard = made ? !held : !idle && stamp - heardAt <= PAUSE_AFTER_MS;
  const dt = shared.update(ridge, seconds, heard);
  shared.still.value = reducedMotion.matches ? 1 : 0;
  // What each part of the look is told once a frame.
  const palette = findPalette(values.palette);
  const tick = { seconds, dt, heard, shared, values, camera: stage.camera, palette, gradient: findGradient(palette, values.colours), setColours };
  for (const entry of looking) entry.frame?.(tick);
  for (const entry of filtering) entry.frame?.(tick);
  mesh.frame(ridge, tick);
  backdrop.frame(tick);
  stage.frameFilters(tick);
  // The camera's uniforms are written once it has moved for this frame.
  stage.render(stamp, shared.updateCamera);
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
    holdMs: ring.hold * 1000,
    heardAfterMs: capture.heardAfter * 1000,
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

// Sets every setting to the link's value, or the default under its preset and palette
// where the link has none, in table order so a palette comes before its colours.
function applyLink(given) {
  const base = defaults(given.values.preset, given.values.palette);
  for (const s of SETTINGS) set(s.name, s.name in given.values ? given.values[s.name] : base[s.name]);
}

applyLink(link);
// The camera's drift is for a visit that opens on the page as it comes, with nothing asked
// of it; picking a preset afterwards sets it back to the preset's default, which is off.
if (Object.keys(link.values).length === 0 && !link.view) set('drift', true);
// A link pasted into this tab changes only the fragment, which does not reload the page.
window.addEventListener('hashchange', () => {
  const next = decode(location.hash.slice(1));
  applyLink(next);
  if (!next.view) return;
  if (stage && onStage()) stage.setView(next.view);
  else linkView = next.view;
});
toCover();
$('panel').hidden = !query.has('debug');

const supported = navigator.mediaDevices ? navigator.mediaDevices.getSupportedConstraints() : {};
log(navigator.userAgent);
log(
  `secure context: ${window.isSecureContext}, getDisplayMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)}, ` +
    `CaptureController: ${'CaptureController' in window}, seen as: ${where.browser || '?'} on ${where.system || '?'}, offered: ${offer.ways.join(', ')}`,
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
    shared,
  });
  backdrop = createBackdrop({ scene: stage.scene, shared, resolution: stage.resolution, pixelRatio: stage.pixelRatio });
  stage.scene.add(mesh.object);
  applyLook();
  applyFilters();
  window.addEventListener('resize', applyValues);
  stage.setFov(values.fov);
  stage.controls.enabled = onStage();
  applyPalette();
  panel = createPanel({ values, onChange: set, onResetView: () => stage.resetView(), onCopyLink: copyLink });
  // A start that beat the graphics is already live.
  if (onStage()) stage.goLive({ view: linkView, drift: values.drift });

  applyLayout();
  if (!onStage()) stage.showCover();
  // The page opens on a full ridge.
  fillFromDemo();

  // The first move of the camera retires the nudge and brings in the status line.
  stage.controls.addEventListener('start', () => document.body.classList.add('handled'));

  status.addKey('t', 'palette', nextPalette);
  status.addKey('g', 'colours', nextColours);
  status.addKey('v', 'reset view', () => stage.resetView());
  status.addKey('f', 'full screen', fullScreen);
  pauseKey = status.addKey('q', 'pause on silence', togglePause);
  pauseKey.setAttribute('aria-pressed', String(values.pause));
  status.addKey('p', 'options', toggleOptions);
  status.addKey('o', 'open files', openPicker);
  backKey = status.addKey('b', 'back', () => capture.previousFile());
  nextKey = status.addKey('n', 'next', () => capture.nextFile());
  inputKey = status.addKey('i', 'input', chooseInput);
  showSourceKeys();

  // The arrow keys move through a file, and keep moving while held.
  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !filesUp()) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    // In a field or a list the arrows are the field's.
    if (event.target.closest?.('textarea, input, select, [role="slider"]')) return;
    event.preventDefault();
    status.stir();
    seekBy(event.key === 'ArrowLeft' ? -SEEK_STEP_SEC : SEEK_STEP_SEC);
  });
  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    // Letters typed into a text or number field are the field's.
    if (event.target.closest?.('textarea, input:not([type="checkbox"])')) return;
    status.stir();
    if (event.key === 'Escape' && document.body.dataset.view === 'intro') toCover();
    const key = event.key.toLowerCase();
    // A hotkey on a focused list replaces the list's own jump to a matching entry.
    if (key.length === 1 && 'tgpfvdsqonib'.includes(key) && event.target instanceof HTMLSelectElement) {
      event.preventDefault();
      event.target.blur();
    }
    if (key === 't') nextPalette();
    else if (key === 'g') nextColours();
    else if (key === 'p') toggleOptions();
    else if (key === 'f') fullScreen();
    else if (key === 'v') stage.resetView();
    else if (key === 'q') togglePause();
    else if (key === 'd') diagnostics.toggle();
    else if (key === 's') startOrStop();
    else if (key === 'o') openPicker();
    else if (key === 'n') capture.nextFile();
    else if (key === 'b') capture.previousFile();
    else if (key === 'i') chooseInput();
  });
  window.addEventListener('pointermove', status.stir);
  window.addEventListener('pointermove', (event) => {
    shared.pointer.value.set(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
  });
  setInterval(showStats, 500);
  setInterval(showProgress, 250);
  stage.renderer.setAnimationLoop(frame);

  // A hook for checking the page from a console.
  window.pulsr = { ring, ridge, stats, stage, mesh, shared, values, set, panel, report: diagnostics.report, toCover, openIntro, toLive, explain: intro.explain, showGuide: intro.showGuide };
}
