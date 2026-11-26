// Round-ended dashes, evenly spaced along each row and longer where the row is louder:
// quiet stretches come out dotted and loud ones nearly solid, like telegraph tape.
import { max, smoothstep, varying, vec2 } from 'three/tsl';
import { rowLengths, steadySpacing } from '../lib/line-arc.js';
import { baseHalf, coreAt, px, random, seedOf } from '../lib/line-kit.js';

// A dash about every this many line widths in the middle of the ridge.
const EVERY = 6;
// The stroke is this many line widths across: room for the dashes' soft edges.
const SPAN = 1.6;

export default {
  name: 'dashed',
  build: (c) => {
    const lengths = rowLengths(c);
    const steady = steadySpacing(c, EVERY);
    const s = varying(lengths.at(c.index));
    // Each row's dashes start at a place of their own, so rows do not line up in columns.
    const cells = s.div(steady.spacing).add(random(seedOf(c.row), 99));
    const apart = varying(lengths.onScreen()).mul(steady.spacing);
    // How far along this pixel is from the middle of its dash, in device pixels, and how
    // much of each step the dash fills: a dot where quiet, most of it where loud.
    const along = cells.fract().sub(0.5).abs().mul(apart);
    const fill = smoothstep(0.03, 0.5, c.height).mul(0.62).add(0.3);
    const radius = baseHalf(c).max(px(c, 0.8));
    const straight = max(fill.mul(apart).mul(0.5).sub(radius), 0);
    const d = vec2(max(along.sub(straight), 0), c.across.mul(radius.mul(SPAN))).length();
    return {
      width: radius.mul(SPAN).div(baseHalf(c)),
      colour: c.faded(c.tint),
      opacity: coreAt(d, radius),
      transparent: false,
      alphaTest: 0.5,
      alphaToCoverage: true,
      extras: [lengths.extra, steady.extra],
    };
  },
};
