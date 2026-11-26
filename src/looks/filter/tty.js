// The ridge drawn as a terminal draws it: each character cell takes the stroke its line
// makes there, _ - ' " where it runs flat, / \ | on slopes, ^ v over crests and dips. A
// backdrop shows faintly behind, in dots and dashes that are heavier where it is brighter.
import { float, floor, fract, mix, pow, vec2, vec4 } from 'three/tsl';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { fullHueOf, standoutOf } from '../lib/filter-kit.js';
import { STROKES, createStrokes } from '../lib/filter-strokes.js';
import { createGlyphs } from '../lib/glyphs.js';

// A character cell, in CSS pixels.
const CELL = [8, 14];
// How much of its cell's width a character's square in the sheet is squeezed into.
const NARROW = 0.62;
// The characters a backdrop is shown in, lightest first, and how brightly.
const [DOT, DASH, DOUBLE] = ['.', '-', '='].map((c) => STROKES.indexOf(c));
const BACKDROP_SHOWN = 0.55;

export default {
  name: 'tty',
  build: (context) => {
    const { uv, resolution, background, stops } = context;
    const standout = standoutOf(background, stops);
    const fullHue = fullHueOf(background, stops);
    const glyphs = createGlyphs(STROKES, { weight: 600 });
    // Strokes are read from the ridge's own marks, measured from what is behind them.
    const ground = groundOf(context);
    const strokes = createStrokes(context, CELL, undefined, { ground });

    const at = uv.mul(resolution).div(strokes.size);
    const cell = floor(at);
    const here = strokes.at(cell);
    const behind = ground(cell.add(0.5).mul(strokes.size).div(resolution));
    const stroke = floor(here.a);
    const strength = fract(here.a).div(0.99);
    const ridge = stroke.greaterThan(0.5);
    const back = standout(behind);
    const backChar = back.lessThan(0.12).select(float(0), back.lessThan(0.35).select(float(DOT), back.lessThan(0.7).select(float(DASH), float(DOUBLE))));
    const index = ridge.select(stroke, backChar);
    const grid = vec2(floor(at.x).add(0.5).add(fract(at.x).sub(0.5).mul(NARROW)), at.y.negate());
    const drawn = glyphs.sample(index, grid).mul(index.greaterThan(0.5).select(float(1), float(0)));
    const tint = ridge.select(fullHue(here.rgb, behind), fullHue(behind));
    const amount = ridge.select(pow(strength, 0.45), pow(back, 0.45).mul(BACKDROP_SHOWN));
    // Everything is drawn on the plain background, which is what a filter after this sees
    // behind the ridge.
    const output = handOn(vec4(mix(background, tint, drawn.mul(amount)), 1), () => background);

    return { output, frame: strokes.frame, dispose: () => { strokes.dispose(); glyphs.dispose(); } };
  },
};
