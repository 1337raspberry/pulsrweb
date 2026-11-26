// Strings of fairy lights: tiny bulbs evenly spaced on a thin wire, each glowing with the
// loudness under it and twinkling on its own, the palette's three colours taking turns.
import { max, mix, select, sin, smoothstep, varying, vec2, vec3 } from 'three/tsl';
import { rowLengths, steadySpacing } from '../lib/line-arc.js';
import { baseHalf, coreAt, halo, haloAt, keepBrightest, px, random, seedOf, signal, smoothLift } from '../lib/line-kit.js';

// Bulbs about this many line widths apart in the middle of the ridge.
const APART = 9;

export default {
  name: 'fairy',
  build: (c) => {
    const lengths = rowLengths(c);
    const steady = steadySpacing(c, APART);
    const s = varying(lengths.at(c.index));
    const bulbSize = baseHalf(c).mul(2.1).max(px(c, 1.4));
    const light = halo(c, { core: bulbSize, reach: bulbSize.mul(1.8).mul(signal(c, 'level').mul(0.5).add(1)) });

    // Each string's bulbs start at a place of their own, so strings do not line up in columns.
    const cells = s.div(steady.spacing).add(random(seedOf(c.row), 99));
    const cell = cells.round();
    const apart = varying(lengths.onScreen()).mul(steady.spacing);
    const d = vec2(cells.sub(cell).mul(apart), c.across.mul(light.half)).length();

    // Each bulb twinkles at its own rate; a beat runs a chase along every string.
    const seed = seedOf(c.row);
    const id = cell.mod(4096);
    const twinkle = sin(c.time.mul(random(seed, id).mul(2.4).add(0.6)).add(random(seed, id.add(1)).mul(6.283))).mul(0.22).add(0.78);
    const chase = signal(c, 'beat').mul(smoothstep(0.75, 1, cell.div(9).sub(c.time.mul(3)).fract()));
    const which = cell.mod(3);
    const glass = select(which.lessThan(0.5), c.stops[0], select(which.lessThan(1.5), c.stops[1], c.stops[2]));
    const lit = smoothstep(0.03, 0.6, c.height).mul(0.85).add(0.15).mul(twinkle).add(chase).min(1.2).mul(c.fade);

    const bulb = coreAt(d, light.core);
    const shine = haloAt(d, light.reach).mul(light.strength).mul(0.9);
    // The wire: a hairline a little off the ground's colour.
    const wire = coreAt(c.across.abs().mul(light.half), px(c, 0.45)).mul(c.fade).mul(0.55);
    const strung = mix(c.ground, mix(c.ground, c.tint, 0.35), wire);
    const tint = mix(c.ground, glass, lit);
    const hot = mix(mix(glass, vec3(1), 0.45).mul(lit.mul(1.8)), mix(glass, vec3(0), 0.3), c.light);
    // By day the bulbs are coloured glass beads, shown in full; by night they show as lit.
    const shown = mix(lit.min(1), c.fade, c.light);
    return {
      // Strings drape: the grain's little zigzags are smoothed away.
      lift: smoothLift(c),
      width: light.width,
      colour: mix(mix(strung, tint, max(shine, bulb.mul(0.6))), hot, bulb.mul(shown)),
      ...keepBrightest(c),
      extras: [lengths.extra, steady.extra],
    };
  },
};
