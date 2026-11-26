// The stacked rows wrapped round a column: every row is a ring, the newest at the foot and
// the history rising above it, the middle of the spectrum facing the front.
import { CylinderGeometry } from 'three/webgpu';
import { cos, float, sin, TWO_PI, vec3 } from 'three/tsl';
import { occluder } from '../lib/shape-kit.js';

const RADIUS = 4;
// Height of the whole stack, whatever the number of rows.
const TALL = 13;

export default {
  name: 'totem',
  layout: { sleeve: false, tilt: 8, framing: 18, target: [0, 6.5, 0], orbit: { azimuth: 'free', polar: [40, 115] }, spin: 6 },
  // Rows lie on the column: a peak pushes its line up towards the older rings. Newer
  // rings sit a hair further out, so each ring's curtain covers the older lines above it.
  // A row's two ends, which are flat, meet at the back.
  place: ({ along, height, row }) => {
    const turn = along.sub(0.5).mul(TWO_PI);
    const r = float(RADIUS).add(row.far.oneMinus().mul(0.25));
    const y = row.far.mul(TALL).add(height.mul(0.6));
    return vec3(sin(turn).mul(r), y, cos(turn).mul(r));
  },
  // The column itself, in the colour of empty space, hides the back of every ring.
  extras: ({ ground }) => {
    const core = occluder(new CylinderGeometry(RADIUS - 0.03, RADIUS - 0.03, TALL + 8, 128, 1), ground);
    core.object.position.y = TALL / 2;
    return [core];
  },
};
