// The ridge twisting away like a corkscrew: the newest row stands upright and each older
// row is turned a little further about the line of sight, winding one way and then back.
import { cos, sin, vec3 } from 'three/tsl';
import { clockRate, musicClock, signal } from '../lib/shape-kit.js';

// The most the oldest row is turned from the newest, in radians.
const TWIST = Math.PI;

export default {
  name: 'twirl',
  layout: { sleeve: false, tilt: 4, framing: 14, target: [0, 0.5, -10], orbit: { azimuth: [-40, 40], polar: [55, 95] } },
  // Each row turns about its own foot, in its own plane, so its curtain still faces a
  // camera looking down the stack and hides the rows behind at any angle.
  place: ({ along, height, row, time, signals, WIDTH }) => {
    // Never quite straight: the twist breathes between about a tenth and all of TWIST.
    const wind = sin(musicClock(signals, time).mul(clockRate(0.15))).mul(0.45).add(0.55).mul(TWIST);
    // A beat gives the whole stack a twitch, stronger further back.
    const turn = row.far.mul(wind.add(signal(signals, 'beat').mul(0.35)));
    const x = along.sub(0.5).mul(WIDTH);
    const c = cos(turn);
    const s = sin(turn);
    return vec3(x.mul(c).sub(height.mul(s)), x.mul(s).add(height.mul(c)), row.z);
  },
};
