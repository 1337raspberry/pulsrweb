// The stacked rows printed on the face of a ball: the newest low down, older ones climbing
// towards the top, bass at the left edge and treble at the right, curving away all round.
import { SphereGeometry } from 'three/webgpu';
import { cos, float, mix, sin, vec3 } from 'three/tsl';
import { occluder } from '../lib/shape-kit.js';

const RADIUS = 6;
// The latitudes, in radians, of the newest and the oldest row.
const LOW = -0.95;
const HIGH = 1.2;

export default {
  name: 'marble',
  layout: { sleeve: false, tilt: 8, framing: 17, target: [0, 0, 0], orbit: { azimuth: [-75, 75], polar: [25, 155] } },
  // Rows lie on the surface rather than standing out of it: a peak pushes its line up the
  // ball towards the older rows, the way ink would on a printed sheet. Newer rows sit a
  // hair further out, so each row's curtain covers the older lines it overlaps.
  place: ({ along, height, row }) => {
    const lat = mix(float(LOW), float(HIGH), row.far).add(height.mul(0.5 / RADIUS));
    const lon = along.sub(0.5).mul(Math.PI * 0.94);
    const r = float(RADIUS).add(row.far.oneMinus().mul(0.2));
    return vec3(cos(lat).mul(sin(lon)), sin(lat), cos(lat).mul(cos(lon))).mul(r);
  },
  // The ball itself, in the colour of empty space, hides the rows' far edges behind it.
  extras: ({ ground }) => [occluder(new SphereGeometry(RADIUS - 0.03, 128, 96), ground)],
};
