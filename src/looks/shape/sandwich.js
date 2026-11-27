// The ridge with a second ridge hanging over it, turned end for end, so the eye looks down
// a corridor between two ranges of sound, one standing on the floor and one on the ceiling.
import { float, select, vec3 } from 'three/tsl';
import { nearZ, squash } from '../lib/shape-kit.js';

// Height of the ceiling over the floor; peaks are kept short of meeting in the middle.
const GAP = 9;
const CAP = GAP * 0.4;

export default {
  name: 'sandwich',
  // Level, halfway between floor and ceiling, and far enough back to see the floor from the
  // nearest row on.
  layout: { sleeve: false, tilt: 0, framing: 13.5, target: [0, GAP / 2, -9], orbit: { azimuth: [-40, 40], polar: [65, 115] } },
  copies: 2,
  place: ({ along, height, row, u, copy, WIDTH }) => {
    const x = along.sub(0.5).mul(WIDTH);
    const y = squash(height, CAP);
    // The ceiling's copy is the floor's turned half a turn about the corridor's middle, so
    // its bass hangs over the floor's treble.
    const over = copy.greaterThan(0.5);
    // Whichever way the rows flow, the nearest is at the same place.
    return vec3(select(over, x.negate(), x), select(over, float(GAP).sub(y), y), row.z.sub(nearZ(u)));
  },
};
