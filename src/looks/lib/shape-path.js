// Paths for shapes that lay the ridge along a line through space. A path is worked out
// once, in plain numbers: a closed loop sampled at even steps of its length, with a
// direction across it at every sample. It goes to the GPU as a small float texture that a
// shape reads anywhere along the loop. Each row is laid where the path's head was when the
// row was cut, so the laid rows stay where they are while the head travels on.
import { DataTexture, FloatType, Group, NearestFilter, RGBAFormat } from 'three/webgpu';
import { cross, floor, int, ivec2, max, min, mix, normalize, select, textureLoad, uniform } from 'three/tsl';

// Samples to a row of the texture.
const WIDE = 1024;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crossOf = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => scale(a, 1 / (Math.hypot(...a) || 1));

// A closed loop through `points` (an array of [x, y, z], the last joining back to the
// first), sampled again every `step` world units or a hair less, so that a whole number
// of steps goes round. Gives the samples and the loop's length.
export function evenly(points, step) {
  const n = points.length;
  const lengths = [0];
  for (let i = 0; i < n; i++) lengths.push(lengths[i] + Math.hypot(...sub(points[(i + 1) % n], points[i])));
  const length = lengths[n];
  const count = Math.max(8, Math.round(length / step));
  const samples = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const at = (k / count) * length;
    while (lengths[j + 1] < at) j++;
    const t = (at - lengths[j]) / Math.max(lengths[j + 1] - lengths[j], 1e-9);
    const a = points[j];
    const b = points[(j + 1) % n];
    samples.push(add(a, scale(sub(b, a), t)));
  }
  return { samples, length };
}

// Evenly spaced samples of a closed loop with every corner tighter than about `width`
// world units rounded off: each sample is moved to the weighted average of those within
// twice `width` of it along the loop.
export function smoothed(samples, step, width) {
  const n = samples.length;
  const reach = Math.ceil((2 * width) / step);
  const weights = Array.from({ length: 2 * reach + 1 }, (_, k) => Math.exp(-0.5 * (((k - reach) * step) / width) ** 2));
  const total = weights.reduce((a, b) => a + b, 0);
  return samples.map((_, i) => {
    const sum = [0, 0, 0];
    weights.forEach((w, k) => {
      const p = samples[(i + k - reach + n) % n];
      sum[0] += p[0] * w;
      sum[1] += p[1] * w;
      sum[2] += p[2] * w;
    });
    return scale(sum, 1 / total);
  });
}

// The way ahead at each sample of a closed loop.
const tangents = (samples) => samples.map((p, i) => unit(sub(samples[(i + 1) % samples.length], samples[(i - 1 + samples.length) % samples.length])));

// A direction across a closed loop at each sample that stays level: square to the way ahead
// and to straight up. Right for a path that never heads straight up or down.
export function levelAcross(samples) {
  return tangents(samples).map((t) => unit(crossOf(t, [0, 1, 0])));
}

