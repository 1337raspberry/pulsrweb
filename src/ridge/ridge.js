// The ridgeline: a stack of lines, each a past moment of the spectrum drawn as a profile
// along a bent log frequency axis, bass on the left. Everything runs on time, not display
// frames, so the picture moves the same at any refresh rate.

import { MAX_ROWS } from './params.js';

const CHANNELS = 2;
// Longest stretch of time one sub-step covers, in seconds.
const MAX_STEP = 1 / 240;
// A gap between two advances longer than this is a stall: the picture resumes where it stopped.
const STALL = 0.25;
const SILENCE = 1e-6;

// Share of the remaining distance a point moves in `dt` seconds, for an easing factor
// given per 60 Hz frame.
function easeAlpha(ease, dt) {
  if (dt <= 0) return 0;
  return 1 - (1 - Math.min(Math.max(ease, 0), 1)) ** (dt * 60);
}

export class Ridge {
  constructor(params, bands = 64) {
    this.p = params;
    this.bands = bands;
    this.raw = new Float32Array(bands * CHANNELS);
    this.levels = new Float32Array(bands);
    this.target = new Float32Array(bands);
    this.shaped = new Float32Array(bands);
    this.spread = new Float32Array(bands);
    this.smoothed = new Float32Array(bands);
    this.slope = new Float32Array(bands);
    this.secant = new Float32Array(bands);
    this.peak = 0;

    const perBand = Math.min(Math.max(params.oversample, 1), 8);
    const fine = (bands - 1) * perBand + 1;
    this.fineCount = fine;
    this.fine = new Float32Array(fine);
    this.grain = new Float32Array(fine);
    this.grained = new Float32Array(fine);
    this.axis = new Float32Array(fine);
    this.capacity = MAX_ROWS;
    this.history = new Float32Array(MAX_ROWS * fine);
    this.head = 0;
    this.cuts = 0;
    // Calls to advance, so readers can tell whether anything moved.
    this.advances = 0;
    this.buildTables();

    this.reroll();
    this.lastStepAt = null;
    this.lastRowAt = 0;
    this.phase = 0;
  }

  // Merges `partial` into the params and rebuilds the tables whose inputs changed.
  // `oversample` fixes the point count, so it is read only at construction.
  setParams(partial) {
    const p = this.p;
    const stale = ['axisCurve', 'spread'].some((k) => k in partial && partial[k] !== p[k]);
    Object.assign(p, partial);
    if (stale) this.buildTables();
  }

  // The frequency axis and spread bell, derived from the params.
  buildTables() {
    const { axisCurve, spread } = this.p;
    const bands = this.bands;
    const fine = this.fineCount;

    // Band position of each resampled point: below 1 the curve widens the low end.
    const inverse = axisCurve > 0 ? 1 / axisCurve : 1;
    for (let j = 0; j < fine; j++) this.axis[j] = (j / (fine - 1)) ** inverse * (bands - 1);

    const radius = Math.min(bands - 1, Math.ceil(spread * 3));
    this.bell = new Float32Array(radius + 1);
    for (let d = 0; d <= radius; d++) this.bell[d] = Math.exp(-(d * d) / (2 * spread * spread));
  }

  // Row `k` back from the newest history row; rows never cut read as zeros.
  historyRow(k) {
    const rows = this.capacity;
    const i = (((this.head - 1 - k) % rows) + rows) % rows;
    return this.history.subarray(i * this.fineCount, (i + 1) * this.fineCount);
  }

  reroll() {
    for (let i = 0; i < this.grain.length; i++) this.grain[i] = Math.random() * 2 - 1;
  }

