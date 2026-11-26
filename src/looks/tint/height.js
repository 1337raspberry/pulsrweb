// Colour by height: up through the palette's three stops, in two halves.
import { mix, select } from 'three/tsl';

export default {
  name: 'height',
  colour: ({ t, stops }) => {
    const low = mix(stops[0], stops[1], t.mul(2));
    const high = mix(stops[1], stops[2], t.mul(2).sub(1));
    return select(t.lessThan(0.5), low, high);
  },
};
