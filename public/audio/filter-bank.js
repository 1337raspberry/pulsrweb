// Spectrum analysis over PCM. Per channel, each band is a band-pass biquad whose squared
// output is low-passed into a power envelope and sampled in dBFS at the frame rate.
// Arithmetic is f64: the narrow bass bands' poles are too close to the unit circle for f32.

export const BANDS = 64;
export const CHANNELS = 2;
export const FRAME_RATE = 240;
export const FREQ_LOW_HZ = 50;
export const FREQ_HIGH_HZ = 16000;

const ENVELOPE_LOWPASS_HZ = 20;
const ENVELOPE_LOWPASS_Q = 0.707;
// Lowest power the level expression sees, which puts silence at -100 dBFS.
const POWER_FLOOR = 1e-10;
// Filter state below this is zeroed after a run, so silence does not decay into subnormals.
const STATE_FLOOR = 1e-30;

export class FilterBank {
  constructor(bands, fps, sampleRate) {
    this.bands = bands;
    this.fps = fps;
    const width = Math.log2(FREQ_HIGH_HZ / FREQ_LOW_HZ) / (bands - 1);

    // Band-pass coefficients, normalised by a0. The numerator is (b0, 0, -b0).
    this.b0 = new Float64Array(bands);
    this.a1 = new Float64Array(bands);
    this.a2 = new Float64Array(bands);
    for (let k = 0; k < bands; k++) {
      // A centre above Nyquist has no filter; hold it just under.
      const f = Math.min(FREQ_LOW_HZ * 2 ** (k * width), sampleRate * 0.45);
      const w0 = (2 * Math.PI * f) / sampleRate;
      const alpha = Math.sin(w0) * Math.sinh(((Math.LN2 / 2) * width * w0) / Math.sin(w0));
      const a0 = 1 + alpha;
      this.b0[k] = alpha / a0;
      this.a1[k] = (-2 * Math.cos(w0)) / a0;
      this.a2[k] = (1 - alpha) / a0;
    }

    // Envelope low-pass coefficients, the same for every band.
    const w0 = (2 * Math.PI * ENVELOPE_LOWPASS_HZ) / sampleRate;
    const alpha = Math.sin(w0) / (2 * ENVELOPE_LOWPASS_Q);
    const a0 = 1 + alpha;
    this.lb0 = (1 - Math.cos(w0)) / 2 / a0;
    this.lb1 = (1 - Math.cos(w0)) / a0;
    this.lb2 = this.lb0;
    this.la1 = (-2 * Math.cos(w0)) / a0;
    this.la2 = (1 - alpha) / a0;

    // Per channel per band (transposed direct form II): band-pass delays, envelope
    // low-pass delays and the latest envelope value.
    const states = CHANNELS * bands;
    this.s1 = new Float64Array(states);
    this.s2 = new Float64Array(states);
    this.t1 = new Float64Array(states);
    this.t2 = new Float64Array(states);
    this.envelope = new Float64Array(states);

    this.rate = Math.max(1, Math.round(sampleRate));
    // Advances by the frame rate per sample; a frame is cut each time it reaches the rate.
    this.phase = 0;
    this.db = new Float32Array(states);
  }

  reset() {
    for (const state of [this.s1, this.s2, this.t1, this.t2, this.envelope]) state.fill(0);
    this.phase = 0;
  }

  // Calls onFrame(done, db) for each frame the call completes: done is the number of
  // samples of this call consumed so far, db one dBFS level per band per channel (left
  // bands, then right). db is reused between frames.
  process(left, right, count, onFrame) {
    let done = 0;
    while (done < count) {
      const untilCut = Math.ceil((this.rate - this.phase) / this.fps);
      const n = Math.min(untilCut, count - done);
      this.run(left, done, n, 0);
      this.run(right, done, n, 1);
      done += n;
      this.phase += n * this.fps;
      if (this.phase >= this.rate) {
        this.phase -= this.rate;
        for (let i = 0; i < this.db.length; i++) {
          this.db[i] = 10 * Math.log10(Math.max(this.envelope[i], POWER_FLOOR));
        }
        onFrame(done, this.db);
      }
    }
  }

  run(x, from, count, channel) {
    const base = channel * this.bands;
    const { lb0, lb1, lb2, la1, la2 } = this;
    const end = from + count;
    for (let k = 0; k < this.bands; k++) {
      const b = this.b0[k];
      const c1 = this.a1[k];
      const c2 = this.a2[k];
      const i = base + k;
      let bs1 = this.s1[i];
      let bs2 = this.s2[i];
      let lt1 = this.t1[i];
      let lt2 = this.t2[i];
      let e = this.envelope[i];
      for (let n = from; n < end; n++) {
        const v = x[n];
        const y = b * v + bs1;
        bs1 = bs2 - c1 * y;
        bs2 = -b * v - c2 * y;
        const p = y * y;
        e = lb0 * p + lt1;
        lt1 = lb1 * p - la1 * e + lt2;
        lt2 = lb2 * p - la2 * e;
      }
      if (Math.abs(bs1) < STATE_FLOOR && Math.abs(bs2) < STATE_FLOOR) {
        bs1 = 0;
        bs2 = 0;
      }
      if (Math.abs(lt1) < STATE_FLOOR && Math.abs(lt2) < STATE_FLOOR) {
        lt1 = 0;
        lt2 = 0;
      }
      this.s1[i] = bs1;
      this.s2[i] = bs2;
      this.t1[i] = lt1;
      this.t2[i] = lt2;
      this.envelope[i] = e;
    }
  }
}
