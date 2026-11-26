import { expect, test } from 'vitest';
import { FilterBank } from '../public/audio/filter-bank.js';
import { LevelMapper } from '../public/audio/level-mapper.js';
import { createSignals } from '../src/looks/signals.js';

// Sound is made sample by sample, run through the analyser as the page's worklet runs it
// (240 frames a second of mapped levels), then played to the signals at a display's frame
// rate, each frame seeing the latest analysed frame, as the page's ring does.
const RATE = 48000;
const BANDS = 64;

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// `voice(t)` gives [left, right] at time t; returns the analysed frames.
function analyse(seconds, voice) {
  const n = Math.round(seconds * RATE);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) [left[i], right[i]] = voice(i / RATE);
  const bank = new FilterBank(BANDS, 240, RATE);
  const mapper = new LevelMapper(240, BANDS);
  const frames = [];
  bank.process(left, right, n, (done, db) => {
    const levels = new Float32Array(2 * BANDS);
    mapper.map(db, levels);
    frames.push({ at: done / RATE, levels });
  });
  return frames;
}

function play(frames, fps, { heard = () => true, ridge: given = {} } = {}) {
  const signals = createSignals(BANDS);
  const ridge = { raw: new Float32Array(2 * BANDS), p: { span: 0.7, axisCurve: 0.75 }, ...given };
  const trace = [];
  let j = 0;
  for (let n = 0; n / fps <= frames.at(-1).at; n++) {
    const t = n / fps;
    while (j + 1 < frames.length && frames[j + 1].at <= t) j++;
    ridge.raw.set(frames[j].levels);
    const values = signals.update(ridge, n === 0 ? 0 : 1 / fps, heard(t));
    trace.push({ t, ...values, pings: [...values.pings] });
  }
  return trace;
}

const between = (trace, from, to) => trace.filter((f) => f.t >= from && f.t < to);
const mean = (frames, name) => frames.reduce((sum, f) => sum + f[name], 0) / frames.length;
const beatsIn = (trace, from, to) => {
  const span = between(trace, from, to);
  return span.at(-1).beats - span[0].beats;
};

// A kick drum: a sine falling from 150 Hz to 45 Hz, dying away over a few tenths of a second.
const kick = (t) => 0.6 * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * (45 * t + 4.2 * (1 - Math.exp(-t / 0.04))));
// A held chord in the low mids.
const pad = (t) => 0.06 * [220, 277.2, 329.6, 440].reduce((sum, hz, i) => sum + Math.sin(2 * Math.PI * hz * t + i), 0);
const mono = (f) => (t) => {
  const v = f(t);
  return [v, v];
};

let cached = null;
const fourOnTheFloor = () => (cached ??= analyse(8, mono((t) => kick(t % 0.5) + pad(t))));

test('a steady tone neither beats nor changes', () => {
  const trace = play(analyse(5, mono((t) => 0.3 * Math.sin(2 * Math.PI * 440 * t))), 60);
  const settled = between(trace, 1, 5);
  expect(beatsIn(trace, 1, 5)).toBe(0);
  expect(Math.max(...settled.map((f) => f.hit))).toBeLessThan(0.05);
  expect(mean(settled, 'flux')).toBeLessThan(0.05);
  expect(mean(settled, 'level')).toBeGreaterThan(0.9);
  expect(mean(settled, 'silence')).toBe(0);
});

test('four on the floor over a pad beats on every kick', () => {
  const trace = play(fourOnTheFloor(), 60);
  expect(Math.abs(beatsIn(trace, 2, 8) - 12)).toBeLessThanOrEqual(1);
  // The pulse jumps within a frame or two of each kick and has faded before the next.
  for (const at of [3, 4.5, 6]) {
    const after = between(trace, at, at + 0.06);
    expect(Math.max(...after.map((f) => f.beat))).toBeGreaterThanOrEqual(0.6);
    expect(between(trace, at + 0.4, at + 0.45)[0].beat).toBeLessThan(0.15);
  }
  // The last four beats are half a second apart, newest first.
  const pings = trace.at(-1).pings;
  for (let i = 0; i < 3; i++) expect(Math.abs(pings[i + 1] - pings[i] - 0.5)).toBeLessThan(0.05);
  // The kicks are low and the chord holds, so bass pulses while mid stays up.
  const settled = between(trace, 2, 8);
  expect(Math.max(...settled.map((f) => f.bass))).toBeGreaterThan(0.95);
  expect(Math.min(...settled.map((f) => f.bass))).toBeLessThan(0.3);
  expect(mean(settled, 'mid')).toBeGreaterThan(0.8);
  expect(mean(settled, 'treble')).toBeLessThan(0.2);
});

