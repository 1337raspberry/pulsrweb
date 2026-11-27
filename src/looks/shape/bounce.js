// The whole ridge as one small slab adrift on the screen, in the manner of an old screen
// saver: it rocks from side to side as it goes, bounces off the edges of the picture, and
// each bounce passes the palette's colours one place along. It drifts faster as the music
// fills out, swells a little on the beat, and spins right round on a drop.
import { Euler, Matrix3, Matrix4, Vector3 } from 'three/webgpu';
import { uniform, vec3 } from 'three/tsl';

// The slab's size in world units, whatever the number of rows: across, and front to back.
const WIDE = 12;
const DEEP = 9;
// How much of a peak's height is kept.
const PEAKS = 0.8;
// Half the room the slab is given on the screen, across and up, when working out a bounce.
const HALF = [7.2, 4.6];
// How far the far end is tipped up towards the eye, in radians, so the rows show from above.
const TIP = 0.72;
// World units a second it drifts, and how fast it rocks, in silence and with the music at
// its fullest.
const DRIFT = [1.1, 4.2];
const ROCK = [0.3, 0.9];
// How far it rocks to either side and rolls, in radians, and how long a full spin takes.
const SWAY = 0.55;
const ROLL = 0.12;
const SPIN = 1.4;

// Where the slab's middle is in the world, and which way it is turned.
const adrift = uniform(new Vector3());
const turned = uniform(new Matrix3());

const heading = Math.random() * Math.PI * 2;
const way = { x: Math.cos(heading), y: Math.sin(heading) * 0.8 };
const at = { x: 0, y: 0 };
const right = new Vector3();
const up = new Vector3();
const gaze = new Vector3();
const turning = new Matrix4();
const pose = new Euler(0, 0, 0, 'YXZ');
let rocked = 0;
// Seconds of a spin still to go, and whether the drop that set it off is still sounding.
let spinning = 0;
let dropped = false;
// How many places along the colours have been passed.
let passed = 0;

export default {
  name: 'bounce',
  layout: { sleeve: false, tilt: 0, framing: 20, target: [0, 0, 0], orbit: { azimuth: [-50, 50], polar: [60, 110] } },
  place: ({ along, height, row, signals }) => {
    const swell = signals.beat.mul(0.06).add(1);
    const local = vec3(along.sub(0.5).mul(WIDE), height.mul(PEAKS), row.far.oneMinus().sub(0.5).mul(DEEP)).mul(swell);
    return turned.mul(local).add(adrift);
  },
  frame({ dt, shared, camera, gradient, setColours }) {
    const s = shared.signals;
    const full = s.energy.value * (1 - s.silence.value);
    // The edges of the picture where the slab is: it drifts in the plane that faces the eye.
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    camera.getWorldDirection(gaze);
    const away = Math.max(-camera.position.dot(gaze), 1);
    const tall = away * Math.tan((camera.fov * Math.PI) / 360);
    const reach = { x: Math.max(tall * camera.aspect - HALF[0], 0.2), y: Math.max(tall - HALF[1], 0.2) };
    const drift = DRIFT[0] + (DRIFT[1] - DRIFT[0]) * full;
    let bounced = false;
    for (const axis of ['x', 'y']) {
      at[axis] += way[axis] * drift * dt;
      if (Math.abs(at[axis]) > reach[axis]) {
        at[axis] = Math.sign(at[axis]) * reach[axis];
        way[axis] = -Math.sign(at[axis]) * Math.abs(way[axis]);
        bounced = true;
      }
    }
    adrift.value.copy(right).multiplyScalar(at.x).addScaledVector(up, at.y);
    if (bounced) {
      passed += 1;
      const stops = gradient.stops;
      setColours({ stops: stops.map((_, i) => stops[(i + passed) % stops.length]) });
    }

    rocked += dt * (ROCK[0] + (ROCK[1] - ROCK[0]) * full);
    if (s.drop.value > 0.8 && !dropped && spinning === 0 && shared.still.value < 0.5) spinning = SPIN;
    dropped = s.drop.value > 0.8;
    spinning = Math.max(spinning - dt, 0);
    // The spin eases in and out of one whole turn.
    const done = 1 - spinning / SPIN;
    const spun = spinning > 0 ? done * done * (3 - 2 * done) * Math.PI * 2 : 0;
    pose.set(TIP + Math.sin(rocked * 0.73 + 1) * 0.12, Math.sin(rocked) * SWAY + spun, Math.sin(rocked * 0.57 + 2) * ROLL);
    turned.value.setFromMatrix4(turning.makeRotationFromEuler(pose));
  },
};
