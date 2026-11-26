// The settings table, and its encoding into a link fragment (the text after `#`).
//
// A visual preset is a set of defaults: the ridge's shape and motion, the camera, and the
// look (the shape the rows are laid on, what a line is made of, how it is coloured, what is
// behind it and the filters over it). The table's own defaults are the opening preset's,
// which draws the ridge as a record sleeve; PRESET_VALUES holds what each of the others
// changes. Colour is apart: the palette and the colours picked from it stay the same from
// preset to preset, except that a preset listed in PRESET_COLOURS brings its own.
import { PALETTES, findPalette } from './palettes.js';
import { SLOTS } from './looks/index.js';

export const PRESETS = [
  'division', 'immersive', 'closeup', 'sheet',
  '4am', 'nightcall', 'llama', 'lightspeed', 'borealis', 'diorama', 'sumi', 'ttyl', 'redpill', 'openlate',
  'magma', 'lido', 'funnies', 'blip', 'plasmaball', 'snowday', 'bside', 'slinky', 'highrise', 'vlookup', 'p100',
];
// Scenes that are kept below but not offered for now: a link to one opens the opening preset.
export const SHELVED = ['milkyway'];
// Which way the rows travel. Away: born at the front with the sound, receding. Towards
// live: coming at the camera, as if flying forwards, every row showing the live shape.
export const FLOWS = ['away', 'towards live'];
export const OPENING_PRESET = PRESETS[0];
export const OPENING_PALETTE = PALETTES[0].name;

const num = (name, def, min, max, step, label = name, group = 'basic') => ({
  name, kind: 'number', default: def, min, max, step, label, group,
});
const more = (folder) => ({ group: 'more', folder });

const flag = (name, def, folder, label = name) => ({ name, kind: 'boolean', default: def, label, ...more(folder) });
// A choice among the entries of one of a look's slots; the slot's first is the default.
const slot = (name, label = name, from = name) => ({
  name, kind: 'choice', default: SLOTS[from][0].name, label, group: 'look', choices: SLOTS[from].map((entry) => entry.name),
});

