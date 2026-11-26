// Flying into the ridge for ever: smaller and smaller copies of the ridge recede into its
// far end, each turned a little further, and the whole tunnel keeps zooming in, faster as the
// music gets louder. A backdrop stays where it is, behind the tunnel.
import { clamp, cos, float, mix, sin, step, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { onScreen } from '../lib/camera.js';
import { groundOf } from '../lib/filter-ground.js';
import { standoutOf } from '../lib/filter-kit.js';

// How much smaller each copy is than the one in front of it, and how many there are.
const SHRINK = 2.4;
const COPIES = 5;

export default {
  name: 'vortex',
  build: (context) => {
    const { colour, uv, resolution, background, stops, camera, ridge } = context;
    const standout = standoutOf(background, stops);
    const ground = groundOf(context);
    const behind = ground(uv);
    // The copies sit where the ridge's rows meet in the distance, kept on screen.
    const far = ridge ? onScreen(vec3(0, 0, ridge.u.rows.sub(1).mul(ridge.u.spacing).negate()), camera) : vec2(0.5, 0.45);
    const centre = clamp(far, vec2(0.15), vec2(0.85));
    const aspect = resolution.x.div(resolution.y);
    const square = vec2(aspect, 1);
    const travel = uniform(0);
    const twist = uniform(0.35);
    const along = travel.fract();
    const offset = uv.sub(centre).mul(square);

    // Front to back: each copy covers what lies behind it as far as the ridge has a mark
    // there (measured from what is behind the ridge at the point the copy reads), and what
    // no copy covers is what is behind the ridge here.
    let sum = vec3(0);
    let open = float(1);
    for (let k = 0; k < COPIES; k++) {
      const depth = float(k).sub(along);
      const scale = float(SHRINK).pow(depth);
      const angle = twist.mul(depth);
      const turned = vec2(offset.x.mul(cos(angle)).sub(offset.y.mul(sin(angle))), offset.x.mul(sin(angle)).add(offset.y.mul(cos(angle))));
      const at = turned.mul(scale).div(square).add(centre);
      const onPicture = step(0, at.x).mul(step(at.x, 1)).mul(step(0, at.y)).mul(step(at.y, 1));
      const seen = colour.sample(at).rgb;
      // Deeper copies sink into what is behind; the front one fades as it flies past, and
      // the deepest fades in as it appears, so the loop has no seam.
      const fade = float(0.62).pow(depth.max(0));
      const enter = k === 0 ? along.oneMinus() : k === COPIES - 1 ? along : float(1);
      const shade = mix(behind, seen, fade);
      const drawn = standout(seen, ground(at)).mul(onPicture).mul(enter);
      sum = sum.add(shade.mul(drawn).mul(open));
      open = open.mul(drawn.oneMinus());
    }
    const picture = sum.add(behind.mul(open));

    let level = 0;
    function frame({ dt, shared }) {
      const loud = shared.signals.level?.value ?? 0;
      level += (loud - level) * (1 - Math.exp(-dt / 0.8));
      // The tunnel holds still for anyone who has asked for less motion.
      const calm = shared.still?.value > 0.5;
      travel.value = (travel.value + (calm ? 0 : dt * (0.12 + 0.35 * level))) % 1000;
      twist.value = 0.35;
    }

    return { output: vec4(picture, 1), frame };
  },
};
