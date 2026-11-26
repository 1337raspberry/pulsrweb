// Lights out of focus: soft discs in depth layers, as a city at night is seen through a
// lens focused much nearer. Used for views through a window and as a backdrop of its own.
import { clamp, dot, exp, float, floor, length, mix, mx_noise_float, select, smoothstep, step, vec2, vec3 } from 'three/tsl';
import { hash21, hash22, recentLevel } from './backdrop-kit.js';

// The colours of city light (linear): sodium street lamps, warm white and cool white.
const SODIUM = [1, 0.4, 0.1];
const WARM = [1, 0.78, 0.5];
const COOL = [0.55, 0.7, 1];

// One layer of lights at the centred point `p`. In each cell of a grid `cells` to the
// screen's height a light sits somewhere in the cell, its size up to `radius` cells (at
// most half a cell, so only the four nearest cells need looking at). `focus` runs from 0,
// small bright points, to 1, large soft discs with the faint bright rim real lenses give.
// `present(centre, k, id)` is the chance a light is lit at all and `glow(centre)` how
// brightly, given its centre (centred units), its own number `k` and its cell `id`;
// `colourOf(k)` its colour.
export function bokehLayer(p, { cells, radius, focus, seed, present, glow, colourOf }) {
  const offset = vec2(seed * 13.7, seed * 7.3);
  const g = p.mul(cells).add(offset);
  const base = floor(g.sub(0.5));
  let sum = vec3(0);
  for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const id = base.add(vec2(ox, oy));
    const k = hash21(id.add(seed * 1.7 + 11.3));
    const centre = id.add(hash22(id.add(seed * 3.1)).mul(0.8).add(0.1));
    const size = mix(0.7, 1, hash21(id.add(seed * 2.3 + 5.5))).mul(radius);
    const r = mix(size.mul(0.16), size, focus);
    const d = length(g.sub(centre));
    const edge = mix(0.1, 0.24, focus).mul(r);
    const disc = smoothstep(r.sub(edge), r, d).oneMinus();
    const rim = mix(float(1), mix(0.55, 1, smoothstep(r.mul(0.25), r.mul(0.9), d).pow(2)), focus);
    // The same light spread over a larger disc is fainter at any one point.
    const energy = mix(1.8, 0.55, focus);
    const at = centre.sub(offset).div(cells);
    const lit = step(k, present(at, k, id));
    // Some lights are much brighter than others.
    const strength = mix(0.3, 1.3, hash21(id.add(seed * 5.9 + 31.7)).pow(2));
    sum = sum.add(colourOf(hash21(id.add(seed * 4.1 + 23.4))).mul(disc.mul(rim).mul(energy).mul(lit).mul(strength).mul(glow(at))));
  }
  return sum;
}

// A city at night out of focus. With the lens focused near, every far light spreads into
// a disc of much the same size, so the city is two layers of large discs that overlap,
// lit along streets: whole rows of cells are lit or dark, more of them low down. `focus`
// as for a layer; `glow(centre)` how brightly a light at `centre` shines (0 to about
// 1.5); `stops` the palette's colours, which some of the lights take.
export function cityLights(p, { focus = 1, glow, stops }) {
  const colourOf = (k) => select(k.lessThan(0.34), vec3(...SODIUM),
    select(k.lessThan(0.5), vec3(...WARM),
      select(k.lessThan(0.56), vec3(...COOL),
        select(k.lessThan(0.72), stops[0], select(k.lessThan(0.86), stops[1], stops[2])))));
  const streets = (share, seed) => (at, k, id) => {
    const street = step(hash21(vec2(id.y, seed * 17.1)), mix(0.9, 0.3, smoothstep(-0.32, 0.3, at.y)));
    return float(share).mul(street);
  };
  const layer = (cells, radius, share, seed, strength) =>
    bokehLayer(p, { cells, radius, focus, seed, present: streets(share, seed), glow: (at) => glow(at).mul(strength), colourOf });
  return layer(9, 0.46, 0.62, 1, 0.55).add(layer(5.2, 0.48, 0.42, 2, 0.45));
}

const LUMA = [0.2126, 0.7152, 0.0722];

// The whole view of the city at the centred point `p`: a dark sky over it lit from below
// by a haze of street light, and the lights themselves, each shining with the level of the
// spectrum at its place across the screen (bass to the left, treble to the right, as on
// the ridge). By day (`light` 1) the same lights are trees and buildings blurred into soft
// shapes, darker than a pale sky.
export function cityView(p, { ridge, resolution, background, stops, light }) {
  const aspect = resolution.x.div(resolution.y);
  const span = ridge.u.span;
  const glow = (at) => {
    const across = clamp(at.x.div(aspect).add(0.5), 0, 1);
    return recentLevel(ridge, mix(float(0.5).sub(span.mul(0.5)), float(0.5).add(span.mul(0.5)), across), 3).mul(1.2).add(0.28);
  };
  const lights = cityLights(p, { focus: 1, glow, stops });
  const dusk = mix(mix(background, stops[0], 0.06).mul(0.85), background.mul(0.5), smoothstep(-0.5, 0.5, p.y));
  const streetHaze = mx_noise_float(vec2(p.x.mul(1.3), p.y.mul(5))).mul(0.5).add(0.6);
  const pollution = exp(p.y.add(0.5).mul(-2.6)).mul(0.14).mul(streetHaze);
  const night = dusk.add(mix(stops[1], vec3(1, 0.55, 0.25), 0.55).mul(pollution)).add(lights);
  const shade = clamp(dot(lights, vec3(...LUMA)).mul(1.5), 0, 0.8);
  const day = mix(background, mix(background.mul(0.35), stops[0].mul(0.45), 0.45), shade.mul(0.55)).mul(mix(0.93, 1.02, smoothstep(-0.5, 0.5, p.y)));
  return mix(night, day, light);
}
