// A night thunderstorm: low cloud lit from inside by lightning on the music's big hits,
// rain slanting through the scene and falling among the rows, and the wet ground beyond
// mirroring the sky, ringed by drops. The rain thickens as the music fills out and leans
// with the bass.
import { Vector2 } from 'three/webgpu';
import { abs, clamp, exp, float, floor, fract, length, mix, mx_fractal_noise_float, mx_noise_float, positionView, rotate, rtt, smoothstep, step, uniform, uv as spriteUv, varying, vec2, vec3 } from 'three/tsl';
import { centred, createView, dither, floorHit, follow, hash11, hash21, hash22, lift, release } from '../lib/backdrop-kit.js';
import { createMotes, glowOrInk } from '../lib/motes.js';

// Seconds at least between strikes, and at most without a hit to set one off.
const STRIKE_GAP = 2.6;
const STRIKE_IDLE = 16;
// The colour of lightning's light (linear).
const BOLT = [0.78, 0.84, 1];

export default {
  name: 'storm',
  build: ({ uv, background, stops, light, resolution, camera, time, signals }) => {
    const view = createView();
    const fall = uniform(0);
    const slant = uniform(-0.15);
    const flash = uniform(0);
    const bolt = uniform(0);
    const strikeAt = uniform(new Vector2(0, 0.3));
    const strikeSeed = uniform(0);
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let since = 0;
    let idle = 8;
    let flicker = -1;
    let gust = 0;

    const p = centred(uv, resolution);
    const horizon = clamp(view.horizon, 0.42, 0.64);
    const v = uv.y.sub(horizon);

    // The cloud deck, worked out at half resolution: heavy and dark, lit from inside round
    // the strike.
    const density = mx_fractal_noise_float(vec3(p.mul(vec2(1.4, 3.2)).add(vec2(time.mul(0.012), 0)), time.mul(0.02)), 4, 2, 0.5).mul(0.5).add(0.5);
    const cloud = mix(background.mul(0.3), mix(background, stops[0], 0.18).mul(0.95), density);
    // The strike lights the cloud from inside: brightest in its thick parts, round about it.
    const nearStrike = exp(length(p.sub(strikeAt).mul(vec2(0.8, 1.6))).pow(2).mul(-11));
    const litCloud = cloud.add(vec3(...BOLT).mul(flash.mul(nearStrike.mul(density.pow(2).mul(1.6).add(0.15)).add(0.03))));
    const deck = smoothstep(-0.02, 0.22, v);
    const haze = mix(background.mul(0.45), mix(background, stops[0], 0.1).mul(0.7), smoothstep(0.1, 0, abs(v)));
    const skyTexture = rtt(mix(haze, litCloud, deck).add(vec3(...BOLT).mul(flash.mul(0.04))), null, null, { resolutionScale: 0.5 });
    const sky = skyTexture.sample(uv);

    // A bolt now and then: a jagged thread from the cloud base down to the horizon.
    const jag = mx_noise_float(vec2(p.y.mul(6), strikeSeed)).mul(0.09).add(mx_noise_float(vec2(p.y.mul(26), strikeSeed.add(5))).mul(0.022));
    const off = abs(p.x.sub(strikeAt.x).sub(jag)).mul(resolution.y);
    const reach = step(horizon.sub(0.5), p.y).mul(step(p.y, strikeAt.y));
    const thread = exp(off.div(1.4).pow(2).negate()).mul(2.2).add(exp(off.div(14).negate()).mul(0.35)).mul(reach).mul(bolt);

    // The wet ground beyond the ridge: the sky mirrored, rings spreading where drops land.
    const ground = floorHit(uv, camera, 0);
    const g = ground.point.xz.div(0.9);
    const id = floor(g);
    const k = hash21(id);
    const turn = fract(time.mul(mix(0.6, 1.2, k)).add(k.mul(7)));
    const ringCentre = hash22(id.add(3.3)).sub(0.5).mul(0.5);
    const ring = exp(length(fract(g).sub(0.5).sub(ringCentre)).sub(turn.mul(0.45)).div(0.03).pow(2).negate())
      .mul(turn.oneMinus().pow(2)).mul(step(k, 0.7)).mul(exp(ground.distance.mul(-0.05)));
    const mirrored = skyTexture.sample(vec2(uv.x, horizon.mul(2).sub(uv.y).add(ring.mul(0.012))));
    const wet = mix(background.mul(0.18), mirrored.mul(0.55), 0.85).add(vec3(...BOLT).mul(ring.mul(0.1)));
    // Sky and ground meet in a band of rain haze.
    let colour = mix(wet, sky, smoothstep(-0.012, 0.012, v));
    colour = mix(colour, haze.mul(1.15), exp(abs(v).mul(-45)).mul(0.55)).add(vec3(...BOLT).mul(thread));

    // Rain: thin streaks slanting down in three depths, catching the light of a strike.
    const rain = (columns, speed, length0, seed, strength) => {
      const q = rotate(p, slant);
      const x = q.x.mul(columns);
      const col = floor(x);
      const h = hash11(col.add(seed * 31));
      const f = fract(q.y.mul(columns * 0.08).add(fall.mul(speed).mul(mix(0.8, 1.2, h))).add(h.mul(9)));
      const dash = smoothstep(0, 0.04, f).mul(smoothstep(length0 * 0.6, length0, f).oneMinus());
      const across = abs(fract(x).sub(0.5).sub(h.sub(0.5).mul(0.6))).mul(resolution.y.div(columns));
      return dash.mul(smoothstep(0.4, 1.2, across).oneMinus()).mul(step(h, 0.6)).mul(strength);
    };
    const streaks = rain(150, 2.2, 0.3, 1, 0.07).add(rain(95, 3, 0.36, 2, 0.11)).add(rain(55, 4, 0.42, 3, 0.15));
    colour = colour.add(mix(stops[0], vec3(...BOLT), 0.6).mul(streaks.mul(flash.mul(2.5).add(1))));
    const paper = lift(mix(background, background.mul(0.9), density.mul(deck)), stops[0], streaks.mul(2), light);

    // Rain falling among the rows: tall thin streaks, hidden behind the hills like the rest.
    const reachZ = 30;
    const motes = createMotes({
      count: 2200,
      make: ([a, b, c, d]) => {
        const height = 12;
        const y = fract(b.sub(fall.mul(mix(0.85, 1.15, d)).div(height))).mul(height).sub(0.5);
        const x = a.sub(0.5).mul(28);
        const z = float(9).sub(c.mul(reachZ));
        const far = varying(exp(positionView.z.mul(0.04)));
        // Thin across, tapering towards its tail.
        const streak = smoothstep(0.2, 1, spriteUv().x.sub(0.5).abs().mul(2)).oneMinus().mul(smoothstep(0, 0.6, spriteUv().y));
        const glow = mix(stops[0], vec3(...BOLT), 0.6).mul(streak.mul(far).mul(flash.mul(2).add(0.35)));
        return { position: vec3(x, y, z), size: vec2(0.014, mix(0.35, 0.6, d)), colour: glowOrInk(glow, vec3(0.3), streak.mul(far).mul(0.3), light) };
      },
    });
    motes.object.material.rotationNode = slant;

    return {
      colour: mix(colour, paper, light).add(dither()),
      object: motes.object,
      frame: ({ dt, camera: seen, shared }) => {
        view.update(seen);
        const s = shared.signals;
        fall.value += dt * (5 + 5 * (s.energy?.value ?? 0.5));
        gust = follow(gust, s.bass.value, dt, 1.5);
        slant.value = -0.08 - 0.28 * gust;
        since += dt;
        flash.value *= Math.exp(-dt / 0.3);
        bolt.value *= Math.exp(-dt / 0.12);
        // One flicker after the first flash, then quiet until the next strike.
        if (flicker >= 0 && since > flicker) {
          flash.value = Math.max(flash.value, 0.55);
          flicker = -1;
        }
        const hit = (s.hit?.value ?? 0) > 0.85 || s.drop?.value > 0.9;
        if (!calm && since > STRIKE_GAP && (hit || since > idle)) {
          since = 0;
          idle = STRIKE_IDLE * (0.5 + Math.random() * 0.5);
          flash.value = 1;
          flicker = 0.1 + Math.random() * 0.1;
          const wide = seen.aspect / 2;
          strikeAt.value.set((Math.random() - 0.5) * 1.4 * wide, 0.22 + Math.random() * 0.18);
          strikeSeed.value = Math.random() * 100;
          bolt.value = Math.random() < 0.4 ? 1 : 0;
        }
      },
      dispose: () => {
        motes.dispose();
        release(sky);
      },
    };
  },
};
