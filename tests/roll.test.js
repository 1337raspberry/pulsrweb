import { expect, test } from 'vitest';
import { ROLLED, ROLLED_WILD, roll, rollView } from '../src/roll.js';
import { PRESET_COLOURS, SETTINGS, defaults } from '../src/settings.js';
import { findPalette } from '../src/palettes.js';

const byName = Object.fromEntries(SETTINGS.map((s) => [s.name, s]));

// A repeatable stand-in for Math.random (mulberry32).
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const many = (count, seed = 1) => {
  const random = seeded(seed);
  return Array.from({ length: count }, () => roll(random));
};

test('a roll sets the look and the colours, and nothing else', () => {
  expect(ROLLED).toEqual(['preset', 'shape', 'line', 'tint', 'backdrop', 'filter', 'filter2', 'palette', 'colours', 'peak', 'speed', 'rows']);
  for (const look of many(200)) expect(Object.keys(look)).toEqual(ROLLED);
  // Of the sliders only the three main ones move: none of those under `more`, and how the
  // ridge answers the music above all.
  for (const s of SETTINGS) if (s.group === 'more') expect(ROLLED, s.name).not.toContain(s.name);
  for (const name of ['gamma', 'floorCut', 'gain', 'attack', 'decay']) expect(ROLLED).not.toContain(name);
  expect(ROLLED).not.toContain('flow');
  expect(ROLLED[0]).toBe('preset');
  expect(ROLLED.indexOf('palette')).toBeLessThan(ROLLED.indexOf('colours'));
});

test('every value rolled is one the options offer', () => {
  for (const look of many(500)) {
    for (const name of ['shape', 'line', 'tint', 'backdrop', 'filter', 'filter2', 'palette']) {
      expect(byName[name].choices, `${name} ${look[name]}`).toContain(look[name]);
    }
    expect(findPalette(look.palette).gradients.map((g) => g.name)).toContain(look.colours);
  }
});

test('entries that belong to one scene are never rolled', () => {
  for (const look of many(2000)) {
    expect(look.backdrop).not.toBe('spreadsheet');
    for (const filter of ['plotarea', 'teletext']) {
      expect(look.filter).not.toBe(filter);
      expect(look.filter2).not.toBe(filter);
    }
  }
});

test('a second filter is a light one, and only over a first', () => {
  const looks = many(2000);
  for (const look of looks) {
    if (look.filter2 === 'none') continue;
    expect(['glowup', 'vignette', 'fringe', 'telly']).toContain(look.filter2);
    expect(look.filter).not.toBe('none');
    expect(look.filter2).not.toBe(look.filter);
  }
  const share = looks.filter((look) => look.filter2 !== 'none').length / looks.length;
  expect(share).toBeGreaterThan(0.05);
  expect(share).toBeLessThan(0.25);
});

test('about half the rolls keep the flat shape, and half go unfiltered', () => {
  const looks = many(4000);
  const share = (name, value) => looks.filter((look) => look[name] === value).length / looks.length;
  expect(share('shape', 'flat')).toBeGreaterThan(0.4);
  expect(share('shape', 'flat')).toBeLessThan(0.6);
  expect(share('filter', 'none')).toBeGreaterThan(0.4);
  expect(share('filter', 'none')).toBeLessThan(0.6);
  expect(share('backdrop', 'plain')).toBeGreaterThan(0.3);
  expect(share('backdrop', 'plain')).toBeLessThan(0.5);
});

test('every entry that is not kept out turns up', () => {
  const looks = many(6000);
  for (const name of ['shape', 'line', 'tint', 'backdrop', 'filter']) {
    const seen = new Set(looks.map((look) => look[name]));
    const out = name === 'backdrop' ? ['spreadsheet'] : name === 'filter' ? ['plotarea', 'teletext'] : [];
    const kept = byName[name].choices.filter((choice) => !out.includes(choice));
    expect([...seen].sort(), name).toEqual([...kept].sort());
  }
  expect(new Set(looks.map((look) => look.palette)).size).toBe(byName.palette.choices.length);
});

