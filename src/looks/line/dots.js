// Rows drawn as strings of round dots, evenly spaced along each row so the peaks keep their
// shape in dots. The louder a part of the row, the bigger its dots; far off, where the dots
// crowd together, they close up into a line.
import { max, smoothstep, varying, vec2 } from 'three/tsl';
import { rowLengths, steadySpacing } from '../lib/line-arc.js';
import { baseHalf, coreAt, px, random, seedOf } from '../lib/line-kit.js';

// The stroke is this many line widths across, room for the biggest dot.
const SPAN = 4;
// Dots about this many line widths apart in the middle of the ridge.
const APART = 4.5;

export default {
  name: 'dots',
  build: (c) => {
    const lengths = rowLengths(c);
    const steady = steadySpacing(c, APART);
    const s = varying(lengths.at(c.index));
    const half = baseHalf(c).mul(SPAN);
    // This pixel's place among the dots: which one is nearest, and how far from its middle.
    // Each row's dots start at a place of their own, so rows do not line up in columns.
    const cells = s.div(steady.spacing).add(random(seedOf(c.row), 99));
    const local = cells.sub(cells.round());
    const apart = varying(lengths.onScreen()).mul(steady.spacing);
    const across = c.across.mul(half);
    const radius = baseHalf(c).mul(2.5).max(px(c, 1.3)).mul(c.height.mul(0.5).add(0.8)).min(half.mul(0.95));
    const dot = coreAt(vec2(local.mul(apart), across).length(), radius);
    const crowded = smoothstep(radius.mul(2), radius.mul(3.2), apart).oneMinus();
    const line = coreAt(across.abs(), radius.mul(0.75)).mul(crowded);
    return {
      width: SPAN,
      colour: c.faded(c.tint),
      opacity: max(dot, line),
      transparent: false,
      alphaTest: 0.5,
      alphaToCoverage: true,
      extras: [lengths.extra, steady.extra],
    };
  },
};
