// Falling code: curtains of glyphs pour down behind the ridge, one behind another far into
// the distance, each column a bright head with a trail fading behind it. They stand in the
// world, so they slide past each other as the camera moves, and a dark polished floor
// mirrors them. Faster as the music fills out and brightest behind the frequencies that are
// playing; the ridge hides whatever falls behind it. On a light background, ink on paper.
import { exp, float, floor, fract, int, mix, pow, screenUV, step, uniform, vec2, vec3 } from 'three/tsl';
import { CHARACTERS, canDraw, createGlyphs } from '../lib/glyphs.js';
import { rayThrough } from '../lib/camera.js';
import { dither, hash11, hash21, lift, recentLevel } from '../lib/backdrop-kit.js';

// A glyph's cell is this wide for its height, and this tall in the world.
const CELL = 0.66;
const GLYPH = 1.15;
// The curtains: how far back each hangs (world z; the ridge ends at about -20), and how
// brightly it is drawn. The same size in the world, so the far ones are small and slow.
const CURTAINS = [[-26, 1], [-40, 0.72], [-62, 0.5], [-98, 0.36], [-155, 0.26]];
// Share of a curtain's columns that carry code, leaving gaps to see the next one through.
const FILLED = 0.72;
// How brightly the floor mirrors the code, and the depth (world units) its image fades over.
const MIRROR = 0.45;
const MIRROR_REACH = 9;

export default {
  name: 'glyphfall',
  build: ({ uv, background, stops, light, ridge, camera, time }) => {
    // Half-width katakana where the system's fonts have them, as in the films; letters
    // and figures otherwise.
    const set = (canDraw('ｱ') ? CHARACTERS.katakana : 'ABCDEFGHJKLMNPQRSTUVWXYZ') + CHARACTERS.digits + ':.=*+<>|';
    const glyphs = createGlyphs(set, { mirror: true, weight: 600, scale: 0.9 });
    // How far the code has fallen: seconds that run faster when the music is fuller.
    const fall = uniform(0);
    // Every head flares on a beat.
    const flare = uniform(0);
    let beatsSeen = -1;

    const eye = camera.position;
    const ray = rayThrough(uv, camera);
    // The depth the ridge's middle row stands at, to line the code up with the spectrum.
    const ridgeZ = ridge.rowAt(int(ridge.u.rows.mul(0.5))).z;

    // One curtain: an upright sheet of glyphs across the world at depth `z`, falling
    // `speed` glyphs a second, drawn `strength` bright.
    const curtain = (z, speed, seed, strength) => {
      // Where this pixel's line of sight meets the sheet. Below the floor it meets the
      // sheet's mirror image instead.
      const reach = float(z).sub(eye.z).div(ray.z.min(-1e-4));
      const hit = eye.add(ray.mul(reach));
      const up = hit.y.abs();
      const mirrored = hit.y.lessThan(0);
      const g = vec2(hit.x.div(GLYPH * CELL), up.div(GLYPH));
      const column = floor(g.x);
      const col = column.add(seed * 1000);
      // Rows are counted downwards, the way the code falls.
      const row = floor(g.y).negate();
      const k = hash11(col);
      const trailLength = mix(8, 26, hash11(col.add(0.37)));
      const period = trailLength.add(mix(16, 40, hash11(col.add(0.59))));
      // Two drops to a column, at their own places in its turn, coming round again and
      // again: how many rows this glyph is behind the nearest head above it.
      const behindHead = (offset) => fract(hash11(col.add(offset)).add(fall.mul(speed).mul(mix(0.6, 1.45, k)).sub(row).div(period))).mul(period);
      const behindA = behindHead(0.71);
      const behindB = behindHead(0.23);
      const trailOf = (behind) => pow(behind.div(trailLength).oneMinus().max(0), 1.7);
      const trail = trailOf(behindA).max(trailOf(behindB));
      const headOf = (behind) => exp(behind.mul(behind).mul(-1.2));
      const head = headOf(behindA).max(headOf(behindB));

      // Each glyph changes now and then, some much more often than others.
      const cell = vec2(col, row);
      const rate = mix(0.15, 3, pow(hash21(cell.add(seed * 3.7)), 3));
      const turn = floor(time.mul(rate).add(hash21(cell.add(5.1)).mul(10)));
      const index = floor(hash21(vec2(col.add(turn.mul(13.1)), row.add(seed))).mul(glyphs.count));
      const ink = glyphs.sample(index, g);
      const haze = glyphs.blurred(index, g, 3.5);

      // Brightest in line with the part of the spectrum that is playing, as the eye sees
      // the column against the ridge.
      const middle = column.add(0.5).mul(GLYPH * CELL);
      const inLine = eye.x.add(middle.sub(eye.x).mul(ridgeZ.sub(eye.z)).div(float(z).sub(eye.z)));
      const lit = recentLevel(ridge, inLine.div(ridge.WIDTH).add(0.5), 3).mul(1.1).add(0.22);
      // Nothing where the sheet is behind the eye, and in only some of the columns; the
      // floor's image is dimmer and sinks away.
      const there = step(ray.z, -1e-3).mul(step(hash11(col.add(0.91)), FILLED));
      const seen = mirrored.select(exp(up.div(-MIRROR_REACH)).mul(MIRROR), float(1)).mul(there).mul(lit).mul(strength);
      const trailColour = stops[0].mul(trail.mul(0.95)).mul(ink);
      // The head burns white and glows a little beyond its own strokes.
      const headColour = mix(stops[0], vec3(1), 0.8).mul(head.mul(flare.mul(0.8).add(1.6))).mul(ink.add(haze.mul(0.6)));
      return { light: trailColour.add(headColour).mul(seen), amount: trail.add(head).mul(ink).mul(seen) };
    };
    const curtains = CURTAINS.map(([z, strength], i) => curtain(z, 11, i + 1, strength));
    const glow = curtains.map((c) => c.light).reduce((a, b) => a.add(b));
    const amount = curtains.map((c) => c.amount).reduce((a, b) => a.add(b));
    // The empty dark the code falls through, a little lighter towards the top. By day the
    // code is ink on the page.
    const empty = (height) => mix(mix(background.mul(0.8), background, height), background, light);
    const dark = empty(uv.y).add(glow);
    const paper = lift(background, stops[0], amount.mul(0.8), light);
    return {
      colour: mix(dark, paper, light).add(dither()),
      // The ridge's curtains are painted as the empty dark, so the code is hidden behind them.
      veil: () => empty(screenUV.y.oneMinus()),
      solid: true,
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
