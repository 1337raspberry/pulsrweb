// A dark studio wall hung with strip lights: long thin bars of light in the palette's
// colours, each brightening with its own part of the sound and sliding slowly sideways, so
// anything shiny in front of them has something to catch. The ridge stands in front of the
// lights and hides them. On a light background, bars of ink.
import { abs, exp, float, length, max, mix, sin, smoothstep, vec2, vec3 } from 'three/tsl';
import { centred, createView, dither, lift, signal } from '../lib/backdrop-kit.js';

// Each light: its height on the wall (centred, in screen heights), its length, half its
// thickness, how far and how fast it slides, and which part of the sound drives it.
const LIGHTS = [
  [0.41, 0.9, 0.004, 0.07, 'treble'],
  [0.25, 0.5, 0.006, 0.11, 'mid'],
  [0.08, 1.1, 0.003, 0.05, 'bass'],
  [-0.12, 0.6, 0.006, 0.09, 'treble'],
  [-0.3, 1, 0.004, 0.06, 'mid'],
  [-0.43, 0.7, 0.005, 0.1, 'bass'],
];

export default {
  name: 'studio',
  build: ({ uv, background, stops, light, resolution, time, signals }) => {
    const view = createView();
    const p = centred(uv, resolution).add(view.shift.mul(0.35));
    // The wall: darker than the palette's background, a little lighter in the middle.
    const wall = background.mul(mix(0.6, 0.35, smoothstep(0.1, 0.9, length(p))));
    let colour = mix(wall, background, light);
    LIGHTS.forEach(([height, long, thick, rate, band], i) => {
      const middle = sin(time.mul(rate).add(i * 1.9)).mul(0.6);
      // Distance from the bar: a line with rounded ends.
      const d = length(vec2(max(abs(p.x.sub(middle)).sub(long / 2), 0), p.y.sub(height))).sub(thick);
      const tube = smoothstep(0, 0.0025, d).oneMinus();
      const halo = exp(max(d, 0).mul(-45)).mul(0.16).add(exp(max(d, 0).mul(-10)).mul(0.02));
      const power = signal(signals, band).mul(1.3).add(0.45);
      const tone = mix(stops[i % 3], vec3(1), 0.35);
      colour = lift(colour, tone, tube.mul(1.2).add(halo).mul(power), light);
    });
    return {
      colour: colour.add(dither()),
      // The ridge's curtains are the bare wall, so no light shows through the ridge.
      veil: () => mix(background.mul(0.45), background, light),
      solid: true,
      frame: ({ camera }) => view.update(camera),
    };
  },
};
