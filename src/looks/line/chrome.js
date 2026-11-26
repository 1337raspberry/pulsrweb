// Rows as polished metal tubes reflecting a made-up sky: a bright sky above a sharp
// horizon, dark ground below, a streak of a key light, all turning with each tube as it
// bends, and a horizon that ripples like liquid metal with the bass. Best fairly thick.
import { cross, dot, exp, float, max, min, mix, normalize, reflect, select, sign, sin, smoothstep, varying, vec2, vec3 } from 'three/tsl';
import { baseHalf, px, rowGap, signal, smoothLevel, smoothLift, toPixels } from '../lib/line-kit.js';

export default {
  name: 'chrome',
  build: (c) => {
    // The tube's path, smoothed as the lift draws it, and its frame at this point: which way
    // it runs, which way is up for it (the shape's own up), and its side facing the eye.
    const before = max(c.index.sub(1), 0);
    const after = min(c.index.add(1), c.points - 1);
    const level = smoothLevel(c, c.index);
    const along = c.alongAt(c.index);
    const path = (i) => c.place(c.alongAt(i), smoothLevel(c, i).mul(c.row.rise));
    const here = c.place(along, level.mul(c.row.rise));
    const run = normalize(path(after).sub(path(before)));
    const lifted = normalize(c.place(along, level.mul(c.row.rise).add(0.05)).sub(here));
    const up = normalize(lifted.sub(run.mul(dot(lifted, run))));
    const eye = normalize(c.camera.position.sub(here));
    const side = cross(run, up);
    const facing = side.mul(sign(dot(side, eye)));
    // The stroke's upper side on screen is `across` 1; flip if the tube's up points the other way.
    const span = toPixels(c, path(after)).sub(toPixels(c, path(before)));
    const normal = vec2(span.y.negate(), span.x);
    const upOnScreen = toPixels(c, here.add(up.mul(0.05))).sub(toPixels(c, here));
    const flip = varying(select(dot(normal, upOnScreen).lessThan(0), float(-1), float(1)));
    const [vUp, vFacing, vEye, vHere] = [up, facing, eye, here].map((v) => varying(v));

    // The tube's surface at this pixel, and what it reflects.
    const a = c.across.mul(flip).clamp(-1, 1);
    const n = normalize(vUp.mul(a).add(vFacing.mul(a.mul(a).oneMinus().max(0).sqrt())));
    const r = reflect(vEye.negate(), n);
    // The made-up world it reflects. Its horizon sits a little below level, so a tube seen
    // from above shows sky over most of its upper half, as a studio shot of chrome does.
    const horizonAt = sin(vHere.x.mul(0.8).add(c.time.mul(1.7))).mul(0.05).mul(signal(c, 'bass').add(0.3)).sub(0.25);
    const sharp = signal(c, 'treble').mul(-0.006).add(0.012);
    const sky = mix(mix(c.tint, vec3(1), 0.55), vec3(1.15), smoothstep(horizonAt, 0.9, r.y));
    const ground = mix(mix(c.ground, vec3(0), 0.7), c.tint.mul(0.3), smoothstep(-1, horizonAt, r.y));
    const off = r.y.sub(horizonAt).div(0.035);
    const horizon = exp(off.mul(off).negate()).mul(0.8);
    const key = dot(r, normalize(vec3(-0.35, 0.8, 0.5))).max(0).pow(60).mul(signal(c, 'beat').mul(0.8).add(1.2));
    const env = mix(ground, sky, smoothstep(horizonAt.sub(sharp), horizonAt.add(sharp), r.y)).add(horizon).add(key);
    // Kept under half the gap to the next row, so tubes do not pile up when rows are packed.
    const half = min(baseHalf(c).mul(2.2), rowGap(c).mul(0.42)).max(px(c, 1));
    return {
      lift: smoothLift(c),
      width: half.div(baseHalf(c)),
      colour: c.faded(env),
    };
  },
};
