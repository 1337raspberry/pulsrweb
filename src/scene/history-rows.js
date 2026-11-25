// The ridge's rows as one float array laid out for a texture: row 0 is the live row,
// row 1 + slot is history slot `slot`, in the ridge's own ring order.
export class HistoryRows {
  constructor(fineCount, capacity) {
    this.width = fineCount;
    this.height = capacity + 1;
    this.capacity = capacity;
    this.data = new Float32Array(this.width * this.height);
    // Slot of the newest history row.
    this.newest = capacity - 1;
    this.seenCuts = 0;
    this.seenAdvances = -1;
  }

  // Copies the live row and every row cut since the last call. Returns whether anything was written.
  update(ridge) {
    if (ridge.advances === this.seenAdvances && ridge.cuts === this.seenCuts) return false;
    const { width, capacity } = this;
    this.data.set(ridge.grained, 0);
    const fresh = Math.min(ridge.cuts - this.seenCuts, capacity);
    for (let k = 0; k < fresh; k++) {
      const slot = (((ridge.head - 1 - k) % capacity) + capacity) % capacity;
      this.data.set(ridge.historyRow(k), (1 + slot) * width);
    }
    this.newest = (ridge.head + capacity - 1) % capacity;
    this.seenCuts = ridge.cuts;
    this.seenAdvances = ridge.advances;
    return true;
  }
}
