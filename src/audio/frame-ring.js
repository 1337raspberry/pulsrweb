// No frame for this long means the analyser has stopped delivering.
export const STALE_SEC = 0.1;
// How far the newest frame may trail the moment asked for and still be drawn.
export const LAG_TOLERANCE_SEC = 0.1;
// The picture reads this far behind the freshest arrival, so it interpolates between
// frames instead of stepping as messages land.
export const READ_BEHIND_SEC = 0.006;

// Recent frames keyed by their position on the audio clock, and the mapping from the
// page's clock to that one.
export class FrameRing {
  constructor(width = 128, frameRate = 240, seconds = 2) {
    this.width = width;
    this.frameRate = frameRate;
    this.capacity = seconds * frameRate;
    this.positions = new Float64Array(this.capacity);
    this.levels = new Float32Array(this.capacity * width);
    this.head = 0;
    this.count = 0;
    this.lastArrival = -Infinity;
    // Page time minus audio position of the promptest recent arrival, over two windows.
    this.offset = 0;
    this.windowMin = Infinity;
    this.previousMin = Infinity;
    this.windowStart = 0;
    this.lateSum = 0;
    this.lateCount = 0;
  }

  slot(i) {
    return (this.head + this.capacity - this.count + i) % this.capacity;
  }

  push(position, levels, from, at) {
    const width = this.width;
    this.positions[this.head] = position;
    this.levels.set(levels.subarray(from, from + width), this.head * width);
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);

    if (at - this.windowStart > 2) {
      this.previousMin = this.windowMin;
      this.windowMin = Infinity;
      this.windowStart = at;
    }
    const offset = at - position;
    if (offset < this.windowMin) this.windowMin = offset;
    this.offset = Math.min(this.windowMin, this.previousMin);
    this.lateSum += offset - this.offset;
    this.lateCount += 1;
    this.lastArrival = at;
  }

  // Mean milliseconds frames arrived late since the last call.
  takeLateness() {
    const late = this.lateCount ? (this.lateSum / this.lateCount) * 1000 : 0;
    this.lateSum = 0;
    this.lateCount = 0;
    return late;
  }

  // Fills `out` with the frame for page time `t`, interpolated between its neighbours.
  read(t, out) {
    const width = this.width;
    if (this.count === 0 || t - this.lastArrival > STALE_SEC) return false;
    const want = t - this.offset - READ_BEHIND_SEC;
    if (this.positions[this.slot(this.count - 1)] < want - LAG_TOLERANCE_SEC) return false;
    // First frame after `want`; the one before it is at or before.
    let lo = 0;
    let hi = this.count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.positions[this.slot(mid)] <= want) lo = mid + 1;
      else hi = mid;
    }
    const a = Math.max(lo - 1, 0);
    let b = a;
    let mix = 0;
    if (lo > 0 && lo < this.count) {
      const pa = this.positions[this.slot(lo - 1)];
      const pb = this.positions[this.slot(lo)];
      const gap = pb - pa;
      if (gap > 0 && gap <= 2.5 / this.frameRate) {
        b = lo;
        mix = (want - pa) / gap;
      }
    }
    const fa = this.slot(a) * width;
    const fb = this.slot(b) * width;
    for (let i = 0; i < width; i++) {
      const va = this.levels[fa + i];
      out[i] = va + (this.levels[fb + i] - va) * mix;
    }
    return true;
  }
}
