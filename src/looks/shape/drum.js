// The history wound round a roller lying across the view, like the pinned drum of a music
// box: each row stays a straight line from bass to treble, the newest comes up at the
// front, rides over the top and goes down behind as it ages.
import { CylinderGeometry } from 'three/webgpu';
import { cos, normalize, sin, vec3 } from 'three/tsl';
import { occluder, squash } from '../lib/shape-kit.js';
import { farLeading } from '../lib/shape-path.js';

const RADIUS = 4;
// The roller's axis runs across the view through this point, turned this far about the
// vertical (treble end back), so its round end shows from the front.
const CENTRE = [0, 3.4, -5];
const YAW = 0.22;
// Where the newest row sits, in radians up from straight in front, and how far round the
// oldest has gone beyond it: three quarters of a turn, whatever the number of rows, so the
// oldest go out of sight behind the roller rather than meeting the newest underneath.
const START = -0.75;
const TURN = 1.5 * Math.PI;
// Peaks stand out from the roller leaning this much towards the older rows, so that on the
// face of the roller, where straight out is straight at the eye, they still rise up the
// screen and hide the rows above them as the flat ridge's do.
const LEAN = 0.55;
// Peaks are kept to about this length.
const CAP = 2.4;
// Rows reach this far into the roller, so no gap opens between a row and the roller.
const SINK = 0.3;

export default {
  name: 'drum',
  layout: { sleeve: false, tilt: 12, framing: 15, target: [-0.6, CENTRE[1] + 0.6, CENTRE[2]], orbit: { azimuth: [-75, 75], polar: [30, 115] } },
  floor: -SINK,
  place: ({ along, height, row, u, phase, WIDTH }) => {
    const angle = farLeading(row, u, phase).mul(TURN).add(START);
    const out = vec3(0, sin(angle), cos(angle));
    // Round the roller towards the far end of the history.
    const onward = vec3(0, cos(angle), sin(angle).negate());
    const rise = normalize(out.add(onward.mul(LEAN)));
    const p = vec3(along.sub(0.5).mul(WIDTH), 0, 0).add(out.mul(RADIUS)).add(rise.mul(squash(height, CAP)));
    return vec3(p.x.mul(Math.cos(YAW)).add(p.z.mul(Math.sin(YAW))), p.y, p.z.mul(Math.cos(YAW)).sub(p.x.mul(Math.sin(YAW)))).add(vec3(...CENTRE));
  },
  // The roller itself, in the colour of empty space, hides the rows that have gone round
  // the back.
  extras: ({ ground, WIDTH }) => {
    const core = occluder(new CylinderGeometry(RADIUS - 0.03, RADIUS - 0.03, WIDTH + 0.4, 160, 1), ground);
    core.object.rotation.set(0, YAW, Math.PI / 2);
    core.object.position.set(...CENTRE);
    return [core];
  },
};
