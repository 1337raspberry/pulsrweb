// Maps per-band dBFS levels to heights (0...1) against a running peak, after a spectral
// tilt about the centre of the band range lifts the treble.

import { CHANNELS, FREQ_HIGH_HZ, FREQ_LOW_HZ } from './filter-bank.js';

const DB_FLOOR = -90;
const DYNAMIC_RANGE_DB = 55;
const PEAK_HEADROOM_DB = 2;
const COMPRESSION = 0.6;
const PEAK_SEED_DB = -20;
const PEAK_DECAY_DB_PER_SEC = 6;
const PEAK_FLOOR_DB = -40;
const TILT_DB_PER_OCTAVE = 1;

export class LevelMapper {
  // The peak's release is scaled by fps so it is the same per second at any rate.
  constructor(fps, bands) {
    this.peakDb = PEAK_SEED_DB;
    this.decayPerFrame = PEAK_DECAY_DB_PER_SEC / Math.max(1, fps);
    this.bands = bands;
    const octaves = Math.log2(FREQ_HIGH_HZ / FREQ_LOW_HZ);
    this.tilt = new Float64Array(bands);
    for (let k = 0; k < bands; k++) {
      this.tilt[k] = TILT_DB_PER_OCTAVE * octaves * (k / (bands - 1) - 0.5);
    }
    this.tilted = new Float64Array(bands * CHANNELS);
  }

  // Maps one frame of dBFS values (left bands, then right) into out, advancing the running
  // peak. The tilt is applied first; a band at the floor is silence and stays there.
  map(db, out) {
    const width = this.tilted.length;
    const tilted = this.tilted;
    let frameMax = DB_FLOOR;
    for (let i = 0; i < width; i++) {
      let d = Math.max(db[i], DB_FLOOR);
      if (d > DB_FLOOR) d = Math.max(d + this.tilt[i % this.bands], DB_FLOOR);
      tilted[i] = d;
      if (d > frameMax) frameMax = d;
    }
    if (frameMax > this.peakDb) {
      this.peakDb = frameMax;
    } else {
      this.peakDb = Math.max(this.peakDb - this.decayPerFrame, frameMax, PEAK_FLOOR_DB);
    }
    const ceiling = this.peakDb + PEAK_HEADROOM_DB;
    const floor = Math.max(ceiling - DYNAMIC_RANGE_DB, DB_FLOOR);
    for (let i = 0; i < width; i++) {
      const d = tilted[i];
      out[i] = d <= floor ? 0 : ((Math.min(d, ceiling) - floor) / (ceiling - floor)) ** COMPRESSION;
    }
  }
}
