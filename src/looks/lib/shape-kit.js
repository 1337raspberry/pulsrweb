// Small pieces the shapes share: soft limits on height, the ridge's reach, signals that
// may not exist yet, and invisible cores that hide the far side of a closed shape.
import { DoubleSide, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { exp, float, max, min, select } from 'three/tsl';

// How far in front of the scene's origin rows run when they flow towards the camera
// (the ridge's own LEAD).
export const LEAD = 6.4;
// For this share of a row's time after a cut, the ridge hides its newest history row,
// unless the live row slides in (the ridge's own EMERGE).
export const EMERGE = 0.1;

// About `h` while small, never more than `cap`: keeps tall peaks from crossing the middle
// of a tunnel or a curl. A negative `h` (a curtain's foot below the base) passes through
// unchanged.
export const squash = (h, cap) => float(cap).mul(exp(max(h, 0).div(cap).negate()).oneMinus()).add(min(h, 0));

// The world depth from the ridge's nearest row to its furthest.
export const reach = (u) => u.rows.sub(1).max(1).mul(u.spacing);

// The flat layout's z at the camera's end of the ridge: 0 flowing away, LEAD flowing towards.
export const nearZ = (u) => select(u.flow.lessThan(0.5), float(0), float(LEAD));

// A signal by name, or `fallback` while the sound analysis does not provide it.
export const signal = (signals, name, fallback = 0) => signals?.[name] ?? float(fallback);

// Seconds that follow the music where the analysis provides them, plain seconds otherwise.
export const musicClock = (signals, time) => signals?.clock ?? time;

// The music clock starts again from 0 after this many seconds.
const CLOCK_WRAP = 3600;
// A turning speed near `radiansPerSecond` that makes a whole number of turns while the
// music clock runs through its span, so anything turned by the clock does not jump when
// the clock starts again.
export const clockRate = (radiansPerSecond) => {
  const turns = Math.max(1, Math.round((radiansPerSecond * CLOCK_WRAP) / (2 * Math.PI)));
  return (2 * Math.PI * turns) / CLOCK_WRAP;
};

// A solid in the colour of empty space: it shows nothing of its own but hides whatever is
// behind it, as the curtains do. Pushed back in depth so lines lying on it always win.
export function occluder(geometry, ground) {
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  material.colorNode = ground;
  material.polygonOffset = true;
  material.polygonOffsetFactor = 2;
  material.polygonOffsetUnits = 2;
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    object: mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
