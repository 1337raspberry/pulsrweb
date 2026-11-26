// Rows as layers of cut card in a shadow box: matte layers in a ramp of the palette's
// colours, each casting a soft shadow onto the layer behind it from a light off to the
// left, with a faint paper grain and a pale cut edge along every top.
import { clamp, int, max, min, mix, mx_noise_float, round, select, smoothstep, varying, vec3 } from 'three/tsl';
import { seedOf, signal } from '../lib/line-kit.js';

export default {
  name: 'papercut',
  build: (c) => {
    // The row between this one and the camera, whose shadow falls on this one.
    const away = c.u.flow.lessThan(0.5);
    const k = c.row.k;
    const front = c.rowAt(select(away, k.sub(1), k.add(1)));
    const hasFront = select(away, k.greaterThan(int(0)), k.lessThan(int(round(c.u.rows)).sub(1)));
    // The light comes from the left and a little above, so the shadow falls to the right
    // and a little down: by this many points along, and this far down.
    const shift = int(round(c.u.spacing.mul(1.3).mul((c.points - 1) / c.WIDTH)));
    const from = clamp(c.index.sub(shift), 0, c.points - 1);
    const edge = varying(select(hasFront, front.heightAt(from).mul(front.rise), -1));
    const drop = c.u.spacing.mul(0.3);
    const soft = c.u.spacing.mul(0.9);
    // This pixel's height on its own layer, in world units.
    const y = c.up.mul(c.height).mul(c.row.rise);
    const depth = signal(c, 'level').mul(0.15).add(0.38);
    const shadow = smoothstep(edge.sub(drop).sub(soft), edge.sub(drop).add(soft.mul(0.25)), y).oneMinus().mul(depth);

    // Card in a ramp from the palette's first colour at the front to its last at the back,
    // softened towards the ground, a touch lighter near each layer's top.
    const card = mix(mix(c.stops[0], c.stops[2], c.far), c.ground, mix(0.3, 0.45, c.light));
    const sheet = card.mul(c.up.mul(0.08).add(0.94));
    const grain = mx_noise_float(vec3(c.along.mul(c.WIDTH * 22), y.mul(22), seedOf(c.row))).mul(0.03);
    const curtain = mix(c.ground, sheet.mul(shadow.oneMinus()).add(grain), min(c.fade.mul(1.4), 1));
    // The cut edge catches the light.
    const cut = mix(card, vec3(1), 0.35);
    return {
      colour: mix(c.ground, cut, min(c.fade.mul(1.4), 1)),
      width: 0.8,
      curtain: { colour: max(curtain, vec3(0)) },
    };
  },
};
