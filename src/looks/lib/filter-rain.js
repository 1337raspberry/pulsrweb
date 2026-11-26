// Rain on a window pane, worked out for each pixel from layers of drops on a grid: nothing
// is simulated or stored, so the pane costs the same however long it has rained.
//
// Positions are in layer units: `p.x` across and `p.y` down the pane, one unit the width
// of a cell. Every layer function returns, for the pixel:
//   drop   1 inside a drop, 0 outside, with a soft edge,
//   to     the vector from the drop's centre to the pixel, in layer units,
//   rel    the same over the drop's radius (length 1 at its edge),
//   clear  how far the drop and its trail have wiped the fog from the glass here.
import { abs, atan, clamp, float, floor, fract, length, max, mix, rand, select, sin, smoothstep, step, vec2 } from 'three/tsl';
import { hash21 } from './backdrop-kit.js';

// Share of a drop's turn it spends clinging before it lets go and slides, and how far down
// its cell it travels in a turn. A cell comes down by its own height in a turn, so a drop
// that climbs its cell at nearly that pace while it clings stays where it is on the glass.
const CLING = 0.62;
const TRAVEL = 0.56;

// Drops that run down the pane. Each column of cells slides down the glass at its own pace,
// for good, and every cell holds at most one drop, which climbs its cell while it clings and
// drops back down it as it lets go: on the glass it sticks, slides a cell's height and
// sticks again, all the way down and off the bottom. A sliding drop is pulled long, and no
// drop is quite round. Each leaves a wiped streak beaded with tiny drops, which stay where
// they were left and dry away from the top. `tall` is how many times taller than wide a
// cell is, `size` the smallest and largest radius in cell widths, `amount` the share of
// cells that hold a drop; `seed` makes layers differ.
export function runningDrops(p, t, seed, tall, { size = [0.05, 0.09], amount = 1 } = {}) {
  const column = floor(p.x);
  const stagger = rand(vec2(column, seed));
  const pace = rand(vec2(column, seed + 31.7)).mul(0.22).add(0.16);
  // Down the column in cell heights: `still` stays with the glass, `q` with the cells.
  const still = p.y.div(tall).add(stagger.mul(7));
  const fallen = t.mul(pace);
  const q = still.sub(fallen);
  const id = vec2(column, floor(q));
  // Within the cell: x in cell widths, y in cell heights, both -0.5 to 0.5.
  const st = vec2(fract(p.x).sub(0.5), fract(q).sub(0.5));
  const n = hash21(id.add(seed * 13.7));
  const m = hash21(id.add(seed * 7.1 + 3.3));
  const held = step(hash21(id.add(seed * 3.1 + 9.9)), amount);

  // One turn for each cell's height the column comes down.
  const turn = fract(fallen.add(n));
  const sliding = smoothstep(CLING, 1, turn);
  const y = select(turn.lessThan(CLING), float(0.5).sub(turn.div(CLING)), sliding.sub(0.5)).mul(TRAVEL);
  // How fast it is sliding, 0 to 1.
  const rush = sliding.mul(sliding.oneMinus()).mul(4);
  // The path a drop takes wanders, and belongs to the glass: the trail stays on it.
  const lane = m.sub(0.5).mul(0.4);
  const path = (at) => lane.add(sin(at.mul(tall * 1.7).add(n.mul(20))).mul(0.05)).add(sin(at.mul(tall * 4.1).add(m.mul(9))).mul(0.02));
  const x = path(still.add(y.sub(st.y)));
  const radius = mix(size[0], size[1], m);
  const to = vec2(st.x.sub(x), st.y.sub(y).mul(tall));
  // Water hangs at the bottom of a drop and thins out above it, more so as it runs, and
  // the edge is lumpy rather than a circle.
  const shaped = vec2(to.x, to.y.mul(select(to.y.lessThan(0), float(1).div(rush.mul(0.9).add(1.35)), float(1.12))));
  const angle = atan(to.y, to.x);
  const lumpy = radius.mul(sin(angle.mul(3).add(n.mul(50))).mul(0.1).add(sin(angle.mul(5).add(m.mul(70))).mul(0.06)).add(1));
  const drop = float(1).sub(smoothstep(lumpy.mul(0.72), lumpy, length(shaped))).mul(held);

  // The trail runs up from the drop to the top of its cell, fainter the further up, so it
  // lengthens as the drop slides and dries from the top while the drop clings.
  const span = y.add(0.5);
  const dry = (above) => clamp(above.div(span).oneMinus(), 0, 1).mul(step(0, above));
  const fromPath = st.x.sub(path(still));
  const streak = float(1).sub(smoothstep(radius.mul(0.4), radius.mul(0.8), abs(fromPath))).mul(dry(y.sub(st.y))).mul(held);
  // Small drops left behind on the trail, not every one where it might be.
  const slots = Math.round(tall * 3.5);
  const slot = floor(still.mul(slots));
  const beadAt = slot.add(0.5).div(slots);
  const beadTo = vec2(st.x.sub(path(beadAt)), still.sub(beadAt).mul(tall));
  const k = hash21(vec2(slot, column.add(seed * 5.3)));
  const left = dry(y.sub(st.y.add(beadAt.sub(still))).sub(radius.mul(1.6 / tall)));
  const beadSize = mix(0.012, 0.034, k).mul(step(0.4, k)).mul(smoothstep(0, 0.3, left)).max(0.001);
  const bead = float(1).sub(smoothstep(beadSize.mul(0.6), beadSize, length(beadTo))).mul(step(0.002, beadSize)).mul(held);

  return {
    drop,
    to: to.mul(drop).add(beadTo.mul(bead)),
    rel: shaped.div(lumpy),
    clear: max(max(drop, bead), streak.mul(0.9)),
  };
}

// Fine droplets that sit still, beading up and drying away again in their own time.
export function stillDrops(p, t, seed) {
  const id = floor(p);
  const st = fract(p).sub(0.5);
  const n = rand(id.add(seed));
  const m = rand(id.add(seed + 4.4));
  const life = fract(t.mul(0.05).add(rand(id.add(seed + 9.1))));
  const grown = smoothstep(0, 0.15, life).mul(float(1).sub(smoothstep(0.7, 1, life)));
  const radius = n.mul(0.17).add(0.05).mul(grown).max(0.002);
  const centre = vec2(n, m).sub(0.5).mul(0.6);
  const to = st.sub(centre);
  const drop = float(1).sub(smoothstep(radius.mul(0.65), radius, length(to))).mul(step(0.01, grown));
  return { drop, to: to.mul(drop), rel: to.div(radius), clear: drop.mul(0.6) };
}
