// The P7 radar-screen phosphor: a row lights blue-white as it is drawn, then hangs on as a
// long yellow-green afterglow that fades towards the back. A screen's colours, whatever the
// palette; on a light background it is drawn as green ink.
import { exp, max, mix } from 'three/tsl';
import { hex } from '../lib/colour.js';

export default {
  name: 'p7',
  colour: ({ age, t, signals, background, light }) => {
    // The first couple of rows still carry the beam's blue flash, harder on a beat.
    const fresh = exp(age.mul(-40)).mul(signals.beat.mul(0.5).add(0.5));
    const persists = exp(age.mul(-2.5)).mul(t.mul(0.6).add(0.4));
    const glow = mix(mix(background, hex('#1a4d12'), 0.6), hex('#a8ff3e'), persists);
    const lit = mix(glow, hex('#d8ecff'), fresh).mul(max(persists, fresh).mul(0.7).add(0.3));
    const ink = mix(mix(background, hex('#2f7d32'), 0.7), hex('#0b3d0f'), t);
    return mix(lit, ink, light);
  },
};
