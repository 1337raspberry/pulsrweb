// Trails for the picture: each frame what was there before is drawn again, faded towards
// what is behind the ridge and, if asked, zoomed and turned round a centre, with the live
// picture on top. A trail is kept as how far it stands from what is behind it, so it fades
// into any backdrop, light or dark, and a backdrop that moves leaves no trails of its own;
// trails change through the palette's stops as they age.
import { clamp, float, length, mix, pow, rotate, step, uniform, vec2, vec4 } from 'three/tsl';
import { feedback } from './filter-feedback.js';
import { groundOf } from './filter-ground.js';
import { rampOf, standoutOf } from './filter-kit.js';

// `centre` is a vec2 node (0 to 1 from the top left). `emit(rgb)` says how much of the live
// picture at a pixel feeds the trails, 0 to 1 (all of it by default; a dense picture fed in
// whole blurs into a haze). The returned `frame(dt, changes)` takes the per-frame changes:
// `zoom` (> 1 draws the trails in towards the centre, < 1 out), `twist` (radians), and
// `decay` (how much of a trail is left after a 60th of a second).
export function createTrails(context, centre, { scale = 0.5, emit = null } = {}) {
  const { colour, uv, resolution, background, stops } = context;
  const standout = standoutOf(background, stops);
  const ground = groundOf(context);
  const ramp = rampOf(stops);
  const step60 = uniform(1);
  const zoom = uniform(1);
  const twist = uniform(0);
  const decay = uniform(0.95);
  const aspect = resolution.x.div(resolution.y);
  const square = vec2(aspect, 1);

  const memory = feedback(({ previous, uv: at, fresh }) => {
    const from = rotate(at.sub(centre).mul(square), twist.mul(step60)).mul(pow(zoom, step60)).div(square).add(centre);
    const onPicture = step(0, from.x).mul(step(from.x, 1)).mul(step(0, from.y)).mul(step(from.y, 1));
    const old = previous.sample(from);
    const kept = old.rgb.mul(pow(decay, step60).mul(onPicture));
    const live = colour.sample(at).rgb;
    const mark = live.sub(ground(at));
    const now = emit ? mark.mul(emit(live)) : mark;
    // Whichever stands further from what is behind wins; alpha keeps a trail's age in seconds.
    const nowWins = length(now).greaterThanEqual(length(kept)).or(fresh.greaterThan(0.5));
    return nowWins.select(vec4(now, 0), vec4(kept, old.a.add(step60.div(60))));
  }, { scale });

  const behind = ground(uv);
  const trail = memory.getTextureNode().sample(uv);
  const ghost = behind.add(trail.rgb);
  const strength = standout(ghost, behind);
  // Young trails keep their own colour; older ones slide from the top stop down the palette.
  const aged = mix(behind, ramp(clamp(float(1).sub(trail.a.mul(0.6)), 0, 1)), strength);
  const tinted = mix(ghost, aged, clamp(trail.a.mul(2.5), 0, 1));
  const live = colour.rgb;
  const output = vec4(standout(live, behind).greaterThanEqual(strength.mul(0.9)).select(live, tinted), 1);

  function frame(dt, { zoom: z = 1, twist: w = 0, decay: d = 0.95 }) {
    step60.value = Math.min(Math.max(dt * 60, 0), 4);
    zoom.value = z;
    twist.value = w;
    decay.value = d;
  }

  return { output, frame, dispose: () => memory.dispose() };
}
