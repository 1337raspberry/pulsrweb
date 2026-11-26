// The palette all but grey, with one vivid accent kept for the loudest 5% of the picture:
// only the tallest peaks catch fire, and the colour goes back with their rows.
import { max, mix, select, smoothstep } from 'three/tsl';
import { chromaOf, hex, ramp3, withChroma } from '../lib/colour.js';

export default {
  name: 'redline',
  colour: ({ t, height, stops, light, signals }) => {
    const muted = withChroma(ramp3(stops, t), 0.12);
    // The palette's most colourful stop, made a little more so; a palette with none (white
    // lines, black lines) gets a signal red.
    const [a, b, c] = stops.map(chromaOf);
    const vivid = select(a.greaterThan(b).and(a.greaterThan(c)), stops[0], select(b.greaterThan(c), stops[1], stops[2]));
    const red = mix(hex('#ff3b30'), hex('#d0021b'), light);
    const accent = select(max(a, max(b, c)).lessThan(0.07), red, withChroma(vivid, 1.3));
    const burn = smoothstep(signals.hot.sub(0.02), signals.hot.add(0.06), height);
    // On a dark background a beat makes the accent glow.
    const flare = signals.beat.mul(0.4).mul(light.oneMinus()).add(1);
    return mix(muted, accent.mul(flare), burn);
  },
};
