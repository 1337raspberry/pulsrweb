import { expect, test } from 'vitest';
import { Ridge } from '../src/ridge/ridge.js';
import { PARAMS, MAX_ROWS } from '../src/ridge/params.js';

const steady = (level) => ({
  read(t, out) {
    out.fill(level);
    return true;
  },
});
const silent = { read: () => false };
const run = (r, seconds, source) => {
  for (let i = 0; i <= seconds * 60; i++) r.advance(i / 60, source);
};

test('one row is cut per row interval', () => {
  const r = new Ridge({ ...PARAMS, rowMs: 33 });
  for (let i = 0; i <= 60; i++) r.advance(i / 60, steady(1));
  expect(r.cuts).toBe(30);
});

test('a long pause does not cut a burst of rows', () => {
  const r = new Ridge({ ...PARAMS, rowMs: 33 });
  run(r, 1, steady(1));
  const before = r.cuts;
  r.advance(6.0, steady(1));
  expect(r.cuts - before).toBeLessThanOrEqual(1);
  expect(r.phase).toBeGreaterThanOrEqual(0);
  expect(r.phase).toBeLessThanOrEqual(1);
});

test('the newest history row is row 0', () => {
  const r = new Ridge({ ...PARAMS });
  run(r, 1, steady(1));
  expect(Math.max(...r.historyRow(0))).toBeGreaterThan(0.5);
  expect(Math.max(...r.historyRow(r.capacity - 1))).toBe(0);
});

test('capacity is MAX_ROWS', () => {
  expect(new Ridge({ ...PARAMS }).capacity).toBe(MAX_ROWS);
});

test('levels fall to exactly zero when the source stops', () => {
  const r = new Ridge({ ...PARAMS });
  run(r, 1, steady(1));
  expect(r.peak).toBeGreaterThan(0);
  for (let i = 0; i <= 300; i++) r.advance(1 + i / 60, silent);
  expect(r.peak).toBe(0);
});

test('setParams rebuilds tables only when their inputs change', () => {
  const r = new Ridge({ ...PARAMS });
  const axis = r.axis.slice();
  const bell = r.bell;
  r.setParams({ gain: 2 });
  expect(r.bell).toBe(bell);
  expect(r.p.gain).toBe(2);
  r.setParams({ axisCurve: 0.5 });
  expect(Array.from(r.axis)).not.toEqual(Array.from(axis));
  r.setParams({ spread: 2 });
  expect(r.bell).not.toBe(bell);
});