test('the same kicks beat the same at 30, 60 and 144 frames a second', () => {
  const runs = [30, 60, 144].map((fps) => play(fourOnTheFloor(), fps));
  const counts = runs.map((trace) => beatsIn(trace, 2, 8));
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  // At 30 a second the frames are too far apart to see every dip a kick makes in the other
  // ranges (the analyser turns them down for a moment as the kick sets its peak).
  for (const name of ['level', 'bass', 'mid', 'energy', 'centroid', 'flux']) {
    const [slow, usual, fast] = runs.map((trace) => mean(between(trace, 2, 8), name));
    expect(Math.abs(fast - usual), name).toBeLessThan(0.03);
    expect(Math.abs(slow - usual), name).toBeLessThan(0.08);
  }
});

test('dense noise does not beat constantly', () => {
  const noise = random(1);
  const bursts = analyse(8, mono((t) => 0.3 * ((t * 12) % 1 < 0.35 ? 1 : 0.25) * (noise() * 2 - 1)));
  for (const fps of [60, 144]) expect(beatsIn(play(bursts, fps), 4, 8) / 4).toBeLessThanOrEqual(3);
  const hiss = random(2);
  const steady = analyse(8, mono(() => 0.2 * (hiss() * 2 - 1)));
  expect(beatsIn(play(steady, 60), 2, 8) / 6).toBeLessThan(0.5);
});

test('hi-hats hit but do not beat', () => {
  const noise = random(5);
  let a = 0;
  let b = 0;
  // Noise through a second difference: a hiss with almost nothing under a few kHz.
  const hats = analyse(6, mono((t) => {
    const x = noise() * 2 - 1;
    const y = x - 2 * a + b;
    b = a;
    a = x;
    return 0.15 * Math.exp(-(t % 0.125) / 0.02) * y + pad(t);
  }));
  const trace = play(hats, 60);
  expect(beatsIn(trace, 2, 6)).toBe(0);
  const hits = between(trace, 2, 6).filter((f, i, all) => i > 0 && f.hit > all[i - 1].hit + 0.3).length;
  expect(hits).toBeGreaterThan(16);
  expect(mean(between(trace, 2, 6), 'flux')).toBeGreaterThan(0.4);
});

test('silence reads as silence, and stops the clock', () => {
  const frames = analyse(5, mono((t) => (t < 2 ? kick(t % 0.5) + pad(t) : 0)));
  const trace = play(frames, 60);
  const quiet = between(trace, 3.2, 5);
  expect(Math.min(...quiet.map((f) => f.silence))).toBe(1);
  for (const name of ['level', 'bass', 'mid', 'treble', 'energy', 'beat', 'hit', 'peakLevel']) {
    expect(Math.max(...quiet.map((f) => f[name]))).toBeLessThan(0.02);
  }
  expect(quiet.at(-1).clock - quiet[0].clock).toBe(0);
  expect(between(trace, 1, 2).every((f) => f.silence === 0)).toBe(true);
  // Told that nothing is heard, levels left over in the frame count for nothing.
  const deaf = play(fourOnTheFloor(), 60, { heard: (t) => t < 2 });
  expect(between(deaf, 3.2, 8).every((f) => f.silence === 1 && f.level === 0)).toBe(true);
});

test('stereo width reads panning, and mono as none', () => {
  const tone = (t) => 0.3 * Math.sin(2 * Math.PI * 440 * t);
  expect(mean(between(play(analyse(3, (t) => [tone(t), 0.05 * tone(t)]), 60), 1.5, 3), 'width')).toBeGreaterThan(0.5);
  expect(mean(between(play(analyse(3, mono(tone)), 60), 1.5, 3), 'width')).toBe(0);
});

test('brightness follows where the sound sits', () => {
  const at = (hz) => mean(between(play(analyse(3, mono((t) => 0.3 * Math.sin(2 * Math.PI * hz * t))), 60), 2, 3), 'centroid');
  const low = at(100);
  const mid = at(1000);
  const high = at(8000);
  expect(low).toBeLessThan(mid);
  expect(mid).toBeLessThan(high);
  expect(low).toBeLessThan(0.25);
  expect(high).toBeGreaterThan(0.75);
});

