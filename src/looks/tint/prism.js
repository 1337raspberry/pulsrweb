// Colour by pitch: the bass at one end of the palette and the treble at the other, over the
// music's own span of the row, lit by height so the busy frequencies glow and quiet ground
// sinks back towards the background.
import { clamp, float, mix } from 'three/tsl';
import { ramp3 } from '../lib/colour.js';

export default {
  name: 'prism',
  colour: ({ along, t, u, stops, background, light }) => {
    // The ridge spreads the bands over the middle `span` of a row and bends them by
    // `axisCurve`; undoing both gives the point's place in the spectrum, 0 to 1.
    const within = clamp(along.sub(u.span.oneMinus().mul(0.5)).div(u.span), 0, 1);
    const pitch = within.pow(float(1).div(u.axisCurve));
    const hue = ramp3(stops, pitch);
    // Low ground sinks towards the background, less so on a light one, where pale lines vanish.
    return mix(mix(background, hue, mix(0.4, 0.8, light)), hue, t.pow(0.6));
  },
};
