// The picture seen through fluted glass: upright reeds, each a small lens that shows a
// flipped, squeezed strip of what is behind it, with a highlight down every reed.
import { abs, exp, float, floor, mix, pow, smoothstep, vec2, vec3, vec4 } from 'three/tsl';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { signal } from '../lib/filter-kit.js';

// Reed width in CSS pixels.
const REED = 26;

export default {
  name: 'fluted',
  build: (context) => {
    const { colour, uv, resolution, pixelRatio, signals, light } = context;
    const bass = signal(signals, 'bass');
    const beat = signal(signals, 'beat');
    const width = pixelRatio.mul(REED);
    // A convex reed turns what is behind it round: its left side shows what is to the right
    // of its middle, magnified away from the middle, and the bass swells the glass a little.
    const bend = float(1.6).add(bass.mul(0.5));
    const step = float(1.5).mul(pixelRatio).div(resolution.y);
    const dark = mix(0.25, 0.12, light);

    // The glass at screen point `at`, over a picture read by `read(point)`.
    const glass = (read, at) => {
      const x = at.x.mul(resolution.x);
      const centre = floor(x.div(width)).add(0.5).mul(width);
      // -1 at a reed's left edge, 1 at its right.
      const across = x.sub(centre).div(width.mul(0.5));
      const seen = centre.sub(x.sub(centre).mul(bend)).add(across.mul(abs(across)).mul(width).mul(0.18));
      const s = vec2(seen.div(resolution.x), at.y);
      // Light spreads a touch along each reed, as through real glass.
      let c = read(s).mul(0.5).add(read(s.add(vec2(0, step))).mul(0.25)).add(read(s.sub(vec2(0, step))).mul(0.25));
      // Each reed is darker towards its edges, where the glass turns away; a thin groove
      // marks the join, and a soft highlight runs down the reed's left shoulder.
      const edge = pow(abs(across), 5);
      const groove = smoothstep(0.86, 1, abs(across));
      const shine = exp(across.add(0.4).div(0.22).pow(2).negate()).mul(beat.mul(0.6).add(1));
      c = c.mul(float(1).sub(edge.mul(dark))).mul(float(1).sub(groove.mul(0.25)));
      return c.add(vec3(shine.mul(mix(0.025, 0.02, light))));
    };

    // The backdrop is seen through the same glass, and a filter after this one is told so.
    const ground = groundOf(context);
    return handOn(vec4(glass((p) => colour.sample(p).rgb, uv), 1), (at) => glass(ground, at));
  },
};
