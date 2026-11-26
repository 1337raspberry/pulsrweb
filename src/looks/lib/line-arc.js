// Distance along each row, for line styles that space marks out evenly (dots, bulbs,
// twists, stitches). Measured on the CPU from the levels the ridge draws, so marks keep
// their spacing up the steep sides of a peak instead of thinning out there.
import { DataTexture, FloatType, Group, NearestFilter, RedFormat } from 'three/webgpu';
import { ivec2, max, min, textureLoad, uniform } from 'three/tsl';
import { toPixels } from './line-kit.js';

// As the ridge draws its rows: the world height of a level of 1 per unit of the height
// setting, and how far towards the camera a row flowing towards it reaches full height.
const HEIGHT = 10;
const LIVE_FULL = 0.7;

const ease = (from, to, x) => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

// The distance in world units from each row's bass end to each of its points, as a
// texture laid out like the ridge's levels. Gives `at(index, row)`, the distance to point
// `index` (an int node) of `row` (vertex stage), and an extra to hand back among the
// style's extras, which keeps the distances up to date every frame.
export function rowLengths(c) {
  const { ridge } = c;
  const points = ridge.points;
  const rows = ridge.capacity + 1;
  const data = new Float32Array(points * rows);
  const texture = new DataTexture(data, points, rows, RedFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  const walls = new Float32Array(points);
  const step = c.WIDTH / (points - 1);

  function update() {
    const levels = ridge.texture.image.data;
    const { u, capacity } = ridge;
    const away = u.flow.value < 0.5;
    const shown = Math.round(u.rows.value);
    const trench = u.trench.value;
    // A trench flattens the middle of every row, as the ridge's shader does.
    for (let i = 0; i < points; i++) {
      const across = Math.abs(i / (points - 1) - 0.5) * 2;
      walls[i] = trench > 0 ? ease(trench * 0.3, trench, across) : 1;
    }
    for (let r = 0; r < rows; r++) {
      // The row this texture row is drawn as: 0 the live row, then newest to oldest.
      const k = r === 0 ? 0 : ((ridge.newest.value - (r - 1) + capacity) % capacity) + 1;
      if (k >= shown) continue;
      const depth = k === 0 ? 0 : k - 1 + ridge.phase.value;
      const age = Math.min(Math.max(depth / Math.max(u.rows.value - 1, 1), 0), 1);
      const far = away ? age : 1 - age;
      const rise = u.peak.value * HEIGHT * ((u.depthScale.value - 1) * far + 1);
      // Flowing towards the camera, every row shows the live levels, flat far off.
      const from = (away ? r : 0) * points;
      const scale = away ? rise : rise * ease(0, LIVE_FULL, 1 - far);
      let s = 0;
      let before = levels[from] * walls[0] * scale;
      data[r * points] = 0;
      for (let i = 1; i < points; i++) {
        const h = levels[from + i] * walls[i] * scale;
        const dh = h - before;
        s += Math.sqrt(step * step + dh * dh);
        data[r * points + i] = s;
        before = h;
      }
    }
    texture.needsUpdate = true;
  }
  update();

  const at = (index, row = c.row) => textureLoad(texture, ivec2(index, row.textureRow)).x;
  return {
    at,
    // Device pixels on screen per world unit along the row, at this vertex: from its
    // neighbours, so it stays steady where a sharp corner folds the stroke over itself.
    onScreen: () => {
      const before = max(c.index.sub(1), 0);
      const after = min(c.index.add(1), c.points - 1);
      const point = (i) => c.place(c.alongAt(i), c.row.heightAt(i).mul(c.row.rise));
      const pixels = toPixels(c, point(after)).sub(toPixels(c, point(before))).length();
      return pixels.div(max(at(after).sub(at(before)), 1e-5));
    },
    extra: { object: new Group(), frame: update, dispose: () => texture.dispose() },
  };
}

// A spacing in world units that puts marks about `lines` line widths apart in the middle
// of the ridge as the camera sees it, kept to whole octaves so it only changes when the
// view zooms a long way: rows keep their marks still as they recede and the camera drifts.
// Gives the spacing as a uniform, and an extra that keeps it up to date.
export function steadySpacing(c, lines, least = 0.02) {
  const spacing = uniform(0.1);
  let octave = null;
  const extra = {
    object: new Group(),
    frame: ({ camera }) => {
      const { u } = c.ridge;
      const middle = { x: 0, y: 0, z: -((u.rows.value - 1) * u.spacing.value) / 2 };
      const distance = Math.hypot(camera.position.x - middle.x, camera.position.y - middle.y, camera.position.z - middle.z);
      // CSS pixels per world unit at the middle of the ridge.
      const scale = c.resolution.value.y / c.pixelRatio.value / (2 * distance * Math.tan((camera.fov * Math.PI) / 360));
      const ideal = Math.log2(Math.max((lines * u.lineWidth.value) / scale, least));
      // A little hysteresis, so a view poised between two octaves does not flicker.
      if (octave === null || Math.abs(ideal - octave) > 0.75) octave = Math.round(ideal);
      spacing.value = 2 ** octave;
    },
  };
  return { spacing, extra };
}
