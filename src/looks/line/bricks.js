// Rows built of stacked square blocks: each band of the spectrum a flat-topped stack, as many
// blocks high as it is loud, every block bevelled (lit along its top and left, shaded along
// its bottom and right, a thin dark gap round it) and coloured by its height. A column that
// grows on a hit flashes its new blocks.
import { clamp, exp, float, fwidth, int, max, min, mix, modelWorldMatrix, positionWorld, round, select, smoothstep, step, varying, vec3, vec4 } from 'three/tsl';
import { random, seedOf, signal } from '../lib/line-kit.js';

// Points per column, and columns per row (the last takes the row's final point too).
const COLUMN = 7;
const COLUMNS = 72;
// As the ridge colours its rows: the share of a row's rise that reaches the last stop.
const GRADIENT_TOP = 0.6;
// Across a block: the gap round it and the bevel inside that, as shares of its side.
const GAP = 0.07;
const BEVEL = 0.13;

export default {
  name: 'bricks',
  build: (c) => {
    const last = c.points - 1;
    const step1 = 1 / last;
    const columnOf = (i) => min(i.div(COLUMN), int(COLUMNS - 1));

    // A column of `row`: its level (the average of its band), the world width of its foot, how
    // far a unit of height moves a point there, and from those the height of one square block
    // (kept so a full column holds between 3 and 60), the number of blocks and the height of
    // its flat top. Shapes that stretch a row (a record's rim) get blocks less than square.
    const stack = (column, row = c.row) => {
      const start = column.mul(COLUMN);
      const level = [1, 2, 4, 5].reduce((sum, d) => sum.add(row.heightAt(min(start.add(d), last))), float(0)).div(4);
      const middle = c.alongAt(start.add(Math.floor(COLUMN / 2)));
      const width = c.place(c.alongAt(start), float(0), row).sub(c.place(c.alongAt(min(start.add(COLUMN), last)), float(0), row)).length();
      const scale = c.place(middle, float(0.5), row).sub(c.place(middle, float(0), row)).length().div(0.5).max(1e-4);
      const block = clamp(width.div(scale), row.rise.div(60), row.rise.div(3)).max(1e-4);
      const count = round(level.mul(row.rise).div(block));
      return { count, block, scale, top: count.mul(block) };
    };

    const lift = (i) => stack(columnOf(i)).top.div(c.row.rise.max(1e-4)).sub(c.row.heightAt(i));
    // The two points either side of a column's edge are moved to meet on it, so each column
    // stands with straight sides and the step between two columns is sheer.
    const across = (i) => {
      const at = i.mod(COLUMN);
      const column = i.div(COLUMN);
      const lastOfColumn = at.equal(int(COLUMN - 1)).and(column.lessThan(int(COLUMNS - 1)));
      const firstOfColumn = at.equal(int(0)).and(i.greaterThan(int(0))).and(column.lessThan(int(COLUMNS)));
      return select(lastOfColumn, float(0.5), select(firstOfColumn, float(-0.5), float(0)));
    };
    const shift = (i) => across(i).mul(step1);

    // On the curtain: which column, how far across it, and how far down from the column's
    // top, in blocks. The curtain's world position at this pixel against the column's top
    // gives that for any shape, whatever its curtains' foot.
    const own = stack(columnOf(c.index));
    const previous = stack(columnOf(c.index), c.rowAt(c.row.k.add(1)));
    const top = c.place(c.alongAt(c.index).add(shift(c.index)), own.top);
    const topWorld = varying(modelWorldMatrix.mul(vec4(top, 1)).xyz);
    const blockWorld = varying(own.block.mul(own.scale));
    const blockHeight = varying(own.block.div(c.row.rise.max(1e-4)));
    const count = varying(own.count);
    const grown = varying(previous.count);
    const x = varying(float(c.index).add(across(c.index))).add(0.5).div(COLUMN);
    const column = x.floor().min(COLUMNS - 1);
    const u = x.sub(column).clamp(0, 1);
    const down = positionWorld.sub(topWorld).length().div(blockWorld);
    const fromTop = down.floor();
    const v = down.sub(fromTop).oneMinus();
    const block = count.sub(1).sub(fromTop);
    const inStack = step(-0.5, block);

    // The block's colour: the tint at the block's height, a little lighter or darker for
    // each block on its own.
    const seed = varying(seedOf(c.row)).round();
    const vary = random(seed, column.mul(61).add(block.max(0)).mod(4096));
    const level = block.add(0.5).mul(blockHeight);
    const base = c.tintOf({ t: clamp(level.div(GRADIENT_TOP), 0, 1), height: level }).mul(vary.sub(0.5).mul(0.22).add(1));
    // New blocks flash for a moment when their column grows on a hit: on the live row while
    // the hit lasts, and on rows cut on a kick as they leave.
    const fresh = signal(c, 'hit').mul(exp(c.row.depth.negate()));
    const kicked = c.row.born.beat.mul(exp(c.row.depth.div(c.u.speed.max(1e-3)).div(0.25).negate()));
    const flash = varying(max(fresh, kicked)).mul(step(grown.sub(0.5), block));
    const face = mix(base, mix(base, vec3(1), 0.6).mul(1.4), flash);

    // The bevel: each pixel's nearest edge of its block, and whether it is in the gap, on the
    // bevel by that edge, or on the face.
    const left = u;
    const right = u.oneMinus();
    const bottom = v;
    const topEdge = v.oneMinus();
    const nearest = min(min(left, right), min(bottom, topEdge));
    const aa = max(fwidth(x), fwidth(down)).max(1e-5);
    const gap = smoothstep(aa.negate().add(GAP / 2), aa.add(GAP / 2), nearest).oneMinus();
    const onBevel = smoothstep(aa.negate().add(GAP / 2 + BEVEL), aa.add(GAP / 2 + BEVEL), nearest).oneMinus();
    // Lit from the top left: the top bevel lightest, the left a little less, the bottom and
    // right in shadow.
    const lit = select(topEdge.lessThanEqual(nearest), float(1), select(left.lessThanEqual(nearest), float(0.6), float(-1)));
    const shaded = select(lit.greaterThan(0), mix(face, vec3(1), lit.mul(0.38)), face.mul(0.5));
    const grout = mix(base, vec3(0), 0.75);
    const tile = mix(mix(face, shaded, onBevel), grout, gap);
    // Blocks too small to draw blend into their face.
    const tiny = smoothstep(0.12, 0.35, aa);
    const painted = mix(tile, face.mul(0.92), tiny);
    const curtain = mix(c.ground, painted, c.fade.mul(inStack));
    const topLevel = varying(own.top.div(c.row.rise.max(1e-4)));
    const edge = mix(c.tintOf({ t: clamp(topLevel.div(GRADIENT_TOP), 0, 1), height: topLevel }), vec3(1), 0.45);
    return {
      lift,
      shift,
      width: 0.7,
      colour: c.faded(edge),
      curtain: { colour: curtain },
    };
  },
};
