// Every row freshly painted: a coat of glossy paint along its top edge that runs down its
// face in drips, each ending in a round bead, longer the louder the row and the longer it
// has had to run. The live row is wet paint just laid on.
import { exp, float, fwidth, length, max, min, mix, modelWorldMatrix, mx_noise_float, positionWorld, select, smoothstep, step as step01, varying, vec2, vec3, vec4 } from 'three/tsl';
import { random, seedOf } from '../lib/line-kit.js';

// Rows back a drip takes to run most of its length: within the few rows nearest the
// camera's end, where a row's face is still in view.
const RUN = 2;

export default {
  name: 'drip',
  build: (c) => {
    const last = c.points - 1;
    const along = c.alongAt(c.index);
    const before = max(c.index.sub(1), 0);
    const after = min(c.index.add(1), last);
    // The line's height above the row's foot in world units, at a point, and how steeply it
    // climbs here, in world units of height per world unit along the row.
    const raised = (i) => c.place(c.alongAt(i), c.row.heightAt(i).mul(c.row.rise)).sub(c.place(c.alongAt(i), float(0))).length();
    const step = c.place(c.alongAt(after), float(0)).sub(c.place(c.alongAt(before), float(0))).length().max(1e-4);
    const slope = varying(raised(after).sub(raised(before)).div(step));
    const pace = varying(step.div(float(after.sub(before)).max(1)));
    const height = varying(raised(c.index));
    const lineWorld = varying(modelWorldMatrix.mul(vec4(c.place(along, c.level.mul(c.row.rise)), 1)).xyz);
    // A drip cell's width, from the row's height scale so the paint keeps its proportions.
    const unit = varying(c.row.rise.mul(0.04).clamp(0.05, 0.35));
    const serial = varying(seedOf(c.row)).round();
    // How far the paint has had to run: a row is laid on as it is cut, and its drips have
    // mostly run within a few rows.
    const ran = varying(exp(c.row.depth.add(0.5).div(RUN).negate()).oneMinus());

    // On the curtain: world units along the row, and down from the line.
    const X = c.pointIndex.mul(pace);
    const D = positionWorld.sub(lineWorld).length();
    // The world size of a pixel on the curtain here, from its position, which runs on
    // smoothly from one drip's cell to the next, so the cell edges leave no seams. The paint
    // is drawn as signed distances in pixels, so its edges stay crisp at any angle and a thin
    // darker rim can follow them.
    const pixel = length(fwidth(positionWorld)).mul(0.7).max(1e-6);
    // The coat along the top, its lower edge gently uneven.
    const coat = unit.mul(mx_noise_float(vec2(X.div(unit).mul(0.6), serial.mul(0.37))).mul(0.18).add(0.62));
    const band = coat.sub(D).div(pixel);

    // One drip in each cell, or none: more drips where the row is loud. Each has a place, a
    // width and a length of its own, and runs as the row ages, never below the row's base.
    const cell = X.div(unit).floor();
    const id = cell.mod(4096);
    const loud = smoothstep(0.03, 0.5, c.height);
    const has = random(serial, id.add(101)).lessThan(loud.mul(0.5).add(0.3));
    const centre = cell.add(0.5).add(random(serial, id.add(211)).sub(0.5).mul(0.4)).mul(unit);
    const half = unit.mul(random(serial, id.add(307)).mul(0.12).add(0.2));
    const under = height.add(slope.mul(centre.sub(X)));
    const longest = c.row.rise.mul(0.5).mul(random(serial, id.add(401)).pow(1.5).mul(0.8).add(0.2)).mul(loud.mul(0.6).add(0.4)).mul(ran);
    const reach = min(longest, under.sub(half.mul(2.6)).max(0));
    // Down from where the drip leaves the coat (on a slope, the line under its middle).
    const down = D.add(slope.mul(centre.sub(X))).sub(coat);
    const dx = X.sub(centre);
    // A run of paint that flares where it leaves the coat and thins a little as it goes,
    // ending in a bead.
    const width = half.mul(exp(down.max(0).div(half.mul(1.4)).negate()).mul(1.2).add(1)).mul(down.div(reach.max(1e-4)).clamp(0, 1).mul(-0.2).add(1));
    const run = min(width.sub(dx.abs()), reach.sub(down)).div(pixel);
    const bead = half.mul(1.5);
    const drop = vec2(dx, down.sub(reach));
    const ball = select(reach.greaterThan(half.mul(0.5)), bead.sub(drop.length()).div(pixel), float(-1e4));
    const drip = select(has, max(run, ball), float(-1e4));
    const inside = max(band, drip);
    const paint = smoothstep(-0.5, 0.5, inside);
    const dripping = smoothstep(-0.5, 0.5, drip);

    // Glossy, wet paint: lit from the upper left, a streak of light down each drip and a spot
    // on each bead, darker along the right of a run and in a thin rim round every edge.
    const across = dx.div(max(width, 1e-4)).clamp(-1, 1);
    const streak = smoothstep(0.06, 0.2, across.add(0.45).abs()).oneMinus().mul(dripping);
    const spot = smoothstep(0.12, 0.34, drop.sub(vec2(bead.mul(-0.38), bead.mul(-0.38))).length().div(bead)).oneMinus().mul(smoothstep(-0.5, 0.5, ball));
    const sheen = smoothstep(0, 0.4, D.div(coat.max(1e-4))).oneMinus().mul(0.4);
    const shade = mix(float(1), across.mul(-0.3).add(0.85), dripping);
    const rim = smoothstep(0.8, 2.2, inside).mul(0.45).add(0.55);
    const wet = c.tint.mul(shade).mul(rim).add(vec3(1).mul(max(max(streak, spot), sheen.mul(step01(0.5, band))).mul(0.6)));
    return {
      width: 1.3,
      colour: c.faded(mix(c.tint, vec3(1), 0.2)),
      curtain: { colour: mix(c.ground, mix(c.ground, wet, c.fade), paint) },
    };
  },
};
