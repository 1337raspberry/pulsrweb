// A tunnel made of the last few seconds: every row is a ring round the line of sight with
// its peaks pointing in, bass rising off the floor on both sides and treble overhead.
import { cos, float, sin, TWO_PI, vec3 } from 'three/tsl';
import { clockRate, musicClock, squash } from '../lib/shape-kit.js';

const RADIUS = 5;
// Height of the tunnel's middle above the flat layout's floor.
const AXIS = 3;
// Each ring's curtain reaches this far out past the wall, so the tunnel's sides are solid
// and nothing outside it shows between the rings.
const WALL = 6;

export default {
  name: 'wormhole',
  // Level and on the tunnel's axis, a little behind the nearest row in either flow.
  layout: { sleeve: false, tilt: 0, framing: 8.4, target: [0, AXIS, -7.5], orbit: { azimuth: [-12, 12], polar: [80, 100] } },
  floor: -WALL,
  // Both ends of a ring meet at the floor, so the floor reads the bass from either side
  // and the ceiling the treble: the tunnel is the same on its left and right.
  fold: (along) => along.mul(2).sub(1).abs().oneMinus(),
  place: ({ along, height, row, time, signals }) => {
    const clock = musicClock(signals, time);
    // A slow roll, and a little more turn for older rings, which rifles the bore.
    const turn = along.mul(TWO_PI).add(clock.mul(clockRate(0.12))).add(row.far.mul(0.5));
    // A ring cut on a kick drum is a little wider, so each beat leaves a bulge that
    // travels down the tunnel with its row.
    const wall = float(RADIUS).mul(row.born.beat.mul(0.12).add(1));
    const r = wall.sub(squash(height, RADIUS * 0.8));
    // The far end wanders, so the tunnel bends out of sight rather than ending in a point.
    const bend = row.far.mul(row.far).mul(3);
    const heading = clock.mul(clockRate(0.07));
    return vec3(
      sin(turn).mul(r).add(cos(heading).mul(bend)),
      float(AXIS).sub(cos(turn).mul(r)).add(sin(heading).mul(bend)),
      row.z,
    );
  },
};
