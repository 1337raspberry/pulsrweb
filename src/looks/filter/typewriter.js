// The picture typed out: heavy characters where the lines crowd together, light ones where
// a single line passes, a dust of dots where the rows fade, each in its line's colour. A
// backdrop is typed too, in lighter characters, so the ridge stays the thing to read.
import { clamp, float, floor, fract, max, mix, pow, rand, vec2, vec4 } from 'three/tsl';
import { createCells } from '../lib/filter-cells.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { fullHueOf, signal, standoutOf } from '../lib/filter-kit.js';
import { byCoverage, createGlyphs } from '../lib/glyphs.js';

// A character cell, in CSS pixels.
const CELL = [8, 14];
// Characters to choose from, and how many steps of ink to keep from them.
const RAMP = ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
const STEPS = 16;
// How much of its cell's width a character's square in the sheet is squeezed into.
const NARROW = 0.62;
// How much ink a backdrop at full strength is typed with, and how brightly.
const BACKDROP = 0.3;
const BACKDROP_SHOWN = 0.7;

// The `STEPS` characters whose measured ink climbs most evenly from none to the most.
function evenRamp() {
  const probe = createGlyphs(RAMP, { weight: 500 });
  const order = byCoverage(probe);
  const most = probe.coverage[order[order.length - 1]];
  const chosen = [];
  for (let k = 0; k < STEPS; k++) {
    const want = (k / (STEPS - 1)) * most;
    let pick = -1;
    for (const i of order) {
      if (chosen.includes(i)) continue;
      if (pick < 0 || Math.abs(probe.coverage[i] - want) < Math.abs(probe.coverage[pick] - want)) pick = i;
    }
    chosen.push(pick);
  }
  chosen.sort((a, b) => probe.coverage[a] - probe.coverage[b]);
  const characters = [...RAMP];
  probe.dispose();
  return chosen.map((i) => characters[i]).join('');
}

export default {
  name: 'typewriter',
  build: (context) => {
    const { uv, resolution, background, stops, signals, time } = context;
    const beat = signal(signals, 'beat');
    const treble = signal(signals, 'treble');
    const standout = standoutOf(background, stops);
    const fullHue = fullHueOf(background, stops);
    const glyphs = createGlyphs(evenRamp(), { weight: 500 });
    // The ridge's ink is measured from what is behind it, so a backdrop does not read as
    // lines; the backdrop is typed separately, from its colour at the cell's middle.
    const ground = groundOf(context);
    const cells = createCells(context, CELL, { mean: true, ground });

    const at = uv.mul(resolution).div(cells.size);
    const cell = floor(at);
    const here = cells.at(cell);
    const behind = ground(cell.add(0.5).mul(cells.size).div(resolution));
    // A line through a cell inks about a tenth of it, so the ink is scaled up to reach the
    // middle of the ramp; crowded crests and crossings reach its heavy end.
    const ink = clamp(here.a.mul(4), 0, 1);
    const backdrop = standout(behind).mul(BACKDROP);
    const ridge = ink.greaterThanEqual(backdrop);
    // With the treble a few cells flicker to the next character for a moment; a beat makes
    // every character a step heavier.
    const flicker = rand(cell.add(floor(time.mul(12)))).lessThan(treble.mul(0.25)).select(float(1), float(0));
    const index = clamp(floor(pow(max(ink, backdrop), 0.8).mul(STEPS - 1).add(0.5).add(beat.mul(1.5)).add(flicker)), 0, STEPS - 1);
    // The sheet's cells are square; a character is read from the middle of its square so it
    // keeps its own shape in a narrow cell. The cell's fraction runs up, as the sheet wants.
    const grid = vec2(floor(at.x).add(0.5).add(fract(at.x).sub(0.5).mul(NARROW)), at.y.negate());
    const drawn = glyphs.sample(index, grid);
    const tint = ridge.select(fullHue(here.rgb, behind), fullHue(behind));
    const strength = ridge.select(pow(standout(here.rgb, behind), 0.45), pow(standout(behind), 0.45).mul(BACKDROP_SHOWN));
    // Everything is typed on the plain background, which is what a filter after this sees
    // behind the ridge.
    const output = handOn(vec4(mix(background, tint, drawn.mul(strength)), 1), () => background);

    return { output, frame: cells.frame, dispose: () => { cells.dispose(); glyphs.dispose(); } };
  },
};
