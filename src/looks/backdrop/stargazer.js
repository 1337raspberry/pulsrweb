// A deep night sky: three depths of stars twinkling with the treble, the milky way's band
// of haze and dust across it, shooting stars on the big beats, all turning slowly and
// staying put in the world as the camera moves. On a light background, a star chart.
import { Vector2 } from 'three/webgpu';
import { clamp, dot, exp, length, max, mix, mx_fractal_noise_float, rotate, sin, smoothstep, step, uniform, vec2, vec3 } from 'three/tsl';
import { atScale, centred, createView, dither, gridLine, lift, release, stars } from '../lib/backdrop-kit.js';

// Seconds at least between shooting stars, and at most without a beat to start one.
const METEOR_GAP = 2.5;
const METEOR_IDLE = 14;

export default {
  name: 'stargazer',
  build: ({ uv, background, stops, light, resolution, time, signals }) => {
    const view = createView();
    // The shooting star: where it starts, which way it goes, how long it is, its age.
    const from = uniform(new Vector2(0, 0.3));
    const heading = uniform(new Vector2(-0.8, -0.6));
    const length0 = uniform(0.3);
    const age = uniform(9);
    let since = 0;
    let idle = 6;
    let beatsSeen = -1;

    const p = centred(uv, resolution);
    // The sky's own coordinates: still in the world, turning about a pole above the left.
    const pole = vec2(-0.7, 0.9);
    const turning = (shift) => rotate(p.add(shift).sub(pole), time.mul(0.0012)).add(pole);
    const sky = turning(view.shift);

    // The milky way: a band of soft light with dark lanes of dust down its middle, soft
    // enough to work out at half the resolution. It moves with the stars, but never so far
    // up or down that it leaves the sky.
    const m = rotate(turning(vec2(view.shift.x, clamp(view.shift.y, -0.25, 0.25))).sub(vec2(0, 0.22)), 0.3);
    const across = m.y.sub(sin(m.x.mul(1.3)).mul(0.05));
    const band = exp(across.mul(across).mul(-16));
    const core = exp(across.mul(across).mul(-70));
    const haze = mx_fractal_noise_float(vec3(m.mul(2.2), 1.7), 4, 2, 0.5).mul(0.5).add(0.5);
    const dust = smoothstep(0.52, 0.78, mx_fractal_noise_float(vec3(m.mul(4.5), 3.1), 3, 2, 0.5).mul(0.5).add(0.5));
    const tint = mix(vec3(0.7, 0.78, 1), mix(vec3(1, 0.85, 0.65), stops[2], 0.25), core);
    const milky = atScale(tint.mul(band.mul(haze).mul(0.2).add(core.mul(0.1))).mul(dust.mul(core).mul(0.8).oneMinus()), uv, 0.5);

    // Stars: faint and many, brighter and fewer, and the band's own crowd.
    const twinkle = signals.treble.mul(0.45).add(0.12);
    const starLight = stars(sky, { cells: 90, share: 0.35, seed: 1, resolution, size: 0.8, time, twinkle })
      .mul(0.45)
      .add(stars(sky, { cells: 38, share: 0.3, seed: 2, resolution, size: 1.1, time, twinkle }).mul(0.8))
      .add(stars(sky, { cells: 140, share: band.mul(0.6), seed: 3, resolution, size: 0.7, time, twinkle }).mul(0.4));

    // The shooting star: a streak with a bright head and a fading tail.
    const d = p.sub(from);
    const ahead = dot(d, heading);
    const aside = length(d.sub(heading.mul(ahead))).mul(resolution.y);
    const head = age.mul(0.95);
    const tail = clamp(ahead.sub(head.sub(length0)).div(length0), 0, 1);
    const fade = smoothstep(0, 0.06, age).mul(smoothstep(0.45, 0.85, age).oneMinus());
    const meteor = exp(aside.div(1.3).pow(2).negate()).mul(tail.mul(tail)).mul(step(ahead, head)).mul(fade).mul(1.6);

    const deep = mix(mix(background, stops[0], 0.08), background.mul(0.45), smoothstep(-0.5, 0.4, p.y));
    const night = deep.add(milky).add(vec3(starLight.add(meteor)));
    // A star chart: ink stars on the page, the band as a wash, a grid of the sky's own.
    const chart = lift(background, stops[0], clamp(starLight.mul(1.4).add(meteor), 0, 1), light)
      .mul(milky.x.mul(0.8).oneMinus())
      .mul(max(gridLine(sky.x.mul(4)), gridLine(sky.y.mul(4))).mul(0.12).oneMinus());
    return {
      colour: mix(night, chart, light).add(dither()),
      frame: ({ dt, camera, shared }) => {
        view.update(camera);
        const s = shared.signals;
        since += dt;
        age.value += dt;
        const beat = beatsSeen >= 0 && s.beats.value !== beatsSeen && s.beat.value > 0.8;
        beatsSeen = s.beats.value;
        if (since > METEOR_GAP && ((beat && Math.random() < 0.6) || since > idle)) {
          since = 0;
          idle = METEOR_IDLE * (0.5 + Math.random() * 0.5);
          const wide = camera.aspect / 2;
          from.value.set((Math.random() - 0.5) * 1.6 * wide, 0.12 + Math.random() * 0.3);
          const right = Math.random() < 0.5 ? -1 : 1;
          heading.value.set(right * (0.7 + Math.random() * 0.25), -(0.35 + Math.random() * 0.35)).normalize();
          length0.value = 0.18 + Math.random() * 0.2;
          age.value = 0;
        }
      },
      dispose: () => release(milky),
    };
  },
};
