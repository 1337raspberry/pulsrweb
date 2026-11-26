// The ridge rolling itself up: the newest rows lie flat, and each older row curls a little
// further, until the far end of the ridge has closed into a tunnel.
import { cos, float, max, sin, smoothstep, vec3 } from 'three/tsl';
import { squash } from '../lib/shape-kit.js';

export default {
  name: 'rollup',
  layout: { sleeve: false, tilt: 14, framing: 13, target: [0, 2, -9] },
  place: ({ along, height, row, WIDTH }) => {
    // A row bent into a circle of its own length closes exactly; younger rows bend less.
    // Bending keeps a row's length, so nothing stretches as it curls.
    const closed = (2 * Math.PI) / WIDTH;
    // Rows cut in a busier passage curl a little further.
    const eager = row.born.energy.mul(0.25).add(0.75);
    const bend = max(smoothstep(0.12, 0.9, row.far).mul(eager).mul(closed), 1e-4);
    const angle = along.sub(0.5).mul(WIDTH).mul(bend);
    const foot = vec3(sin(angle).div(bend), cos(angle).oneMinus().div(bend), row.z);
    // Up turns inwards as the row curls; peaks are kept short of the tube's middle.
    const up = vec3(sin(angle).negate(), cos(angle), 0);
    return foot.add(up.mul(squash(height, float(0.85).div(bend))));
  },
};
