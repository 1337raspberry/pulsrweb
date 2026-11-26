// Watching the music through a window in the rain: the glass is fogged, drops cling and
// run down it, each a little lens showing the picture upside down, and every running drop
// wipes a clear streak through the fog that mists over again behind it.
import { dot, exp, float, length, max, mix, smoothstep, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { runningDrops, stillDrops } from '../lib/filter-rain.js';

// Layer sizes: how many cell widths fit down the screen.
const BIG = 5;
const SMALL = 9;
const FINE = 28;

export default {
  name: 'windowpane',
  build: (context) => {
    const { colour, uv, resolution, background, light } = context;
    // The rain's own clock, which a beat pushes on, and how hard it is raining.
    const rain = uniform(0);
    const heavy = uniform(0.5);
    const aspect = resolution.x.div(resolution.y);
    const pane = vec2(uv.x.mul(aspect), uv.y);
    const big = runningDrops(pane.mul(BIG), rain, 1, 2.6, { size: [0.085, 0.15], amount: 0.8 });
    const small = runningDrops(pane.mul(SMALL), rain.mul(1.25), 2, 2.2, { size: [0.065, 0.125], amount: 0.6 });
    const fine = stillDrops(pane.mul(FINE), rain, 3);
    // Layer units back to the picture's uv.
    const back = (v, scale) => vec2(v.x.div(aspect), v.y).div(scale);
    const lens = back(big.to, BIG).add(back(small.to, SMALL).mul(heavy)).add(back(fine.to, FINE));
    const clear = max(max(big.clear, small.clear.mul(heavy)), fine.clear);

    // Through the water the picture is sharp, flipped and shrunk, as a drop sees it.
    const sharp = colour.sample(uv.sub(lens.mul(2.6))).rgb;
    // Elsewhere the fog: the picture softened and veiled. Fog is never quite opaque, and
    // thin dark lines on a light pane would blur away to nothing, so a little of the sharp
    // picture shows through it, more on a light pane.
    const blurred = gaussianBlur(colour, 1, 4, { resolutionScale: 0.5 });
    const fogged = mix(blurred.getTextureNode().sample(uv.add(lens.mul(0.3))).rgb, colour.rgb, mix(0.12, 0.35, light));
    const veil = mix(background.mul(1.3).add(0.03), background.mul(1.03).add(0.02), light);
    const mist = mix(0.24, 0.2, light);
    const misted = mix(fogged, veil, mist);
    let c = mix(misted, sharp, clear);

    // A drop gathers the light round it into a bright crescent at its foot, darkens at its
    // very edge, and shows a small sharp glint near its top.
    const shade = (layer, weight) => {
      const r = length(layer.rel);
      const drop = layer.drop.mul(weight);
      const crescent = drop.mul(smoothstep(0.1, 0.75, layer.rel.y)).mul(float(1).sub(smoothstep(0.7, 0.95, r)));
      const rim = drop.mul(smoothstep(0.75, 1, r));
      const g = layer.rel.sub(vec2(-0.3, -0.45));
      const glint = drop.mul(exp(dot(g, g).mul(-110)));
      return { crescent, rim, glint };
    };
    const a = shade(big, float(1));
    const b = shade(small, heavy);
    const f = shade(fine, float(0.3));
    const crescent = max(a.crescent, b.crescent);
    const rim = max(a.rim, b.rim);
    const glint = max(max(a.glint, b.glint), f.glint);
    c = c.add(misted.mul(crescent).mul(mix(0.9, 0.12, light))).mul(float(1).sub(rim.mul(mix(0.25, 0.2, light))));
    c = c.add(vec3(glint.mul(mix(0.55, 0.3, light))));

    let level = 0;
    function frame({ dt, shared }) {
      const signals = shared.signals;
      const loud = signals.level?.value ?? 0;
      const hit = signals.hit?.value ?? signals.beat?.value ?? 0;
      level += (loud - level) * (1 - Math.exp(-dt / 0.8));
      rain.value += dt * (0.5 + 0.5 * level + 2 * hit);
      heavy.value = 0.45 + 0.55 * level;
    }

    // A filter after this one sees the backdrop through the same mist (the drops aside,
    // which are small and few).
    const ground = groundOf(context);
    const output = handOn(vec4(c, 1), (at) => mix(ground(at), veil, mist));
    return { output, frame, dispose: () => blurred.dispose() };
  },
};
