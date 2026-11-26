// Green-to-violet light shimmering over the ridge, as if it caught the northern lights:
// slow folds of colour drift across it, and bright rays flicker with the treble.
import { clamp, mix, mx_noise_float, smoothstep, vec2 } from 'three/tsl';
import { rampN } from '../lib/colour.js';

export default {
  name: 'borealis',
  colour: ({ along, t, age, signals, background, light }) => {
    const drift = signals.clock.mul(0.12);
    const folds = mx_noise_float(vec2(along.mul(7), age.mul(3).add(drift))).mul(0.5).add(0.5);
    const rays = smoothstep(0.5, 1, mx_noise_float(vec2(along.mul(45), drift.mul(5)))).mul(signals.treble.mul(0.7).add(0.3));
    const hue = rampN(['#1de9b6', '#64ff8a', '#9b5cff', '#ff4fd8'], clamp(t.mul(0.75).add(folds.mul(0.35)), 0, 1));
    const lit = clamp(t.pow(0.6).mul(0.7).add(rays.mul(0.5)).add(0.18).mul(signals.level.mul(0.4).add(0.7)), 0, 1);
    // On a light background the same colours, darkened to read on paper.
    return mix(mix(background, hue, lit), mix(hue.mul(0.55), hue.mul(0.35), t), light);
  },
};
