import { describe, expect, test } from 'vitest';
import { canvasSize, mixView, safeView } from '../src/scene/view-math.js';

test('the canvas matches the screen’s pixels, up to a ratio of two', () => {
  expect(canvasSize(800, 600, 1)).toEqual({ width: 800, height: 600, ratio: 1 });
  expect(canvasSize(800, 600, 2)).toEqual({ width: 1600, height: 1200, ratio: 2 });
  expect(canvasSize(800, 600, 3)).toEqual({ width: 1600, height: 1200, ratio: 2 });
  expect(canvasSize(0, 0, 2)).toEqual({ width: 1, height: 1, ratio: 2 });
});

test('a glide starts at one view and ends at the other', () => {
  const a = { position: [0, 7, 24], target: [0, 1.5, -4] };
  const b = { position: [10, 2, 5], target: [1, 1, 1] };
  expect(mixView(a, b, 0)).toEqual(a);
  expect(mixView(a, b, 1)).toEqual(b);
  expect(mixView(a, b, 2)).toEqual(b);
  expect(mixView(a, b, -1)).toEqual(a);
  expect(mixView(a, b, 0.5).position[0]).toBeCloseTo(5);
  expect(mixView(a, b, 0.5).target[1]).toBeCloseTo(1.25);
});

test('a glide eases: slower than linear at the start', () => {
  const a = { position: [0, 0, 0], target: [0, 0, 0] };
  const b = { position: [10, 0, 0], target: [0, 0, 0] };
  expect(mixView(a, b, 0.25).position[0]).toBeLessThan(2.5);
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
