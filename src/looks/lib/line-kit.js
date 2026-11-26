// Pieces shared by the line styles: sizes in device pixels across and along a stroke,
// seeds that stay with a row, where things land on screen, and blending for light that
// only brightens (or ink that only darkens), so overlapping glows never burn out.
import { CustomBlending, MaxEquation, MinEquation, OneFactor } from 'three/webgpu';
import {
  cameraProjectionMatrix,
  cameraViewMatrix,
  exp,
  float,
  hash,
  int,
  max,
  min,
  mix,
  modelWorldMatrix,
  positionGeometry,
  round,
  select,
  sign,
  smoothstep,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

// CSS pixels to device pixels.
export const px = (c, n) => c.pixelRatio.mul(n);

// Half the line width setting, in device pixels.
export const baseHalf = (c) => c.u.lineWidth.mul(c.pixelRatio).mul(0.5);

// A signal by name, or `fallback` for one the sound's measurements do not provide yet.
export const signal = (c, name, fallback = 0) => c.signals[name] ?? float(fallback);

// A seed that stays with a row from the moment it is the live row until it leaves, and a
// random number from 0 to 1 for a seed and a key. Both stay below 4096 so the sums are
// exact in a float.
export const seedOf = (row) => row.serial.mod(4096);
export const random = (seed, key) => hash(float(seed).mod(4096).mul(4096).add(float(key).mod(4096)));

// A row's level at point `i` (an int node) smoothed with its neighbours': a binomial blur
// three points either side, each `step` points apart.
const BLUR = [1, 6, 15, 20, 15, 6, 1];
export const smoothLevel = (c, i, step = 1, row = c.row) => {
  let sum = float(0);
  BLUR.forEach((weight, j) => {
    const at = min(max(i.add((j - 3) * step), 0), c.points - 1);
    sum = sum.add(row.heightAt(at).mul(weight / 64));
  });
  return sum;
};

// A `lift` that smooths each point's level with its neighbours'. Wide strokes fold over
// themselves at the sharp little corners the grain leaves on a row; smoothed, they drape.
// The curtain follows, so hiding still holds.
export const smoothLift = (c) => (i) => smoothLevel(c, i).sub(c.row.heightAt(i));

// Where a world point lands on screen: in clip space, and in device pixels from the middle.
const toClip = (p) => cameraProjectionMatrix.mul(cameraViewMatrix).mul(modelWorldMatrix).mul(vec4(p, 1));
export const toPixels = (c, p) => {
  const clip = toClip(p);
  return clip.xy.div(max(clip.w, 1e-3)).mul(c.resolution).mul(0.5);
};

// A stroke of constant screen width through `count` world points `at(i)` (`i` an int
// node), `half` device pixels to either side, for a material's `vertexNode` on a strip
// geometry of `count - 1` segments (x from -0.5 to 0.5 along it, y -0.5 or 0.5 across).
// The same as the ridge's own line, for strips that are not rows. Gives the clip-space
// `position` and the point's `index`.
export function strokeThrough(c, at, count, half) {
  const index = int(round(positionGeometry.x.add(0.5).mul(count - 1)));
  const clip = toClip(at(index)).toVar();
  const pixels = (p) => {
    const q = toClip(p);
    return q.xy.div(max(q.w, 1e-3)).mul(c.resolution).mul(0.5);
  };
  const span = pixels(at(min(index.add(1), count - 1))).sub(pixels(at(max(index.sub(1), 0)))).toVar();
  const dir = select(span.length().lessThan(1e-4), vec2(1, 0), span.normalize());
  const offset = vec2(dir.y.negate(), dir.x).mul(sign(positionGeometry.y)).mul(half);
  return { position: vec4(clip.xy.add(offset.mul(2).div(c.resolution).mul(clip.w)), clip.zw), index };
}

// The distance on screen, in device pixels, from one row's base to the next one's at this
// point (vertex stage). A style can keep its width under it, so wide strokes and glows
// never fill the gaps between rows when the rows are packed tight. Measured to the row two
// back, per row of depth between them: just after a cut the live row and the newest
// history row stand in the same place.
export const rowGap = (c) => {
  const along = c.alongAt(c.index);
  const behind = c.rowAt(c.row.k.add(2));
  const here = toPixels(c, c.place(along, float(0), c.row));
  const there = toPixels(c, c.place(along, float(0), behind));
  return here.sub(there).length().div(max(behind.depth.sub(c.row.depth), 1));
};

// Material flags for strokes whose light only brightens on a dark background, or whose
// ink only darkens on a light one: each pixel keeps the brightest (or darkest) colour drawn
// on it, so halos may overlap freely and the order rows are drawn in stops mattering.
// The look is rebuilt when the background flips between light and dark.
export const keepBrightest = (c) => ({
  transparent: true,
  depthWrite: false,
  blending: CustomBlending,
  blendEquation: c.light.value > 0.5 ? MinEquation : MaxEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendEquationAlpha: MaxEquation,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneFactor,
});

// A stroke with a core `core` device pixels to either side of its middle inside a halo
// that falls off over `reach` pixels, kept under a quarter of the gap to the next row. The
// sizes are vertex-stage nodes. Gives the `width` to hand back as the style's width, and
// for the fragment: `d`, this pixel's distance from the middle, the core's edge and the
// halo's reach, all in device pixels, and `strength`, which drops as the gap squeezes the
// halo, so tightly packed rows keep dark gaps between them.
export function halo(c, { core, reach }) {
  const radius = max(min(reach, rowGap(c).mul(0.25)), px(c, 0.5));
  const half = core.add(radius.mul(2.3));
  const quad = varying(half);
  return {
    width: half.div(baseHalf(c)),
    half: quad,
    d: c.across.abs().mul(quad),
    core: varying(core),
    reach: varying(radius),
    strength: varying(radius.div(max(reach, 1e-3)).pow(1.5)),
  };
}

// How strongly a pixel belongs to a soft-edged core of `edge` pixels, and to its halo.
export const coreAt = (d, edge) => smoothstep(edge.sub(0.6), edge.add(0.6), d).oneMinus();
export const haloAt = (d, reach) => exp(d.div(reach).pow(2).negate());

// The colour of a glowing stroke in `tint`: on a dark background a core brighter than white
// (a bloom filter takes it up) in a halo that fades to the ground; on a light one a darker
// core of ink in a soft bleed. `core` and `glow` are strengths, 0 to 1.
export function glowColour(c, tint, core, glow, heat = 1.6) {
  const hot = mix(mix(tint, vec3(1), 0.5).mul(heat), mix(tint, vec3(0), 0.35), c.light);
  return mix(mix(c.ground, tint, glow), hot, core);
}
