import { expect, test } from 'vitest';
import {
  FLOWS, LAYOUTS, OPENING_PALETTE, OPENING_PRESET, PRESETS, PRESET_COLOURS, SETTINGS, decode, defaults, encode,
} from '../src/settings.js';
import { PALETTES, findPalette } from '../src/palettes.js';
import { findEntry } from '../src/looks/index.js';

const byName = Object.fromEntries(SETTINGS.map((s) => [s.name, s]));

test('the table has the 42 settings', () => {
  expect(SETTINGS.length).toBe(42);
  expect(byName.peak).toMatchObject({ default: 0.25, min: 0.05, max: 1.5, step: 0.01, label: 'height', group: 'basic' });
  expect(byName.gamma).toMatchObject({ group: 'more', folder: 'music reactivity' });
  expect(byName.lineWidth).toMatchObject({ label: 'line width', group: 'more', folder: 'shape' });
  expect(byName.rising).toMatchObject({ kind: 'boolean', default: false, folder: 'motion' });
  expect(byName.drift).toMatchObject({ kind: 'boolean', default: false, folder: 'camera' });
  expect(byName.demoSpread).toMatchObject({ default: 0.27, label: 'spread', group: 'more', folder: 'cover' });
  expect(SETTINGS.map((s) => s.name).slice(0, 3)).toEqual(['preset', 'palette', 'colours']);
  expect(SETTINGS.slice(0, 3).map((s) => s.label)).toEqual(['visual preset', 'palette', 'colours']);
  expect(byName.pause).toMatchObject({ kind: 'boolean', default: false, label: 'pause on silence', sticky: true });
});

test('every setting says what it does in one short line', () => {
  for (const s of SETTINGS) {
    expect(s.help, s.name).toEqual(expect.any(String));
    expect(s.help.length, s.name).toBeGreaterThan(10);
    expect(s.help.length, s.name).toBeLessThanOrEqual(90);
    expect(s.help, s.name).not.toMatch(/\n/);
  }
});

test('defaults encode to nothing', () => expect(encode(defaults(), null)).toBe(''));

test('the opening preset has the sleeve’s defaults, and immersive pulsr’s own', () => {
  expect(PRESETS.slice(0, 4)).toEqual(['division', 'immersive', 'inyoface', 'sheet']);
  expect([OPENING_PRESET, OPENING_PALETTE]).toEqual(['division', 'greyscale']);
  expect(defaults()).toMatchObject({
    preset: 'division', palette: 'greyscale', colours: 'white', rows: 80, speed: 12, peak: 0.25, span: 0.7, fadeCurve: 0, tilt: 40,
  });
  expect(defaults('immersive')).toMatchObject({
    preset: 'immersive', palette: 'greyscale', colours: 'white', peak: 0.6, speed: 30, rows: 51, lineWidth: 1.25, noise: 0,
    span: 1, spacing: 0.38, depthScale: 0.39, fadeCurve: 0.75, alpha: 0.85, tilt: 18,
  });
  // What the two share.
  expect(defaults('immersive').gamma).toBe(defaults().gamma);
  expect(Object.keys(defaults('immersive'))).toEqual(Object.keys(defaults()));
});

test('the closer presets are pulsr’s own from another seat', () => {
  const { preset: a, tilt: tiltA, ...immersive } = defaults('immersive');
  const { preset: b, tilt: tiltB, ...inyoface } = defaults('inyoface');
  expect(inyoface).toEqual(immersive);
  expect([tiltA, tiltB]).toEqual([18, 2]);
  expect(defaults('sheet')).toEqual({
    ...defaults('inyoface'), preset: 'sheet', flow: 'towards live', trench: 0.25, rows: 100, speed: 50,
  });
  expect(LAYOUTS.sheet.framing).toBeGreaterThan(LAYOUTS.inyoface.framing);
  expect(LAYOUTS.sheet).toEqual({ sleeve: false, framing: 15.75, target: [0, 3, -7] });
  expect(decode('preset=trenchrun').values.preset).toBeUndefined();
  expect(defaults().flow).toBe('away');
  expect(FLOWS).toEqual(['away', 'towards live']);
  // No preset has the camera drift.
  for (const preset of PRESETS) expect(defaults(preset).drift, preset).toBe(false);
});

test('the scenes are named, each once, in lower case', () => {
  expect(PRESETS.length).toBeGreaterThanOrEqual(20);
  expect(new Set(PRESETS).size).toBe(PRESETS.length);
  for (const preset of PRESETS) expect(preset).toMatch(/^[a-z0-9]{2,12}$/);
});

test('a scene brings colours that exist, and its link is its name alone', () => {
  for (const [preset, own] of Object.entries(PRESET_COLOURS)) {
    expect(PRESETS, preset).toContain(preset);
    const palette = findPalette(own.palette);
    expect(palette.name, preset).toBe(own.palette);
    expect(palette.gradients.map((g) => g.name), preset).toContain(own.colours);
    expect(defaults(preset), preset).toMatchObject({ palette: own.palette, colours: own.colours });
  }
  for (const preset of PRESETS.slice(1)) {
    expect(encode(defaults(preset), null), preset).toBe(`preset=${preset}`);
    const { values } = decode(`preset=${preset}`);
    expect({ ...defaults(values.preset, values.palette), ...values }, preset).toEqual(defaults(preset));
  }
});

