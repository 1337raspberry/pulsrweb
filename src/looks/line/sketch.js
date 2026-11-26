// Rows drawn by hand: grainy pencil on a light background, chalk on a dark one, each row
// wobbling a little in its own way and redrawn on every beat and a few times a second, as
// hand-drawn animation boils.
import { MultiplyBlending } from 'three/webgpu';
import { mix, mx_noise_float, screenCoordinate, smoothstep, vec2, vec3 } from 'three/tsl';
import { keepBrightest, seedOf, signal } from '../lib/line-kit.js';

export default {
  name: 'sketch',
  build: (c) => {
    const light = c.light.value > 0.5;
    // Each redrawing gives every row a new wobble of its own.
    const take = signal(c, 'beats').add(c.time.mul(3).floor()).mod(4096);
    const seed = seedOf(c.row).mul(0.73).add(take.mul(1.37));
    const wobble = (i, axis) => mx_noise_float(vec2(c.alongAt(i).mul(7), seed.add(axis)));
    const shake = c.u.spacing.mul(0.12);
    const lift = (i) => wobble(i, 0).mul(shake).div(c.row.rise.max(1e-3));
    const shift = (i) => wobble(i, 31).mul(shake).div(c.WIDTH).mul(0.5);
    // The paper's tooth, fixed to the screen: the lead or chalk only catches its high spots,
    // more of them the harder it is pressed (louder parts of the row press harder).
    const tooth = mx_noise_float(screenCoordinate.xy.div(c.pixelRatio).mul(0.55)).mul(0.5).add(0.5);
    const pressure = smoothstep(0, 0.8, c.height).mul(0.35).add(0.55);
    const cover = smoothstep(0.3, 0.7, tooth.mul(0.6).add(pressure).sub(c.across.abs().mul(0.45))).mul(c.fade);
    const lead = mix(c.ink, c.tint, 0.35);
    const chalk = mix(c.tint, vec3(1), 0.55);
    return {
      lift,
      shift,
      width: 1.5,
      ...(light
        ? { colour: lead, opacity: cover, transparent: true, depthWrite: false, blending: MultiplyBlending, premultipliedAlpha: true }
        : { colour: mix(c.ground, chalk, cover), ...keepBrightest(c) }),
    };
  },
};
