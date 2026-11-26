// The picture folded into a kaleidoscope: mirrored wedges round the middle of the screen,
// turning slowly, faster as the music gets louder.
import { atan, cos, float, floor, length, min, sin, uniform, vec2, vec4 } from 'three/tsl';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { signal } from '../lib/filter-kit.js';

// Wedges round the circle; each shows the same slice of the picture, every other one mirrored.
const WEDGES = 8;

export default {
  name: 'kaleido',
  build: (context) => {
    const { colour, uv, resolution, signals } = context;
    const bass = signal(signals, 'bass');
    const turn = uniform(0);
    const aspect = resolution.x.div(resolution.y);
    const wedge = float((2 * Math.PI) / WEDGES);
    // Where in the picture a screen point looks.
    const fold = (at) => {
      const p = at.sub(0.5).mul(vec2(aspect, 1));
      // Fold the angle into the first half-wedge, mirroring alternate wedges so no seam shows.
      let a = atan(p.y, p.x).add(turn);
      a = a.sub(wedge.mul(floor(a.div(wedge))));
      a = min(a, wedge.sub(a));
      // The slice points down from just above the middle, across the busiest part of the
      // ridge, and comes a little closer with the bass.
      const reach = length(p).mul(float(0.8).sub(bass.mul(0.12)));
      const aim = a.add(Math.PI / 2 - Math.PI / WEDGES / 2);
      return vec2(0.5, 0.42).add(vec2(cos(aim).div(aspect), sin(aim)).mul(reach));
    };

    // The turn runs on its own clock, so a loud stretch speeds it up without a jump. It
    // holds still for anyone who has asked for less motion.
    function frame({ dt, shared }) {
      if (shared.still?.value > 0.5) return;
      const level = shared.signals.level?.value ?? 0;
      turn.value = (turn.value + dt * (0.06 + 0.3 * level)) % (2 * Math.PI);
    }

    // The backdrop is folded with everything else, and a filter after this one is told so.
    const ground = groundOf(context);
    const output = handOn(vec4(colour.sample(fold(uv)).rgb, 1), (at) => ground(fold(at)));
    return { output, frame };
  },
};
