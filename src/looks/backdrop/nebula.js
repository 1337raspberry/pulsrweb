// A glowing cloud of gas far out in space: billows of the palette's colours folded through
// one another, dark lanes of dust across them, hot knots that flare with the music, and
// stars. It stays put in the world as the camera turns, and the ridge hides whatever is
// behind it. On a light background, a wash of ink.
import { clamp, float, mix, mx_fractal_noise_float, smoothstep, vec2, vec3 } from 'three/tsl';
import { atScale, centred, createView, dither, lift, release, signal, stars } from '../lib/backdrop-kit.js';

// Noise from -1 to 1 turned into 0 to 1.
const cloud = (at, octaves = 4) => mx_fractal_noise_float(at, octaves, 2, 0.5).mul(0.5).add(0.5);

export default {
  name: 'nebula',
  build: ({ uv, background, stops, light, resolution, time, signals }) => {
    const view = createView();
    const p = centred(uv, resolution).add(view.shift.mul(0.6));
    // The gas churns slowly by itself and faster with the music.
    const churn = time.mul(0.012).add(signal(signals, 'clock', 0).mul(0.02));
    const q = p.mul(2.1);
    // Each billow is pushed about by another, which folds the cloud into wisps.
    const push = vec2(cloud(vec3(q, churn), 3), cloud(vec3(q.add(5.2), churn.add(3.1)), 3)).sub(0.5);
    const first = cloud(vec3(q.add(push.mul(2.4)), churn.mul(0.7)));
    const second = cloud(vec3(q.mul(1.7).sub(push.mul(1.8)).add(11.3), churn.mul(0.9).add(7)));
    const dust = smoothstep(0.5, 0.78, cloud(vec3(q.mul(2.3).add(push).add(23.7), 1.9), 3));
    const level = signal(signals, 'level');
    const beat = signal(signals, 'beat');
    const swell = level.mul(0.7).add(beat.mul(0.35)).add(0.75);
    const gas = stops[0].mul(smoothstep(0.42, 0.82, first).mul(0.55))
      .add(stops[2].mul(smoothstep(0.5, 0.9, second).mul(0.5)))
      .add(stops[1].mul(smoothstep(0.5, 0.85, first.mul(second).mul(2)).mul(0.35)));
    // Where both billows are thick the gas burns nearly white.
    const knots = smoothstep(0.58, 0.82, first.mul(0.6).add(second.mul(0.4))).pow(2);
    const glow = gas.add(mix(stops[1], vec3(1), 0.6).mul(knots).mul(level.mul(0.9).add(0.5)))
      .mul(dust.mul(0.75).oneMinus()).mul(swell);
    const soft = atScale(glow, uv, 0.5);

    const twinkle = signal(signals, 'treble').mul(0.4).add(0.12);
    const starLight = stars(p, { cells: 70, share: 0.3, seed: 4, resolution, size: 0.9, time, twinkle }).mul(0.6)
      .add(stars(p, { cells: 30, share: 0.25, seed: 5, resolution, size: 1.2, time, twinkle }));
    const night = background.mul(0.5).add(soft).add(vec3(starLight));
    const wash = lift(background, mix(stops[0], stops[2], 0.5), clamp(soft.r.add(soft.g).add(soft.b).mul(0.5).add(starLight), 0, 1), light);
    return {
      colour: mix(night, wash, light).add(dither()),
      // The ridge's curtains are solid, so nothing of the cloud shows through the ridge.
      veil: () => mix(background.mul(0.9), background, light),
      solid: true,
      frame: ({ camera }) => view.update(camera),
      dispose: () => release(soft),
    };
  },
};
