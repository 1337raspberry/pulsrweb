// The settings table, and its encoding into a link fragment (the text after `#`).
//
// A visual preset is a set of defaults for everything but colour: the ridge's shape and
// motion, and the camera. The table's own defaults are the opening preset's, which draws
// the ridge as a record sleeve; PRESET_VALUES holds what each of the others changes.
// Colour is apart: the palette and the colours picked from it are the same under any preset.
import { PALETTES, findPalette } from './palettes.js';

export const PRESETS = ['division', 'immersive', 'inyoface', 'sheet'];
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
  preset: 'the overall shape, motion and camera, from the record sleeve to a flight through it',
  palette: 'the family of colour schemes to pick colours from',
  colours: 'the background and the blend of colours along the lines',
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
// What each preset changes from the table. `inyoface` is pulsr's own from close in and
// almost level; `sheet` stands further back from rows that come at the camera, all showing
// the live shape, so their near edge is in view.
const PRESET_VALUES = {
  division: {},
  immersive: IMMERSIVE,
  inyoface: { ...IMMERSIVE, tilt: 2 },
  sheet: { ...IMMERSIVE, tilt: 2, flow: 'towards live', trench: 0.25, rows: 100, speed: 50 },
};
// How each preset is laid out for the camera: as the sleeve, or open, showing `framing`
// of the scene's height at the point its front view looks at (`target`, where it has its own).
export const LAYOUTS = {
  division: { sleeve: true },
  immersive: { sleeve: false, framing: 12.7 },
  inyoface: { sleeve: false, framing: 7.7 },
  sheet: { sleeve: false, framing: 15.75, target: [0, 3, -7] },
};

const BY_NAME = new Map(SETTINGS.map((s) => [s.name, s]));

// Every setting's default under `preset` and `palette`. A palette comes with its first
// gradient.
export function defaults(preset = OPENING_PRESET, palette = OPENING_PALETTE) {
  const base = Object.fromEntries(SETTINGS.map((s) => [s.name, s.default]));
  const shaped = preset in PRESET_VALUES ? { ...base, ...PRESET_VALUES[preset], preset } : base;
  return { ...shaped, palette, colours: findPalette(palette).gradients[0].name };
}

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

function writeValue(s, v) {
  if (s.kind === 'number') return Number(v).toFixed(decimals(s.step));
  return String(v);
}

// Fragment text without the `#`: the preset and palette unless they are the opening ones,
// the settings that differ from their defaults under those two, then the camera view.
export function encode(values, view) {
  const parts = [];
  const base = defaults(values.preset ?? OPENING_PRESET, values.palette ?? OPENING_PALETTE);
  const opening = { preset: OPENING_PRESET, palette: OPENING_PALETTE };
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

// Never throws; returns only known settings with in-range values, and a view or null.
export function decode(fragment) {
  const values = {};
  let view = null;
  const text = typeof fragment === 'string' && fragment.length <= MAX_FRAGMENT ? fragment : '';
  for (const part of text.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = safeDecode(part.slice(0, eq));
    const raw = safeDecode(part.slice(eq + 1));
    if (name === null || raw === null) continue;
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
    const palette = values.palette ?? OPENING_PALETTE;
    if (!BY_NAME.get('colours').choicesFor(palette).includes(values.colours)) delete values.colours;
  }
  return { values, view };
}
