// Every beat starts a new colour and each row keeps the colour it was born in, so the stack
// becomes a measure of the rhythm: one band of rows per beat, travelling with the rows, each
// band melting into the next over the rows where they meet.
import { clamp, int, length, mix, round, select, varying, vec3 } from 'three/tsl';

// Weights for a row and the three taps either side of it.
const BLUR = [1, 6, 15, 20, 15, 6, 1];
// Rows between one tap and the next, for each row a second the ridge cuts: the faster rows
// are cut, the more of them a beat's band holds, and the wider the bands can blend.
const TAP_ROWS = 0.066;

export default {
  name: 'onetwo',
  colour: ({ row, rowAt, t, u, ridge, stops, background, light }) => {
    // A palette of one colour still shows the beats: every other band is dimmer.
    const plain = length(stops[0].sub(stops[2])).lessThan(0.02);
    // The colour of a band, from the beats counted when its rows were cut.
    const bandOf = (count) => {
      const pick = count.mod(3);
      const stop = select(pick.lessThan(0.5), stops[0], select(pick.lessThan(1.5), stops[1], stops[2]));
      return mix(background, stop, select(plain.and(count.mod(2).greaterThan(0.5)), 0.45, 1));
    };
    // A row's own band blurred with its neighbours', so a new beat's colour comes in over
    // several rows rather than at a hard edge. Each row keeps its marks as it travels, so
    // the blend travels with it.
    const tap = u.speed.mul(TAP_ROWS);
    let sum = vec3(0);
    BLUR.forEach((weight, j) => {
      const k = clamp(row.k.add(int(round(tap.mul(j - 3)))), 0, ridge.capacity);
      sum = sum.add(bandOf(rowAt(k).born.beats).mul(weight / 64));
    });
    const band = varying(sum);
    return mix(mix(background, band, mix(0.45, 0.8, light)), band, t.pow(0.6));
  },
};
