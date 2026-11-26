// The ridge in Braille: two by four dots to a character cell, each cell in the colour of its
// brightest dot, and dim dots beside a bright one left out, so a cell never smudges two
// lines into one. A backdrop shows in sparser dots, scattered in proportion to its
// brightness.
import { float, floor, length, max, mix, pow, vec2, vec3, vec4 } from 'three/tsl';
import { createCells } from '../lib/filter-cells.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { bayer8, fullHueOf, inside, signal, standoutOf } from '../lib/filter-kit.js';

// Dot spacing, in CSS pixels; a cell is two dots across and four down.
const DOT = 4;
// A dot this strong is lit; a dot dimmer than this share of its cell's brightest is left out.
const LIT = 0.04;
const KEEP = 0.7;
// How many of a backdrop's dots are lit at full strength, and how brightly.
const BACKDROP = 0.5;
const BACKDROP_SHOWN = 0.6;

export default {
  name: 'braille',
  build: (context) => {
    const { uv, resolution, background, stops, signals } = context;
    const level = signal(signals, 'level');
    const beat = signal(signals, 'beat');
    const standout = standoutOf(background, stops);
    const fullHue = fullHueOf(background, stops);
    // The ridge's dots are measured from what is behind it, so a backdrop does not read as
    // lines; the backdrop gets dots of its own below.
    const ground = groundOf(context);
    const sites = createCells(context, [DOT, DOT], { ground });

    const px = uv.mul(resolution);
    const pitch = sites.size;
    const site = floor(px.div(pitch));
    const first = floor(site.div(vec2(2, 4))).mul(vec2(2, 4));
    // The cell's brightest dot, and its colour.
    let brightest = float(0);
    let tone = vec3(background);
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const dot = sites.at(first.add(vec2(dx, dy)));
        tone = dot.a.greaterThan(brightest).select(dot.rgb, tone);
        brightest = max(brightest, dot.a);
      }
    }
    const mine = sites.at(site).a;
    const lit = mine.greaterThan(LIT).and(mine.greaterThanEqual(brightest.mul(KEEP))).select(float(1), float(0));
    // A cell the ridge does not touch shows the backdrop behind it, an ordered dither of its
    // strength.
    const behind = ground(site.add(0.5).mul(pitch).div(resolution));
    const back = standout(behind);
    const ridge = brightest.greaterThan(LIT);
    const backLit = back.mul(BACKDROP).greaterThan(bayer8(site).mul(0.94).add(0.03)).select(float(1), float(0));
    // Dots sit a little in from their cell's edge, so the gap between cells reads wider than
    // the gap between the dots of one cell, as in print.
    const middle = first.add(vec2(1, 2)).mul(pitch);
    const centre = site.add(0.5).mul(pitch);
    const placed = centre.add(middle.sub(centre).mul(0.12));
    const radius = pitch.x.mul(mix(0.3, 0.38, level)).mul(beat.mul(0.15).add(1));
    const dotShape = inside(length(px.sub(placed)), radius, float(0.75));
    const tint = ridge.select(fullHue(tone, behind), fullHue(behind));
    const amount = ridge.select(lit.mul(pow(brightest, 0.35)), backLit.mul(pow(back, 0.35)).mul(BACKDROP_SHOWN));
    // Everything is drawn on the plain background, which is what a filter after this sees
    // behind the ridge.
    const output = handOn(vec4(mix(background, tint, dotShape.mul(amount)), 1), () => background);

    return { output, frame: sites.frame, dispose: sites.dispose };
  },
};
