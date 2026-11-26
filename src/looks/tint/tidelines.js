// Each row keeps the colour of what was loudest when it was born, the bass in the first
// stop, the middle in the second and the treble in the third, so the stack reads as a
// history of the music's balance over the last few seconds.
import { mix, varying, vec3 } from 'three/tsl';
import { fromLab, toLab } from '../lib/colour.js';

export default {
  name: 'tidelines',
  colour: ({ row, t, stops, background, light }) => {
    // Each range against its own recent loudest, as the row was cut, cubed so the one most
    // up has the most say.
    const say = vec3(varying(row.born.bass), varying(row.born.mid), varying(row.born.treble)).pow(vec3(3)).add(0.001);
    const [low, middle, high] = stops.map((stop) => toLab(stop));
    const hue = fromLab(low.mul(say.x).add(middle.mul(say.y)).add(high.mul(say.z)).div(say.x.add(say.y).add(say.z)));
    // Rows born loud stand out; quiet ones sink back.
    const strength = varying(row.born.level).mul(0.5).add(0.5);
    return mix(background, mix(mix(background, hue, mix(0.45, 0.8, light)), hue, t.pow(0.6)), strength);
  },
};
