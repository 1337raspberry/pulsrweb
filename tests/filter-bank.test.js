import { expect, test } from 'vitest';
import { FilterBank } from '../public/audio/filter-bank.js';

function sine(hz, amp, seconds, rate) {
  const out = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

function feed(bank, left, right, block) {
  const frames = [];
  for (let at = 0; at < left.length; at += block) {
    const count = Math.min(block, left.length - at);
    const l = left.subarray(at, at + count);
    const r = right.subarray(at, at + count);
    bank.process(l, r, count, (done, db) => frames.push({ pos: (at + done) / bank.rate, db: Float32Array.from(db) }));
  }
  return frames;
}

test('a centred sine reads its power', () => {
  for (const rate of [48000, 44100]) {
    const hz = 50 * 2 ** ((32 * Math.log2(320)) / 63);
    const left = sine(hz, 0.1, 1.5, rate);
    const right = new Float32Array(left.length);
    const frames = feed(new FilterBank(64, 60, rate), left, right, left.length);
    expect(frames.length).toBe(90);
    const last = frames.at(-1).db;
    expect(last.length).toBe(128);
    expect(Math.abs(last[32] + 23.01)).toBeLessThan(0.15);
    expect(last[31]).toBeLessThan(last[32] - 3);
    expect(last[33]).toBeLessThan(last[32] - 3);

    // Twelve bands down, a two-pole band-pass of this Q has fallen by 1 / (Q |r - 1/r|).
    const width = Math.log2(320) / 63;
    const q = 1 / (2 * Math.sinh((Math.LN2 / 2) * width));
    const ratio = 2 ** (12 * width);
    const skirt = 20 * Math.log10(1 / (q * (ratio - 1 / ratio)));
    expect(Math.abs(last[32 - 12] - (last[32] + skirt))).toBeLessThan(1);
    expect(last[64 + 32]).toBe(-100);

    const chunked = feed(new FilterBank(64, 60, rate), left, right, 257);
    expect(chunked.map((f) => [...f.db])).toEqual(frames.map((f) => [...f.db]));
    expect(chunked.map((f) => f.pos)).toEqual(frames.map((f) => f.pos));
  }
});

test('the frame rate does not depend on the block size or sample rate', () => {
  for (const rate of [44100, 48000, 96000]) {
    const tone = sine(440, 0.1, 1, rate);
    const frames = feed(new FilterBank(64, 240, rate), tone, tone, 128);
    expect(frames.length).toBe(240);
    expect(Math.abs(frames.at(-1).pos - 1)).toBeLessThan(1e-9);
  }
});

test('silence after a signal decays to exactly the floor', () => {
  const rate = 48000;
  const bank = new FilterBank(64, 240, rate);
  const tone = sine(100, 0.5, 0.2, rate);
  feed(bank, tone, tone, 256);
  const silence = new Float32Array(rate * 10);
  const frames = feed(bank, silence, silence, 256);
  expect(frames.at(-1).db.every((d) => d === -100)).toBe(true);
  expect([...bank.s1, ...bank.t1].every((s) => s === 0)).toBe(true);
});

test('reset clears the filter state', () => {
  const rate = 48000;
  const bank = new FilterBank(64, 240, rate);
  const tone = sine(1000, 0.5, 0.5, rate);
  feed(bank, tone, tone, 256);
  bank.reset();
  const silence = new Float32Array(256);
  const frames = feed(bank, silence, silence, 256);
  expect(frames.at(-1).db.every((d) => d === -100)).toBe(true);
});
