// Ranges of hills melting into haze: every row's curtain becomes a ridge of hills, dark in
// front and paler row by row until the last are lost in a dawn sky. On a light background,
// ink wash on paper under a red sun.
import { clamp, exp, length, mix, pow, select, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import { centred, createView, dither, follow } from '../lib/backdrop-kit.js';

// The sun on paper: a vermilion seal of a sun, as in ink-wash prints (linear).
const VERMILION = [0.62, 0.06, 0.02];

export default {
  name: 'smokies',
  build: ({ uv, background, stops, light, resolution }) => {
    const view = createView();
    // How thick the haze hangs, following the bass over seconds, and how warm the sky glows,
    // following how full the music is.
    const haze = uniform(0.85);
    const warmth = uniform(0.4);
    const p = centred(uv, resolution);
    // The horizon painted: the true one where the camera shows it, else just behind the
    // ridge's far end.
    const horizon = clamp(view.horizon, 0.5, 0.64);
    const v = uv.y.sub(horizon);

    // A deep sky with the glow pooled at the horizon; on paper, only a faint warm wash.
    const glowColour = mix(stops[1], stops[2], 0.6);
    const warm = mix(background, glowColour, mix(0.42, 0.16, light).mul(warmth.mul(0.5).add(0.75)));
    const zenith = mix(background.mul(0.72), background, light);
    const sky = mix(warm, zenith, smoothstep(0, 0.34, v));
    // Below the horizon the valleys are full of mist, thinning and darkening to the front.
    const front = mix(background.mul(0.5), background, light);
    const valley = mix(warm, front, smoothstep(0, 0.45, v.negate()));
    let colour = select(v.greaterThan(0), sky, valley);

    // A low sun to one side: a pale moon in its own glow over a dark palette, a red disc on
    // paper.
    const sunAt = vec2(0.36, horizon.sub(0.5).add(0.11));
    const d = length(p.sub(sunAt));
    const disc = smoothstep(0.042, 0.047, d).oneMinus();
    const halo = exp(d.mul(-11)).mul(0.32).add(exp(d.mul(-3.5)).mul(0.07)).mul(light.oneMinus());
    const moon = mix(stops[1], vec3(1), 0.7).mul(0.9);
    const sun = mix(moon, vec3(...VERMILION), light);
    colour = mix(colour.add(glowColour.mul(halo)), sun, disc.mul(0.85));

    // The curtains: ink in front, fading row by row into whatever is behind them, with mist
    // gathered low in every valley.
    const veil = (c) => {
      const ink = mix(background.mul(0.3), mix(stops[0], vec3(0.015), 0.84), light);
      const depth = pow(c.far, 0.72).mul(haze);
      const mist = smoothstep(0, 0.55, c.up).oneMinus().mul(0.42).mul(c.near.mul(0.5).add(0.5));
      return mix(ink, c.ground, clamp(depth.add(mist), 0, 1));
    };

    return {
      colour: colour.add(dither()),
      veil,
      frame: ({ dt, camera, shared }) => {
        view.update(camera);
        haze.value = follow(haze.value, 0.78 + 0.22 * shared.signals.bass.value, dt, 2.5);
        warmth.value = follow(warmth.value, shared.signals.energy?.value ?? 0.4, dt, 3);
      },
    };
  },
};
