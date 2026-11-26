// A look is one entry from each slot. Every slot lists its entries in its own folder.
import shape from './shape/index.js';
import line from './line/index.js';
import tint from './tint/index.js';
import backdrop from './backdrop/index.js';
import filter from './filter/index.js';

export const SLOTS = { shape, line, tint, backdrop, filter };

// The entry of `slot` called `name`, or the slot's first.
export function findEntry(slot, name) {
  return SLOTS[slot].find((entry) => entry.name === name) ?? SLOTS[slot][0];
}
