// The ridge on a little planet: the ground curves away under the rows in every direction,
// so the last few seconds stand tall in front of the eye and the past sinks below the horizon.
import { SphereGeometry } from 'three/webgpu';
import { cos, sin, vec3 } from 'three/tsl';
import { nearZ, occluder } from '../lib/shape-kit.js';

// The planet's radius, in world units.
const RADIUS = 13;

export default {
  name: 'smallworld',
  layout: { sleeve: false, tilt: 16, framing: 12.5, target: [0, 2, -5], orbit: { azimuth: [-60, 60], polar: [45, 89] } },
  // The flat layout wrapped onto the sphere: across a row is round the planet sideways,
  // back through the rows is round it away from the eye, and heights stand straight up.
  // The row nearest the camera, whichever way the rows flow, sits on the planet's top.
  place: ({ along, height, row, u, WIDTH }) => {
    const side = along.sub(0.5).mul(WIDTH).div(RADIUS);
    const back = nearZ(u).sub(row.z).div(RADIUS);
    const up = vec3(sin(side), cos(side).mul(cos(back)), cos(side).mul(sin(back)).negate());
    return up.mul(height.add(RADIUS)).sub(vec3(0, RADIUS, 0));
  },
  // The planet itself, in the colour of empty space: rows that have gone over the horizon
  // stay hidden behind it instead of showing through the gaps between nearer rows.
  extras: ({ ground }) => {
    const core = occluder(new SphereGeometry(RADIUS, 160, 96), ground);
    core.object.position.set(0, -RADIUS, 0);
    return [core];
  },
};
