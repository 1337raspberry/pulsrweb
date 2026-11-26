// The ridge at the bottom of a swimming pool: tiles under a wobbling net of caustic light,
// sunlit and bright on a light palette, a night swim lit from below on a dark one. The
// light swirls harder with the bass, and each beat sends a ring out across the floor.
import { clamp, exp, floor, int, length, max, mix, mx_noise_float, mx_worley_noise_vec2, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import { dither, floorHit, follow, gridLine, hash21 } from '../lib/backdrop-kit.js';

export default {
  name: 'deepend',
  build: ({ uv, background, stops, light, resolution, camera, ridge, signals, time }) => {
    const swirl = uniform(0.3);
    const swim = uniform(0);
    const floor0 = floorHit(uv, camera, 0);
    const P = floor0.point.xz;
    // Tiles four rows wide, a line of grout under every fourth row.
    const tile = ridge.u.spacing.mul(4);
    const z1 = ridge.rowAt(int(1)).z;
    const at = vec2(P.x.div(tile), P.y.sub(z1).div(tile));
    const grout = max(gridLine(at.x, 1.4), gridLine(at.y, 1.4));
    const shade = hash21(floor(at)).mul(0.06).add(0.97);

    // Caustics: two nets of light drifting across each other, bent by the moving water.
    // The water bends the light strongly, so the net's straight edges curve and pinch.
    const warp = vec2(mx_noise_float(vec3(P.mul(0.55), swim)), mx_noise_float(vec3(P.mul(0.55).add(9), swim))).mul(swirl.mul(1.8));
    const a = mx_worley_noise_vec2(P.mul(1.1).add(warp).add(vec2(swim.mul(0.4), 0)));
    const b = mx_worley_noise_vec2(P.mul(1.45).sub(warp.mul(0.8)).add(vec2(0, swim.mul(0.5))));
    // A ring running out from the front of the ridge after each beat.
    const out = length(vec2(P.x, P.y.sub(z1)));
    const since = signals.sinceBeat;
    const ring = exp(out.sub(since.mul(9)).div(0.8).pow(2).negate()).mul(exp(since.mul(-1.4)));
    // Where the two nets cross the light gathers brightest.
    const strands = smoothstep(0, 0.16, a.y.sub(a.x)).oneMinus().add(smoothstep(0, 0.13, b.y.sub(b.x)).oneMinus());
    const net = strands.mul(0.55).pow(1.4).mul(1.7).mul(ring.mul(0.8).add(1)).mul(exp(floor0.distance.mul(-0.035)));

    // Sunlit by day: pale aqua tiles, bright light. By night: deep teal, light from below.
    const water = mix(stops[0], vec3(0.25, 0.7, 0.8), 0.5);
    const dayTiles = mix(mix(background, water, 0.45), water.mul(0.55), grout.mul(0.5)).mul(shade);
    const nightTiles = mix(mix(background, water, 0.3).mul(0.55), background.mul(0.25), grout.mul(0.6)).mul(shade);
    const sun = mix(vec3(1, 0.98, 0.9), stops[1], 0.15);
    const lit = mix(nightTiles.add(water.mul(net.mul(0.35))), dayTiles.add(sun.mul(net.mul(0.32))), light);
    // Far off the water swallows the floor.
    const deep = mix(mix(background, water, 0.35).mul(0.35), mix(background, water, 0.5).mul(0.8), light);
    const colour = mix(deep, lit, exp(floor0.distance.mul(-0.03)).mul(floor0.down.select(1, 0)));
    // Shafts of light slanting down through the water.
    const shafts = mx_noise_float(vec2(uv.x.mul(5).add(uv.y.mul(1.6)), time.mul(0.04))).mul(0.5).add(0.5).pow(4)
      .mul(smoothstep(0.2, 1, uv.y)).mul(0.12);
    return {
      colour: clamp(colour.add(sun.mul(shafts)), 0, 4).add(dither()),
      frame: ({ dt, shared }) => {
        const s = shared.signals;
        swirl.value = follow(swirl.value, 0.25 + 0.6 * s.bass.value, dt, 0.6);
        swim.value += dt * (0.12 + 0.25 * (s.energy?.value ?? 0.5));
      },
    };
  },
};
