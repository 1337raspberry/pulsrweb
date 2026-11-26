// Lit glass tubes: a core brighter than white inside a soft halo of the row's own colour.
// On a light background the halo becomes ink bleeding into damp paper.
import { float, mix, select } from 'three/tsl';
import { baseHalf, coreAt, glowColour, halo, haloAt, keepBrightest, px, random, seedOf, signal } from '../lib/line-kit.js';

export default {
  name: 'neon',
  build: (c) => {
    // The halo is widest on the nearest rows, swells with the music and flares on the
    // live row with each beat.
    const flare = select(c.row.live, signal(c, 'beat').add(1), float(1));
    const reach = px(c, 4.5).mul(c.row.near.mul(0.6).add(0.4)).mul(signal(c, 'level').mul(0.6).add(0.8)).mul(flare);
    const tube = halo(c, { core: baseHalf(c).mul(0.85), reach });
    // Now and then a tube stutters, as old neon does.
    const stutter = select(random(seedOf(c.row), c.time.mul(12).floor()).lessThan(0.025), float(0.4), float(1));
    const tint = mix(c.ground, c.tint, c.fade.mul(stutter));
    return {
      width: tube.width,
      colour: glowColour(c, tint, coreAt(tube.d, tube.core), haloAt(tube.d, tube.reach).mul(tube.strength).mul(0.85)),
      ...keepBrightest(c),
    };
  },
};
