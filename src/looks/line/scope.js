// An oscilloscope trace: each row drawn by a glowing beam that leaves more light where it
// moves slowly, so flat stretches glow and the steep sides of peaks go faint and fine, as
// on an analogue scope. A bright spot sweeps along the live row.
import { exp, float, fract, max, min, mix, select, varying } from 'three/tsl';
import { baseHalf, coreAt, glowColour, halo, haloAt, keepBrightest, px, signal } from '../lib/line-kit.js';

export default {
  name: 'scope',
  build: (c) => {
    // How fast the beam crosses this point: the row's length here against the length it
    // would have lying flat. The beam leaves light in inverse proportion.
    const before = max(c.index.sub(1), 0);
    const after = min(c.index.add(1), c.points - 1);
    const flat = (i) => c.place(c.alongAt(i), float(0));
    const drawn = (i) => c.place(c.alongAt(i), c.row.heightAt(i).mul(c.row.rise));
    const slow = flat(after).sub(flat(before)).length().div(drawn(after).sub(drawn(before)).length().max(1e-5)).min(1);
    const beam = varying(slow.pow(0.8).max(0.07));

    // The trace is finer where the beam is fast, and its glow swells with the music.
    const core = baseHalf(c).mul(slow.mul(0.45).add(0.55));
    const reach = px(c, 3).mul(c.row.near.mul(0.5).add(0.5)).mul(signal(c, 'level').mul(0.4).add(0.8));
    const trace = halo(c, { core, reach });
    const tint = mix(c.ground, c.tint, c.fade.mul(beam));
    const glow = haloAt(trace.d, trace.reach).mul(trace.strength).mul(beam.mul(0.6).add(0.4));

    // The spot that writes the live row, sweeping across it again and again.
    const lag = c.along.sub(fract(c.time.mul(0.7)));
    const spot = exp(lag.mul(lag).mul(-2500)).mul(select(c.row.live, float(1), float(0))).mul(c.light.oneMinus());
    return {
      width: trace.width,
      colour: glowColour(c, tint, coreAt(trace.d, trace.core), glow, 1.5).add(spot.mul(coreAt(trace.d, trace.core.mul(1.6))).mul(2)),
      ...keepBrightest(c),
    };
  },
};
