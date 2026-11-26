// Each peak lit from one side by the slope of its line: flanks that face the light glow and
// the others fall into shadow, so the ridge looks carved, like an etched relief map. The
// light comes from the bass side when the music is dark and swings over as it brightens.
import { atan, clamp, cos, float, max, min, mix, varying } from 'three/tsl';
import { contrast, ramp3 } from '../lib/colour.js';

export default {
  name: 'relief',
  colour: ({ row, index, points, t, stops, background, light, signals, WIDTH }) => {
    // The line's slope in the world, over two points either side, as an angle.
    const before = row.heightAt(max(index.sub(2), 0));
    const after = row.heightAt(min(index.add(2), points - 1));
    const slope = varying(atan(after.sub(before).mul(row.rise), float((4 * WIDTH) / (points - 1))));
    // The light's angle from straight up, positive from the bass side.
    const sun = signals.centroid.sub(0.45).mul(-1.5).add(0.9);
    const lit = clamp(cos(slope.sub(sun)), 0, 1).pow(1.5);
    const hue = ramp3(stops, t);
    // Dark background: the lit side towards white, the shadow towards the background. Light
    // background: the lit side towards the paper, the shadow towards ink.
    const bright = mix(hue, mix(contrast(light), background, light), 0.5);
    const shade = mix(hue, mix(background, contrast(light), light), 0.75);
    return mix(shade, bright, lit);
  },
};
