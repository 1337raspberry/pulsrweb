// The settings table, and its encoding into a link fragment (the text after `#`).
//
// There are two sets of defaults. The table's own belong to the opening theme, which
// draws the ridge as a record sleeve; under any other theme the settings in CLASSIC take
// pulsr's own values instead.
import { THEMES, findTheme } from './themes.js';

export const OPENING_THEME = 'division';

const num = (name, def, min, max, step, label = name, group = 'basic') => ({
  name, kind: 'number', default: def, min, max, step, label, group,
});
const more = (folder) => ({ group: 'more', folder });

const flag = (name, def, folder) => ({ name, kind: 'boolean', default: def, label: name, ...more(folder) });

export const SETTINGS = [
  {
    name: 'theme', kind: 'choice', default: OPENING_THEME, label: 'theme', group: 'basic',
    choices: THEMES.map((t) => t.name),
  },
  {
    name: 'gradient', kind: 'choice', default: 'white', label: 'gradient', group: 'basic',
    choicesFor: (themeName) => findTheme(themeName).gradients.map((g) => g.name),
  },
  num('peak', 0.25, 0.05, 1.5, 0.01, 'height'),
  num('speed', 12, 2, 80, 1), // rows per second; rowMs = 1000 / speed
  num('rows', 80, 10, 120, 1, 'depth'),
  num('lineWidth', 1.4, 0.5, 6, 0.05, 'line'),
  ...[
    ['gamma', 4, 1, 8, 0.1, 'levels'],
    ['floorCut', 0.6, 0, 0.9, 0.01, 'levels'],
    ['gain', 1.15, 0.5, 3, 0.05, 'levels'],
    ['attack', 0.67, 0.05, 1, 0.01, 'motion'],
    ['decay', 0.5, 0.05, 1, 0.01, 'motion'],
    flag('rising', false, 'motion'),
    ['spread', 1, 0, 4, 0.1, 'shape'],
    ['smooth', 0.1, 0, 0.6, 0.01, 'shape'],
    ['grain', 0.03, 0, 0.3, 0.01, 'shape'],
    ['noise', 0.03, 0, 0.1, 0.005, 'shape'],
    ['span', 0.7, 0.2, 1, 0.01, 'shape'],
    ['edgeTaper', 0.22, 0, 0.5, 0.01, 'shape'],
    ['axisCurve', 0.75, 0.4, 1.2, 0.01, 'shape'],
    ['spacing', 0.3, 0.05, 0.6, 0.01, 'depth'],
    ['depthScale', 1, 0.2, 1.5, 0.01, 'depth'],
    ['fadeCurve', 0, 0, 3, 0.05, 'depth'],
    ['alpha', 1, 0.1, 1, 0.01, 'depth'],
    ['fov', 30, 15, 75, 1, 'camera'],
    ['tilt', 40, 15, 75, 1, 'camera'], // degrees the front view looks down from
    flag('drift', true, 'camera'),
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

// pulsr's own look, which every theme but the opening one starts from.
const CLASSIC = {
  peak: 0.6, speed: 30, rows: 51, lineWidth: 1.25, noise: 0, span: 1,
  spacing: 0.38, depthScale: 0.39, fadeCurve: 0.75, alpha: 0.85, tilt: 18,
};

const BY_NAME = new Map(SETTINGS.map((s) => [s.name, s]));

// Every setting's default under `theme`. A theme other than the opening one comes with
// its first gradient.
export function defaults(theme = OPENING_THEME) {
  const base = Object.fromEntries(SETTINGS.map((s) => [s.name, s.default]));
  if (theme === OPENING_THEME) return base;
  return { ...base, ...CLASSIC, theme, gradient: findTheme(theme).gradients[0].name };
}

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

function writeValue(s, v) {
  if (s.kind === 'number') return Number(v).toFixed(decimals(s.step));
  return String(v);
}

// Fragment text without the `#`: the theme unless it is the opening one, the settings that
// differ from that theme's defaults, then the camera view.
export function encode(values, view) {
  const parts = [];
  const theme = values.theme ?? OPENING_THEME;
  const base = defaults(theme);
  for (const s of SETTINGS) {
    const v = values[s.name];
    if (v === undefined) continue;
    if (s.name === 'theme' ? v === OPENING_THEME : v === base[s.name]) continue;
    parts.push(`${s.name}=${encodeURIComponent(writeValue(s, v))}`);
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
      values[name] = raw; // checked against the theme below
    }
  }
  if ('gradient' in values) {
    const theme = values.theme ?? BY_NAME.get('theme').default;
    if (!BY_NAME.get('gradient').choicesFor(theme).includes(values.gradient)) delete values.gradient;
  }
  return { values, view };
}
