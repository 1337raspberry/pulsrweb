import { expect, test } from 'vitest';
import { createDemo } from '../src/audio/demo-source.js';
import { Ridge } from '../src/ridge/ridge.js';
import { PARAMS } from '../src/ridge/params.js';

const BANDS = 64;

test('every level is a level, and both channels match', () => {
  const demo = createDemo({ ...PARAMS }, BANDS);
  const out = new Float32Array(BANDS * 2);
  for (let t = 0; t < 30; t += 0.037) {
    expect(demo.read(t, out)).toBe(true);
    for (let k = 0; k < BANDS; k++) {
      expect(out[k]).toBeGreaterThanOrEqual(0);
      expect(out[k]).toBeLessThanOrEqual(1);
      expect(out[BANDS + k]).toBe(out[k]);
    }
  }
});

test('the same moment reads the same', () => {
  const demo = createDemo({ ...PARAMS }, BANDS);
  const a = new Float32Array(BANDS * 2);
  const b = new Float32Array(BANDS * 2);
  demo.read(12.34, a);
  demo.read(99, b);
  demo.read(12.34, b);
  expect(Array.from(b)).toEqual(Array.from(a));
});

test('through the ridge it stands in the middle of the row and leaves the ends flat', () => {
  const params = { ...PARAMS, noise: 0, grain: 0 };
  const ridge = new Ridge(params, BANDS);
  const demo = createDemo(params, BANDS);
  for (let i = 0; i <= 20 * 60; i++) ridge.advance(i / 60, demo);
  const n = ridge.fineCount;
  let middle = 0;
  let ends = 0;
  let tallest = 0;
  for (let k = 0; k < ridge.capacity; k++) {
    const row = ridge.historyRow(k);
    for (let j = 0; j < n; j++) {
      const along = j / (n - 1);
      if (along > 0.35 && along < 0.65) middle += row[j];
      else if (along < 0.3 || along > 0.7) ends += row[j];
      if (row[j] > tallest) tallest = row[j];
    }
  }
  expect(middle).toBeGreaterThan(0);
  expect(ends).toBeLessThan(middle * 0.02);
  expect(tallest).toBeGreaterThan(0.5);
});
