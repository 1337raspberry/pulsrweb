// Tunable values for the ridge. Those that are also settings take the settings' defaults.
import { defaults } from '../settings.js';

// Rows of history kept; the `rows` setting says how many are shown.
export const MAX_ROWS = 120;

const d = defaults();

export const PARAMS = {
  oversample: 8,
  rowMs: 1000 / d.speed,
  ...Object.fromEntries(
    ['spread', 'smooth', 'grain', 'noise', 'span', 'edgeTaper', 'attack', 'decay', 'gamma', 'floorCut', 'gain', 'axisCurve'].map((name) => [name, d[name]]),
  ),
};
