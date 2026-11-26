// Raindrops on a window pane: drops that cling where they landed, and heavier ones that
// let go and run down in fits and starts, wiping a trail beaded with droplets. For a
// picture seen through wet glass: each drop says where its middle is and how big it is,
// so the view can be turned upside down inside it, as a real drop does.
import { abs, floor, fract, length, max, mix, pow, select, sin, smoothstep, step, vec2 } from 'three/tsl';
import { hash21, hash22 } from './backdrop-kit.js';

// Drops that cling: one to a cell of a grid `cells` to the screen's height, each landing,
// staying and drying at its own pace. `amount` (0 to 1) is how much of the time a cell
// holds its drop, so more rain means more drops at once. Sizes are shares of a cell.
function clinging(p, { cells, seed, time, amount, smallest, largest }) {
  const offset = vec2(seed * 5.3, seed * 9.1);
  const g = p.mul(cells).add(offset);
  const id = floor(g);
  const k = hash21(id.add(seed * 7.3));
  const life = fract(time.mul(mix(0.015, 0.045, k)).add(k.mul(13)));
  // Swells in as it lands, then stays until it dries.
  const swell = smoothstep(0, 0.012, life);
  const at = hash22(id.add(seed * 2.9)).mul(0.6).add(0.2);
  const size = mix(smallest, largest, pow(hash21(id.add(seed * 4.7 + 3.3)), 2.5)).mul(swell).max(1e-4);
  const q = fract(g).sub(at).mul(vec2(1, 1.12));
  const mask = smoothstep(size.mul(0.75), size, length(q)).oneMinus().mul(step(life, amount));
  return { mask, centre: id.add(at).sub(offset).div(cells), radius: size.div(cells), local: q.div(size) };
}

// Drops that run: in columns `columns` to the screen's height, each cell `height` screen
// heights tall holds a runner on some of its turns (`amount`), which goes from the top of
// the cell to the bottom as `slide` grows by one, halting three times on the way.
function running(p, { columns, height = 0.6, seed, slide, amount }) {
  const offset = vec2(seed * 3.7, seed * 1.9);
  const g = vec2(p.x.mul(columns), p.y.div(height)).add(offset);
  const id = floor(g);
  const f = fract(g);
  const k = hash21(id.add(seed * 8.1));
  const t = slide.mul(mix(0.55, 1.1, k)).add(k.mul(17));
  const runs = step(hash21(vec2(id.x.add(floor(t).mul(7.13)), id.y.add(seed * 2.2))), amount);
  const s = fract(t);
  const y = s.add(sin(s.mul(Math.PI * 6)).mul(0.053)).oneMinus();
  // Where across its column the runner is at any height of its cell: it meanders.
  const wander = (at) => k.sub(0.5).mul(0.45).add(0.5).add(sin(at.mul(8.5).add(k.mul(40))).mul(0.06)).add(sin(at.mul(23).add(k.mul(9))).mul(0.015));
  const x = wander(y);
  // A cell's height in column widths, the unit everything round is measured in.
  const tall = height * columns;
  const size = mix(0.12, 0.19, hash21(id.add(seed * 6.6 + 4.4)));
  const q = vec2(f.x.sub(x), f.y.sub(y).mul(tall));
  // Water gathers at the bottom of a running drop: it is a little pear-shaped.
  const drop = smoothstep(size.mul(0.78), size, length(vec2(q.x, q.y.mul(select(q.y.greaterThan(0), 0.8, 1.1))))).oneMinus().mul(runs);
  // The trail it wiped above itself, and the beads of water left along it.
  const behind = f.y.sub(y).mul(tall);
  const trail = smoothstep(size.mul(0.35), size.mul(0.6), abs(f.x.sub(wander(f.y)))).oneMinus()
    .mul(step(0, behind)).mul(smoothstep(0, 3.2, behind).oneMinus()).mul(runs);
  const beads = 22;
  const slot = floor(f.y.mul(beads));
  const beadY = slot.add(0.5).div(beads);
  const bk = hash21(vec2(id.x, slot).add(seed * 9.7 + 1.3));
  const beadSize = mix(0.025, 0.07, bk).mul(step(0.4, bk)).max(1e-4);
  const bq = vec2(f.x.sub(wander(beadY)), f.y.sub(beadY).mul(tall));
  const bead = smoothstep(beadSize.mul(0.7), beadSize, length(bq)).oneMinus().mul(trail).mul(step(0.25, behind));
  const isDrop = drop.greaterThanEqual(bead);
  const radius = select(isDrop, size, beadSize);
  return {
    mask: max(drop, bead),
    centre: id.add(select(isDrop, vec2(x, y), vec2(wander(beadY), beadY))).sub(offset).div(vec2(columns, 1 / height)),
    radius: radius.div(columns),
    local: select(isDrop, q, bq).div(radius),
    trail,
  };
}

// The drops on the glass at the centred point `p`. `time` in seconds lets clinging drops
// come and go; `slide` moves the running ones (one turn per unit); `rain` (0 to 1) is how
// wet the glass is. Returns `{ mask, centre, radius, local, trail }`: `mask` 1 inside a
// drop, `centre` and `radius` the drop's (centred units), `local` the point within it
// (length 1 at its edge, y up), and `trail` 1 where a running drop has wiped the glass.
export function raindrops(p, { time, slide, rain }) {
  const runA = running(p, { columns: 6, seed: 3, slide, amount: rain.mul(0.5) });
  const runB = running(p, { columns: 9, seed: 4, slide: slide.mul(0.83).add(0.37), amount: rain.mul(0.4) });
  const trail = max(runA.trail, runB.trail);
  // Running drops sweep up the clinging ones in their way.
  const kept = trail.oneMinus();
  const big = clinging(p, { cells: 20, seed: 1, time, amount: rain.mul(0.3).add(0.06), smallest: 0.1, largest: 0.36 });
  const fine = clinging(p, { cells: 64, seed: 2, time, amount: rain.mul(0.3).add(0.08), smallest: 0.1, largest: 0.26 });
  const layers = [{ ...big, mask: big.mask.mul(kept) }, { ...fine, mask: fine.mask.mul(kept) }, runA, runB];
  // Where drops overlap, the stronger one is seen.
  let best = layers[0];
  for (const layer of layers.slice(1)) {
    const take = layer.mask.greaterThan(best.mask);
    best = {
      mask: max(best.mask, layer.mask),
      centre: select(take, layer.centre, best.centre),
      radius: select(take, layer.radius, best.radius),
      local: select(take, layer.local, best.local),
    };
  }
  return { ...best, trail };
}