export const SETTINGS = [
  {
    name: 'preset', kind: 'choice', default: OPENING_PRESET, label: 'visual preset', group: 'basic',
    choices: PRESETS,
  },
  {
    name: 'palette', kind: 'choice', default: OPENING_PALETTE, label: 'palette', group: 'basic',
    choices: PALETTES.map((p) => p.name),
  },
  {
    name: 'colours', kind: 'choice', default: PALETTES[0].gradients[0].name, label: 'colours', group: 'basic',
    choicesFor: (paletteName) => findPalette(paletteName).gradients.map((g) => g.name),
  },
  slot('shape'),
  slot('line'),
  slot('tint'),
  slot('backdrop'),
  slot('filter'),
  slot('filter2', 'second filter', 'filter'),
  num('peak', 0.25, 0.05, 1.5, 0.01, 'height'),
  num('speed', 12, 2, 80, 1), // rows per second; rowMs = 1000 / speed
  num('rows', 80, 10, 120, 1, 'depth'),
  ...[
    ['gamma', 4, 1, 8, 0.1, 'music reactivity'],
    ['floorCut', 0.6, 0, 0.9, 0.01, 'music reactivity'],
    ['gain', 1.15, 0.5, 3, 0.05, 'music reactivity'],
    ['attack', 0.67, 0.05, 1, 0.01, 'motion'],
    ['decay', 0.5, 0.05, 1, 0.01, 'motion'],
    flag('rising', false, 'motion'),
    { name: 'flow', kind: 'choice', default: FLOWS[0], label: 'flow', choices: FLOWS, ...more('motion') },
    // Holds the ridge still while nothing is heard. `sticky`: a change of preset leaves it be.
    { ...flag('pause', false, 'motion', 'pause on silence'), sticky: true },
    // Milliseconds added to how far the picture is held back for files the page plays,
    // for speakers that lag more or less than the browser reports.
    { name: 'sync', kind: 'number', default: 0, min: -300, max: 300, step: 10, label: 'file sound sync', ...more('motion'), sticky: true },
    ['lineWidth', 1.4, 0.5, 6, 0.05, 'shape', 'line width'],
    ['spread', 1, 0, 4, 0.1, 'shape'],
    ['smooth', 0.1, 0, 0.6, 0.01, 'shape'],
    ['grain', 0.03, 0, 0.3, 0.01, 'shape'],
    ['noise', 0.03, 0, 0.1, 0.005, 'shape'],
    ['span', 0.7, 0.2, 1, 0.01, 'shape'],
    ['edgeTaper', 0.22, 0, 0.5, 0.01, 'shape'],
    ['axisCurve', 0.75, 0.4, 1.2, 0.01, 'shape'],
    ['trench', 0, 0, 0.6, 0.01, 'shape'],
    ['spacing', 0.3, 0.05, 0.6, 0.01, 'depth'],
    ['depthScale', 1, 0.2, 1.5, 0.01, 'depth'],
    ['fadeCurve', 0, 0, 3, 0.05, 'depth'],
    ['alpha', 1, 0.1, 1, 0.01, 'depth'],
    ['fov', 30, 15, 75, 1, 'camera'],
    ['tilt', 40, 2, 75, 1, 'camera'], // degrees the front view looks down from
    // Off in every preset; the page turns it on for a visit that opens without a link.
    flag('drift', false, 'camera'),
    // The made-up signal the cover plays: where its peaks stand and how they move.
    ['demoSpread', 0.27, 0.05, 0.5, 0.01, 'cover', 'spread'],
    ['demoPeaks', 7, 1, 16, 1, 'cover', 'peaks'],
    ['demoHeight', 1, 0.2, 3, 0.05, 'cover', 'height'],
    ['demoWidth', 1, 0.3, 3, 0.05, 'cover', 'width'],
    ['demoRate', 13, 1, 30, 0.5, 'cover', 'rate'],
    ['demoSparse', 3, 1, 6, 0.1, 'cover', 'sparse'],
  ].map((entry) => {
    if (!Array.isArray(entry)) return entry;
    const [name, def, min, max, step, folder, label] = entry;
    return { ...num(name, def, min, max, step, label), ...more(folder) };
  }),
];

// One line on what each setting does, in plain words, for the panel to show on hover.
const HELP = {
  preset: 'a whole look at once: shape, motion, camera, and for the scenes their own colours',
  palette: 'the family of colour schemes to pick colours from',
  colours: 'the background and the blend of colours along the lines',
  shape: 'what the rows are laid out on: a flat plane, or something else entirely',
  line: 'what each line is made of, and what fills the space under it',
  tint: 'how colours from the palette are spread over the lines, and how they change',
  backdrop: 'what is behind and around the ridge',
  filter: 'an effect over the whole finished picture',
  filter2: 'another effect, applied after the first',
  peak: 'how tall the loudest peaks stand',
  speed: 'how many new lines are drawn each second',
  rows: 'how many lines are on screen, front to back',
  gamma: 'contrast: higher flattens quiet sounds so only loud ones stand out',
  floorCut: 'ignores anything quieter than this, so background hiss stays flat',
  gain: 'overall boost to how strongly the lines react',
  attack: 'how quickly a line jumps up when the music gets louder',
  decay: 'how quickly a line falls back when the music gets quieter',
  rising: 'the newest line slides in from the front instead of starting in place',
  flow: 'which way the lines travel: away from you, or towards you as if flying forwards',
  pause: 'holds the picture still while nothing is playing',
  sync: 'for your own files: moves the picture later (or earlier) to line up with the sound, in ms',
  lineWidth: 'how thick the lines are',
  spread: 'how far each peak bleeds into its neighbours, making peaks wider',
  smooth: 'rounds off sharp corners along a line',
  grain: 'adds roughness to the peaks',
  noise: 'adds a slight wiggle to the flat parts of a line',
  span: 'how much of each line’s width the music fills; the rest stays flat',
  edgeTaper: 'how gently peaks shrink towards the two ends of the music’s span',
  axisCurve: 'bends the bass-to-treble axis: lower gives the bass more room',
  trench: 'flattens a channel down the middle, leaving walls on either side',
  spacing: 'the gap between one line and the next',
  depthScale: 'how tall the back lines are compared with the front ones',
  fadeCurve: 'how quickly lines fade out towards the back',
  alpha: 'how solid the lines are: lower is fainter',
  fov: 'the lens angle: wider exaggerates depth, narrower flattens it',
  tilt: 'how steeply the front view looks down on the ridge',
  drift: 'a slow automatic sway of the camera, until you move it',
  demoSpread: 'cover only: how far from the middle the made-up peaks stand',
  demoPeaks: 'cover only: how many made-up peaks there are',
  demoHeight: 'cover only: how tall the made-up peaks are',
  demoWidth: 'cover only: how wide the made-up peaks are',
  demoRate: 'cover only: how fast the made-up peaks flicker',
  demoSparse: 'cover only: how seldom each made-up peak is up',
};
for (const s of SETTINGS) s.help = HELP[s.name];