test('the same run of numbers rolls the same looks, and the top of the range is safe', () => {
  expect(many(20, 7)).toEqual(many(20, 7));
  expect(many(20, 7)).not.toEqual(many(20, 8));
  const look = roll(() => 0.9999999999999999);
  for (const name of ROLLED.slice(0, 9)) expect(look[name], name).toEqual(expect.any(String));
  expect(Object.keys(roll(() => 0))).toEqual(ROLLED);
});

test('a roll starts from one of the three plain presets, each about as often', () => {
  const looks = many(3000);
  for (const preset of ['division', 'immersive', 'closeup']) {
    const share = looks.filter((look) => look.preset === preset).length / looks.length;
    expect(share, preset).toBeGreaterThan(0.28);
    expect(share, preset).toBeLessThan(0.39);
    // None of them is a scene, which would bring a look and colours of its own.
    expect(PRESET_COLOURS[preset], preset).toBeUndefined();
    for (const name of ['shape', 'line', 'tint', 'backdrop', 'filter', 'filter2']) {
      expect(defaults(preset)[name], `${preset} ${name}`).toBe(defaults()[name]);
    }
  }
  expect(new Set(looks.map((look) => look.preset)).size).toBe(3);
});

test('the three sliders stay near what the rolled preset gives them', () => {
  {
    for (const look of many(3000, 3)) {
      const preset = look.preset;
      const base = defaults(preset);
      // Half a step of slack for landing on the slider's own steps.
      expect(look.peak, preset).toBeGreaterThanOrEqual(Math.max(0.05, base.peak * 0.85 - 0.005));
      expect(look.peak, preset).toBeLessThanOrEqual(base.peak * 1.25 + 0.005);
      expect(look.speed, preset).toBeGreaterThanOrEqual(Math.max(2, base.speed * 0.4 - 0.5));
      expect(look.speed, preset).toBeLessThanOrEqual(base.speed * 1.2 + 0.5);
      expect(look.rows, preset).toBeGreaterThanOrEqual(Math.max(10, base.rows * 0.5 - 0.5));
      expect(look.rows, preset).toBeLessThanOrEqual(Math.min(120, base.rows * 1.5 + 0.5));
      expect(Number.isInteger(look.speed) && Number.isInteger(look.rows), preset).toBe(true);
      expect(look.peak, preset).toBe(Number(look.peak.toFixed(2)));
    }
  }
});

test('the sliders do move, to both sides of the preset’s value', () => {
  const base = defaults('immersive');
  const looks = many(1500).filter((look) => look.preset === 'immersive');
  for (const name of ['peak', 'speed', 'rows']) {
    expect(looks.some((look) => look[name] < base[name]), name).toBe(true);
    expect(looks.some((look) => look[name] > base[name]), name).toBe(true);
  }
  // Slower more often than faster.
  expect(looks.filter((look) => look.speed < base.speed).length).toBeGreaterThan(looks.length * 0.6);
  expect(Math.max(...looks.map((look) => look.speed))).toBeLessThanOrEqual(36);
});

const manyWild = (count, seed = 1) => {
  const random = seeded(seed);
  return Array.from({ length: count }, () => roll(random, true));
};
// What sets how the ridge answers the music.
const REACTIVITY = ['gamma', 'floorCut', 'gain', 'attack', 'decay'];

test('a wild roll sets the look, the shape, the depth and the lens, and never the music reactivity', () => {
  expect(ROLLED_WILD.slice(0, ROLLED.length)).toEqual(ROLLED);
  for (const look of manyWild(200)) expect(Object.keys(look)).toEqual(ROLLED_WILD);
  for (const name of REACTIVITY) expect(ROLLED_WILD, name).not.toContain(name);
  for (const s of SETTINGS) {
    if (s.folder === 'music reactivity' || s.folder === 'cover' || s.sticky) expect(ROLLED_WILD, s.name).not.toContain(s.name);
    if (s.kind === 'number' && ['shape', 'depth', 'camera'].includes(s.folder)) expect(ROLLED_WILD, s.name).toContain(s.name);
  }
  expect(ROLLED_WILD).toEqual(expect.arrayContaining(['flow', 'rising', 'tilt', 'fov', 'lineWidth', 'spacing']));
  expect(ROLLED_WILD).not.toContain('drift');
});

