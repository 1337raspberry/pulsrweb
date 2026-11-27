// A spiky log lying in the scene: every row is a ring round its axis with the peaks
// pointing out, the newest ring at the near end and the history running back along it,
// the whole log turning slowly on its axis with the music.
import { CylinderGeometry, Vector3 } from 'three/webgpu';
import { clamp, cos, float, sin, TWO_PI, vec3 } from 'three/tsl';
import { clockRate, musicClock, occluder, reach, squash } from '../lib/shape-kit.js';
import { farLeading } from '../lib/shape-path.js';

const RADIUS = 3;
// Peaks are kept to about this length.
const CAP = 2.6;
// The log's middle, and how far its axis is turned about the vertical from running
// straight into the scene, so that its length shows from the front.
const MIDDLE = [0, 3.2, -6];
const YAW = 0.7;
// The log's length is this share of the flat ridge's depth, within these bounds.
const SHARE = 0.6;
const SHORTEST = 7;
const LONGEST = 15;
// How far round, in radians, the oldest ring has turned beyond the newest, so that
// a sound held for a while draws a spiral round the log.
const TWIST = 0.9;
// Rings reach this far into the core, so no gap opens between a ring and the core.
const SINK = 0.3;

// The axis runs from the near end back into the scene, and two directions square to it
// make each ring.
const AXIS = [-Math.sin(YAW), 0, -Math.cos(YAW)];
const ACROSS = [Math.cos(YAW), 0, -Math.sin(YAW)];
const lengthOf = (rows, spacing) => Math.min(LONGEST, Math.max(SHORTEST, Math.max(rows - 1, 1) * spacing * SHARE));

export default {
  name: 'barrel',
  // The front view looks a little below the log's middle, since its near end, being
  // nearer, looms larger.
  layout: { sleeve: false, tilt: 24, framing: 15, target: [0.4, 2.3, -5.6], orbit: { azimuth: 'free', polar: [15, 120] } },
  floor: -SINK,
  // Each ring reads the spectrum up one side and back down the other, so the log is the
  // same on both its flanks and the two ends of a ring meet in the bass.
  fold: (along) => along.mul(2).sub(1).abs().oneMinus(),
  place: ({ along, height, row, u, phase, time, signals }) => {
    const length = clamp(reach(u).mul(SHARE), SHORTEST, LONGEST);
    // The newest ring at the near end, older ones further along the axis.
    const far = farLeading(row, u, phase);
    const s = far.sub(0.5).mul(length);
    const centre = vec3(...MIDDLE).add(vec3(...AXIS).mul(s));
    const turn = along.mul(TWO_PI).add(musicClock(signals, time).mul(clockRate(0.2))).add(far.mul(TWIST));
    const out = vec3(0, 1, 0).mul(cos(turn)).add(vec3(...ACROSS).mul(sin(turn)));
    return centre.add(out.mul(float(RADIUS).add(squash(height, CAP))));
  },
  // The core, in the colour of empty space, hides the far side of every ring. It runs from
  // just behind the newest ring to past the oldest, whatever the log's length.
  extras: ({ ground, u }) => {
    const core = occluder(new CylinderGeometry(RADIUS - 0.03, RADIUS - 0.03, 1, 128, 1), ground);
    core.object.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...AXIS));
    const fit = () => {
      const length = lengthOf(u.rows.value, u.spacing.value);
      const from = 0.02 - length / 2;
      const to = length / 2 + 0.5;
      core.object.scale.set(1, to - from, 1);
      const mid = (from + to) / 2;
      core.object.position.set(...MIDDLE.map((n, i) => n + AXIS[i] * mid));
    };
    fit();
    return [{ ...core, frame: fit }];
  },
};
