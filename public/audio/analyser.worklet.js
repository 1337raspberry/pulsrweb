// Spectrum analysis on the audio thread: feeds the filter bank, maps each frame's dBFS levels
// to 0...1 and posts them with their positions, plus input peak and onset for the delay
// measurement.

import { BANDS, CHANNELS, FRAME_RATE, FilterBank } from './filter-bank.js';
import { LevelMapper } from './level-mapper.js';

const WIDTH = BANDS * CHANNELS;

class PulsrAnalyser extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bank = new FilterBank(BANDS, FRAME_RATE, sampleRate);
    this.mapper = new LevelMapper(FRAME_RATE, BANDS);
    this.silence = new Float32Array(128);

    this.cutPositions = [];
    this.cutLevels = [];
    this.inputPeak = 0;

    // Onset detection for the delay measurement.
    this.background = 0;
    this.armed = false;
    this.threshold = 1;
    this.port.onmessage = (event) => {
      if (event.data === 'arm') {
        this.armed = true;
        this.threshold = Math.max(0.01, 4 * this.background);
      } else if (event.data === 'disarm') {
        this.armed = false;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    let left = input && input[0];
    let right = input && (input[1] || input[0]);
    if (!left) {
      left = this.silence;
      right = this.silence;
    }
    const count = Math.min(left.length, right.length);

    let peak = 0;
    for (let n = 0; n < count; n++) {
      const a = Math.abs(left[n]);
      const b = Math.abs(right[n]);
      if (a > peak) peak = a;
      if (b > peak) peak = b;
    }
    // A block with a sample that is not a number is heard as silence.
    if (!(peak < Infinity)) {
      left = this.silence;
      right = this.silence;
      peak = 0;
    }
    if (peak > this.inputPeak) this.inputPeak = peak;

    let onset = null;
    if (this.armed && peak > this.threshold) {
      for (let n = 0; n < count; n++) {
        if (Math.abs(left[n]) > this.threshold || Math.abs(right[n]) > this.threshold) {
          onset = (currentFrame + n) / sampleRate;
          break;
        }
      }
      this.armed = false;
    }
    this.background = Math.max(peak, this.background * 0.98);

    this.bank.process(left, right, count, (done, db) => {
      const levels = new Float32Array(WIDTH);
      this.mapper.map(db, levels);
      this.cutPositions.push((currentFrame + done) / sampleRate);
      this.cutLevels.push(levels);
    });

    if (this.cutPositions.length > 0 || onset !== null) {
      const frames = this.cutPositions.length;
      const levels = new Float32Array(frames * WIDTH);
      for (let f = 0; f < frames; f++) levels.set(this.cutLevels[f], f * WIDTH);
      this.port.postMessage({ positions: this.cutPositions, levels, peak: this.inputPeak, onset }, [levels.buffer]);
      this.cutPositions = [];
      this.cutLevels = [];
      this.inputPeak = 0;
    }
    return true;
  }
}

registerProcessor('pulsr-analyser', PulsrAnalyser);
