// Cymbals and hi-hats scatter glitter: random points along the lines glint, more of them the
// brighter the top end was when their row was born, and each row's glints go back with it.
import { floor, hash, mix, oscSine, step, varying } from 'three/tsl';
import { contrast, ramp3 } from '../lib/colour.js';

export default {
  name: 'glitter',
  colour: ({ t, row, pointIndex, stops, background, light, signals, time }) => {
    const hue = ramp3(stops, t);
    const base = mix(mix(background, hue, mix(0.55, 0.85, light)), hue, t);
    // A number of its own for every point of every row, kept for as long as the row is shown.
    const seed = hash(floor(pointIndex).add(varying(row.serial).mul(733)));
    const many = varying(row.born.treble).pow(3).mul(0.07).add(signals.hit.mul(0.02));
    const glint = step(seed, many).mul(oscSine(time.mul(4).add(seed.mul(40)))).mul(t.mul(0.6).add(0.4));
    return mix(base, contrast(light), glint).mul(glint.mul(1.5).mul(light.oneMinus()).add(1));
  },
};
