// The picture reduced to a grid of cells, one texel per cell, each holding the cell's most
// prominent colour (rgb) and how far it stands out from the background (a). Thin lines are
// a pixel or two wide, so sampling one point per cell would lose most of them; keeping the
// strongest of many taps keeps every line that crosses the cell.
import { HalfFloatType, Vector2 } from 'three/webgpu';
import { Fn, Loop, float, floor, int, ivec2, rtt, uniform, uv, vec2, vec4 } from 'three/tsl';
import { standoutOf } from './filter-kit.js';

// `colour` is the picture (a texture node), `cellPx` the cell size in CSS pixels as [x, y].
// The taps are spread over the cell with bilinear reads at pixel corners, so at a pixel
// ratio of 2 each tap averages a 2 by 2 block and the whole cell is still covered. With
// `mean`, a cell's alpha is instead the average standing out over the cell: how much of
// it is inked, rather than how strongly its strongest line is drawn. With `ground` (what is
// behind the ridge at a screen point, as `groundOf` gives it), a tap stands out by how far
// it is from that rather than from the background, so a backdrop reads as empty.
export function createCells({ colour, resolution, pixelRatio, background, stops }, cellPx, { mean = false, ground = null } = {}) {
  const standout = standoutOf(background, stops);
  const size = uniform(new Vector2(1, 1));
  const grid = uniform(new Vector2(1, 1));
  const [tx, ty] = cellPx;
  const reduce = Fn(() => {
    const origin = floor(uv().mul(grid)).mul(size);
    // Starts below any tap, so a cell with nothing in it still holds the colour it shows.
    const best = vec4(0, 0, 0, -1).toVar();
    const total = float(0).toVar();
    Loop({ start: int(0), end: int(tx), name: 'i' }, ({ i }) => {
      Loop({ start: int(0), end: int(ty), name: 'j' }, ({ j }) => {
        const at = origin.add(vec2(float(i).add(0.5).div(tx), float(j).add(0.5).div(ty)).mul(size));
        const point = at.div(resolution);
        const c = colour.sample(point).rgb;
        const s = ground ? standout(c, ground(point)) : standout(c);
        best.assign(s.greaterThan(best.a).select(vec4(c, s), best));
        total.addAssign(s);
      });
    });
    return mean ? vec4(best.rgb, total.div(tx * ty)) : best;
  })();
  const target = rtt(reduce, 1, 1, { type: HalfFloatType });
  let seen = '';

  // Keeps the grid matched to the canvas; call once a frame.
  function frame() {
    const ratio = pixelRatio.value;
    const w = cellPx[0] * ratio;
    const h = cellPx[1] * ratio;
    const across = Math.max(1, Math.ceil(resolution.value.x / w));
    const down = Math.max(1, Math.ceil(resolution.value.y / h));
    const key = `${across}x${down}@${w}x${h}`;
    if (key === seen) return;
    seen = key;
    size.value.set(w, h);
    grid.value.set(across, down);
    target.setSize(across, down);
  }

  return {
    // The cell a picture position falls in (integer coordinates as a vec2), the cell's
    // size in device pixels, and the cell's texel.
    cellOf: (at) => floor(at.mul(resolution).div(size)),
    size,
    at: (cell) => target.load(ivec2(cell)),
    frame,
    dispose: () => target.dispose(),
  };
}
