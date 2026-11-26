// Falling code: columns of glyphs pour down behind the ridge, each a bright head with a
// trail fading behind it, faster as the music fills out and brightest over the frequencies
// that are playing. On a light background, ink on paper.
import { exp, floor, fract, int, mix, pow, step, uniform, vec2, vec3 } from 'three/tsl';
import { CHARACTERS, canDraw, createGlyphs } from '../lib/glyphs.js';
import { alongUnder, dither, hash11, hash21, lift, recentLevel } from '../lib/backdrop-kit.js';

// A glyph's cell is this wide for its height.
const CELL = 0.66;

export default {
  name: 'glyphfall',
  build: ({ uv, background, stops, light, resolution, ridge, camera, time }) => {
    // Half-width katakana where the system's fonts have them, as in the films; letters
    // and figures otherwise.
    const set = (canDraw('ｱ') ? CHARACTERS.katakana : 'ABCDEFGHJKLMNPQRSTUVWXYZ') + CHARACTERS.digits + ':.=*+<>|';
    const glyphs = createGlyphs(set, { mirror: true, weight: 600, scale: 0.9 });
    // How far the code has fallen: seconds that run faster when the music is fuller.
    const fall = uniform(0);
    // Every head flares on a beat.
    const flare = uniform(0);
    let beatsSeen = -1;
    const aspect = resolution.x.div(resolution.y);

    // One depth of rain: `rows` glyphs to the screen's height falling `speed` rows a
    // second, drawn `strength` bright.
    const layer = (rows, speed, seed, strength) => {
      const cols = aspect.mul(rows / CELL);
      // Columns across, rows counted down from the top.
      const g = vec2(uv.x.mul(cols), uv.y.oneMinus().mul(rows));
      const col = floor(g.x).add(seed * 1000);
      const row = floor(g.y);
      const k = hash11(col);
      const trailLength = mix(8, 26, hash11(col.add(0.37)));
      const period = trailLength.add(rows);
      // Two drops to a column, at their own places in its turn.
      const behindHead = (offset) => {
        const head = fract(hash11(col.add(offset)).add(fall.mul(speed).mul(mix(0.6, 1.45, k)).div(period))).mul(period);
        return head.sub(row);
      };
      const behindA = behindHead(0.71);
      const behindB = behindHead(0.23);
      const trailOf = (behind) => step(0, behind).mul(pow(behind.div(trailLength).oneMinus().max(0), 1.7));
      const trail = trailOf(behindA).max(trailOf(behindB));
      const headOf = (behind) => step(0, behind).mul(exp(behind.mul(behind).mul(-1.2)));
      const head = headOf(behindA).max(headOf(behindB));

      // Each glyph changes now and then, some much more often than others.
      const cell = vec2(col, row);
      const rate = mix(0.15, 3, pow(hash21(cell.add(seed * 3.7)), 3));
      const turn = floor(time.mul(rate).add(hash21(cell.add(5.1)).mul(10)));
      const index = floor(hash21(vec2(col.add(turn.mul(13.1)), row.add(seed))).mul(glyphs.count));
      const grid = vec2(g.x, uv.y.mul(rows));
      const ink = glyphs.sample(index, grid);
      const haze = glyphs.blurred(index, grid, 3.5);

      // Brightest over the part of the spectrum that is playing below.
      const middle = vec2(floor(g.x).add(0.5).div(cols), 0.5);
      const along = alongUnder(middle, camera, ridge, int(ridge.u.rows.mul(0.5)));
      const lit = recentLevel(ridge, along, 3).mul(1.1).add(0.22);
      const trailColour = stops[0].mul(trail.mul(0.95)).mul(ink);
      // The head burns white and glows a little beyond its own strokes.
      const headColour = mix(stops[0], vec3(1), 0.8).mul(head.mul(flare.mul(0.8).add(1.6))).mul(ink.add(haze.mul(0.6)));
      return { light: trailColour.add(headColour).mul(lit).mul(strength), amount: trail.add(head).mul(ink).mul(lit).mul(strength) };
    };
    const far = layer(58, 9, 1, 0.4);
    const near = layer(31, 12, 2, 0.95);
    const glow = far.light.add(near.light);
    // By day the code is ink on the page.
    const dark = mix(background.mul(0.8), background, uv.y).add(glow);
    const paper = lift(background, stops[0], near.amount.add(far.amount).mul(0.8), light);
    return {
      colour: mix(dark, paper, light).add(dither()),
      frame: ({ dt, shared }) => {
        const s = shared.signals;
        fall.value += dt * (0.55 + 0.9 * (s.energy?.value ?? 0.5));
        flare.value *= Math.exp(-dt / 0.18);
        if (beatsSeen >= 0 && s.beats.value !== beatsSeen) flare.value = 1;
        beatsSeen = s.beats.value;
      },
      dispose: () => glyphs.dispose(),
    };
  },
};
