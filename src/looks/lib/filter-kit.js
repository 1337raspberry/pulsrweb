// Small helpers the filters share: sound signals that may not be measured yet, telling when
// a beat has just landed, how far a colour stands out from the background, the palette's gradient, display-space colour,
// antialiased edges, a soft shoulder for colours above 1, and an ordered-dither matrix.
import { clamp, dot, exp, float, floor, fract, length, max, mix, smoothstep, sRGBTransferEOTF, sRGBTransferOETF, step, vec2, vec3 } from 'three/tsl';

// The signal called `name`, or a constant 0 where the sound does not provide it.
export const signal = (signals, name) => signals?.[name] ?? float(0);

// For a filter's per-frame code: a function that, called once a frame with the signals,
// says whether the onset signal `name` ('beat' or 'hit') has just fired. A firing lifts the
// signal to between 0.6 and 1 from wherever its decay had left it, whatever its strength.
export function onsetOf(name) {
  let last = 0;
  return (signals) => {
    const now = signals?.[name]?.value ?? 0;
    const fired = now >= 0.6 && now > last + 0.1;
    last = now;
    return fired;
  };
}

// How far a colour stands out from what is behind it: 0 where it matches, 1 as far as the
// palette's furthest line colour is from the background. What is behind is the background
// unless another colour is given (the ground at that point, say). It reads the same on
// light and dark palettes, where luminance would not.
export function standoutOf(background, stops) {
  const reach = max(max(length(stops[0].sub(background)), length(stops[1].sub(background))), length(stops[2].sub(background))).max(0.02);
  return (rgb, behind = background) => clamp(length(rgb.sub(behind)).div(reach), 0, 1);
}

// A colour brought back to full strength: a far row drawn faded towards what is behind it
// (the background unless another colour is given) comes back to the colour it was before
// it faded.
export function fullHueOf(background, stops) {
  const standout = standoutOf(background, stops);
  return (rgb, behind = background) => clamp(behind.add(rgb.sub(behind).div(standout(rgb, behind).max(0.05))), 0, 1);
}

// How hot a colour is: how far it has climbed from the first stop towards the last (so the
// crests of a ridge tinted by height are hottest), times how strongly it is drawn, with
// colour above 1 hotter still. A palette whose stops are all one colour makes every line
// as hot as it is strong.
export function heatOf(background, stops) {
  const standout = standoutOf(background, stops);
  const span = stops[2].sub(stops[0]);
  const spread = dot(span, span);
  return (rgb) => {
    const along = clamp(dot(rgb.sub(stops[0]), span).div(spread.max(1e-4)), 0, 1);
    const climbed = spread.greaterThan(0.002).select(along, float(1));
    const over = clamp(max(max(rgb.r, rgb.g), rgb.b).sub(1), 0, 1);
    return clamp(climbed.mul(standout(rgb)).add(over), 0, 1);
  };
}

// The palette's three stops as one gradient, 0 to 1, in the same two halves the lines use.
export const rampOf = (stops) => (t) => mix(mix(stops[0], stops[1], clamp(t.mul(2), 0, 1)), stops[2], clamp(t.mul(2).sub(1), 0, 1));

// Linear colour to display (sRGB-encoded) values and back, for steps and thresholds that
// should look even to the eye.
export const toDisplay = (rgb) => sRGBTransferOETF(max(rgb, vec3(0)));
export const toLinear = (rgb) => sRGBTransferEOTF(max(rgb, vec3(0)));

// 1 inside radius `r`, 0 outside, over a soft edge `soft` wide (all in the same units).
export const inside = (d, r, soft) => float(1).sub(smoothstep(r.sub(soft), r.add(soft), d));

// Leaves colours below `knee` alone and eases those above it towards 1, so a bright glow
// does not clip into flat white.
export function shoulder(rgb, knee = 0.8) {
  const k = float(knee);
  const over = max(rgb.sub(k), vec3(0));
  const eased = k.add(float(1).sub(k).mul(float(1).sub(exp(over.div(float(1).sub(k)).negate()))));
  return mix(rgb, vec3(eased), step(k, rgb));
}

// The 8 by 8 Bayer matrix as a threshold in [0, 1) for the integer cell `p`: the classic
// ordered-dither pattern, worked out with floats only.
const bayer2 = (p) => fract(dot(floor(p), vec2(0.5, floor(p.y).mul(0.75))));
const bayer4 = (p) => bayer2(p.mul(0.5)).mul(0.25).add(bayer2(p));
export const bayer8 = (p) => bayer4(p.mul(0.5)).mul(0.25).add(bayer2(p));

// Luminance of a linear colour (Rec. 709 weights, as three's own `luminance`).
export const luma = (rgb) => dot(rgb, vec3(0.2126, 0.7152, 0.0722));