// A direction across a closed loop at each sample that turns no more than the path makes
// it (carried along the loop without twisting), for a path that may head any way at all.
// Whatever turn is left over when it comes back round is shared out along the loop.
export function carriedAcross(samples) {
  const ahead = tangents(samples);
  const n = samples.length;
  let across = unit(crossOf(ahead[0], Math.abs(ahead[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const out = [across];
  for (let i = 1; i <= n; i++) {
    const t = ahead[i % n];
    across = unit(sub(across, scale(t, dot(across, t))));
    if (i < n) out.push(across);
  }
  // `across` has come back round to the first sample: the angle it is off by, about the
  // way ahead there, is taken out a share at a time.
  const t0 = ahead[0];
  const off = Math.atan2(dot(crossOf(out[0], across), t0), dot(out[0], across));
  return out.map((a, i) => {
    const t = ahead[i];
    const angle = (-off * i) / n;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Turned about the way ahead by `angle`.
    return unit(add(add(scale(a, c), scale(crossOf(t, a), s)), scale(t, dot(t, a) * (1 - c))));
  });
}

// The texture for a sampled loop: two texels for each sample, its place and the direction
// across, in alternate rows of the texture.
function pathTexture(samples, across) {
  const n = samples.length;
  const rows = Math.ceil(n / WIDE);
  const data = new Float32Array(WIDE * rows * 2 * 4);
  samples.forEach((p, i) => {
    const at = ((Math.floor(i / WIDE) * 2) * WIDE + (i % WIDE)) * 4;
    data.set([...p, 1], at);
    data.set([...across[i], 0], at + WIDE * 4);
  });
  const texture = new DataTexture(data, WIDE, rows * 2, RGBAFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// A path for a shape to lay its rows along. `make()` gives `{ samples, length, across }`
// in plain numbers; it runs, and the texture is made, the first time the path is read.
// Gives:
//   at(s): where the path is `s` world units along it (any number, wrapped round the
//     loop), as `{ centre, across, ahead, up }` nodes: up is square to the other two.
//   head: a uniform holding how far along the loop the head is.
//   behind(back): where the path is `back` world units behind the head, in plain numbers.
//   extra(c, stride): for a shape's extras: moves the head on each frame by the rows cut
//     since the last frame, and the change in the share of a row, times `stride` world
//     units a row, so every row stays where it was laid.
export function laidPath(make) {
  let made = null;
  const head = uniform(0);
  const get = () => {
    if (made) return made;
    const { samples, length, across } = make();
    made = { texture: pathTexture(samples, across), samples, count: samples.length, length };
    return made;
  };

  // Where the path is `back` world units behind the head, as plain numbers: for a camera
  // that follows the head.
  function behind(back = 0) {
    const { samples, count, length } = get();
    const t = ((((head.value - back) % length) + length) % length) / (length / count);
    const i = Math.min(Math.floor(t), count - 1);
    const a = samples[i];
    const b = samples[(i + 1) % count];
    return add(a, scale(sub(b, a), t - i));
  }

  function at(s) {
    const { texture, count, length } = get();
    const wrapped = s.sub(floor(s.div(length)).mul(length));
    const t = wrapped.div(length / count);
    const i = min(int(floor(t)), int(count - 1));
    const f = t.sub(floor(t));
    const j = select(i.add(1).greaterThanEqual(int(count)), int(0), i.add(1));
    const texel = (k, part) => textureLoad(texture, ivec2(k.mod(int(WIDE)), k.div(int(WIDE)).mul(int(2)).add(int(part))));
    const a = texel(i, 0).xyz;
    const b = texel(j, 0).xyz;
    const centre = mix(a, b, f);
    const ahead = normalize(b.sub(a));
    const across = normalize(mix(texel(i, 1).xyz, texel(j, 1).xyz, f));
    return { centre, across, ahead, up: normalize(cross(across, ahead)) };
  }

  // The cuts and the share of a row when the head was last moved on. Kept with the path
  // rather than with one extra, so that rebuilding the look does not lose a frame's travel.
  let last = null;
  function extra(c, stride) {
    const frame = () => {
      const cuts = c.ridge.cuts.value;
      const share = c.ridge.phase.value;
      const { length } = get();
      if (last) {
        // The count of cuts wraps round at 2^20.
        let rows = cuts - last.cuts;
        if (rows < 0) rows += 1048576;
        const gone = (rows + share - last.share) * c.u.spacing.value * stride;
        head.value = (((head.value + gone) % length) + length) % length;
      }
      last = { cuts, share };
    };
    return { object: new Group(), frame };
  }

  return { at, head, extra, behind };
}

// Whether `row` is the live row sliding in from in front of the ridge, as it does flowing
// away with the rising setting on.
const sliding = (row, u) => u.flow.lessThan(0.5).and(row.z.greaterThan(1e-3));

// How far back from the head a row lies, in rows: a history row a whole number of rows
// back plus the share of a row since the last cut, the live row at the head itself, or a
// row ahead of it while it slides in.
export const rowsBack = (row, u, phase) => select(sliding(row, u), phase.sub(1), row.depth);

// `row.far`, except that the live row, while it slides in, is a row in front of the
// newest history row rather than on top of it, for a shape laid out by `far`.
export const farLeading = (row, u, phase) => select(sliding(row, u), phase.sub(1).div(max(u.rows.sub(1), 1)), row.far);
