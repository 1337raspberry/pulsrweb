// Every row is born white-hot and cools as it goes back, the tallest peaks and the rows
// born on a beat staying hot the longest, like metal fresh from the forge. Rows flowing
// towards the camera are hottest as they reach it. On a light background the same heat
// is wet ink, drying towards the paper.
import { clamp, exp, float, mix, smoothstep, varying } from 'three/tsl';
import { rampN } from '../lib/colour.js';

export default {
  name: 'embers',
  colour: ({ t, far, near, row, signals, background, light }) => {
    const struck = varying(row.born.beat);
    // Loud stretches cool more slowly, so the hot zone deepens as the music fills out.
    const cooling = float(3.2).sub(signals.energy.mul(1.4));
    // Flat ground keeps a dull glow near the front, so the stack still reads as rows.
    const heat = clamp(
      t.pow(0.8).mul(exp(far.mul(cooling).negate()))
        .add(exp(far.mul(-2.5)).mul(mix(0.16, 0.3, light)))
        .add(struck.mul(0.35).mul(exp(far.mul(-1.5))))
        .add(signals.beat.mul(near.pow(8)).mul(0.25)),
      0,
      1,
    );
    const fire = rampN([background, '#5a0a00', '#b52200', '#ff6a00', '#ffc04a', '#fff3dc'], heat);
    const ink = rampN([background, '#b89a78', '#8a4a26', '#3d1608', '#100402'], heat);
    // The hottest glows past white, for a bloom filter to catch.
    const glow = smoothstep(0.85, 1, heat).mul(0.5).add(1);
    return mix(fire.mul(glow), ink, light);
  },
};
