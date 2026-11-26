// The ridge as it has always been: rows straight across, stepping back along z.
import { vec3 } from 'three/tsl';

export default {
  name: 'flat',
  place: ({ along, height, row, WIDTH }) => vec3(along.sub(0.5).mul(WIDTH), height, row.z),
};
