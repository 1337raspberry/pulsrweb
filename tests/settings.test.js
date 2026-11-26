import { expect, test } from 'vitest';
import { OPENING_THEME, SETTINGS, decode, defaults, encode } from '../src/settings.js';
import { THEMES } from '../src/themes.js';

const byName = Object.fromEntries(SETTINGS.map((s) => [s.name, s]));

test('the table has the 32 settings', () => {
  expect(SETTINGS.length).toBe(32);
  expect(byName.peak).toMatchObject({ default: 0.25, min: 0.05, max: 1.5, step: 0.01, label: 'height', group: 'basic' });
  expect(byName.gamma).toMatchObject({ group: 'more', folder: 'levels' });
  expect(byName.rising).toMatchObject({ kind: 'boolean', default: false, folder: 'motion' });
  expect(byName.drift).toMatchObject({ kind: 'boolean', default: true, folder: 'camera' });
  expect(byName.demoSpread).toMatchObject({ default: 0.27, label: 'spread', group: 'more', folder: 'cover' });
  expect(SETTINGS.map((s) => s.name).slice(0, 2)).toEqual(['theme', 'gradient']);
});

test('defaults encode to nothing', () => expect(encode(defaults(), null)).toBe(''));

test('the opening theme has the sleeve’s defaults, and every other theme pulsr’s own', () => {
  expect(OPENING_THEME).toBe('division');
  expect(defaults()).toMatchObject({ theme: 'division', gradient: 'white', rows: 80, speed: 12, peak: 0.25, span: 0.7, fadeCurve: 0, tilt: 40 });
  expect(defaults('nord')).toMatchObject({
    theme: 'nord', gradient: 'frost', peak: 0.6, speed: 30, rows: 51, lineWidth: 1.25, noise: 0, span: 1,
    spacing: 0.38, depthScale: 0.39, fadeCurve: 0.75, alpha: 0.85, tilt: 18,
  });
  // What the two share.
  expect(defaults('nord').gamma).toBe(defaults().gamma);
  expect(Object.keys(defaults('nord'))).toEqual(Object.keys(defaults()));
});

test('a link is written against its own theme’s defaults', () => {
  expect(encode(defaults('nord'), null)).toBe('theme=nord');
  expect(encode({ ...defaults('nord'), gradient: 'aurora', rows: 80 }, null)).toBe('theme=nord&gradient=aurora&rows=80');
  // The sleeve's value for a setting is a change under another theme, and the other way round.
  expect(encode({ ...defaults(), rows: 51 }, null)).toBe('rows=51');
  const back = decode(encode({ ...defaults('nord'), peak: 0.9 }, null));
  expect({ ...defaults(back.values.theme), ...back.values }).toEqual({ ...defaults('nord'), peak: 0.9 });
});

test('a look survives a round trip', () => {
  const v = { ...defaults('nord'), gradient: 'aurora', peak: 0.9, rows: 60, rising: true, drift: false };
  const view = { position: [1, 7.5, 22], target: [0, 1.5, -4] };
  const back = decode(encode(v, view));
  expect({ ...defaults(back.values.theme), ...back.values }).toEqual(v);
  expect(back.view).toEqual(view);
});

test('numbers are written at their step’s precision', () => {
  expect(encode({ ...defaults(), peak: 0.9, rows: 60, lineWidth: 2, gamma: 5, noise: 0.05 }, null))
    .toBe('peak=0.90&rows=60&lineWidth=2.00&gamma=5.0&noise=0.050');
});

test('every setting round-trips at a non-default value', () => {
  const v = defaults();
  for (const s of SETTINGS) {
    if (s.kind === 'number') v[s.name] = s.default === s.max ? s.min : s.max;
    if (s.kind === 'boolean') v[s.name] = !s.default;
  }
  expect(decode(encode(v, null)).values).toEqual({
    ...Object.fromEntries(SETTINGS.filter((s) => s.kind !== 'choice').map((s) => [s.name, v[s.name]])),
  });
});