test('every value of a wild roll is one the options allow', () => {
  for (const look of manyWild(1500)) {
    for (const name of ROLLED_WILD) {
      const s = byName[name];
      if (s.kind === 'number') {
        expect(look[name], name).toBeGreaterThanOrEqual(s.min);
        expect(look[name], name).toBeLessThanOrEqual(s.max);
        // On one of the slider's own steps.
        expect(Math.abs(look[name] / s.step - Math.round(look[name] / s.step)), `${name} ${look[name]}`).toBeLessThan(1e-6);
      } else if (s.kind === 'boolean') {
        expect(look[name], name).toEqual(expect.any(Boolean));
      } else if (name === 'colours') {
        expect(findPalette(look.palette).gradients.map((g) => g.name)).toContain(look.colours);
      } else {
        expect(s.choices, `${name} ${look[name]}`).toContain(look[name]);
      }
    }
    expect(look.backdrop).not.toBe('spreadsheet');
    for (const filter of ['plotarea', 'teletext']) {
      expect(look.filter).not.toBe(filter);
      expect(look.filter2).not.toBe(filter);
    }
    if (look.filter !== 'none') expect(look.filter2).not.toBe(look.filter);
  }
});

test('a wild roll reaches the whole of every slider, yet leaves most near the preset', () => {
  const looks = manyWild(6000);
  for (const name of ROLLED_WILD) {
    const s = byName[name];
    if (s.kind !== 'number') continue;
    const seen = looks.map((look) => look[name]);
    const reach = s.max - s.min;
    expect(Math.min(...seen), name).toBeLessThanOrEqual(s.min + reach * 0.05);
    expect(Math.max(...seen), name).toBeGreaterThanOrEqual(s.max - reach * 0.05);
    // More than half land within a quarter of the slider of where the rolled preset has it.
    const near = looks.filter((look) => Math.abs(look[name] - defaults(look.preset)[name]) <= reach * 0.25).length;
    expect(near / looks.length, name).toBeGreaterThan(0.5);
  }
});

test('a wild roll puts any entry in any slot, with no leaning to the plain ones', () => {
  const looks = manyWild(6000);
  const share = (name, value) => looks.filter((look) => look[name] === value).length / looks.length;
  expect(share('shape', 'flat')).toBeLessThan(0.15);
  expect(share('filter', 'none')).toBeLessThan(0.1);
  expect(share('backdrop', 'plain')).toBeLessThan(0.12);
  // Two heavy filters at once can come up, as a plain roll never allows.
  expect(looks.some((look) => look.filter === 'kaleido' && look.filter2 === 'tty')).toBe(true);
  expect(new Set(looks.map((look) => look.filter2)).size).toBe(byName.filter.choices.filter((choice) => !['plotarea', 'teletext'].includes(choice)).length);
  expect(share('flow', 'towards live')).toBeGreaterThan(0.28);
  expect(share('flow', 'towards live')).toBeLessThan(0.39);
  expect(share('rising', true)).toBeGreaterThan(0.45);
  expect(share('rising', true)).toBeLessThan(0.55);
});

test('a plain roll is as it was beside a wild one', () => {
  expect(Object.keys(roll(seeded(5), false))).toEqual(ROLLED);
  expect(roll(seeded(5))).toEqual(roll(seeded(5), false));
  expect(manyWild(10, 4)).toEqual(manyWild(10, 4));
});

test('the camera is sent to either side, in and out, and its target a little way off', () => {
  const random = seeded(9);
  const views = Array.from({ length: 2000 }, () => rollView(random));
  for (const view of views) {
    expect(Math.abs(view.turn)).toBeLessThanOrEqual(0.7);
    expect(view.zoom).toBeGreaterThanOrEqual(1 / 1.6 - 1e-9);
    expect(view.zoom).toBeLessThanOrEqual(1.6 + 1e-9);
    expect(Math.abs(view.pan[0])).toBeLessThanOrEqual(3);
    expect(Math.abs(view.pan[1])).toBeLessThanOrEqual(1.5);
    expect(view.pan[2]).toBe(0);
  }
  expect(views.some((view) => view.turn < -0.5) && views.some((view) => view.turn > 0.5)).toBe(true);
  expect(views.some((view) => view.zoom < 0.7) && views.some((view) => view.zoom > 1.45)).toBe(true);
});