  // Brings the ridge up to `now` (seconds). `source.read(t, out)` fills one frame of
  // levels (left bands, then right) and says whether there was one for that moment.
  advance(now, source) {
    const rowPeriod = Math.max(this.p.rowMs / 1000, 1e-3);
    let prev;
    if (this.lastStepAt !== null && now >= this.lastStepAt && now - this.lastStepAt <= STALL) {
      prev = this.lastStepAt;
    } else {
      this.lastRowAt = this.lastStepAt === null ? now : this.lastRowAt + (now - this.lastStepAt);
      prev = now;
    }
    this.lastStepAt = now;
    this.advances++;

    let t = prev;
    for (;;) {
      const nextCut = this.lastRowAt + rowPeriod;
      let to = Math.min(t + MAX_STEP, now);
      const cut = nextCut <= to;
      if (cut) to = Math.max(nextCut, t);
      this.step(to, to - t, source);
      t = to;
      if (cut) {
        this.cutRow();
        this.lastRowAt = nextCut;
      }
      if (t >= now) break;
    }

    this.resample();
    this.applyGrain();
    this.phase = Math.min(Math.max((now - this.lastRowAt) / rowPeriod, 0), 1);
  }

  // One sub-step: reads the source for time `t` and eases the levels over `dt` seconds.
  step(t, dt, source) {
    const p = this.p;
    const n = this.bands;
    const haveFrame = source ? source.read(t, this.raw) : false;
    if (!haveFrame && this.peak === 0) return;

    for (let k = 0; k < n; k++) {
      let v = haveFrame ? (this.raw[k] + this.raw[n + k]) / 2 : 0;
      // The level curve: a floor cut with the rest rescaled, a power, a gain.
      v = v <= p.floorCut ? 0 : (v - p.floorCut) / (1 - p.floorCut);
      this.shaped[k] = Math.min(v ** p.gamma * p.gain, 1);
    }

    // Widen every peak without lowering it, then blend each point with its neighbours.
    const radius = this.bell.length - 1;
    for (let i = 0; i < n; i++) {
      let best = this.shaped[i];
      for (let d = 1; d <= radius; d++) {
        const k = this.bell[d];
        if (i >= d) best = Math.max(best, this.shaped[i - d] * k);
        if (i + d < n) best = Math.max(best, this.shaped[i + d] * k);
      }
      this.spread[i] = best;
    }
    const side = p.smooth / 2;
    const own = 1 - p.smooth;
    for (let i = 0; i < n; i++) {
      const l = this.spread[Math.max(i - 1, 0)];
      const r = this.spread[Math.min(i + 1, n - 1)];
      this.smoothed[i] = own * this.spread[i] + side * (l + r);
    }

    const attack = easeAlpha(p.attack, dt);
    const decay = easeAlpha(p.decay, dt);
    let peak = 0;
    for (let k = 0; k < n; k++) {
      const before = this.levels[k];
      const level = this.smoothed[k];
      let value = before + (level - before) * (level > before ? attack : decay);
      if (!haveFrame && value < SILENCE) value = 0;
      this.levels[k] = value;
      if (value > peak) peak = value;
    }
    this.peak = peak;
  }

  cutRow() {
    this.resample();
    this.applyGrain();
    this.history.set(this.grained, this.head * this.fineCount);
    this.head = (this.head + 1) % this.capacity;
    this.cuts++;
    this.reroll();
  }

  applyGrain() {
    const amount = this.p.grain;
    for (let i = 0; i < this.fineCount; i++) {
      this.grained[i] = Math.max(this.fine[i] * (1 + amount * this.grain[i]), 0);
    }
  }

  // Resamples the eased levels onto the fine grid along a monotone cubic
  // (Fritsch-Carlson), which never overshoots between neighbouring bands.
  resample() {
    const y = this.levels;
    const n = this.bands;
    const m = this.slope;
    const d = this.secant;
    for (let k = 0; k < n - 1; k++) d[k] = y[k + 1] - y[k];
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
    for (let k = 0; k < n - 1; k++) {
      if (d[k] === 0) {
        m[k] = 0;
        m[k + 1] = 0;
        continue;
      }
      const a = m[k] / d[k];
      const b = m[k + 1] / d[k];
      const r2 = a * a + b * b;
      if (r2 > 9) {
        const s = 3 / Math.sqrt(r2);
        m[k] = s * a * d[k];
        m[k + 1] = s * b * d[k];
      }
    }
    for (let j = 0; j < this.fineCount; j++) {
      const c = Math.min(Math.max(this.axis[j], 0), n - 1);
      const i = Math.min(Math.floor(c), n - 2);
      const t = c - i;
      const t2 = t * t;
      const t3 = t2 * t;
      this.fine[j] =
        (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * m[i + 1];
    }
  }
}
