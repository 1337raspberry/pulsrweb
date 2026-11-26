// A record: every row is one turn of a single groove, joined end to start with the next,
// so the history winds in from the rim to the label while the disc slowly turns.
import { CircleGeometry, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { cos, float, mix, normalize, select, sin, TWO_PI, vec3 } from 'three/tsl';
import { EMERGE, clockRate, musicClock } from '../lib/shape-kit.js';

// Radius of the innermost turn, beside the label, and of the newest turn, at the rim.
const INNER = 3.4;
const OUTER = 15;
// How far peaks lean out from straight up, so they still show on the disc's flanks, where
// a straight-up peak would run along the groove on screen.
const SPLAY = 0.35;
// Heights are scaled down so a peak covers a handful of turns, not the whole record.
const SCALE = 0.45;

export default {
  name: 'vinyl',
  layout: { sleeve: false, tilt: 35, framing: 26, target: [0, 0.5, 0], orbit: { azimuth: 'free', polar: [12, 75] } },
  place: ({ along, height, row, phase, u, time, signals }) => {
    // Turns are counted in from the rim. The live row sits one whole turn outside the
    // newest history row, so the groove runs on without a jump where they meet.
    // Just after a cut the ridge hides its newest history row for a moment, unless the
    // live row slides in (then the live row stands in front of the origin, z > 0). In
    // that moment the live row takes the hidden row's turn, so the groove never gaps.
    const pitch = float(OUTER - INNER).div(u.rows.max(2));
    const own = row.z.greaterThan(0.001).or(phase.greaterThanEqual(EMERGE));
    const turn = select(row.live, select(own, phase.sub(1), phase), row.depth).add(along);
    const r = float(OUTER).sub(turn.mul(pitch));
    // The disc turns with the music, and stops when it stops.
    const angle = along.mul(TWO_PI).negate().sub(musicClock(signals, time).mul(clockRate(0.25)));
    const out = vec3(cos(angle), 0, sin(angle));
    const up = normalize(out.mul(SPLAY).add(vec3(0, 1, 0)));
    return out.mul(r).add(up.mul(height.mul(SCALE)));
  },
  // The label in the middle, in the palette's first line colour, with a dark spindle hole.
  extras: ({ stops, background }) => {
    const disc = new CircleGeometry(INNER - 0.45, 96);
    disc.rotateX(-Math.PI / 2);
    const material = new MeshBasicNodeMaterial();
    material.colorNode = mix(stops[0], background, 0.25);
    const label = new Mesh(disc, material);
    label.position.y = 0.01;
    const hole = new CircleGeometry(0.18, 32);
    hole.rotateX(-Math.PI / 2);
    const dark = new MeshBasicNodeMaterial();
    dark.colorNode = background;
    const spindle = new Mesh(hole, dark);
    spindle.position.y = 0.02;
    label.add(spindle);
    return [{
      object: label,
      dispose() {
        disc.dispose();
        hole.dispose();
        material.dispose();
        dark.dispose();
      },
    }];
  },
};
