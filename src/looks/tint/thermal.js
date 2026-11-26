// A thermal camera on the music: heat pools where the sound lasts, so held notes glow
// white-hot while quick hits only flare orange. Dark backgrounds show it white-hot, light
// ones black-hot, as thermal cameras offer.
import { clamp, int, min, mix, smoothstep, varying } from 'three/tsl';
import { rampN } from '../lib/colour.js';

export default {
  name: 'thermal',
  colour: ({ row, rowAt, index, level, ridge, background, light, signals }) => {
    // This point's level on its own row counts twice, and on each of the three rows before.
    const older = (back) => rowAt(min(row.k.add(back), int(ridge.capacity))).heightAt(index);
    const pooled = varying(level.mul(2).add(older(1)).add(older(2)).add(older(3)).div(5));
    // Flat ground reads cold but not empty, so the rows still show.
    const heat = clamp(pooled.div(0.5).add(mix(0.07, 0.16, light)).add(signals.beat.mul(0.06)), 0, 1);
    const whiteHot = rampN([background, '#2a0a5e', '#6a0dad', '#c21f7a', '#f0541e', '#ffb21a', '#fff27a', '#ffffff'], heat);
    const blackHot = rampN([background, '#e9b949', '#e0702a', '#c2302a', '#7a1450', '#2b0a3d', '#0a0410'], heat);
    return mix(whiteHot.mul(smoothstep(0.9, 1, heat).mul(0.5).add(1)), blackHot, light);
  },
};
