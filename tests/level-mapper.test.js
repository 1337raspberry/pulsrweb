import { expect, test } from 'vitest';
import { LevelMapper } from '../public/audio/level-mapper.js';

test('the peak jumps up and relaxes 6 dB per second', () => {
  for (const fps of [60, 240]) {
    const m = new LevelMapper(fps, 2);
    const out = new Float32Array(4);
    m.map(Float32Array.of(-10, -30, -10, -30), out);
    const peak = m.peakDb;
    expect(peak).toBeGreaterThan(-20);
    for (let i = 0; i < fps; i++) m.map(new Float32Array(4).fill(-80), out);
    expect(Math.abs(m.peakDb - (peak - 6))).toBeLessThan(0.01);
  }
});

test('levels span zero to one', () => {
  const m = new LevelMapper(240, 2);
  const out = new Float32Array(4);
  m.map(Float32Array.of(-10, -100, -10, -100), out);
  expect(out[0]).toBeGreaterThan(0.9);
  expect(out[0]).toBeLessThanOrEqual(1);
  expect(out[1]).toBe(0);
});

test('the tilt lifts the treble', () => {
  const m = new LevelMapper(240, 2);
  const out = new Float32Array(4);
  m.map(Float32Array.of(-30, -30, -30, -30), out);
  expect(out[1]).toBeGreaterThan(out[0]);
  expect(out[3]).toBeGreaterThan(out[2]);
});
