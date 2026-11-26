// For each character cell of the picture, the stroke a line makes as it passes through:
// flat at the top, middle or bottom of the cell, rising, falling, upright, turning over a
// crest or through a dip, or several flat rows stacked in one cell. It is read from the ink
// in the cell: where it sits, which way its edges run, how widely it is spread up and down,
// and how high it is at the cell's left, middle and right.
//
// The strokes and thresholds follow the line mode of pulsr's terminal version.
import { HalfFloatType, Vector2 } from 'three/webgpu';
import { Fn, Loop, abs, atan, float, floor, int, ivec2, max, rtt, step, tan, uniform, uv, vec2, vec4 } from 'three/tsl';
import { standoutOf } from './filter-kit.js';

// The characters, in the order the indices below name them.
export const STROKES = ' "\'-._/\\|^v=';
const BLANK = 0;
const TOP = 1;
const UPPER = 2;
const MIDDLE = 3;
const LOWER = 4;
const BOTTOM = 5;
const RISING = 6;
const FALLING = 7;
const UPRIGHT = 8;
const CREST = 9;
const DIP = 10;
const STACKED = 11;

// Slopes are in cell heights per cell width: below FLAT a line is flat, below GENTLE a
// gentle slope, beyond STEEP upright. A crest or dip stands TURN cell heights above or
// below both ends of the cell. Flat ink spread more than SPREAD cell heights (its standard
// deviation) is more than one row.
const FLAT = 0.12;
const GENTLE = 0.45;
const STEEP = 1.7;
const TURN = 0.22;
const SPREAD = 0.2;

// 1 where a third of the cell has any ink worth reading.
const inked = (w) => step(0.05, w);

// `cellPx` is the cell size in CSS pixels as [x, y]. Each texel holds the cell's strongest
// colour (rgb) and, in alpha, the stroke's index plus 0.99 times how strongly it is drawn.
// With `ground` (what is behind the ridge at a screen point, as `groundOf` gives it), ink is
// measured from that rather than from the background, so a backdrop makes no strokes.
export function createStrokes({ colour, resolution, pixelRatio, background, stops }, cellPx, taps = [6, 10], { ground = null } = {}) {
  const standout = standoutOf(background, stops);
  const size = uniform(new Vector2(1, 1));
  const grid = uniform(new Vector2(1, 1));
  const [tx, ty] = taps;
  const reduce = Fn(() => {
    const origin = floor(uv().mul(grid)).mul(size);
    // One pixel, in uv, for the slopes of the ink.
    const step1 = pixelRatio.div(resolution);
    const best = vec4(0).toVar();
    const m = float(0).toVar();
    const my = float(0).toVar();
    const myy = float(0).toVar();
    // The structure tensor: which way the ink's edges face.
    const jxx = float(0).toVar();
    const jyy = float(0).toVar();
    const jxy = float(0).toVar();
    // Weight and weighted height in the cell's left, middle and right thirds.
    const wl = float(0).toVar();
    const wm = float(0).toVar();
    const wr = float(0).toVar();
    const yl = float(0).toVar();
    const ym = float(0).toVar();
    const yr = float(0).toVar();
    Loop({ start: int(0), end: int(tx), name: 'i' }, ({ i }) => {
      Loop({ start: int(0), end: int(ty), name: 'j' }, ({ j }) => {
        const fx = float(i).add(0.5).div(tx);
        const fy = float(j).add(0.5).div(ty);
        const at = origin.add(vec2(fx, fy).mul(size)).div(resolution);
        // The ground barely changes over a pixel, so one read serves the neighbours too.
        const behind = ground ? ground(at) : background;
        const inkAt = (p) => standout(colour.sample(p).rgb, behind);
        const c = colour.sample(at).rgb;
        const s = standout(c, behind);
        best.assign(s.greaterThan(best.a).select(vec4(c, s), best));
        const gx = inkAt(at.add(vec2(step1.x, 0))).sub(inkAt(at.sub(vec2(step1.x, 0))));
        const gy = inkAt(at.add(vec2(0, step1.y))).sub(inkAt(at.sub(vec2(0, step1.y))));
        jxx.addAssign(gx.mul(gx));
        jyy.addAssign(gy.mul(gy));
        jxy.addAssign(gx.mul(gy));
        // Faint haze is left out of the shape so it does not move the stroke.
        const w = max(s.sub(0.06), 0);
        m.addAssign(w);
        my.addAssign(w.mul(fy));
        myy.addAssign(w.mul(fy).mul(fy));
        const left = float(1).sub(step(1 / 3, fx));
        const right = step(2 / 3, fx);
        const middle = float(1).sub(left).sub(right);
        wl.addAssign(w.mul(left));
        wm.addAssign(w.mul(middle));
        wr.addAssign(w.mul(right));
        yl.addAssign(w.mul(fy).mul(left));
        ym.addAssign(w.mul(fy).mul(middle));
        yr.addAssign(w.mul(fy).mul(right));
      });
    });
    const total = m.max(1e-5);
    const cy = my.div(total);
    const spread = myy.div(total).sub(cy.mul(cy)).max(0).sqrt();
    // The edges face across the line; the line runs at right angles to them (y down).
    const facing = atan(jxy.mul(2), jxx.sub(jyy)).mul(0.5);
    const slope = tan(facing.add(Math.PI / 2)).mul(size.x.div(size.y));
    const steepness = abs(slope);
    // A crest or dip needs ink in all three thirds.
    const heightOf = (wy, ww) => wy.div(ww.max(1e-5));
    const seenAll = inked(wl).mul(inked(wm)).mul(inked(wr));
    const hl = heightOf(yl, wl);
    const hm = heightOf(ym, wm);
    const hr = heightOf(yr, wr);
    const crest = seenAll.mul(step(TURN, hl.sub(hm))).mul(step(TURN, hr.sub(hm)));
    const dip = seenAll.mul(step(TURN, hm.sub(hl))).mul(step(TURN, hm.sub(hr)));

    const oneRow = cy.lessThan(0.2).select(float(TOP), cy.lessThan(0.4).select(float(UPPER), cy.lessThan(0.6).select(float(MIDDLE), cy.lessThan(0.8).select(float(LOWER), float(BOTTOM)))));
    const flatStroke = spread.greaterThan(SPREAD).select(float(STACKED), oneRow);
    const gentleStroke = cy.lessThan(0.5).select(float(UPPER), float(LOWER));
    const slantStroke = slope.lessThan(0).select(float(RISING), float(FALLING));
    const byRun = steepness.lessThan(FLAT).select(flatStroke, steepness.lessThan(GENTLE).select(gentleStroke, steepness.lessThan(STEEP).select(slantStroke, float(UPRIGHT))));
    const turned = crest.greaterThan(0.5).select(float(CREST), dip.greaterThan(0.5).select(float(DIP), byRun));
    const stroke = best.a.lessThan(0.08).or(m.lessThan(0.15)).select(float(BLANK), turned);
    return vec4(best.rgb, stroke.add(best.a.mul(0.99)));
  })();
  const target = rtt(reduce, 1, 1, { type: HalfFloatType });
  let seen = '';

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

  return { size, at: (cell) => target.load(ivec2(cell)), frame, dispose: () => target.dispose() };
}
