// The ridge laid as a ribbon along a path that wanders slowly through the air: each new row
// is put down where the path's head is, and stays there while the head travels on, so the
// last few seconds trail behind it like a road being built, taken up again at the tail.
import { squash } from '../lib/shape-kit.js';
import { evenly, laidPath, levelAcross, rowsBack, smoothed } from '../lib/shape-path.js';

// The path, seen from above, is a figure of eight drifting about and slowly turning, rising
// and falling as it goes. Every wave in it makes a whole number of turns while `q` runs
// once round, so the path closes on itself: [turns of the eight, its half width, its half
// depth], the eight's own turns, the drift's [turns, size], and the rises' [turns, size,
// start]. The tips of the eight are rounded off a little further, to about SOFTEN.
const EIGHT = [200, 6, 2.6];
const SPIN = 15;
const DRIFT = [20, 1.2];
const LIFTS = [[93, 2.6, 0.6], [217, 1.0, 2.1]];
// The middle of the space the path wanders through, and how finely it is traced.
const MIDDLE = [0, 5, -8];
const TRACE = 120000;
const SOFTEN = 1.5;
// Rows are this far apart along the path, in multiples of the spacing setting.
const STRIDE = 1.3;
// Width of the ribbon, and the scale and limit of its peaks.
const RIBBON = 5;
const SCALE = 0.65;
const CAP = 2.8;
// The camera keeps this far behind the head along the path, so the newest rows and a good
// length of the trail are both in view.
const LOOK_BACK = 4;

// The path's centre at `q`, 0 to 1 round it. Its speed across the ground never falls to
// nothing (the eight is always faster than the drift and the turning put together), so the
// ribbon always knows which way is level across it.
function centreAt(q) {
  const a = (n) => 2 * Math.PI * n * q;
  const [waves, wide, deep] = EIGHT;
  const ex = Math.sin(a(waves)) * wide;
  const ez = Math.sin(a(waves * 2)) * deep;
  const turn = a(SPIN);
  const x = ex * Math.cos(turn) - ez * Math.sin(turn) + Math.cos(a(DRIFT[0])) * DRIFT[1];
  const z = ex * Math.sin(turn) + ez * Math.cos(turn) + Math.sin(a(DRIFT[0])) * DRIFT[1];
  const y = LIFTS.reduce((sum, [n, size, start]) => sum + Math.sin(a(n) + start) * size, 0);
  return [MIDDLE[0] + x, MIDDLE[1] + y, MIDDLE[2] + z];
}

const path = laidPath(() => {
  const traced = evenly(Array.from({ length: TRACE }, (_, i) => centreAt(i / TRACE)), 0.2);
  const { samples, length } = evenly(smoothed(traced.samples, 0.2, SOFTEN), 0.2);
  return { samples, length, across: levelAcross(samples) };
});

export default {
  name: 'meander',
  layout: { sleeve: false, tilt: 26, framing: 13, target: [0, 5, -7], orbit: { azimuth: 'free', polar: [15, 105] } },
  // The camera travels with the head of the path.
  lead: () => path.behind(LOOK_BACK),
  place: ({ along, height, row, u, phase }) => {
    const s = path.head.sub(rowsBack(row, u, phase).mul(u.spacing.mul(STRIDE)));
    const { centre, across, up } = path.at(s);
    return centre.add(across.mul(along.sub(0.5).mul(RIBBON))).add(up.mul(squash(height.mul(SCALE), CAP)));
  },
  extras: (c) => [path.extra(c, STRIDE)],
};
