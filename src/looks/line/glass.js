// Rows as sheets of edge-lit glass: each curtain is a clear pane, faintly tinted, that dims
// whatever is behind it, so the hidden parts of the rows behind show through, fainter for
// every pane in between. Light caught in the sheet brightens it towards its top edge, and
// the edge itself glows.
import { exp, mix, screenUV, sin, smoothstep, vec2, vec3 } from 'three/tsl';
import { signal } from '../lib/line-kit.js';

// How much light one pane takes from what is behind it.
const DIMS = 0.2;

export default {
  name: 'glass',
  build: (c) => {
    // Light caught in the sheet fades with the distance down from its top edge (in levels,
    // so it is the same on a tall pane and a short one).
    const caught = exp(c.up.oneMinus().mul(c.height).div(0.12).negate());
    // A slow glint sweeping across the glass.
    const glint = smoothstep(0.9, 1, sin(screenUV.dot(vec2(7, 4)).add(c.time.mul(0.35)))).mul(0.12);
    const body = mix(c.ground, c.tint, 0.22);
    const lit = mix(mix(c.tint, vec3(1), 0.35), mix(c.tint, vec3(0), 0.25), c.light);
    const pane = mix(body, lit, caught.mul(0.7)).add(glint.mul(c.light.oneMinus()));
    const edge = mix(mix(c.tint, vec3(1), 0.45).mul(signal(c, 'level').mul(0.4).add(1.3)), mix(c.tint, vec3(0), 0.3), c.light);
    return {
      colour: c.faded(edge),
      curtain: {
        colour: pane,
        opacity: c.fade.mul(caught.mul(0.45).add(DIMS)).add(glint),
        transparent: true,
        depthWrite: false,
      },
    };
  },
};
