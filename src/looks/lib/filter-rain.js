// Rain on a window pane, worked out for each pixel from layers of drops on a grid: nothing
// is simulated or stored, so the pane costs the same however long it has rained.
//
// Positions are in layer units: `p.x` across and `p.y` down the pane, one unit the width
// of a cell. Every layer function returns, for the pixel:
//   drop   1 inside a drop, 0 outside, with a soft edge,
//   to     the vector from the drop's centre to the pixel, in layer units,
//   rel    the same over the drop's radius (length 1 at its edge),
//   clear  how far the drop and its trail have wiped the fog from the glass here.
import { abs, clamp, float, floor, fract, length, max, rand, sin, smoothstep, step, vec2 } from 'three/tsl';

const TAU = Math.PI * 2;

// Drops that run down the pane. Each column of cells is staggered and every cell holds one
// drop, which clings, slides and clings again (three pauses on the way down), leaving a
// wiped streak beaded with tiny drops that fog over again behind it. `tall` is how many
// times taller than wide a cell is; `seed` makes layers differ.
export function runningDrops(p, t, seed, tall) {
  const column = floor(p.x);
  const stagger = rand(vec2(column, seed));
  const q = vec2(p.x, p.y.div(tall).add(stagger));
  const id = floor(q);
  // Within the cell: x in cell widths, y in cell heights, both -0.5 to 0.5.
  const st = fract(q).sub(0.5);
  const n = rand(id.add(seed * 13.7));
  const m = rand(id.add(seed * 7.1 + 3.3));
  const phase = fract(t.mul(n.mul(0.3).add(0.18)).add(n));
  // Always forwards, but with three moments where it all but stops.
  const progress = phase.sub(sin(phase.mul(TAU * 3)).div(TAU * 3));
  const y = progress.mul(0.84).sub(0.42);
  const path = (at) => m.sub(0.5).mul(0.5).add(sin(at.mul(9).add(n.mul(20))).mul(0.04));
  const x = path(y);
  const radius = m.mul(0.07).add(0.1);
  const to = vec2(st.x.sub(x), st.y.sub(y).mul(tall));
  const drop = float(1).sub(smoothstep(radius.mul(0.72), radius, length(to)));

  // The trail runs up from the drop along the path it came down, fading with age.
  const above = step(st.y, y);
  const age = clamp(y.sub(st.y).div(0.75), 0, 1);
  const fromPath = st.x.sub(path(st.y));
  // A streak about as wide as the drop that made it.
  const streak = float(1).sub(smoothstep(radius.mul(0.45), radius.mul(0.85), abs(fromPath))).mul(above).mul(age.oneMinus());
  // Small drops left behind on the trail, not every one where it might be.
  const slot = floor(st.y.mul(7));
  const beadAt = slot.add(0.5).div(7);
  const beadTo = vec2(fromPath, st.y.sub(beadAt).mul(tall));
  const beadSize = rand(vec2(slot, n.mul(91))).mul(0.035).add(0.02).mul(step(0.35, rand(vec2(slot.add(4), m.mul(53)))));
  const bead = float(1).sub(smoothstep(beadSize.mul(0.6), beadSize.max(0.001), length(beadTo))).mul(above).mul(step(0.08, age)).mul(age.mul(-0.5).add(1));

  return {
    drop,
    to: to.mul(drop).add(beadTo.mul(bead)),
    rel: to.div(radius),
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