// pulsr's own shape and view.
const IMMERSIVE = {
  peak: 0.6, speed: 30, rows: 51, lineWidth: 1.25, noise: 0, span: 1,
  spacing: 0.38, depthScale: 0.39, fadeCurve: 0.75, alpha: 0.85, tilt: 18,
};
const SHEET = { ...IMMERSIVE, tilt: 2, flow: 'towards live', trench: 0.25, rows: 100, speed: 50 };
// What each preset changes from the table. `closeup` is pulsr's own through a wide lens
// from close in and almost level; `sheet` stands further back from rows that come at the camera, all showing
// the live shape, so their near edge is in view. The scenes after those four are whole
// looks: one entry from each of the look's slots, the settings that suit them, and (in
// PRESET_COLOURS) a palette.
const PRESET_VALUES = {
  division: {},
  immersive: IMMERSIVE,
  closeup: { ...IMMERSIVE, tilt: 5, fov: 75 },
  sheet: SHEET,
  // A city of towers, one per band, seen through a rainy window late at night.
  '4am': {
    ...IMMERSIVE, line: 'skyline', backdrop: 'cityglow', filter: 'windowpane', filter2: 'glowup',
    rows: 30, spacing: 0.5, speed: 8, peak: 0.55, attack: 0.5, decay: 0.3, fadeCurve: 1, tilt: 8, fov: 35,
  },
  // A night drive down a winding road towards a banded sun.
  nightcall: { ...SHEET, shape: 'joyride', tint: 'onetwo', backdrop: 'retrosun', filter: 'glowup' },
  // The ridge smeared and folded into a turning kaleidoscope, the colours drifting through
  // the palette, as the media players' visualisers did.
  llama: { ...IMMERSIVE, line: 'neon', tint: 'chameleon', filter: 'echo', filter2: 'kaleido', lineWidth: 2 },
  // Flying down a snaking tunnel made of the last few seconds, towards a glowing cloud.
  lightspeed: { ...SHEET, shape: 'wormhole', tint: 'prism', backdrop: 'nebula', filter: 'glowup', filter2: 'fringe', fov: 45 },
  // Northern lights over the ridge and rising off it, mirrored in a still lake.
  borealis: {
    ...IMMERSIVE, shape: 'puddle', line: 'veils', tint: 'borealis', backdrop: 'aurora',
    rows: 40, speed: 12, peak: 0.5, attack: 0.3, decay: 0.2,
  },
  // A shadow box of cut-card hills against an evening sky.
  diorama: {
    ...IMMERSIVE, line: 'papercut', backdrop: 'dusk', filter: 'vignette',
    rows: 30, spacing: 0.6, peak: 0.45, depthScale: 1.3, speed: 4, smooth: 0.5, spread: 3, edgeTaper: 0.1,
    fadeCurve: 0, alpha: 1, tilt: 10, fov: 22,
  },
  // Mountains brushed in ink, paling into mist on paper under a red sun.
  sumi: {
    ...IMMERSIVE, line: 'nib', tint: 'haze', backdrop: 'smokies',
    rows: 24, spacing: 0.5, peak: 0.5, depthScale: 1.4, speed: 5, attack: 0.3, decay: 0.2, smooth: 0.4, spread: 2.5,
    grain: 0, fadeCurve: 0.5, alpha: 1, tilt: 10, fov: 25,
  },
  // The ridge as a terminal draws it, on an old television.
  ttyl: { ...IMMERSIVE, filter: 'tty', filter2: 'telly' },
  // Falling code, and the ridge standing in it.
  redpill: { ...IMMERSIVE, backdrop: 'glyphfall', filter: 'glowup', lineWidth: 1.5 },
  // A few rows bent from neon tube, each beat lighting a new colour.
  openlate: {
    ...IMMERSIVE, tint: 'onetwo', filter: 'tubes', filter2: 'vignette',
    rows: 10, spacing: 0.6, speed: 3, lineWidth: 3, fadeCurve: 0, alpha: 1, tilt: 4, fov: 30,
  },
  // Rows born molten that cool and crust over as they go back, throwing sparks.
  magma: { ...IMMERSIVE, line: 'sparks', tint: 'embers', backdrop: 'cinders', filter: 'glowup', peak: 0.55, tilt: 8 },
  // Satin ribbons over the bottom of a sunlit swimming pool.
  lido: {
    ...IMMERSIVE, line: 'ribbon', tint: 'oilslick', backdrop: 'deepend',
    lineWidth: 3, rows: 30, spacing: 0.5, speed: 12,
  },
  // The ridge printed on cheap newsprint, the plates jumping on every hit.
  funnies: {
    ...IMMERSIVE, tint: 'onetwo', filter: 'pressrun', filter2: 'fringe', lineWidth: 3, rows: 30, spacing: 0.5,
  },
  // A radar screen: the history sweeping round the dial as a web in phosphor green.
  blip: { ...IMMERSIVE, shape: 'radar', line: 'grid', tint: 'p7', filter: 'telly' },
  // A spiral galaxy of sound under a sky full of stars.
  milkyway: { ...IMMERSIVE, shape: 'galaxy', line: 'fairy', tint: 'prism', backdrop: 'stargazer', filter: 'glowup' },
  // Lightning crawling over a glass ball.
  plasmaball: { ...IMMERSIVE, shape: 'marble', line: 'zap', filter: 'glowup' },
  // Sheets of ice on a little planet in the snow.
  snowday: { ...IMMERSIVE, shape: 'smallworld', line: 'glass', backdrop: 'flurry', filter: 'vignette' },
  // A record turning, its grooves cut by the music.
  bside: { ...IMMERSIVE, shape: 'vinyl', filter: 'vignette' },
  // The ridge rolling itself up into a coil of polished metal under studio lights.
  slinky: { ...IMMERSIVE, shape: 'rollup', line: 'chrome', backdrop: 'studio', lineWidth: 6, rows: 32, spacing: 0.6 },
  // A tower of lit windows, the history climbing its sides.
  highrise: { ...IMMERSIVE, shape: 'totem', line: 'skyline', filter: 'glowup' },
  // A spreadsheet of the spectrum's figures, with the ridge as an area chart floating over it.
  vlookup: {
    ...IMMERSIVE, line: 'area', tint: 'series', backdrop: 'spreadsheet', filter: 'plotarea',
    rows: 10, spacing: 0.6, speed: 3, peak: 0.65, grain: 0, fadeCurve: 0.2, alpha: 1, lineWidth: 1.5, tilt: 14, fov: 30,
  },
  // A teletext page on an old television: the ridge in chunky blocks of eight colours, under
  // a header with the time ticking.
  p100: {
    ...IMMERSIVE, tint: 'teletext', filter: 'teletext', filter2: 'telly',
    lineWidth: 3, rows: 34, peak: 0.5, speed: 12, tilt: 6, fov: 18,
  },
};
// A preset that is a whole scene comes with colours of its own: a palette, and the entry
// of it to use. Picking the preset picks them; they can be changed afterwards like any other.
export const PRESET_COLOURS = {
  '4am': { palette: 'tokyo-night', colours: 'blue-red' },
  nightcall: { palette: 'dracula', colours: 'purple-orange' },
  llama: { palette: 'dracula', colours: 'cyan-pink' },
  lightspeed: { palette: 'catppuccin', colours: 'mocha blue-pink' },
  borealis: { palette: 'nord', colours: 'aurora' },
  diorama: { palette: 'rose-pine', colours: 'dawn gold-love' },
  sumi: { palette: 'rose-pine', colours: 'dawn black' },
  ttyl: { palette: 'greyscale', colours: 'grey-white' },
  redpill: { palette: 'catppuccin', colours: 'mocha green-sapphire' },
  openlate: { palette: 'tokyo-night', colours: 'magenta-orange' },
  magma: { palette: 'kanagawa', colours: 'yellow-red' },
  lido: { palette: 'catppuccin', colours: 'latte green-sapphire' },
  funnies: { palette: 'solarized', colours: 'light blue-magenta' },
  blip: { palette: 'gotham', colours: 'cyan-white' },
  milkyway: { palette: 'ayu', colours: 'blue-purple' },
  plasmaball: { palette: 'rose-pine', colours: 'iris-love' },
  snowday: { palette: 'nord', colours: 'frost' },
  bside: { palette: 'rose-pine', colours: 'moon gold-love' },
  slinky: { palette: 'greyscale', colours: 'silver' },
  highrise: { palette: 'tokyo-night', colours: 'teal-blue' },
  vlookup: { palette: 'catppuccin', colours: 'latte blue-pink' },
  p100: { palette: 'greyscale', colours: 'white' },
};
// How each preset is laid out for the camera: as the sleeve, or open, showing `framing`
// of the scene's height at the point its front view looks at (`target`, where it has its own).
// A preset whose shape brings a layout of its own needs none here.
export const LAYOUTS = {
  division: { sleeve: true },
  immersive: { sleeve: false, framing: 12.7 },
  closeup: { sleeve: false, framing: 15.17 },
  sheet: { sleeve: false, framing: 15.75, target: [0, 3, -7] },
  '4am': { sleeve: false, framing: 10, target: [0, 2.5, -6] },
  llama: { sleeve: false, framing: 12.7 },
  diorama: { sleeve: false, framing: 9, target: [0, 2, -4.5] },
  sumi: { sleeve: false, framing: 9.5, target: [0, 2.5, -5.5] },
  ttyl: { sleeve: false, framing: 12.7 },
  redpill: { sleeve: false, framing: 12.7 },
  openlate: { sleeve: false, framing: 8, target: [0, 2, -2] },
  magma: { sleeve: false, framing: 11.5 },
  lido: { sleeve: false, framing: 11, target: [0, 2, -5] },
  funnies: { sleeve: false, framing: 11, target: [0, 2, -5] },
  vlookup: { sleeve: false, framing: 14.8, target: [0, 3.47, -2.5] },
  p100: { sleeve: false, framing: 9, target: [0, 2.5, -6] },
};

