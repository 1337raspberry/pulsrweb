// Colour helpers for looks, in TSL and in plain JavaScript. OKLab is a colour space in which
// equal steps look equal (its L is lightness, a and b the hue's two axes), so mixes through
// it stay as bright and as coloured as their ends, and a hue can be turned without the
// colour getting lighter or darker. Colours are linear sRGB, three.js's working space.
import { Color } from 'three/webgpu';
import { Fn, clamp, color, cos, dot, length, mix, select, sin, vec3 } from 'three/tsl';

// Linear sRGB to OKLab.
export const toLab = Fn(([c]) => {
  const lms = vec3(
    dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)),
    dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)),
    dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005)),
  ).cbrt();
  return vec3(
    dot(lms, vec3(0.2104542553, 0.793617785, -0.0040720468)),
    dot(lms, vec3(1.9779984951, -2.428592205, 0.4505937099)),
    dot(lms, vec3(0.0259040371, 0.7827717662, -0.808675766)),
  );
});

// OKLab to linear sRGB, kept to what a screen can show.
export const fromLab = Fn(([o]) => {
  const lms = vec3(
    dot(o, vec3(1, 0.3963377774, 0.2158037573)),
    dot(o, vec3(1, -0.1055613458, -0.0638541728)),
    dot(o, vec3(1, -0.0894841775, -1.291485548)),
  ).pow3();
  return clamp(
    vec3(
      dot(lms, vec3(4.0767416621, -3.3077115913, 0.2309699292)),
      dot(lms, vec3(-1.2684380046, 2.6097574011, -0.3413193965)),
      dot(lms, vec3(-0.0041960863, -0.7034186147, 1.707614701)),
    ),
    0,
    1,
  );
});

// `a` to `b` by `t`, through OKLab.
export const mixLab = (a, b, t) => fromLab(mix(toLab(a), toLab(b), t));

// The palette's three stops by `t` (0 to 1), as the height tint runs them, but through OKLab.
export const ramp3 = (stops, t) => {
  const [a, b, c] = stops.map((stop) => toLab(stop));
  return fromLab(select(t.lessThan(0.5), mix(a, b, t.mul(2)), mix(b, c, t.mul(2).sub(1))));
};

// Any number of colours spread evenly over `t` from 0 to 1, by chained mixes. `colours`
// are nodes or hex strings.
export const rampN = (colours, t) => {
  const nodes = colours.map((c) => (typeof c === 'string' ? hex(c) : c));
  const last = nodes.length - 1;
  return nodes.slice(1).reduce((acc, next, i) => mix(acc, next, clamp(t.mul(last).sub(i), 0, 1)), nodes[0]);
};

// A fixed colour from a hex string (sRGB, as palettes are written), as a TSL constant.
export const hex = (text) => color(new Color(text));

// `c` with its colourfulness scaled by `k` (0 grey, 1 as it is), at the same lightness.
export const withChroma = (c, k) => {
  const o = toLab(c);
  return fromLab(vec3(o.x, o.yz.mul(k)));
};

// `c` with its hue turned by `angle` radians, at the same lightness and colourfulness.
export const turnHue = (c, angle) => {
  const o = toLab(c);
  const s = sin(angle);
  const k = cos(angle);
  return fromLab(vec3(o.x, o.y.mul(k).sub(o.z.mul(s)), o.y.mul(s).add(o.z.mul(k))));
};

// How colourful `c` is (OKLab chroma: 0 for a grey, about 0.3 for the most vivid).
export const chromaOf = (c) => length(toLab(c).yz);

// What stands out against the background: near white on a dark one, near black on a light
// one. `light` is the shared context's uniform, 1 on a light background.
export const contrast = (light) => mix(vec3(0.95), vec3(0.03), light);

// The same conversions in plain JavaScript, for colours worked out once a frame. `c` is a
// three.js Color (linear); returns [L, a, b].
export function labOf(c) {
  const l = Math.cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  const m = Math.cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  const s = Math.cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const unit = (x) => Math.min(Math.max(x, 0), 1);

// OKLab [L, a, b] to a three.js Color (linear), written into `out`.
export function colourOfLab([L, A, B], out = new Color()) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return out.setRGB(
    unit(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    unit(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    unit(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
}

// `a` to `b` by `t` through OKLab, for Colors; written into `out`.
export function mixColours(a, b, t, out = new Color()) {
  const p = labOf(a);
  const q = labOf(b);
  return colourOfLab([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t], out);
}
