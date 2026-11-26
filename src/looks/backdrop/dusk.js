// An evening sky: the background colour overhead, a warm glow low down behind the ridge, a
// big soft sun sinking into it (a pale moon on a dark palette) and thin streaks of cloud.
import { clamp, exp, length, mix, mx_fractal_noise_float, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import { centred, createView, dither, follow, lift } from '../lib/backdrop-kit.js';

export default {
  name: 'dusk',
  build: ({ uv, background, stops, light, resolution, time }) => {
    const view = createView();
    const glow = uniform(0.4);
    const p = centred(uv, resolution);
    const horizon = clamp(view.horizon, 0.42, 0.66);
    const v = uv.y.sub(horizon);

    const warm = mix(stops[0], stops[2], 0.65);
    const low = mix(background, warm, mix(0.38, 0.3, light).mul(glow.mul(0.4).add(0.8)));
    let colour = mix(low, mix(background.mul(0.8), background, light), smoothstep(-0.02, 0.3, v));
    // Below the horizon the glow sinks back into the background.
    colour = mix(colour, mix(background.mul(0.75), background, light), smoothstep(0, 0.4, v.negate()));

    // Thin streaks of cloud, low in the sky, catching the light.
    const drift = time.mul(0.008);
    const streak = mx_fractal_noise_float(vec3(p.x.mul(1.4).add(drift), v.mul(16), 0.5), 3, 2, 0.5).max(0);
    const band = smoothstep(0.02, 0.1, v).mul(smoothstep(0.08, 0.32, v).oneMinus());
    colour = lift(colour, warm, streak.mul(band).mul(0.28), light);

    // The sun, sinking: cut off where it meets the horizon, its glow spread along it.
    const sunAt = vec2(-0.26, horizon.sub(0.5).add(0.035));
    const s = p.sub(sunAt);
    const d = length(s);
    const disc = smoothstep(0.075, 0.08, d).oneMinus().mul(smoothstep(-0.004, 0.004, v));
    const halo = exp(d.mul(-7)).mul(0.22).add(exp(length(s.mul(vec2(0.25, 2.2))).mul(-6)).mul(0.18)).mul(glow.mul(0.4).add(0.8));
    const face = mix(stops[2], vec3(1, 0.88, 0.62), 0.45);
    const sun = mix(face.mul(mix(1.15, 0.95, smoothstep(-0.08, 0.08, s.y))), mix(stops[2], vec3(0.85, 0.3, 0.12), 0.4), light);
    colour = mix(lift(colour, face, halo, light), sun, disc);

    return {
      colour: colour.add(dither()),
      frame: ({ dt, camera, shared }) => {
        view.update(camera);
        glow.value = follow(glow.value, shared.signals.energy?.value ?? 0.4, dt, 3);
      },
    };
  },
};
