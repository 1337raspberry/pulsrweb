// Electric arcs: every row a jagged, crackling bolt that re-strikes many times a second,
// with a core hotter than white and a halo of the row's colour. The newest rows crackle
// hardest; older ones settle into a hum.
import { float, int, mix, select, uniform } from 'three/tsl';
import { baseHalf, coreAt, glowColour, halo, haloAt, keepBrightest, px, random, seedOf, signal } from '../lib/line-kit.js';

// Kinks every this many points, joined by straight lines, with a little fizz on every point.
const KINK = 5;
// Strikes a second, and with reduced motion.
const STRIKES = 24;
const CALM_STRIKES = 2;
// 1 when the visitor asks for reduced motion: the arcs then re-strike slowly and stop flickering.
const calm = uniform(0);

export default {
  name: 'zap',
  build: (c) => {
    const tick = c.time.mul(mix(float(STRIKES), float(CALM_STRIKES), calm)).floor();
    const seed = random(seedOf(c.row), tick).mul(4095).floor();
    const rand = (i, salt) => random(seed, float(i).mul(4).add(salt));
    // A bolt's path: random offsets at every kink, joined straight, plus fizz.
    const bolt = (i, salt) => {
      const kink = i.div(KINK);
      const f = float(i.mod(KINK)).div(KINK);
      return mix(rand(kink, salt), rand(kink.add(1), salt), f).sub(0.5).add(rand(i, salt + 2).sub(0.5).mul(0.35));
    };
    // How wild the arc is, as a share of the gap between rows: the newest rows most, and
    // more with the treble and on a beat.
    const fresh = select(c.row.k.lessThan(int(4)), signal(c, 'beat').mul(1.5), float(0));
    const wild = float(0.28).add(signal(c, 'treble').mul(0.3)).add(fresh).mul(c.row.near.mul(0.6).add(0.4));
    const lift = (i) => bolt(i, 0).mul(wild).mul(c.u.spacing).div(c.row.rise.max(1e-3));
    const shift = (i) => bolt(i, 1).mul(wild).mul(c.u.spacing).div(c.WIDTH).mul(0.6);

    const reach = px(c, 2.6).mul(c.row.near.mul(0.5).add(0.5)).mul(signal(c, 'bass').mul(0.5).add(0.9));
    const arc = halo(c, { core: baseHalf(c).mul(0.7), reach });
    // A row drops out now and then, as an arc does.
    const out = select(random(seedOf(c.row), tick.add(7)).lessThan(mix(float(0.08), float(0), calm)), float(0.25), float(1));
    const tint = mix(c.ground, c.tint, c.fade.mul(out));
    return {
      lift,
      shift,
      width: arc.width,
      colour: glowColour(c, tint, coreAt(arc.d, arc.core), haloAt(arc.d, arc.reach).mul(arc.strength).mul(0.8), 2),
      ...keepBrightest(c),
    };
  },
  frame: () => {
    calm.value = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 1 : 0;
  },
};
