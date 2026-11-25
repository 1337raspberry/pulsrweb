import { expect, test } from 'vitest';
import { Ridge } from '../src/ridge/ridge.js';
import { PARAMS } from '../src/ridge/params.js';
import { HistoryRows } from '../src/scene/history-rows.js';

const steady = (level) => ({
  read(t, out) {
    out.fill(level);
    return true;
  },
});

const textureRow = (rows, y) => Array.from(rows.data.subarray(y * rows.width, (y + 1) * rows.width));

test('the live row and each cut row land in their texture rows', () => {
  const ridge = new Ridge({ ...PARAMS, rowMs: 33 });
  const rows = new HistoryRows(ridge.fineCount, ridge.capacity);
  expect(rows.width).toBe(ridge.fineCount);
  expect(rows.height).toBe(ridge.capacity + 1);
  expect(rows.data.length).toBe(rows.width * rows.height);

  for (let i = 0; i <= 6; i++) ridge.advance(i / 60, steady(1));
  expect(ridge.cuts).toBe(3);

  expect(rows.update(ridge)).toBe(true);
  expect(textureRow(rows, 0)).toEqual(Array.from(ridge.grained));
  expect(rows.newest).toBe((ridge.head + ridge.capacity - 1) % ridge.capacity);
  expect(textureRow(rows, 1 + rows.newest)).toEqual(Array.from(ridge.historyRow(0)));
  expect(textureRow(rows, 1 + ((rows.newest + ridge.capacity - 2) % ridge.capacity))).toEqual(
    Array.from(ridge.historyRow(2)),
  );
  expect(rows.update(ridge)).toBe(false);
});

test('more cuts than the ring holds copy the whole ring', () => {
  const ridge = new Ridge({ ...PARAMS, rowMs: 33 });
  const rows = new HistoryRows(ridge.fineCount, ridge.capacity);
  for (let i = 0; i <= 6 * 60; i++) ridge.advance(i / 60, steady(i % 2));
  expect(ridge.cuts).toBeGreaterThan(ridge.capacity);
  expect(rows.update(ridge)).toBe(true);
  for (let k = 0; k < ridge.capacity; k++) {
    const slot = (rows.newest - k + ridge.capacity) % ridge.capacity;
    expect(textureRow(rows, 1 + slot)).toEqual(Array.from(ridge.historyRow(k)));
  }
});