const BY_NAME = new Map(SETTINGS.map((s) => [s.name, s]));

// Every setting's default under `preset` and `palette`. Without a palette, the preset's
// own or the opening one. A palette comes with its first gradient, unless it is the
// preset's own and the preset names another.
export function defaults(preset = OPENING_PRESET, palette = PRESET_COLOURS[preset]?.palette ?? OPENING_PALETTE) {
  const base = Object.fromEntries(SETTINGS.map((s) => [s.name, s.default]));
  const shaped = preset in PRESET_VALUES ? { ...base, ...PRESET_VALUES[preset], preset } : base;
  const own = PRESET_COLOURS[preset];
  const colours = own?.palette === palette && own.colours ? own.colours : findPalette(palette).gradients[0].name;
  return { ...shaped, palette, colours };
}

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

function writeValue(s, v) {
  if (s.kind === 'number') return Number(v).toFixed(decimals(s.step));
  return String(v);
}

// Fragment text without the `#`: the preset unless it is the opening one, the palette
// unless it is the one the preset comes with,
// the settings that differ from their defaults under those two, then the camera view.
export function encode(values, view) {
  const parts = [];
  const preset = values.preset ?? OPENING_PRESET;
  const base = defaults(preset, values.palette ?? defaults(preset).palette);
  const opening = { preset: OPENING_PRESET, palette: defaults(preset).palette };
  for (const s of SETTINGS) {
    const v = values[s.name];
    if (v === undefined) continue;
    if (v === (s.name in opening ? opening[s.name] : base[s.name])) continue;
    // A space is written as `+`, which reads better in a link than `%20`.
    parts.push(`${s.name}=${encodeURIComponent(writeValue(s, v)).replace(/%20/g, '+')}`);
  }
  if (view) {
    // A value a hair below zero would otherwise read "-0.00".
    const six = [...view.position, ...view.target].map((n) => n.toFixed(2).replace(/^-(0\.00)$/, '$1'));
    parts.push(`view=${six.join(',')}`);
  }
  return parts.join('&');
}

