// Northern lights: curtains of light hang in the night sky above the ridge, folding and
// rippling, and glow brightest over the frequencies that are playing below them.
import { clamp, exp, int, mix, mx_noise_float, pow, sin, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import { alongUnder, atScale, centred, createView, dither, follow, lift, recentLevel, release, stars } from '../lib/backdrop-kit.js';

export default {
  name: 'aurora',
  build: ({ uv, background, stops, light, resolution, ridge, camera, time, signals }) => {
    const view = createView();
    // How far the curtains have folded, and a wave that runs along them faster after a beat.
    const fold = uniform(0);
    const ripple = uniform(0);
    const surge = uniform(0);
    let beatsSeen = -1;
    const p = centred(uv, resolution);
    const horizon = clamp(view.horizon, 0.45, 0.64);
    const base = horizon.sub(0.5);

    // How brightly each column of sky is lit: the level of the ridge below it.
    const along = alongUnder(uv, camera, ridge, int(ridge.u.rows.sub(1)));
    const lit = recentLevel(ridge, clamp(along, 0, 1), 3).mul(1.15).add(0.16);

    let glow = vec3(0);
    for (const [i, lift0, fall] of [[0, 0.05, 7], [1, 0.12, 9], [2, 0.2, 12]]) {
      // Folds: the curtain's line bends back and forth, and the bends drift.
      const x = p.x.add(mx_noise_float(vec2(p.x.mul(0.9).add(i * 3.1), fold.mul(0.12).add(i))).mul(0.14));
      const edge = base.add(lift0).add(mx_noise_float(vec2(x.mul(1.3).add(i * 5.3), fold.mul(0.16))).mul(0.075))
        .add(sin(x.mul(9).sub(ripple.mul(3)).add(i * 2)).mul(0.012));
      const h = p.y.sub(edge);
      // Rays: fine upright streaks, fading upwards from a sharp, bright lower edge.
      const rays = pow(mx_noise_float(vec2(x.mul(46).add(i * 11), fold.mul(0.7))).mul(0.5).add(0.5), 2.2);
      const body = smoothstep(-0.005, 0.006, h).mul(exp(h.max(0).mul(-fall)));
      // The lower edge burns brightest.
      const fringe = exp(h.max(0).mul(-140)).mul(0.6).mul(smoothstep(-0.004, 0.002, h));
      const colour = mix(stops[0], mix(stops[1], stops[2], 0.6), smoothstep(0.02, 0.24, h));
      glow = glow.add(colour.mul(body.add(fringe)).mul(rays.mul(1.5).add(0.3)).mul(1.15 - 0.25 * i));
    }
    // The curtains are soft, so they are worked out at half the screen's resolution.
    const curtains = atScale(glow.mul(lit).mul(surge.mul(0.5).add(0.75)), uv, 0.5);

    // A dark night, darkest overhead, the land below darker still.
    const height = p.y.sub(base);
    const sky = mix(background.mul(0.55), background.mul(0.3), smoothstep(0, 0.45, height)).mul(smoothstep(-0.35, 0, height).mul(0.35).add(0.65));
    const starLight = stars(p, { cells: 52, share: 0.3, seed: 5, resolution, time, twinkle: 0.25 })
      .mul(smoothstep(0, 0.08, height));
    const night = sky.add(vec3(starLight.mul(0.55))).add(curtains);
    const paper = lift(background, stops[0], curtains.x.add(curtains.y).add(curtains.z).mul(0.4), light);
    return {
      colour: mix(night, paper, light).add(dither()),
      frame: ({ dt, camera: seen, shared }) => {
        view.update(seen);
        const s = shared.signals;
        fold.value += dt * (0.35 + 0.9 * s.mid.value);
        if (beatsSeen >= 0 && s.beats.value !== beatsSeen) surge.value = 1;
        beatsSeen = s.beats.value;
        surge.value = follow(surge.value, 0, dt, 0.6);
        ripple.value += dt * (0.8 + 4 * surge.value);
      },
      dispose: () => release(curtains),
    };
  },
};
