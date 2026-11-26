// The left half of the picture, folded over onto the right.
import { vec2 } from 'three/tsl';
import { groundOf, handOn } from '../lib/filter-ground.js';

export default {
  name: 'mirror',
  build: (context) => {
    const { colour, uv } = context;
    const fold = (at) => vec2(at.x.sub(0.5).abs().oneMinus().sub(0.5), at.y);
    // The backdrop is folded with everything else, and a filter after this one is told so.
    const ground = groundOf(context);
    return handOn(colour.sample(fold(uv)), (at) => ground(fold(at)));
  },
};
