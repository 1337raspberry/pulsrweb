// Every kick fires a flashbulb: the ridge bleaches for an instant, peaks most, and the row
// born on the beat keeps the flash as a bright rule that marches back through the stack.
import { max, mix, smoothstep, varying } from 'three/tsl';
import { contrast, ramp3 } from '../lib/colour.js';

export default {
  name: 'flashbulb',
  colour: ({ t, row, stops, background, light, signals }) => {
    const hue = ramp3(stops, t);
    const base = mix(mix(background, hue, mix(0.55, 0.85, light)), hue, t);
    const flash = signals.beat.mul(0.35).mul(t.sqrt());
    const stamped = smoothstep(0.45, 0.8, varying(row.born.beat));
    // A stamped row glows past white on a dark background, for a bloom filter to catch.
    return mix(base, contrast(light), max(flash, stamped.mul(0.9))).mul(stamped.mul(0.5).mul(light.oneMinus()).add(1));
  },
};
