// Snow drifting down among the rows, passing in front of the hills and lost behind them.
// It falls faster as the music fills out and is blown sideways on the bass. On a light
// background, grey flakes of ash on a pale sky.
import { exp, float, fract, mix, mx_noise_float, positionView, pow, sin, smoothstep, step, uniform, varying, vec2, vec3 } from 'three/tsl';
import { centred, dither, follow } from '../lib/backdrop-kit.js';
import { createMotes, glowOrInk, softDot } from '../lib/motes.js';

export default {
  name: 'flurry',
  // A cold night under low snow cloud, a little lighter low down where the snow catches
  // the light.
  colour: ({ uv, background, stops, light, resolution, time }) => {
    const p = centred(uv, resolution);
    const cloud = mx_noise_float(vec3(p.mul(vec2(1.2, 2.4)), time.mul(0.01))).mul(0.5).add(0.5);
    const night = mix(mix(background, stops[0], 0.14), background.mul(0.6), smoothstep(-0.3, 0.5, p.y)).mul(cloud.mul(0.25).add(0.85));
    const overcast = mix(background.mul(0.93), background, smoothstep(-0.5, 0.5, p.y)).mul(cloud.mul(0.04).add(0.98));
    return mix(night, overcast, light).add(dither());
  },
  props: ({ stops, light, ridge, time, signals }) => {
    // How far the snow has fallen and been blown, in world units.
    const fall = uniform(0);
    const wind = uniform(0);
    let gust = 0;
    const reach = ridge.u.rows.sub(1).max(1).mul(ridge.u.spacing);
    const wide = ridge.WIDTH * 1.8;
    const height = 13;
    const motes = createMotes({
      count: 4500,
      make: ([a, b, c, d]) => {
        const y = fract(b.sub(fall.mul(mix(0.6, 1.3, d)).div(height))).mul(height).sub(0.6);
        const sway = sin(time.mul(mix(0.4, 0.9, c)).add(a.mul(40))).mul(0.35);
        const x = fract(a.add(wind.div(wide))).sub(0.5).mul(wide).add(sway);
        // From in front of the ridge to well behind it.
        const z = float(9).sub(c.mul(reach.add(20)));
        // A few flakes catch the light as the treble glitters.
        const glint = varying(step(0.86, c).mul(signals.treble).mul(sin(time.mul(17).add(a.mul(60))).mul(0.5).add(0.5)));
        const far = exp(positionView.z.mul(0.035));
        const m = softDot(0.05);
        const flake = mix(stops[0], vec3(1), 0.82).mul(m.mul(far).mul(glint.mul(1.5).add(0.75)));
        const ash = mix(stops[0].mul(0.35), vec3(0.28), 0.6);
        return { position: vec3(x, y, z), size: mix(0.035, 0.11, pow(d, 2.5)), colour: glowOrInk(flake, ash, m.mul(far).mul(0.55), light) };
      },
    });
    return {
      object: motes.object,
      frame: ({ dt, shared }) => {
        const s = shared.signals;
        fall.value += dt * (0.55 + 0.9 * (s.energy?.value ?? 0.5));
        gust = follow(gust, s.bass.value, dt, 0.8);
        wind.value += dt * (0.3 + 1.8 * gust);
      },
      dispose: motes.dispose,
    };
  },
};
