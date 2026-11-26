// Darker towards the corners, as through an old lens, closing in a little on the bass. On
// a light background it is only a faint shadow, as on a photograph's paper.
import { float, mix, smoothstep, vec4 } from 'three/tsl';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { signal } from '../lib/filter-kit.js';

export default {
  name: 'vignette',
  build: (context) => {
    const { colour, uv, light, signals } = context;
    const bass = signal(signals, 'bass');
    const reach = float(0.36).sub(bass.mul(0.06));
    const depth = mix(0.6, 0.2, light).mul(bass.mul(0.25).add(1));
    const shade = (at) => float(1).sub(depth.mul(smoothstep(reach, 0.8, at.sub(0.5).length())));
    // The backdrop is shaded with everything else, and a filter after this one is told so.
    const ground = groundOf(context);
    return handOn(vec4(colour.rgb.mul(shade(uv)), 1), (at) => ground(at).mul(shade(at)));
  },
};