// Unambiguous, so a long run of digits cannot make matching slow.
const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
const MAX_FRAGMENT = 2000;
const VIEW_LIMIT = 1000;

function parseNumber(text) {
  if (!NUMBER.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseView(text) {
  const parts = text.split(',');
  if (parts.length !== 6) return null;
  const nums = parts.map(parseNumber);
  if (nums.some((n) => n === null || Math.abs(n) > VIEW_LIMIT)) return null;
  return { position: nums.slice(0, 3), target: nums.slice(3) };
}

function safeDecode(text) {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

// Choices that go by another name now, so that links written with the old one still open.
const RENAMED = { preset: { inyoface: 'closeup' } };

// Never throws; returns only known settings with in-range values, and a view or null.
export function decode(fragment) {
  const values = {};
  let view = null;
  const text = typeof fragment === 'string' && fragment.length <= MAX_FRAGMENT ? fragment : '';
  for (const part of text.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = safeDecode(part.slice(0, eq));
    const written = safeDecode(part.slice(eq + 1));
    if (name === null || written === null) continue;
    const raw = RENAMED[name]?.[written] ?? written;
    if (name === 'view') {
      view = parseView(raw);
      continue;
    }
    const s = BY_NAME.get(name);
    if (!s) continue;
    if (s.kind === 'number') {
      const n = parseNumber(raw);
      if (n !== null) values[name] = Math.min(s.max, Math.max(s.min, n));
    } else if (s.kind === 'boolean') {
      if (raw === 'true' || raw === 'false') values[name] = raw === 'true';
    } else if (s.choices?.includes(raw)) {
      values[name] = raw;
    } else if (s.choicesFor) {
      values[name] = raw; // checked against the palette below
    }
  }
  if ('colours' in values) {
    const palette = values.palette ?? defaults(values.preset).palette;
    if (!BY_NAME.get('colours').choicesFor(palette).includes(values.colours)) delete values.colours;
  }
  return { values, view };
}
