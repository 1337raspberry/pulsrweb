// The picture on a pocket games console: four shades of green in chunky dithered pixels,
// with the faint grid of the little screen's cells between them.
import { clamp, color, float, floor, fract, max, pow, step, vec4 } from 'three/tsl';
import { createCells } from '../lib/filter-cells.js';
import { handOn } from '../lib/filter-ground.js';
import { bayer8, signal } from '../lib/filter-kit.js';

// The size of one pixel, in CSS pixels.
const BLOCK = 4;
// Darkest to lightest.
const SHADES = [0x0f380f, 0x306230, 0x8bac0f, 0x9bbc0f];

export default {
  name: 'pocket',
  build: (context) => {
    const { uv, resolution, signals } = context;
    const beat = signal(signals, 'beat');
    const cells = createCells(context, [BLOCK, BLOCK]);
    const block = cells.cellOf(uv);
    // The faintest tints stay blank, and a beat darkens every line a notch, leaving the
    // empty screen alone.
    const strength = clamp(pow(clamp(cells.at(block).a.sub(0.02).div(0.68), 0, 1), 0.8).mul(beat.mul(0.3).add(1)), 0, 1);
    // Three steps between four shades, the dither choosing between neighbours.
    const level = clamp(floor(strength.mul(3).add(bayer8(block).mul(0.9).add(0.05))), 0, 3);
    const [a, b, c, d] = SHADES.map((hex) => color(hex));
    // Lit pixels are dark on this screen: the strongest lines take the darkest green.
    const shade = level.greaterThan(2.5).select(a, level.greaterThan(1.5).select(b, level.greaterThan(0.5).select(c, d)));
    // The thin gaps between the screen's cells.
    const inCell = fract(uv.mul(resolution).div(cells.size));
    const gap = max(step(0.84, inCell.x), step(0.84, inCell.y));
    // The whole picture is redrawn on the little screen, so a filter after this sees its
    // palest green behind the ridge.
    const output = handOn(vec4(shade.mul(float(1).sub(gap.mul(0.1))), 1), () => d);
    return { output, frame: cells.frame, dispose: cells.dispose };
  },
};
