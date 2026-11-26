// A winding road through the music: the rows ahead swing left and right and rise over
// crests as the road bends, and the world leans into each bend.
import { clamp, cos, select, sin, vec3 } from 'three/tsl';
import { reach, signal } from '../lib/shape-kit.js';

// The road repeats every PERIOD world units, a few bends and crests to a lap. Each term is
// [waves per period, size].
const PERIOD = 600;
const W = (2 * Math.PI) / PERIOD;
const ACROSS = [[3, 10], [7, 1.5]];
const UPDOWN = [[5, 2]];
// How far the world leans for a given bend, and at most, in radians.
const LEAN = 11;
const MOST_LEAN = 0.22;

const wave = (terms, s) => terms.map(([n, size]) => sin(s.mul(n * W)).mul(size)).reduce((a, b) => a.add(b));
const slope = (terms, s) => terms.map(([n, size]) => cos(s.mul(n * W)).mul(size * n * W)).reduce((a, b) => a.add(b));
const bendOf = (terms, s) => terms.map(([n, size]) => sin(s.mul(n * W)).mul(-size * (n * W) ** 2)).reduce((a, b) => a.add(b));

export default {
  name: 'joyride',
  layout: { sleeve: false, tilt: 2, framing: 15.75, target: [0, 3, -7], orbit: { azimuth: [-15, 15], polar: [78, 92] } },
  place: ({ along, height, row, u, phase, cuts, camera, signals, WIDTH }) => {
    // How far along the road the eye has come. Rows keep their place on the road: flowing
    // towards, the eye drives on to meet them; flowing away, it backs off as they recede.
    const travelled = cuts.add(phase).mul(u.spacing).mul(select(u.flow.lessThan(0.5), -1, 1));
    const ahead = row.far.mul(reach(u));
    const at = travelled.add(ahead);
    // The road measured from the nearest row, so that row is always straight ahead.
    const dx = wave(ACROSS, at).sub(wave(ACROSS, travelled)).sub(slope(ACROSS, travelled).mul(ahead));
    const dy = wave(UPDOWN, at).sub(wave(UPDOWN, travelled)).sub(slope(UPDOWN, travelled).mul(ahead));
    const p = vec3(along.sub(0.5).mul(WIDTH).add(dx), height.add(dy), row.z);
    // Leaning into the bend, harder when the music is going: the world turns about the
    // line of sight through the eye.
    const keen = signal(signals, 'energy').mul(0.6).add(0.7);
    const lean = clamp(bendOf(ACROSS, travelled).mul(LEAN).mul(keen), -MOST_LEAN, MOST_LEAN);
    const eye = camera.position;
    const x = p.x.sub(eye.x);
    const y = p.y.sub(eye.y);
    const c = cos(lean);
    const s = sin(lean);
    return vec3(x.mul(c).sub(y.mul(s)).add(eye.x), x.mul(s).add(y.mul(c)).add(eye.y), p.z);
  },
};
