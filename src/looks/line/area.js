// Rows as the series of an area chart: each filled from its line down to its foot in its
// own colour, a little paler towards the foot, under a darker edge.
import { mix } from 'three/tsl';

export default {
  name: 'area',
  build: (c) => {
    const edge = mix(c.tint, c.ink, 0.3);
    const face = mix(c.tint, c.background, mix(0.3, 0.1, c.up));
    return {
      colour: c.faded(edge),
      width: 0.8,
      curtain: { colour: c.faded(face) },
    };
  },
};
