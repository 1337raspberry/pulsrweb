// On every hit the lens splits the picture into its colours: red and blue spring out from
// the middle and snap back, leaving a faint fringe at the edges between hits.
import { float, vec2, vec3, vec4 } from 'three/tsl';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { signal } from '../lib/filter-kit.js';

export default {
  name: 'fringe',
  build: (context) => {
    const { colour, uv, signals } = context;
    const hit = signals.hit ?? signal(signals, 'beat');
    const drop = signal(signals, 'drop');
    // How much further out red is drawn than green, and blue further in; it grows towards
    // the edges because it is a change of scale about the middle.
    const split = float(0.004).add(hit.mul(0.025)).add(drop.mul(0.02));
    const centre = vec2(0.5, 0.5);
    const through = (read, at) => {
      const out = at.sub(centre);
      return vec3(read(centre.add(out.mul(split.add(1)))).r, read(at).g, read(centre.add(out.mul(split.oneMinus()))).b);
    };
    // The backdrop is split with everything else, and a filter after this one is told so.
    const ground = groundOf(context);
    return handOn(vec4(through((p) => colour.sample(p).rgb, uv), 1), (at) => through(ground, at));
  },
};
