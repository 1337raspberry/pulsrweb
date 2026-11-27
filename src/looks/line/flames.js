// Every row on fire: tongues of flame lick up from the line, tallest on the newest rows and
// over the loud parts of a row, white-hot at the root through the row's colour to nothing at
// the tips, dying down to a line of glowing embers as the row ages. On a light background
// the fire is drawn in ink.
import { DoubleSide, InstancedMesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { exp, float, fwidth, max, min, mix, mx_noise_float, positionGeometry, select, smoothstep, varying, vec2, vec3 } from 'three/tsl';
import { keepBrightest, random, seedOf, signal, smoothLevel } from '../lib/line-kit.js';

// Fire's own colours, linear: the root, brighter than white so a bloom filter takes it up;
// yellow; the orange a colourless tint warms to; and the dull red the tips cool through.
const WHITE_HOT = [1.45, 1.35, 0.95];
const YELLOW = [1, 0.58, 0.045];
const ORANGE = [1, 0.19, 0.007];
const DULL_RED = [0.46, 0.012, 0.0015];
// Small tongues all along the line, at most this many times as tall as they are wide; big
// ones, this many times as wide, where the fire runs high.
const SMALL_TALL = 3.4;
const BIG = 2.6;

export default {
  name: 'flames',
  build: (c) => {
    const light = c.light.value > 0.5;
    const beat = signal(c, 'beat');
    // How hard a row burns, by how many rows it stands from the camera's end of the ridge:
    // where the newest rows are when they flow away, and where rows coming towards the
    // camera stand at full height. Tall fire dies down within a few rows; a carpet of small
    // flames burns on a while longer, and then only the embers of the line glow.
    const fromEnd = c.u.rows.sub(1).max(1).mul(c.row.near.oneMinus());
    const blaze = exp(fromEnd.div(4).negate());
    const smoulder = exp(fromEnd.div(14).negate());
    // A row cut on a kick burns taller all the way back, and every fire flares on a beat.
    const flare = c.row.born.beat.mul(0.35).add(1).mul(beat.mul(0.7).add(1));

    // The flames stand upright above the line, so the sheet they are drawn on reaches from
    // the line to the flames' height over the highest point near by: a tongue rooted up a
    // slope still fits on the sheet beside it. The flames are taller over the loud parts of
    // the row, followed broadly so they flow.
    const broad = smoothLevel(c, c.index, 3);
    const tall = c.row.rise.mul(smoulder.mul(0.12).add(broad.mul(blaze).mul(0.45))).mul(flare);
    const highest = [-10, -5, 5, 10].reduce((m, d) => max(m, c.row.heightAt(min(max(c.index.add(d), 0), c.points - 1))), c.level);
    const base = c.level.mul(c.row.rise);
    const top = highest.mul(c.row.rise).add(tall);
    const along = c.alongAt(c.index);
    const lit = c.row.shown.and(tall.greaterThan(1e-3));
    const material = new MeshBasicNodeMaterial({ side: DoubleSide });
    material.positionNode = select(lit, c.place(along, select(positionGeometry.y.greaterThan(0), top, base)), vec3(0));

    // A small tongue's width in world units, from the row's own height scale, so the fire
    // keeps its proportions at any height setting; and the world length of a step along the
    // row at its foot, so tongues keep their width on long rows (a record's rim) and short.
    const unit = varying(c.row.rise.mul(0.05).clamp(0.08, 0.45));
    const before = max(c.index.sub(1), 0);
    const after = min(c.index.add(1), c.points - 1);
    const span = c.place(c.alongAt(after), float(0)).sub(c.place(c.alongAt(before), float(0))).length().max(1e-4);
    const pace = varying(span.div(float(after.sub(before)).max(1)));
    // How steeply the line climbs here, in world units of height per world unit along.
    const slope = varying(c.row.heightAt(after).sub(c.row.heightAt(before)).mul(c.row.rise).div(span));
    const sheet = varying(top.sub(base));
    const most = varying(tall);
    const serial = varying(seedOf(c.row)).round();
    const offset = serial.mul(0.731);
    const burning = varying(smoulder);

    // World units along the row and up the sheet. The flicker slows right down for
    // reduced motion.
    const X = c.pointIndex.mul(pace);
    const Y = c.up.mul(sheet);
    const t = c.time.mul(mix(float(1), float(0.25), c.still));

    // How strongly this pixel burns in a row of tongues `w` wide, at most `reach` world units
    // tall: 1 at a tongue's root, falling to 0 at its pointed tip, 0 between tongues. Each
    // tongue has a place, a height that flickers, and a sway of its own that grows towards
    // its tip; the cells either side are looked at too, as a swaying tongue leans out of its own.
    const tongues = (w, reach, salt) => {
      let burn = float(0);
      const first = X.div(w).floor();
      for (const d of [-1, 0, 1]) {
        const cell = first.add(d);
        const id = cell.mod(4096);
        const centre = cell.add(0.5).add(random(serial, id.add(salt)).sub(0.5).mul(0.6)).mul(w);
        const flicker = mx_noise_float(vec2(id.mul(0.613).add(offset), t.mul(2.3).add(salt))).mul(0.5).add(0.5).clamp(0, 1);
        const h = reach.mul(flicker.pow(1.4).mul(0.85).add(0.15)).max(1e-4);
        // Height above the tongue's own root: the line under its middle, from the slope here.
        // Down a steep slope the line falls away below a tongue's root; the fire there fades.
        const raw = Y.add(slope.mul(X.sub(centre))).div(h);
        const k = raw.max(0);
        const hung = smoothstep(-0.3, 0, raw);
        const sway = mx_noise_float(vec2(id.mul(0.37).add(salt), Y.div(w).mul(0.5).sub(t.mul(1.7)))).mul(w).mul(1.3).mul(k.min(1).pow(1.5));
        const dx = X.sub(centre).sub(sway).abs();
        // A candle flame's outline: a little fuller above the root, drawn in to a sharp tip.
        const left = k.oneMinus().max(0);
        const half = w.mul(0.36).mul(left.pow(1.3)).mul(k.mul(2.5).add(1)).mul(k.mul(8).min(1).sqrt().mul(0.3).add(0.7));
        const edge = fwidth(X).max(1e-5);
        const inside = smoothstep(edge.negate(), edge, half.sub(dx));
        // Hottest along the tongue's middle and at its root.
        const middle = dx.div(half.max(1e-5)).oneMinus().clamp(0, 1).sqrt();
        burn = max(burn, inside.mul(left.pow(0.8)).mul(middle.mul(0.6).add(0.4)).mul(hung));
      }
      return burn;
    };
    const small = tongues(unit, min(most, unit.mul(SMALL_TALL)), 17);
    const big = tongues(unit.mul(BIG), most, 59).mul(smoothstep(unit.mul(2), unit.mul(4.5), most));
    // The flames tear apart near their tips: blobs of fire break off and rise.
    const torn = mx_noise_float(vec2(X.div(unit).mul(0.9), Y.div(unit).mul(0.8).sub(t.mul(3.2)).add(offset))).mul(0.5).add(0.5);
    const ragged = smoothstep(0.15, 0.5, torn.add(Y.div(most.max(1e-4)).oneMinus().mul(0.8)).sub(0.3));
    // A steady glow along the line, where every tongue starts.
    const root = exp(Y.div(unit.mul(0.3)).negate());
    // How hot this pixel is (a cooler row burns less white), and how bright the fire is drawn:
    // it fades with the row as the line does.
    const burn = max(max(small, big).mul(ragged), root.mul(0.65)).mul(burning.mul(0.3).add(0.7));
    const shown = c.fade.mul(burning.pow(0.3)).mul(beat.mul(0.35).add(1));

    // A colourless tint (white, grey) warms to orange in the body of the flame; a coloured
    // one keeps its own colour, a gas flame of it.
    const tint = c.tint;
    const spread = tint.x.max(tint.y).max(tint.z).sub(tint.x.min(tint.y).min(tint.z));
    const grey = smoothstep(0.02, 0.12, spread).oneMinus();
    const warm = mix(tint, vec3(...ORANGE), grey.mul(0.85).add(0.15));
    const hot = vec3(...WHITE_HOT).mul(signal(c, 'level').mul(0.2).add(0.9));
    // Near the root a fire turns yellow, and at its tips it cools to a dull red; a gas flame
    // of a coloured tint only leans that way, and darkens in its own colour.
    const pale = mix(warm, vec3(...YELLOW), grey.mul(0.45).add(0.25));
    const dull = mix(warm.mul(0.3), vec3(...DULL_RED), grey.mul(0.6).add(0.2));
    // Root to tip: white-hot, yellow, the row's colour, dull red, nothing.
    const cool = mix(dull, warm, smoothstep(0.1, 0.38, burn));
    const glowing = mix(cool, pale, smoothstep(0.42, 0.68, burn));
    const fire = mix(glowing, hot, smoothstep(0.7, 0.92, burn)).mul(smoothstep(0.02, 0.14, burn)).mul(shown);
    // In ink, on paper: the same fire printed in its colours, a dark rim and tip round an
    // orange body and a yellow heart, where the darkest ink laid on a spot is what shows.
    const inkTone = mix(mix(dull, c.ink, 0.35), vec3(0), 0.25);
    const drawn = mix(mix(inkTone, warm, smoothstep(0.1, 0.3, burn)), pale, smoothstep(0.5, 0.8, burn));
    const cover = smoothstep(0.04, 0.09, burn).mul(shown.mul(1.5).min(1));
    material.colorNode = light ? mix(vec3(1), drawn, cover) : fire;
    Object.assign(material, keepBrightest(c));

    const flames = new InstancedMesh(c.geometry, material, c.count);
    flames.frustumCulled = false;
    // The shape reads which copy of the ridge it is placing; the fire burns on the first.
    flames.userData.copy = 0;

    // The line: white-hot on a row that is burning hard, cooling as it ages to an ember line
    // that glows in slow patches, in the row's colour warmed towards orange.
    const glow = mx_noise_float(vec2(c.pointIndex.mul(0.07).add(offset), t.mul(0.6))).mul(0.5).add(0.5);
    const ember = mix(dull, warm, smoothstep(0.3, 0.8, glow));
    const line = mix(ember, pale, smoothstep(0.35, 0.95, burning));
    const charred = mix(mix(tint, c.ink, 0.45), mix(tint, c.ink, 0.8), smoothstep(0.3, 0.9, burning));
    return {
      colour: c.faded(light ? charred : line),
      width: 1.15,
      extras: [{
        object: flames,
        setRows: (rows) => { flames.count = rows; },
        dispose: () => material.dispose(),
      }],
    };
  },
};
