import { describe, expect, test } from 'vitest';
import {
  canvasSize, distanceFor, driftPose, mixPose, posterWidth, poseToPosition, positionToPose, safeView,
} from '../src/scene/view-math.js';

test('the canvas matches the screen’s pixels, up to a ratio of two', () => {
  expect(canvasSize(800, 600, 1)).toEqual({ width: 800, height: 600, ratio: 1 });
  expect(canvasSize(800, 600, 2)).toEqual({ width: 1600, height: 1200, ratio: 2 });
  expect(canvasSize(800, 600, 3)).toEqual({ width: 1600, height: 1200, ratio: 2 });
  expect(canvasSize(0, 0, 2)).toEqual({ width: 1, height: 1, ratio: 2 });
});

describe('safeView', () => {
  const opening = { position: [0, 9.5, 15.5], target: [0, 2, -7] };

  test('a good view passes through unchanged', () => {
    const view = { position: [3, 8, 12], target: [0, 2, -7] };
    expect(safeView(view, opening)).toEqual(view);
  });

  test('anything malformed gives the opening view', () => {
    const bad = [
      null,
      undefined,
      {},
      { position: [0, 1], target: [0, 2, -7] },
      { position: [0, 1, 2], target: [0, 2, -7, 1] },
      { position: [NaN, 1, 2], target: [0, 2, -7] },
      { position: [0, 1, 2], target: [0, Infinity, -7] },
      { position: ['0', 1, 2], target: [0, 2, -7] },
      { position: [1, 2, 3], target: [1, 2, 3] },
    ];
    for (const view of bad) expect(safeView(view, opening)).toEqual(opening);
  });

  test('a far target is clamped to 6 units of the opening target', () => {
    const view = safeView({ position: [3, 8, 12], target: [100, -100, 100] }, opening);
    expect(view.target).toEqual([6, -4, -1]);
    expect(view.position).toEqual([3, 8, 12]);
  });
});

describe('poses', () => {
  const target = [0, 0.75, -11.85];
  const pose = { azimuth: 0.3, polar: 0.9, framing: 26 };

  test('the poster fits the narrower of the window’s width and height', () => {
    expect(posterWidth(1440, 800)).toBeCloseTo(496);
    expect(posterWidth(375, 812)).toBeCloseTo(300);
    expect(posterWidth(0, 0)).toBe(1);
  });

  test('a longer lens stands further back for the same framing', () => {
    expect(distanceFor(26, 30)).toBeCloseTo(48.52, 1);
    expect(distanceFor(26, 2)).toBeGreaterThan(distanceFor(26, 30) * 10);
  });

  test('a pose survives a trip through a position, at any lens', () => {
    for (const fov of [2, 30, 75]) {
      const back = positionToPose(poseToPosition(pose, target, fov), target, fov);
      expect(back.azimuth).toBeCloseTo(pose.azimuth);
      expect(back.polar).toBeCloseTo(pose.polar);
      expect(back.framing).toBeCloseTo(pose.framing);
    }
  });

  test('azimuth zero is straight in front, and a small polar is overhead', () => {
    const [x, y, z] = poseToPosition({ azimuth: 0, polar: Math.PI / 2, framing: 26 }, target, 30);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(target[1]);
    expect(z).toBeGreaterThan(target[2]);
    expect(poseToPosition({ azimuth: 0, polar: 0.01, framing: 26 }, target, 30)[1]).toBeGreaterThan(40);
  });

  test('a blend starts at one pose and ends at the other', () => {
    const other = { azimuth: -0.2, polar: 1.2, framing: 30 };
    expect(mixPose(pose, other, 0)).toEqual(pose);
    expect(mixPose(pose, other, 1)).toEqual(other);
    expect(mixPose(pose, other, 5)).toEqual(other);
    expect(mixPose(pose, other, 0.5).framing).toBeCloseTo(28);
  });

  test('the drift starts at home and stays close to it', () => {
    const home = { azimuth: 0, polar: (50 * Math.PI) / 180, framing: 26 };
    const start = driftPose(home, 0);
    expect(start.azimuth).toBeCloseTo(home.azimuth);
    expect(start.polar).toBeCloseTo(home.polar);
    expect(start.framing).toBeCloseTo(home.framing);
    const deg = (r) => (r * 180) / Math.PI;
    // Slight: a few degrees either way, and barely closer.
    for (let s = 0; s < 3000; s += 0.5) {
      const p = driftPose(home, s);
      expect(Math.abs(deg(p.azimuth))).toBeLessThanOrEqual(8);
      expect(Math.abs(deg(p.polar) - 50)).toBeLessThanOrEqual(4);
      expect(p.framing).toBeGreaterThan(0.95 * home.framing);
      expect(p.framing).toBeLessThanOrEqual(home.framing + 1e-9);
    }
  });
});