test('every preset has a layout, and a setting within range for each default', () => {
  for (const preset of PRESETS) {
    const d = defaults(preset);
    // A shape with a layout of its own brings it; on the flat ridge the preset names one.
    const layout = findEntry('shape', d.shape).layout ?? LAYOUTS[preset];
    expect(layout, preset).toBeDefined();
    expect(layout.sleeve || layout.framing > 0, preset).toBeTruthy();
    for (const s of SETTINGS) {
      if (s.kind === 'number') {
        expect(d[s.name], `${preset} ${s.name}`).toBeGreaterThanOrEqual(s.min);
        expect(d[s.name], `${preset} ${s.name}`).toBeLessThanOrEqual(s.max);
      }
      if (s.choices) expect(s.choices, `${preset} ${s.name}`).toContain(d[s.name]);
    }
  }
  expect(LAYOUTS.division).toEqual({ sleeve: true });
});

test('a flow is written with pluses and read back', () => {
  expect(encode({ ...defaults('immersive'), flow: 'towards live' }, null)).toBe('preset=immersive&flow=towards+live');
  expect(decode('flow=towards+live').values.flow).toBe('towards live');
  expect(decode('flow=sideways').values.flow).toBeUndefined();
  expect(decode('flow=towards').values.flow).toBeUndefined();
  expect(decode('flow=towards+blended').values.flow).toBeUndefined();
  expect(encode(defaults('sheet'), null)).toBe('preset=sheet');
});

test('colour is apart from the preset', () => {
  // A palette changes nothing but colour, under either preset.
  for (const preset of PRESETS) {
    const { palette, colours, ...shape } = defaults(preset, 'nord');
    const { palette: p0, colours: c0, ...shape0 } = defaults(preset);
    // A scene whose own palette is the one asked for keeps its own entry of it.
    const own = PRESET_COLOURS[preset]?.palette === 'nord' ? PRESET_COLOURS[preset].colours : 'frost';
    expect([palette, colours], preset).toEqual(['nord', own]);
    expect(shape).toEqual(shape0);
  }
  // A preset changes nothing about colour.
  expect(defaults('immersive', 'nord')).toMatchObject({ palette: 'nord', colours: 'frost' });
});

test('a link is written against the defaults of its own preset and palette', () => {
  expect(encode(defaults('immersive'), null)).toBe('preset=immersive');
  expect(encode(defaults('division', 'nord'), null)).toBe('palette=nord');
  expect(encode({ ...defaults('immersive', 'nord'), colours: 'aurora', rows: 80 }, null))
    .toBe('preset=immersive&palette=nord&colours=aurora&rows=80');
  // A name with a space in it is written with a plus.
  expect(encode({ ...defaults('division', 'catppuccin'), colours: 'latte blue-pink' }, null)).toBe('palette=catppuccin&colours=latte+blue-pink');
  expect(decode('palette=catppuccin&colours=latte+blue-pink').values.colours).toBe('latte blue-pink');
  // The sleeve's value for a setting is a change under the other preset, and the other way round.
  expect(encode({ ...defaults(), rows: 51 }, null)).toBe('rows=51');
  const back = decode(encode({ ...defaults('immersive', 'nord'), peak: 0.9 }, null));
  expect({ ...defaults(back.values.preset, back.values.palette), ...back.values }).toEqual({ ...defaults('immersive', 'nord'), peak: 0.9 });
});

test('a look survives a round trip', () => {
  const v = { ...defaults('immersive', 'nord'), colours: 'aurora', peak: 0.9, rows: 60, rising: true, drift: true };
  const view = { position: [1, 7.5, 22], target: [0, 1.5, -4] };
  const back = decode(encode(v, view));
  expect({ ...defaults(back.values.preset, back.values.palette), ...back.values }).toEqual(v);
  expect(back.view).toEqual(view);
});

test('numbers are written at their step’s precision', () => {
  expect(encode({ ...defaults(), peak: 0.9, rows: 60, lineWidth: 2, gamma: 5, noise: 0.05 }, null))
    .toBe('peak=0.90&rows=60&gamma=5.0&lineWidth=2.00&noise=0.050');
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
  for (const f of ['peak=1e99&rows=-5&palette=<script>&colours=nope&preset=nope&bogus=1&speed=abc&view=1,2,NaN',
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
  expect(decode('palette=<script>').values.palette).toBeUndefined();
  expect(decode('preset=nope').values.preset).toBeUndefined();
  expect(decode('preset=immersive').values.preset).toBe('immersive');
  expect(decode('peak=').values.peak).toBeUndefined();
  expect(decode('rising=maybe').values.rising).toBeUndefined();
  expect(decode('rising=true').values.rising).toBe(true);
  expect(decode(undefined)).toEqual({ values: {}, view: null });
});

test('colours are checked against the fragment’s palette, else the opening palette', () => {
  expect(decode('palette=nord&colours=aurora').values).toEqual({ palette: 'nord', colours: 'aurora' });
  expect(decode('colours=aurora&palette=nord').values.colours).toBe('aurora');
  expect(decode('palette=nord&colours=grey-white').values.colours).toBeUndefined();
  expect(decode('colours=grey-white').values.colours).toBe('grey-white');
  expect(decode('colours=aurora').values.colours).toBeUndefined();
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

// The page gives a palette without colours that palette's first gradient.
test('every palette and gradient pair survives a round trip, under either preset', () => {
  for (const preset of PRESETS) {
    for (const { name: palette, gradients } of PALETTES) {
      for (const { name: colours } of gradients) {
        const { values } = decode(encode({ ...defaults(preset, palette), colours }, null));
        const back = { ...defaults(values.preset, values.palette), ...values };
        expect([back.preset, back.palette, back.colours]).toEqual([preset, palette, colours]);
      }
    }
  }
});
