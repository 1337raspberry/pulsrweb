// The ridge at the edge of still water: a second copy hangs upside down beneath it,
// dimmed by the water and stirred by a slow ripple that grows towards the back.
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { float, select, sin, vec3 } from 'three/tsl';

// How much of the reflection the water lets through.
const CLEAR = 0.5;

export default {
  name: 'puddle',
  copies: 2,
  layout: { sleeve: false, tilt: 6, framing: 15, target: [0, 0.6, -5], orbit: { azimuth: [-50, 50], polar: [65, 89] } },
  place: ({ along, height, row, copy, time, WIDTH }) => {
    const x = along.sub(0.5).mul(WIDTH);
    const ripple = sin(row.z.mul(2.7).add(time.mul(1.6))).mul(0.06).mul(row.far.add(0.4));
    const mirrored = vec3(x.add(ripple), height.mul(-0.9).sub(0.04), row.z);
    return select(copy.greaterThan(0.5), mirrored, vec3(x, height, row.z));
  },
  // The water's surface: a sheet of the colour of empty space, half see-through, lying
  // just under the rows' feet, so it veils the reflection and nothing above it.
  extras: ({ ground }) => {
    const sheet = new PlaneGeometry(400, 400);
    sheet.rotateX(-Math.PI / 2);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    material.colorNode = ground;
    material.opacityNode = float(1 - CLEAR);
    const water = new Mesh(sheet, material);
    water.position.set(0, -0.02, -20);
    water.frustumCulled = false;
    return [{
      object: water,
      dispose() {
        sheet.dispose();
        material.dispose();
      },
    }];
  },
};
