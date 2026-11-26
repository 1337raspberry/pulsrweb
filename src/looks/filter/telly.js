// An old television: curved glass in a rounded black bezel, scanlines that fatten where the
// picture is bright, a phosphor grille, a slow roll bar, and the picture kinking on the beat.
import { abs, clamp, exp, float, floor, fract, length, max, min, mix, mod, rand, sin, smoothstep, sqrt, step, vec2, vec3, vec4 } from 'three/tsl';
import { barrelUV, vignette } from 'three/addons/tsl/display/CRT.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { luma, signal } from '../lib/filter-kit.js';

export default {
  name: 'telly',
  build: (context) => {
    const { colour, uv, resolution, pixelRatio, time, signals } = context;
    const beat = signal(signals, 'beat');
    const bass = signal(signals, 'bass');
    const treble = signal(signals, 'treble');
    const lines = resolution.y.div(pixelRatio.mul(3));
    const third = float(1).div(lines.mul(3));

    // The set showing a picture read by `read(point)`, at screen point `at`.
    const show = (read, at) => {
      // The glass bulges, and the picture ends at a rounded edge, smoothed over a pixel.
      const glass = barrelUV(float(0.08), at);
      const fromCentre = glass.sub(0.5).mul(resolution);
      const corner = resolution.y.mul(0.06);
      const q = abs(fromCentre).sub(resolution.mul(0.5).sub(corner));
      const outside = length(max(q, vec2(0))).add(min(max(q.x, q.y), 0)).sub(corner);
      const screen = float(1).sub(smoothstep(-1, 1, outside));

      // One scanline every 3 CSS pixels, kept straight across the screen so they line up
      // with its pixels (curved ones beat against them in rings); the picture they show is
      // curved. A band running down the screen kinks sideways when a beat lands, as a set
      // losing its horizontal hold for a moment.
      const row = at.y.mul(lines);
      const band = float(1).sub(smoothstep(0, 0.12, abs(at.y.sub(fract(time.mul(0.35))))));
      const kink = sin(row.mul(0.7).sub(time.mul(30))).mul(beat).mul(band).mul(pixelRatio.mul(5)).div(resolution.x);

      // Each scanline shows its own strip of the picture, so a thin line never falls into
      // the dark gap between two of them.
      const strip = barrelUV(float(0.08), vec2(at.x, floor(row).add(0.5).div(lines)));
      const x = strip.x.add(kink);
      const tap = (dx, dy) => read(vec2(x.add(dx), strip.y.add(dy)));
      let c = tap(0, 0).mul(0.5).add(tap(0, third).mul(0.25)).add(tap(0, third.negate()).mul(0.25));
      // The signal smears to the right, red the most.
      const smear = tap(pixelRatio.mul(-1.5).div(resolution.x), 0);
      c = mix(c, smear, vec3(0.4, 0.25, 0.15));

      // The beam: bright parts of a line spread into the gap, dark parts stay thin.
      const across = fract(row).sub(0.5).mul(2);
      const width = mix(0.35, 0.8, sqrt(clamp(luma(c), 0, 1))).mul(bass.mul(0.25).add(1));
      const beam = exp(across.mul(across).div(width.mul(width)).negate());
      // Red, green and blue phosphor stripes, one device pixel each.
      const stripe = mod(floor(at.x.mul(resolution.x)), 3);
      const grille = vec3(step(stripe, 0.5), step(0.5, stripe).mul(step(stripe, 1.5)), step(1.5, stripe)).mul(0.65).add(0.35);
      // A faint brighter bar rolls slowly down the screen.
      const roll = float(1).add(float(0.06).mul(float(1).sub(smoothstep(0, 0.14, abs(fract(at.y.sub(time.mul(0.05))).sub(0.5))))));
      // A little static, more with the treble.
      const snow = rand(vec2(floor(at.x.mul(resolution.x).div(pixelRatio)), floor(at.y.mul(resolution.y).div(pixelRatio)).add(floor(time.mul(50))))).sub(0.5);

      c = c.mul(beam).mul(grille).mul(roll).mul(2.6).add(snow.mul(treble.mul(0.03).add(0.0035)));
      return vignette(max(c, vec3(0)), 0.3, 0.6, glass).mul(screen);
    };

    // The backdrop is shown by the same set, and a filter after this one is told so.
    const ground = groundOf(context);
    return handOn(vec4(show((p) => colour.sample(p).rgb, uv), 1), (at) => show(ground, at));
  },
};
