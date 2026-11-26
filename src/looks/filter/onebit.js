// The picture in one bit: the palette's lettering colour on its background, in fat pixels,
// with an ordered dither standing in for every shade between, so far rows dissolve into
// patterns.
import { clamp, pow, vec4 } from 'three/tsl';
import { createCells } from '../lib/filter-cells.js';
import { handOn } from '../lib/filter-ground.js';
import { bayer8, signal } from '../lib/filter-kit.js';

// The size of one fat pixel, in CSS pixels.
const BLOCK = 3;

export default {
  name: 'onebit',
  build: (context) => {
    const { uv, background, ink, signals } = context;
    const beat = signal(signals, 'beat');
    // Each block takes the strongest colour inside it, so lines a pixel wide stay whole.
    const cells = createCells(context, [BLOCK, BLOCK]);
    const block = cells.cellOf(uv);
    // A line in any of the palette's colours at full strength is solid; only rows fading
    // into the distance dither, and the faintest tints (a backdrop's dark ground, say) stay
    // background. A beat lights every line a notch, leaving the empty background alone.
    const strength = pow(clamp(cells.at(block).a.sub(0.02).div(0.68), 0, 1), 0.8).mul(beat.mul(0.3).add(1));
    const lit = strength.greaterThan(bayer8(block).mul(0.94).add(0.03));
    // The whole picture, backdrop and all, is redrawn in the two colours, so a filter after
    // this sees the plain background behind the ridge.
    const output = handOn(vec4(lit.select(ink, background), 1), () => background);
    return { output, frame: cells.frame, dispose: cells.dispose };
  },
};
