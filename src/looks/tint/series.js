// Each row a series of a chart, in a flat colour of its own. The live row is always the
// first series, in the palette's first colour; a row cut from it takes the next of the
// other five (the palette's second and third colours, then all three paler) and keeps it as
// it travels back, so no colour changes under the eye.
import { length, mix, round, select, varying } from 'three/tsl';
import { PALER, SERIES } from '../lib/chartbox.js';

export default {
  name: 'series',
  colour: ({ row, stops, background }) => {
    const n = select(row.live, 0, round(row.serial).mod(SERIES - 1).add(1));
    const pick = n.mod(3);
    const stop = select(pick.lessThan(0.5), stops[0], select(pick.lessThan(1.5), stops[1], stops[2]));
    // A palette of one colour gives six strengths of it instead.
    const plain = length(stops[0].sub(stops[2])).lessThan(0.02);
    const paler = select(plain, n.mul(0.13), select(n.greaterThan(2.5), PALER, 0));
    return varying(mix(stop, background, paler));
  },
};
