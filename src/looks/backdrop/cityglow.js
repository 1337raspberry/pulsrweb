// A city at night far out of focus behind the ridge: big soft discs of street and window
// light gathered along the streets, each breathing with its part of the spectrum, bass to
// the left and treble to the right. By day, soft shapes of trees and buildings.
import { mix, smoothstep } from 'three/tsl';
import { atScale, centred, createView, dither, release } from '../lib/backdrop-kit.js';
import { cityView } from '../lib/bokeh.js';

export default {
  name: 'cityglow',
  build: ({ uv, background, stops, light, resolution, ridge }) => {
    const view = createView();
    // Far away, so it slides only a little as the camera turns.
    const p = centred(uv, resolution).add(view.shift.mul(0.25));
    const city = atScale(cityView(p, { ridge, resolution, background, stops, light }), uv, 0.4);
    // A little darker towards the corners, as through a lens.
    const corners = smoothstep(0.5, 1.1, centred(uv, resolution).length()).mul(mix(0.35, 0.08, light)).oneMinus();
    return {
      colour: city.mul(corners).add(dither()),
      frame: ({ camera }) => view.update(camera),
      dispose: () => release(city),
    };
  },
};
