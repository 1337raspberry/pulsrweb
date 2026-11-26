// Time as an angle, seen from overhead: every row is a spoke from the hub (bass) to the rim
// (treble), and the history sweeps round the dial behind the newest spoke like a radar beam.
import { cos, float, mix, sin, TWO_PI, vec3 } from 'three/tsl';
import { clockRate, musicClock } from '../lib/shape-kit.js';

const HUB = 2.6;
const RIM = 10;

export default {
  name: 'radar',
  layout: { sleeve: false, tilt: 89, framing: 23, target: [0, 0, 0], orbit: { azimuth: 'free', polar: [0.5, 45] } },
  // Rows lie flat: a peak bends its spoke round towards the older spokes, by an angle rather
  // than a distance, so the dial looks the same from hub to rim. Newer spokes sit a hair
  // higher, so each spoke's curtain covers the older ones it overlaps.
  place: ({ along, height, row, time, signals }) => {
    const sweep = musicClock(signals, time).mul(clockRate(0.3)).sub(row.far.mul(TWO_PI));
    const angle = sweep.sub(height.mul(0.045));
    const r = mix(float(HUB), float(RIM), along);
    return vec3(sin(angle).mul(r), row.far.oneMinus().mul(0.2), cos(angle).mul(r).negate());
  },
};
