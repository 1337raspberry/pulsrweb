// The history going round a twisted band: every row lies across the band, standing up from
// both its faces, and as the rows go round the band turns over and over, so the face that
// was on top when a row was new is underneath when it is old.
import { DoubleSide, Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { cos, cross, float, positionGeometry, select, sin, vec3 } from 'three/tsl';
import { clockRate, musicClock, squash } from '../lib/shape-kit.js';
import { farLeading } from '../lib/shape-path.js';

// Radius of the loop the band's middle runs round, its height, and the band's width.
const LOOP = 6.5;
const HEIGHT = 3.5;
const BAND = 5;
// The share of the way round the rows go, leaving a gap where the band's two ends, the one
// turned over from the other, nearly meet; and the half turns the band makes on the way.
const COVER = 0.93;
const TWISTS = 3;
// Peaks: their scale and limit.
const SCALE = 0.55;
const CAP = 2.6;

// A point on the band `share` of the way round it from the newest row, `along` across it
// (0 to 1), `height` off it. The whole band turns slowly about the upright with the music.
const onBand = ({ share, along, height, time, signals }) => {
  const turn = musicClock(signals, time).mul(clockRate(0.1));
  const angle = share.mul(COVER * 2 * Math.PI).add(turn).sub(Math.PI / 2);
  const out = vec3(sin(angle), 0, cos(angle));
  const ahead = vec3(cos(angle), 0, sin(angle).negate());
  // The direction across the band turns over, an odd number of half turns on the way round.
  const twist = share.mul(COVER * TWISTS * Math.PI);
  const across = out.mul(cos(twist)).add(vec3(0, 1, 0).mul(sin(twist)));
  const up = cross(across, ahead);
  const middle = out.mul(LOOP).add(vec3(0, HEIGHT, 0));
  return middle.add(across.mul(along.sub(0.5).mul(BAND))).add(up.mul(height));
};

export default {
  name: 'mobius',
  layout: { sleeve: false, tilt: 34, framing: 17, target: [0, HEIGHT, 0], orbit: { azimuth: 'free', polar: [10, 170] } },
  // The ridge twice: the second copy stands on the band's other face.
  copies: 2,
  place: ({ along, height, row, u, phase, copy, time, signals }) => {
    const rise = squash(height.mul(SCALE), CAP);
    return onBand({ share: farLeading(row, u, phase), along, height: select(copy.greaterThan(0.5), rise.negate(), rise), time, signals });
  },
  // The band itself, between the two faces' rows, hiding from each face whatever stands on
  // the other, as the curtains hide the rows behind them.
  extras: ({ ground, time, signals }) => {
    const geometry = new PlaneGeometry(1, 1, 8, 400);
    const material = new MeshBasicNodeMaterial({ side: DoubleSide });
    material.positionNode = onBand({
      share: positionGeometry.y.add(0.5),
      along: positionGeometry.x.add(0.5),
      height: float(0),
      time,
      signals,
    });
    material.colorNode = ground;
    material.polygonOffset = true;
    material.polygonOffsetFactor = 2;
    material.polygonOffsetUnits = 2;
    const band = new Mesh(geometry, material);
    band.frustumCulled = false;
    return [{
      object: band,
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    }];
  },
};
