// The colours drift through every entry of the chosen palette that shares its background,
// an entry every 16 beats and another every 45 seconds besides, so they move even without
// a beat; each row keeps the mix it was born with, so each change flows back through the stack.
import { Color } from 'three/webgpu';
import { floor, fract, int, smoothstep, uniform, uniformArray, varying } from 'three/tsl';
import { mixLab, ramp3 } from '../lib/colour.js';

const MOST = 16;
const BEATS_PER_ENTRY = 16;
const SECONDS_PER_ENTRY = 45;
// The entries' stops, three to an entry, and how many entries there are.
const entries = uniformArray(Array.from({ length: MOST * 3 }, () => new Color()), 'color');
const count = uniform(1);
let listed = null;

export default {
  name: 'chameleon',
  frame({ palette, gradient }) {
    if (listed === gradient) return;
    listed = gradient;
    // Entries that share the background, starting with the chosen one; entries of a single
    // colour are left out when there are others.
    const same = palette.gradients.filter((g) => g.background === gradient.background);
    const coloured = same.filter((g) => new Set(g.stops).size > 1);
    const list = coloured.length > 1 ? coloured : same;
    const start = Math.max(list.indexOf(gradient), 0);
    const order = [...list.slice(start), ...list.slice(0, start)].slice(0, MOST);
    order.forEach((g, i) => g.stops.forEach((hex, s) => entries.array[i * 3 + s].set(hex)));
    count.value = order.length;
  },
  colour: ({ row, t, u }) => {
    const at = varying(row.born.beats.div(BEATS_PER_ENTRY).add(row.serial.div(u.speed.mul(SECONDS_PER_ENTRY))));
    const step = floor(at);
    const stopsOf = (entry) => [0, 1, 2].map((s) => entries.element(int(entry.mod(count)).mul(3).add(s)));
    return mixLab(ramp3(stopsOf(step), t), ramp3(stopsOf(step.add(1)), t), smoothstep(0.2, 0.8, fract(at)));
  },
};
