// The settings table, and its encoding into a link fragment (the text after `#`).
import { THEMES, findTheme } from './themes.js';

const num = (name, def, min, max, step, label = name, group = 'basic') => ({
  name, kind: 'number', default: def, min, max, step, label, group,
});
const more = (folder) => ({ group: 'more', folder });

export const SETTINGS = [
  {
    name: 'theme', kind: 'choice', default: 'tokyo-night', label: 'theme', group: 'basic',
    choices: THEMES.map((t) => t.name),
  },
  {
    name: 'gradient', kind: 'choice', default: 'blue-red', label: 'gradient', group: 'basic',
    choicesFor: (themeName) => findTheme(themeName).gradients.map((g) => g.name),
  },
  num('peak', 0.6, 0.1, 1.5, 0.01, 'height'),
  num('speed', 30, 8, 80, 1), // rows per second; rowMs = 1000 / speed
  num('rows', 51, 10, 120, 1, 'depth'),
  num('lineWidth', 1.25, 0.5, 6, 0.05, 'line'),
  ...[
    ['gamma', 4, 1, 8, 0.1, 'levels'],
    ['floorCut', 0.6, 0, 0.9, 0.01, 'levels'],
    ['gain', 1.15, 0.5, 3, 0.05, 'levels'],
    ['attack', 0.67, 0.05, 1, 0.01, 'motion'],
    ['decay', 0.5, 0.05, 1, 0.01, 'motion'],
    ['spread', 1, 0, 4, 0.1, 'shape'],
    ['smooth', 0.1, 0, 0.6, 0.01, 'shape'],
    ['grain', 0.03, 0, 0.3, 0.01, 'shape'],
    ['edgeTaper', 0.22, 0, 0.5, 0.01, 'shape'],
    ['axisCurve', 0.75, 0.4, 1.2, 0.01, 'shape'],
    ['spacing', 0.38, 0.05, 0.6, 0.01, 'depth'],
    ['depthScale', 0.39, 0.2, 1.5, 0.01, 'depth'],
    ['fadeCurve', 0.75, 0.2, 3, 0.05, 'depth'],
    ['alpha', 0.85, 0.1, 1, 0.01, 'depth'],
    ['fov', 30, 15, 75, 1, 'camera'],
  ].flatMap(([name, def, min, max, step, folder]) => {
    const s = { ...num(name, def, min, max, step), ...more(folder) };
    return name === 'decay' ? [s, { name: 'rising', kind: 'boolean', default: false, label: 'rising', ...more('motion') }] : [s];
  }),
];

const BY_NAME = new Map(SETTINGS.map((s) => [s.name, s]));

export function defaults() {
  return Object.fromEntries(SETTINGS.map((s) => [s.name, s.default]));
}

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

function writeValue(s, v) {
  if (s.kind === 'number') return Number(v).toFixed(decimals(s.step));
  return String(v);
}

// Fragment text without the `#`: settings that differ from their default, then the camera view.
// Under a theme other than the default, the gradient is always written, since the default
// gradient's name can belong to that theme too.
export function encode(values, view) {
  const parts = [];
  const otherTheme = values.theme !== undefined && values.theme !== BY_NAME.get('theme').default;
  for (const s of SETTINGS) {
    const v = values[s.name];
    if (v === undefined || (v === s.default && !(s.name === 'gradient' && otherTheme))) continue;
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
