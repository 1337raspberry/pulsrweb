// A gorge between two walls of sound: each row is folded into a U, bass at the foot of both
// walls and treble at their rims, with the peaks reaching across the gap.
import { float, select, vec3 } from 'three/tsl';
import { squash } from '../lib/shape-kit.js';

// Half the width of the gorge, and the height of its walls.
const GAP = 5;
const WALL = 9;

export default {
  name: 'canyon',
  layout: { sleeve: false, tilt: 6, framing: 9, target: [0, 3.5, -8], orbit: { azimuth: [-20, 20], polar: [60, 95] } },
  // Both walls read the spectrum from the floor up: bass low, treble high.
  fold: (along) => along.mul(2).sub(1).abs(),
  place: ({ along, height, row }) => {
    // Where `side` flips, between two neighbouring points, the row crosses the floor.
    const side = select(along.lessThan(0.5), float(-1), float(1));
    const up = along.mul(2).sub(1).abs().mul(WALL);
    // The walls close in a little on a row cut with a kick drum, and stay so as it goes.
    const gap = float(GAP).mul(float(1).sub(row.born.beat.mul(0.12)));
    return vec3(side.mul(gap.sub(squash(height, GAP * 0.9))), up, row.z);
  },
};
