// Rows written with a broad-edged pen held at an angle: each stroke swells and thins with
// its direction, thick on the downstrokes and hairline on the upstrokes, like italic
// handwriting. Dark ink on a light background, bright ink on a dark one.
import { cos, max, min, mix, select, sin, vec2, vec3 } from 'three/tsl';
import { baseHalf, px, rowGap, signal, toPixels } from '../lib/line-kit.js';

// The pen's angle, in radians from level.
const ANGLE = 0.72;

export default {
  name: 'nib',
  build: (c) => {
    // Which way the stroke runs on screen at this point.
    const before = max(c.index.sub(1), 0);
    const after = min(c.index.add(1), c.points - 1);
    const drawn = (i) => c.place(c.alongAt(i), c.row.heightAt(i).mul(c.row.rise));
    const span = toPixels(c, drawn(after)).sub(toPixels(c, drawn(before)));
    const dir = select(span.length().lessThan(1e-4), vec2(1, 0), span.normalize());
    // How square-on the stroke runs to the pen's edge: fully across it makes the broadest
    // mark, along it the finest. The pen leans a little with the bass.
    const angle = signal(c, 'bass').mul(0.12).add(ANGLE);
    const broad = dir.x.mul(sin(angle)).sub(dir.y.mul(cos(angle))).abs();
    const pressure = signal(c, 'level').mul(0.35).add(0.85);
    const half = min(baseHalf(c).mul(broad.mul(3.6).add(0.35)).mul(pressure), rowGap(c).mul(0.4)).max(px(c, 0.35));
    // Ink pools a little at the edges of a stroke.
    const pooled = mix(1, 0.78, c.across.abs().pow(3));
    const ink = mix(mix(c.tint, vec3(1), 0.15), mix(c.tint, vec3(0), 0.55).mul(pooled), c.light);
    return {
      width: half.div(baseHalf(c)),
      colour: c.faded(ink),
    };
  },
};
