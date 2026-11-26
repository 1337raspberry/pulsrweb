// Small pieces the backdrops share: hashes that hold up for any input, soft lines, light
// that turns to ink on a light background, where the scene's camera is looking, the floor
// and the ridge as a pixel sees them, and parts of a picture drawn at a lower resolution.
import { Vector2, Vector3 } from 'three/webgpu';
import { abs, clamp, dot, exp, float, floor, fract, fwidth, int, length, mix, pow, rtt, screenCoordinate, sin, smoothstep, step, uniform, vec2, vec3 } from 'three/tsl';
import { rayThrough } from './camera.js';

// A number from 0 to 1 that looks random, for a vec2. No sine, so it is the same on every
// GPU and holds for negative and large inputs (after Dave Hoskins' "hash without sine").
export const hash21 = (p) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(0.1031));
  const r = q.add(dot(q, q.yzx.add(33.33)));
  return fract(r.x.add(r.y).mul(r.z));
};

// Two such numbers for a vec2.
export const hash22 = (p) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(vec3(0.1031, 0.103, 0.0973)));
  const r = q.add(dot(q, q.yzx.add(33.33)));
  return fract(r.xx.add(r.yz).mul(r.zy));
};

// One for a float.
export const hash11 = (x) => {
  const q = fract(float(x).mul(0.1031));
  const r = q.mul(q.add(33.33));
  return fract(r.mul(r.add(r)));
};

// 1 on whole-number values of `v`, falling to 0 within `width` pixels either side. Where
// the lines crowd closer than a few pixels apart they fade to their average, so a grid
// running off into the distance turns to an even haze instead of shimmering.
export const gridLine = (v, width = 1) => {
  const step = fwidth(v).max(1e-5);
  const line = smoothstep(0, float(width), abs(fract(v.sub(0.5)).sub(0.5)).div(step)).oneMinus();
  return mix(line, step.mul(width).min(1), smoothstep(0.12, 0.4, step));
};

// `base` with `amount` of `colour` added as light on a dark background, or stained towards
// a darker `colour` like ink on a light one. `light` is the shared uniform, 1 on a light
// background, so the same picture suits either without being rebuilt.
export const lift = (base, colour, amount, light) => mix(
  base.add(colour.mul(amount)),
  base.mul(mix(vec3(1), colour.mul(0.45), clamp(amount, 0, 1))),
  light,
);

// A little noise, about one step of an 8-bit screen, that keeps smooth gradients from
// showing bands.
export const dither = () => hash21(screenCoordinate.xy).sub(0.5).div(255);

// The screen point `uv` (0 to 1 from the bottom left) in units of the screen's height,
// with the origin in the middle: y runs from -0.5 to 0.5, x as far as the screen is wide.
export const centred = (uv, resolution) => vec2(uv.x.sub(0.5).mul(resolution.x.div(resolution.y)), uv.y.sub(0.5));

// Back from a centred point to the screen's 0 to 1.
export const uncentred = (p, resolution) => vec2(p.x.div(resolution.x.div(resolution.y)).add(0.5), p.y.add(0.5));

// Stars at the centred point `p`: in each cell of a grid `cells` to the screen's height,
// `share` of the cells hold one star, somewhere in the middle of the cell, round and about
// `size` pixels across whatever the cell size, most of them faint and a few bright. With
// `time`, each twinkles by up to `twinkle` at a pace of its own. Returns the light at `p`.
export const stars = (p, { cells, share = 0.3, seed = 0, resolution, size = 1, time = null, twinkle = 0 }) => {
  const g = p.mul(cells).add(seed * 37.7);
  const id = floor(g);
  const pick = hash21(id);
  const at = hash22(id.add(19.19)).mul(0.6).add(0.2);
  const pixels = length(fract(g).sub(at)).mul(resolution.y.div(cells));
  const bright = pow(hash21(id.add(7.7)), 4).mul(0.85).add(0.15);
  const radius = bright.mul(1.1).add(0.55).mul(size);
  let light = exp(pixels.div(radius).pow(2).negate()).mul(bright).mul(step(pick, share));
  if (time) light = light.mul(sin(time.mul(mix(1.5, 5, pick)).add(pick.mul(91))).mul(twinkle).add(1));
  return light;
};

