// Every kick sends a ping of light racing back through the landscape, faster than the rows
// move: a bright front with a fading wake behind it, catching the peaks as it passes, like a
// sonar sweep over terrain.
import { clamp, exp, max, min, mix, select } from 'three/tsl';
import { contrast, ramp3 } from '../lib/colour.js';

export default {
  name: 'sonar',
  colour: ({ t, far, stops, background, light, signals }) => {
    const hue = ramp3(stops, t);
    const base = mix(mix(background, hue, mix(0.55, 0.85, light)), hue, t);
    // Each of the last four beats is a front at its own distance out from the camera's end
    // of the ridge, crossing the stack in about a second (sooner when the music is busy)
    // and fading as it goes. Ahead of the front is dark; behind it a short wake.
    const speed = signals.energy.mul(0.5).add(0.8);
    const ping = (since) => {
      const ahead = far.sub(since.mul(speed));
      const shape = select(ahead.greaterThan(0), exp(ahead.div(0.02).pow2().negate()), exp(ahead.div(0.14)));
      return shape.mul(exp(since.mul(-1.1)));
    };
    const { pings } = signals;
    const glow = min(ping(pings.x).add(ping(pings.y)).add(ping(pings.z)).add(ping(pings.w)), 1.5);
    const lit = clamp(glow.mul(t.mul(0.4).add(0.6)), 0, 1);
    // On a dark background the front glows past white, for a bloom filter to catch.
    return mix(base, contrast(light), lit).mul(max(glow.sub(0.6), 0).mul(light.oneMinus()).add(1));
  },
};
