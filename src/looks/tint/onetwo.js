// Every beat starts a new colour and each row keeps the colour it was born in, so the stack
// becomes a measure of the rhythm: one band of rows per beat, receding with the rows.
import { length, mix, select, varying } from 'three/tsl';

export default {
  name: 'onetwo',
  colour: ({ row, t, stops, background, light }) => {
    // The beats counted when the row was cut, which it keeps as it goes back.
    const count = varying(row.born.beats);
    const pick = count.mod(3);
    const stop = select(pick.lessThan(0.5), stops[0], select(pick.lessThan(1.5), stops[1], stops[2]));
    // A palette of one colour still shows the beats: every other band is dimmer.
    const plain = length(stops[0].sub(stops[2])).lessThan(0.02);
    const band = mix(background, stop, select(plain.and(count.mod(2).greaterThan(0.5)), 0.45, 1));
    return mix(mix(background, band, mix(0.45, 0.8, light)), band, t.pow(0.6));
  },
};
