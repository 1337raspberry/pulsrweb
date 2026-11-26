// Rows as satin ribbons, twisting slowly along their length: a band that narrows to a
// hairline as it turns edge-on and swells again, one face in the palette's first colour and
// the other in its last, with a sheen down the middle when a face is towards you.
import { cos, float, min, mix, select, varying, vec3 } from 'three/tsl';
import { baseHalf, px, rowGap, seedOf, signal, smoothLift } from '../lib/line-kit.js';

// Half-turns along a row.
const TURNS = 5;

export default {
  name: 'ribbon',
  build: (c) => {
    // The twist drifts along the ribbon with the music's own clock.
    const clock = signal(c, 'clock', 0).add(c.time.mul(0.25));
    // (A whole number of turns an hour, so the twist runs on smoothly when the clock wraps.)
    const turn = c.alongAt(c.index).mul(TURNS * Math.PI).add(clock.mul((2 * Math.PI * 460) / 3600)).add(seedOf(c.row).mul(1.7));
    const face = cos(turn);
    const facing = varying(face);
    // Full width in device pixels, kept under half the gap to the next row.
    const full = min(baseHalf(c).mul(3.2).mul(signal(c, 'bass').mul(0.3).add(1)), rowGap(c).mul(0.45)).max(px(c, 1));
    const half = full.mul(face.abs().max(0.12));

    const lambert = facing.abs();
    const front = facing.greaterThan(0);
    const satin = select(front, c.stops[0], c.stops[2]);
    // A soft sheen along the middle when a face is towards you, and darker edges.
    const across = c.across.abs().min(1);
    const sheen = across.oneMinus().pow(4).mul(lambert.pow(3)).mul(0.55);
    const rim = across.pow(5).mul(0.35);
    const shade = lambert.mul(0.55).add(0.45).sub(rim);
    const lit = satin.mul(shade).add(mix(vec3(1), satin, 0.3).mul(sheen));
    return {
      lift: smoothLift(c),
      width: half.div(baseHalf(c)),
      colour: c.faded(mix(lit, c.tint, float(0.15))),
    };
  },
};
