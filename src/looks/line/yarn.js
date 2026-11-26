// Strands of wool yarn: two plies twisted round each other in two tones of the row's
// colour, softly shaded like a round strand, a little thick and thin, with a halo of stray
// fibres. It reads best chunky (a line width of 3 or more).
import { min, mix, mx_noise_float, sin, smoothstep, varying, vec2, vec3 } from 'three/tsl';
import { rowLengths, steadySpacing } from '../lib/line-arc.js';
import { baseHalf, px, rowGap, seedOf, signal, smoothLift } from '../lib/line-kit.js';

// The stroke is this much wider than the strand, room for its fuzz.
const FUZZ_ROOM = 1.5;
// One twist of a ply about every this many line widths along the strand.
const TWIST = 2.8;

export default {
  name: 'yarn',
  build: (c) => {
    const lengths = rowLengths(c);
    const steady = steadySpacing(c, TWIST);
    // The strand's radius in device pixels, kept under half the gap to the next row.
    const thick = min(baseHalf(c).mul(2.3), rowGap(c).mul(0.42)).max(px(c, 1.2));
    const radius = varying(thick);
    const s = varying(lengths.at(c.index));
    const perUnit = varying(lengths.onScreen());
    const seed = seedOf(c.row);

    // Across the strand: -1 to 1 over the yarn itself, beyond that only fuzz.
    const a = c.across.mul(FUZZ_ROOM);
    const turns = s.div(steady.spacing);
    // The plies lean at about forty degrees, not quite evenly, as spun by hand.
    const lean = radius.mul(0.85).div(perUnit.mul(steady.spacing).max(1e-3));
    const wobble = mx_noise_float(vec2(turns.mul(0.3), seed)).mul(0.3);
    const twist = turns.add(a.mul(lean)).add(wobble).mul(2);
    const ply = twist.floor().mod(2);
    const bump = sin(twist.fract().mul(Math.PI));

    // Thick and thin along the strand.
    const lump = mx_noise_float(vec2(turns.mul(0.42), seed.add(17))).mul(0.12).add(0.9);
    const body = a.abs().div(lump).min(1);
    // Soft round shading, lit a little from above, each ply a low rounded ridge.
    const round = body.mul(body).oneMinus().max(0).sqrt();
    const shade = round.mul(0.45).add(0.55).mul(bump.mul(0.3).add(0.7)).mul(a.mul(0.08).add(1));
    // Fibres run along each ply.
    const fibres = mx_noise_float(vec2(twist.mul(13), a.mul(3).add(seed))).mul(0.14);
    const heather = mix(c.tint, mix(c.tint, c.stops[1], 0.55), ply.mul(0.45));
    const wool = heather.mul(shade.add(fibres));

    // The halo of stray fibres, fuller where the sound is bright.
    const fuzz = signal(c, 'treble').mul(0.4).add(0.8);
    const solid = smoothstep(lump.sub(0.12), lump, a.abs()).oneMinus();
    const hairs = mx_noise_float(vec2(turns.mul(36), a.mul(3.2).add(seed.mul(0.37)))).mul(0.5).add(0.5);
    const halo = smoothstep(lump, 1.45, a.abs()).oneMinus();
    const strays = halo.mul(smoothstep(0.5, 0.78, hairs)).mul(fuzz);
    // Where only fuzz covers the pixel it is paler, catching the light.
    const loose = smoothstep(0.75, 1.05, body.mul(lump).max(a.abs().sub(0.1)));
    const colour = mix(wool, mix(heather, mix(c.ground, vec3(1), 0.3), 0.3), loose);
    return {
      lift: smoothLift(c),
      width: thick.mul(FUZZ_ROOM).div(baseHalf(c)),
      colour: c.faded(colour),
      opacity: solid.max(strays),
      transparent: false,
      alphaToCoverage: true,
      extras: [lengths.extra, steady.extra],
    };
  },
};