// A signal by name, or `fallback` if the sound analysis does not provide it.
export const signal = (signals, name, fallback = 0) => signals?.[name] ?? float(fallback);

// Follows `target` from `current`, with a time constant of `tau` seconds, over `dt`.
export const follow = (current, target, dt, tau) => current + (target - current) * (1 - Math.exp(-dt / Math.max(tau, 1e-3)));

// Where the scene's camera is looking, as uniforms a picture can follow, updated from a
// backdrop's `frame`. `horizon` is the height on screen (0 bottom, 1 top) of the level
// horizon, which may be off the screen; `azimuth` the heading (0 straight at the ridge) and
// `pitch` how far it looks down, in radians; `zoom` how many screen heights one radian
// spans. `shift` (centred units) is how far a picture infinitely far away has moved on
// the screen as the camera turned: added to a centred point, it keeps that picture still
// in the world. It is gathered turn by turn at the lens of the moment, so a change of lens
// alone moves nothing, and not at all through a lens as long as the cover's, where the
// smallest turn would sweep the picture across many screens.
export function createView() {
  const view = { horizon: uniform(0.6), azimuth: uniform(0), pitch: uniform(0), zoom: uniform(1), shift: uniform(new Vector2()) };
  const dir = new Vector3();
  let last = null;
  view.update = (camera) => {
    camera.getWorldDirection(dir);
    const down = Math.asin(Math.min(Math.max(-dir.y, -1), 1));
    const heading = Math.atan2(dir.x, -dir.z);
    const half = Math.max((camera.fov * Math.PI) / 360, 1e-3);
    const zoom = 1 / (2 * Math.tan(half));
    view.horizon.value = Math.min(Math.max(0.5 + (0.5 * Math.tan(down)) / Math.tan(half), -10), 10);
    view.azimuth.value = heading;
    view.pitch.value = down;
    view.zoom.value = zoom;
    if (last && camera.fov >= 10) {
      const turned = Math.atan2(Math.sin(heading - last.heading), Math.cos(heading - last.heading));
      view.shift.value.x += turned * zoom;
      view.shift.value.y -= (down - last.down) * zoom;
    }
    last = { heading, down };
  };
  return view;
}

// Where the view ray through `uv` meets the level floor at height `y0`: the world `point`,
// its `distance` along the ray, the `ray` itself, and `down`, whether the ray falls at all.
export const floorHit = (uv, camera, y0 = 0) => {
  const ray = rayThrough(uv, camera);
  const distance = camera.position.y.sub(y0).div(ray.y.negate().max(1e-4));
  return { ray, distance, point: camera.position.add(ray.mul(distance)), down: ray.y.lessThan(0) };
};

// Which point along the ridge (0 bass to 1 treble) stands in line with the screen point
// `uv`, measured where its view ray crosses the upright plane through row `k` (an int node).
export const alongUnder = (uv, camera, ridge, k) => {
  const ray = rayThrough(uv, camera);
  const z = ridge.rowAt(k).z;
  const reach = z.sub(camera.position.z).div(ray.z.min(-1e-4));
  return camera.position.x.add(ray.x.mul(reach)).div(ridge.WIDTH).add(0.5);
};

// The live row's level at `along`, averaged over the newest `rows` rows so it breathes
// rather than flickers. 0 outside the row.
export const recentLevel = (ridge, along, rows = 3) => {
  let sum = float(0);
  for (let back = 0; back < rows; back++) sum = sum.add(ridge.levelAt(along, int(back)));
  const inside = along.greaterThanEqual(0).and(along.lessThanEqual(1));
  return inside.select(sum.div(rows), float(0));
};

// `node` drawn into a texture of its own at `scale` of the screen's resolution and read
// back, smoothly filtered, at `uv`: for soft parts of a picture that need not be worked
// out at every pixel. Inside, `uv` means the same as outside.
export const atScale = (node, uv, scale) => rtt(node, null, null, { resolutionScale: scale }).sample(uv);

// Frees the textures behind `reads` (nodes from `atScale`, or reads of an `rtt` of one's
// own), for a backdrop's `dispose`: each is a render target the size of the screen.
export const release = (...reads) => {
  for (const read of reads) read?.getBase?.().dispose?.();
};
