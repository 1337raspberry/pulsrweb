// The picture on a stadium screen: rows of round lamps with dark gaps between, each lit in
// the colour of the strongest line in its patch, a few running a little hot or dim.
import { exp, float, floor, fract, length, rand, vec3, vec4 } from 'three/tsl';
import { createCells } from '../lib/filter-cells.js';
import { handOn } from '../lib/filter-ground.js';
import { inside, signal, toDisplay, toLinear } from '../lib/filter-kit.js';

// Lamp spacing, in CSS pixels.
const PITCH = 6;

export default {
  name: 'ledwall',
  build: (context) => {
    const { uv, resolution, signals } = context;
    const bass = signal(signals, 'bass');
    const beat = signals.hit ?? signal(signals, 'beat');
    const cells = createCells(context, [PITCH, PITCH]);
    const lamp = cells.cellOf(uv);
    const here = cells.at(lamp);
    const pitch = cells.size.x;
    const d = length(fract(uv.mul(resolution).div(cells.size)).sub(0.5)).mul(pitch);
    const bulb = inside(d, pitch.mul(0.36).mul(bass.mul(0.12).add(1)), float(0.8));
    const halo = exp(d.mul(d).div(pitch.mul(pitch).mul(0.2)).negate()).mul(0.3);
    // A lamp shows 32 steps of each colour, and no two lamps are quite alike.
    const shown = toLinear(floor(toDisplay(here.rgb).mul(31).add(0.5)).div(31));
    const unevenness = rand(lamp).sub(0.5).mul(0.14).add(1);
    // Where a lamp is off the wall is black, whatever the palette.
    // Everything on the wall is lamps, the backdrop included, so a filter after this sees
    // the dark wall behind the ridge.
    const off = vec3(0.004);
    const output = handOn(vec4(off.add(shown.mul(unevenness).mul(bulb.add(halo)).mul(beat.mul(0.15).add(1))), 1), () => off);
    return { output, frame: cells.frame, dispose: cells.dispose };
  },
};
