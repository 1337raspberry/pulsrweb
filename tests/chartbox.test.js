import { describe, expect, it } from 'vitest';
import { SERIES, seriesColour, sheetLayout } from '../src/looks/lib/chartbox.js';

describe('sheetLayout', () => {
  const sizes = [[1280, 720], [2560, 1080], [1024, 520], [390, 844], [320, 480], [800, 300]];

  it('keeps the plot area inside the chart, and the chart inside the grid', () => {
    for (const [width, height] of sizes) {
      const { box, plot, header, gridTop, gridBottom } = sheetLayout(width, height);
      expect(plot.width, `${width}x${height}`).toBeGreaterThan(0);
      expect(plot.height, `${width}x${height}`).toBeGreaterThan(0);
      expect(plot.x).toBeGreaterThan(box.x);
      expect(plot.y).toBeGreaterThan(box.y);
      expect(plot.x + plot.width).toBeLessThan(box.x + box.width);
      expect(plot.y + plot.height).toBeLessThan(box.y + box.height);
      expect(box.x).toBeGreaterThanOrEqual(header);
      expect(box.y).toBeGreaterThanOrEqual(gridTop);
      if (height >= 480) expect(box.y + box.height).toBeLessThanOrEqual(gridBottom);
      if (width >= 320) expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  });

  it('measures the plot area from the middle of a screen with room to spare', () => {
    const { plot } = sheetLayout(2560, 1080);
    expect(plot.x + plot.width / 2).toBeCloseTo(1280, 0);
    expect(plot.y + plot.height).toBeGreaterThan(540);
    expect(plot.y).toBeLessThan(540);
  });
});

describe('seriesColour', () => {
  const stops = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const background = [0, 0, 0];

  it('gives the three stops, then the same three nearer the background, and comes round', () => {
    expect(seriesColour(0, stops, background)).toEqual([1, 0, 0]);
    expect(seriesColour(2, stops, background)).toEqual([0, 0, 1]);
    const paler = seriesColour(3, stops, background);
    expect(paler[0]).toBeLessThan(1);
    expect(paler[0]).toBeGreaterThan(0);
    expect(seriesColour(SERIES, stops, background)).toEqual(seriesColour(0, stops, background));
  });

  it('gives a palette of one colour six strengths of it', () => {
    const one = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
    const strengths = Array.from({ length: SERIES }, (_, n) => seriesColour(n, one, background)[0]);
    expect(new Set(strengths).size).toBe(SERIES);
  });
});
