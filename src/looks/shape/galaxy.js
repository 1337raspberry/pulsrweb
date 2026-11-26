// A spiral galaxy of sound: rings shrink towards the middle as they age and the inner ones
// have turned further, so whatever the music holds on to winds out into spiral arms.
import { cos, float, fract, mix, sin, TWO_PI, vec3 } from 'three/tsl';
import { clockRate, musicClock, signal } from '../lib/shape-kit.js';

const OUTER = 11;
const INNER = 2.6;
// How far round the oldest ring has turned beyond the newest, in radians, in a calm
// passage; a build-up winds the arms up to half as tight again.
const SWIRL = 6;

export default {
  name: 'galaxy',
  layout: { sleeve: false, tilt: 58, framing: 26, target: [0, 0, 0], orbit: { azimuth: 'free', polar: [5, 70] }, spin: 3 },
  // The spectrum twice round each ring, so the bass makes two arms facing each other.
  fold: (along) => fract(along.mul(2)).mul(2).sub(1).abs().oneMinus(),
  // A ring's turn depends on its age alone, so the arms keep their shape instead of winding
  // ever tighter. Rows lie flat, peaks pointing in at the older rings; newer rings sit a
  // hair higher, so each ring's curtain covers the older ones it overlaps.
  place: ({ along, height, row, time, signals }) => {
    const f = row.far;
    const r = mix(float(OUTER), float(INNER), f.pow(0.8));
    const swirl = signal(signals, 'energy').mul(0.5).add(1).mul(SWIRL / 3);
    const turn = along.mul(TWO_PI).add(f.add(f.mul(f).mul(2)).mul(swirl)).add(musicClock(signals, time).mul(clockRate(0.05)));
    const out = vec3(cos(turn), 0, sin(turn));
    // Peaks shrink with the ring, so the small rings in the middle stay legible.
    const reach = height.mul(0.4).mul(r.div(OUTER));
    return out.mul(r.sub(reach)).add(vec3(0, f.oneMinus().mul(0.25), 0));
  },
};
