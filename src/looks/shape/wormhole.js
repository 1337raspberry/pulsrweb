// A tunnel made of the last few seconds: every row is a ring round the line of sight with
// its peaks pointing in, bass rising off the floor on both sides and treble overhead. It
// narrows towards a small opening at its far end and snakes about as it goes, so the
// opening swings across the view and now and then out of sight round a bend.
import { cos, float, sin, TWO_PI, vec3 } from 'three/tsl';
import { clockRate, musicClock, squash } from '../lib/shape-kit.js';

const RADIUS = 5;
// Height of the tunnel's middle above the flat layout's floor.
const AXIS = 3;
// Each ring's curtain reaches this far out past the wall, so the tunnel's sides are solid
// and nothing outside it shows between the rings.
const WALL = 6;
// The far end's bore as a share of the near end's.
const FAR_BORE = 0.34;
// How far, in world units, the far end swings off the line of sight.
const SWAY = 7;
// The bends that travel along the tunnel: for each, how fast it turns (radians a second of
// the music's clock), how many radians of it lie along the tunnel, where it starts, and
// its share of the sway.
const ACROSS = [[0.85, 2.6, 0, 0.7], [0.5, -4.3, 1.7, 0.45]];
const UPDOWN = [[0.7, 2.2, 2.1, 0.7], [0.43, -3.7, 0.4, 0.45]];

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
    const bore = row.far.pow(1.3).mul(FAR_BORE - 1).add(1);
    const wall = float(RADIUS).mul(bore).mul(row.born.beat.mul(0.12).add(1));
    const r = wall.sub(squash(height, wall.mul(0.8)));
    // The near end stays round the eye; further along, the tunnel's middle is carried off
    // by the bends, more the further it goes.
    const swing = row.far.pow(1.5).mul(SWAY);
    const bends = (terms) => terms
      .map(([rate, twist, start, share]) => sin(clock.mul(clockRate(rate)).add(row.far.mul(twist)).add(start)).mul(share))
      .reduce((a, b) => a.add(b));
    return vec3(
      sin(turn).mul(r).add(bends(ACROSS).mul(swing)),
      float(AXIS).sub(cos(turn).mul(r)).add(bends(UPDOWN).mul(swing)),
      row.z,
    );
  },
};
