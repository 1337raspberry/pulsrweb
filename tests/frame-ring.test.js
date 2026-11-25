import { describe, expect, test } from 'vitest';
import { FrameRing, LAG_TOLERANCE_SEC, READ_BEHIND_SEC, STALE_SEC } from '../src/audio/frame-ring.js';

const WIDTH = 128;
const RATE = 240;
const filled = (value) => new Float32Array(WIDTH).fill(value);

// Pushes one frame whose page-time arrival is its audio position plus four seconds.
function push(ring, position, value) {
  ring.push(position, filled(value), 0, position + 4);
}

function twoFrames(gap) {
  const ring = new FrameRing(WIDTH, RATE, 2);
  push(ring, 1.0, 0);
  push(ring, 1.0 + gap, 1);
  return ring;
}

describe('FrameRing', () => {
  test('a read between two frames interpolates', () => {
    const ring = twoFrames(1 / RATE);
    const out = new Float32Array(WIDTH);
    expect(ring.read(5.0 + READ_BEHIND_SEC + 0.5 / RATE, out)).toBe(true);
    for (const value of out) expect(Math.abs(value - 0.5)).toBeLessThan(0.02);
  });

  test('a read past the newest frame returns the newest', () => {
    const ring = twoFrames(1 / RATE);
    const out = new Float32Array(WIDTH);
    const newest = 1.0 + 1 / RATE;
    const t = newest + 4 + READ_BEHIND_SEC + LAG_TOLERANCE_SEC * 0.5;
    expect(ring.read(t, out)).toBe(true);
    for (const value of out) expect(value).toBe(1);
  });

  test('nothing is read once frames stop arriving', () => {
    const ring = twoFrames(1 / RATE);
    const out = new Float32Array(WIDTH).fill(-1);
    const arrival = 5.0 + 1 / RATE;
    expect(ring.read(arrival + STALE_SEC + 0.1, out)).toBe(false);
    for (const value of out) expect(value).toBe(-1);
  });

  test('a gap in the audio is not interpolated across', () => {
    const ring = twoFrames(0.1);
    const out = new Float32Array(WIDTH);
    expect(ring.read(5.05 + READ_BEHIND_SEC, out)).toBe(true);
    for (const value of out) expect(value).toBe(0);
  });

  test('takeLateness reports the mean lateness since the last call', () => {
    const ring = new FrameRing(WIDTH, RATE, 2);
    ring.push(1.0, filled(0), 0, 5.0);
    ring.push(1.0 + 1 / RATE, filled(0), 0, 5.0 + 1 / RATE + 0.01);
    expect(ring.takeLateness()).toBeCloseTo(5, 5);
    expect(ring.takeLateness()).toBe(0);
  });
});
