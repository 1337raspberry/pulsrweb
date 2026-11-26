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

test('the spectrum fills the middle of a row and the taper closes its ends', () => {
  const r = new Ridge({ ...PARAMS, span: 0.5, edgeTaper: 0.2, noise: 0, grain: 0 });
  run(r, 1, steady(1));
  const row = r.historyRow(0);
  const at = (along) => row[Math.round(along * (r.fineCount - 1))];
  expect(at(0.1)).toBe(0);
  expect(at(0.9)).toBe(0);
  expect(at(0.5)).toBeGreaterThan(0.9);
  // Half way up the taper, which covers the first fifth of the span.
  expect(at(0.25 + 0.05)).toBeGreaterThan(0.3);
  expect(at(0.25 + 0.05)).toBeLessThan(0.7);
});

test('a span of one uses the whole row', () => {
  const r = new Ridge({ ...PARAMS, span: 1, edgeTaper: 0, noise: 0, grain: 0 });
  run(r, 1, steady(1));
  expect(Math.min(...r.historyRow(0))).toBeGreaterThan(0.9);
});

test('noise lifts a silent row a little and never below zero', () => {
  const r = new Ridge({ ...PARAMS, noise: 0.05 });
  run(r, 1, silent);
  const row = r.historyRow(0);
  expect(Math.max(...row)).toBeGreaterThan(0);
  expect(Math.max(...row)).toBeLessThanOrEqual(0.05);
  expect(Math.min(...row)).toBeGreaterThanOrEqual(0);
  expect(r.peak).toBe(0);
});

test('changing the span rebuilds the axis', () => {
  const r = new Ridge({ ...PARAMS });
  const axis = r.axis.slice();
  r.setParams({ span: 0.8 });
  expect(Array.from(r.axis)).not.toEqual(Array.from(axis));
});