test('energy sinks through a breakdown, and the drop comes with the bass', () => {
  const hiss = random(6);
  const full = (t) => t < 6 || t >= 22;
  const frames = analyse(28, mono((t) => {
    if (!full(t)) return 0.6 * pad(t);
    return kick(t % 0.5) + 0.15 * Math.sin(2 * Math.PI * 55 * t) + pad(t) + 0.05 * (hiss() * 2 - 1);
  }));
  const trace = play(frames, 60);
  expect(mean(between(trace, 4, 6), 'energy')).toBeGreaterThan(0.9);
  expect(mean(between(trace, 17, 22), 'energy')).toBeLessThan(0.7);
  expect(mean(between(trace, 25, 28), 'energy')).toBeGreaterThan(0.9);
  // One drop, as the kicks and the bass come back; none while they carry on.
  const drops = trace.filter((f, i) => i > 0 && f.drop > trace[i - 1].drop + 0.5);
  expect(drops.filter((f) => f.t > 4).map((f) => Math.round(f.t))).toEqual([22]);
});

test('hot is the height the loudest 5% of the live row stand above', () => {
  const points = 505;
  const grained = Float32Array.from({ length: points }, (_, j) => j / (points - 1));
  const axis = new Float32Array(points);
  const frames = analyse(2, mono((t) => kick(t % 0.5)));
  const trace = play(frames, 60, { ridge: { grained, axis } });
  expect(Math.abs(trace.at(-1).hot - 0.95)).toBeLessThan(0.03);
  // Only the spectrum's part of the row counts, and a flat row never sets it under its floor.
  axis.fill(-1, 0, 400);
  grained.fill(0, 400);
  expect(play(frames, 60, { ridge: { grained, axis } }).at(-1).hot).toBe(0.12);
});

test('peakAt stands where the dominant note stands on the row', () => {
  const hz = 1000;
  const band = (Math.log2(hz / 50) / Math.log2(16000 / 50)) * (BANDS - 1);
  const frames = analyse(3, mono((t) => 0.05 * Math.sin(2 * Math.PI * 60 * t) + 0.3 * Math.sin(2 * Math.PI * hz * t)));
  const straight = play(frames, 60, { ridge: { p: { span: 1, axisCurve: 1 } } }).at(-1);
  expect(Math.abs(straight.peakAt - band / (BANDS - 1))).toBeLessThan(0.02);
  expect(straight.peakLevel).toBeGreaterThan(0.8);
  // On a narrower, bent row it follows the ridge's own axis.
  const bent = play(frames, 60, { ridge: { p: { span: 0.7, axisCurve: 0.75 } } }).at(-1);
  expect(Math.abs(bent.peakAt - (0.15 + 0.7 * (band / (BANDS - 1)) ** 0.75))).toBeLessThan(0.02);
});

test('every signal stays a number in its range, whatever arrives', () => {
  const signals = createSignals(BANDS);
  const noise = random(7);
  const ridge = { raw: new Float32Array(2 * BANDS), grained: new Float32Array(505), axis: new Float32Array(505), p: { span: 0.7, axisCurve: 0.75 } };
  const counts = new Set(['beats', 'sinceBeat', 'clock', 'hot']);
  for (let n = 0; n < 2000; n++) {
    for (let i = 0; i < ridge.raw.length; i++) ridge.raw[i] = noise() < 0.3 ? 0 : noise();
    for (let j = 0; j < 505; j++) ridge.grained[j] = noise() * 1.4;
    const dt = [0, 1 / 240, 1 / 60, 0.05, 0.25][n % 5];
    const values = signals.update(ridge, dt, noise() > 0.1);
    for (const [name, value] of Object.entries(values)) {
      for (const x of Array.isArray(value) ? value : [value]) {
        expect(Number.isFinite(x), name).toBe(true);
        if (!counts.has(name) && name !== 'pings') {
          expect(x, name).toBeGreaterThanOrEqual(0);
          expect(x, name).toBeLessThanOrEqual(1);
        }
      }
    }
  }
  expect(signals.values.pings).toHaveLength(4);
});