test('a bad fragment yields defaults and never throws', () => {
  for (const f of ['peak=1e99&rows=-5&theme=<script>&gradient=nope&bogus=1&speed=abc&view=1,2,NaN',
                   '%%%', '&&&===', 'view=9e9,0,0,0,0,0', 'peak=', 'rising=maybe', 'peak=%E0%A4%A&rows',
                   '__proto__=1&constructor=2', 'peak=1e999', 'peak=0x10', 'peak=Infinity']) {
    const { values, view } = decode(f);
    for (const [k, v] of Object.entries(values)) {
      const s = byName[k];
      expect(s).toBeDefined();
      if (s.kind === 'number') {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(s.min);
        expect(v).toBeLessThanOrEqual(s.max);
      }
    }
    expect(view).toBeNull();
  }
  expect(decode('peak=1e99').values.peak).toBe(1.5);
  expect(decode('rows=-5').values.rows).toBe(10);
  expect(decode('theme=<script>').values.theme).toBeUndefined();
  expect(decode('peak=').values.peak).toBeUndefined();
  expect(decode('rising=maybe').values.rising).toBeUndefined();
  expect(decode('rising=true').values.rising).toBe(true);
  expect(decode(undefined)).toEqual({ values: {}, view: null });
});

test('a gradient is checked against the fragment’s theme, else the default theme', () => {
  expect(decode('theme=nord&gradient=aurora').values).toEqual({ theme: 'nord', gradient: 'aurora' });
  expect(decode('gradient=aurora&theme=nord').values.gradient).toBe('aurora');
  expect(decode('theme=nord&gradient=grey-white').values.gradient).toBeUndefined();
  expect(decode('gradient=grey-white').values.gradient).toBe('grey-white');
  expect(decode('gradient=aurora').values.gradient).toBeUndefined();
});

test('view needs six finite numbers within bounds', () => {
  expect(decode('view=1,2,3,4,5,6').view).toEqual({ position: [1, 2, 3], target: [4, 5, 6] });
  expect(decode('view=1,2,3').view).toBeNull();
  expect(decode('view=1001,0,0,0,0,0').view).toBeNull();
});

// The time limits catch a freeze, not slowness.
test('a fragment over the length cap is dropped whole', () => {
  const t0 = performance.now();
  const { values, view } = decode('peak=' + '1'.repeat(100000) + 'x');
  expect(performance.now() - t0).toBeLessThan(1000);
  expect(values.peak).toBeUndefined();
  expect(view).toBeNull();
});

test('a long run of digits under the length cap fails the number pattern without a freeze', () => {
  const fragment = 'peak=' + '1'.repeat(1900) + 'x';
  expect(fragment.length).toBeLessThanOrEqual(2000);
  const t0 = performance.now();
  expect(decode(fragment).values.peak).toBeUndefined();
  expect(performance.now() - t0).toBeLessThan(1000);
});

test('an over-long fragment decodes to nothing', () => {
  const f = 'peak=0.9&view=1,2,3,4,5,6&' + 'a=1&'.repeat(600);
  expect(f.length).toBeGreaterThan(2000);
  expect(decode(f)).toEqual({ values: {}, view: null });
});

test('a view coordinate a hair below zero is written as 0.00', () => {
  const view = { position: [-1e-15, 9.5, 15.5], target: [0, -0.004, -7] };
  expect(encode(defaults(), view)).toBe('view=0.00,9.50,15.50,0.00,0.00,-7.00');
});

// The page gives a theme without a gradient that theme's first gradient.
test('every theme and gradient pair survives a round trip', () => {
  for (const { name: theme, gradients } of THEMES) {
    for (const { name: gradient } of gradients) {
      const { values } = decode(encode({ ...defaults(theme), gradient }, null));
      const back = { ...defaults(values.theme), ...values };
      expect([back.theme, back.gradient]).toEqual([theme, gradient]);
    }
  }
});
