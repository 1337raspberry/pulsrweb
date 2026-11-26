// Teletext's own colours by height, whatever the palette: cyan along the low ground of each
// row, yellow up its slopes and red on the peaks, in hard bands with nothing between.
import { select, vec3 } from 'three/tsl';

// How far through the gradient's range a point must stand to be on the slopes, and on the peaks.
const SLOPES = 0.3;
const PEAKS = 0.7;

export default {
  name: 'teletext',
  colour: ({ t }) => select(t.lessThan(SLOPES), vec3(0, 1, 1), select(t.lessThan(PEAKS), vec3(1, 1, 0), vec3(1, 0, 0))),
};
