// Distant rows fade into a coloured haze and the tallest peaks catch the light, like ranges
// of hills in an old woodblock print. The haze warms when the music is busy.
import { mix, smoothstep } from 'three/tsl';
import { contrast, mixLab, ramp3 } from '../lib/colour.js';

export default {
  name: 'haze',
  colour: ({ t, far, stops, background, light, signals }) => {
    const air = mixLab(mixLab(background, stops[0], 0.35), mixLab(background, stops[2], 0.35), signals.energy.mul(0.6));
    const hazed = mix(ramp3(stops, t), air, far.pow(1.2).mul(0.85));
    // On a dark background the highest peaks are tipped with light, like snow.
    const snow = smoothstep(0.75, 1, t).mul(0.45).mul(light.oneMinus());
    return mix(hazed, contrast(light), snow);
  },
};
