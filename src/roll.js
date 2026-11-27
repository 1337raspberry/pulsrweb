// A look at random, for stumbling on combinations no preset has: one of the plain presets
// to stand the ridge up in, an entry for each of the look's slots, a set of colours, and
// the three main sliders moved a little. A wild roll goes further: any entry in any slot,
// every slider of the shape, the depth and the camera anywhere in its range, and the
// camera sent off somewhere of its own. How the ridge answers the music is never rolled.
import { SLOTS } from './looks/index.js';
import { PALETTES } from './palettes.js';
import { FLOWS, SETTINGS, defaults } from './settings.js';

// What a roll sets, in the order to set it: the preset comes before what is changed from
// it, and a palette before its colours.
export const ROLLED = ['preset', 'shape', 'line', 'tint', 'backdrop', 'filter', 'filter2', 'palette', 'colours', 'peak', 'speed', 'rows'];

// The sliders a wild roll moves as well: the rest of the shape, the depth and the lens.
const STRAYED = SETTINGS.filter((s) => s.kind === 'number' && ['shape', 'depth', 'camera'].includes(s.folder)).map((s) => s.name);
// What a wild roll sets, in the order to set it.
export const ROLLED_WILD = [...ROLLED, 'flow', 'rising', ...STRAYED];

// The presets a roll starts from: the three that are a way of laying the rows out and
// looking at them, with no look of their own. Each brings its camera and its spacing.
const STAGINGS = ['division', 'immersive', 'closeup'];

// Entries made for one scene, which need the rest of that scene to make sense.
const KEPT_OUT = { backdrop: ['spreadsheet'], filter: ['plotarea'] };
// The share of rolls that leave a slot at its first, plain entry. A roll then changes a
// few things about the picture rather than all of them at once.
const PLAIN = { shape: 0.5, backdrop: 0.4, filter: 0.5 };
// The filters light enough to go over another one. A second filter is rolled this often,
// from these alone, and only over a first.
const FINISHES = ['glowup', 'vignette', 'fringe', 'telly'];
const FINISHED = 0.25;
// The sliders a roll moves, each to somewhere between these two shares of the value the
// rolled preset gives it, so a roll stays near what the preset was tuned to. The height
// hardly moves, the speed leans slower, and the depth goes from half to half as much again.
const SWINGS = { peak: [0.85, 1.25], speed: [0.4, 1.2], rows: [0.5, 1.5] };
// How often a wild roll turns the rows to come at the camera.
const TOWARDS = 1 / 3;
// Where a wild roll may send the camera: turned up to this share of the way to either
// side its layout allows, in closer or further out by up to this factor, and looking at a
// point up to this far to the side of and above or below the layout's own.
const TURN = 0.7;
const ZOOM = 1.6;
const PAN = [3, 1.5];

const BY_NAME = new Map(SETTINGS.map((s) => [s.name, s]));
const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
// A number from -1 up to 1.
const either = (random) => random() * 2 - 1;

// The names `slot` is rolled from: its plain first entry, and the others a roll may land on.
function entries(slot) {
  const [plain, ...others] = SLOTS[slot].map((entry) => entry.name).filter((name) => !KEPT_OUT[slot]?.includes(name));
  return { plain, others };
}

function rollSlot(slot, random, wild) {
  const { plain, others } = entries(slot);
  if (!wild && slot in PLAIN) return random() < PLAIN[slot] ? plain : pick(others, random);
  return pick([plain, ...others], random);
}

// `value` on one of the slider's own steps and within its range.
function onStep({ min, max, step }, value) {
  const places = (String(step).split('.')[1] ?? '').length;
  return Math.min(max, Math.max(min, Number((Math.round(value / step) * step).toFixed(places))));
}

// A value for the slider `name` near `from`, within the slider's swing.
function swung(name, from, random) {
  const [low, high] = SWINGS[name];
  return onStep(BY_NAME.get(name), from * (low + random() * (high - low)));
}

// A value for the slider `name` anywhere in its range: some of the way from `from` to a
// point picked evenly along the slider, most often the smaller part of the way. Every
// value can come up, and a roll of many sliders still leaves most of them near where the
// preset had them.
function strayed(name, from, random) {
  const s = BY_NAME.get(name);
  const towards = s.min + random() * (s.max - s.min);
  return onStep(s, from + (towards - from) * random() ** 2);
}

// A value for each name in ROLLED, or with `wild` for each in ROLLED_WILD. `random`
// returns a number from 0 up to 1, as Math.random does.
export function roll(random = Math.random, wild = false) {
  const preset = pick(STAGINGS, random);
  const base = defaults(preset);
  const [shape, line, tint, backdrop, filter] = ['shape', 'line', 'tint', 'backdrop', 'filter'].map((slot) => rollSlot(slot, random, wild));
  const none = entries('filter').plain;
  let filter2 = none;
  if (wild) {
    // Any filter at all over the first, but not the first again.
    const { plain, others } = entries('filter');
    filter2 = pick([plain, ...others].filter((name) => name === plain || name !== filter), random);
  } else if (filter !== none && random() < FINISHED) {
    filter2 = pick(FINISHES.filter((name) => name !== filter), random);
  }
  const palette = pick(PALETTES, random);
  const colours = pick(palette.gradients, random).name;
  const slider = wild ? strayed : swung;
  const [peak, speed, rows] = Object.keys(SWINGS).map((name) => slider(name, base[name], random));
  const look = { preset, shape, line, tint, backdrop, filter, filter2, palette: palette.name, colours, peak, speed, rows };
  if (!wild) return look;
  look.flow = random() < TOWARDS ? FLOWS[1] : FLOWS[0];
  look.rising = random() < 0.5;
  for (const name of STRAYED) look[name] = strayed(name, base[name], random);
  return look;
}

// Where a wild roll sends the camera, from its layout's front view: `turn` is the share of
// the way round to one side (below zero) or the other, `zoom` what the framing is
// multiplied by, and `pan` how far the point it looks at slides, across and up.
export function rollView(random = Math.random) {
  return {
    turn: either(random) * TURN,
    zoom: ZOOM ** either(random),
    pan: [either(random) * PAN[0], either(random) * PAN[1], 0],
  };
}
