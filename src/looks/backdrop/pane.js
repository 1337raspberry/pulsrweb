// Rain on a window at night: behind the ridge, a pane of glass with drops clinging and
// running down it, over the lights of a city far out of focus. Each drop holds a small,
// sharper, upside-down picture of the lights, as real drops do. On a light background, an
// overcast day.
import { abs, clamp, float, length, max, mix, mx_noise_float, rtt, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import { centred, dither, follow, release, uncentred } from '../lib/backdrop-kit.js';
import { cityView } from '../lib/bokeh.js';
import { raindrops } from '../lib/raindrops.js';

export default {
  name: 'pane',
  build: ({ uv, background, stops, light, resolution, ridge, time }) => {
    // How far the running drops have run, and how wet the glass is.
    const slide = uniform(0);
    const rain = uniform(0.5);
    let beatsSeen = -1;
    const p = centred(uv, resolution);
    const aspect = resolution.x.div(resolution.y);

    // The city out there, its lights following the music across the window. The view is
    // soft, so it is drawn at a fraction of the screen's resolution.
    const view = rtt(cityView(p, { ridge, resolution, background, stops, light }), null, null, { resolutionScale: 0.4 });
    const behind = view.sample(uv);

    // The glass is misted over, thickest low down: the view through it paler and softer.
    // Wherever a drop has run, the mist is wiped away.
    const drops = raindrops(p, { time, slide, rain });
    const breath = mx_noise_float(vec3(p.x.mul(1.8), p.y.mul(2.6), time.mul(0.01))).mul(0.5).add(0.5);
    // By night the mist glows with whatever light is behind it; by day it is a pale veil.
    const mist = smoothstep(-0.5, 0.45, p.y).oneMinus().mul(mix(0.3, 0.36, light)).add(mix(0.08, 0.16, light))
      .mul(breath.mul(0.6).add(0.4)).mul(drops.trail.oneMinus());
    const veiling = mix(mix(background, stops[1], 0.12).add(behind.mul(0.5)), mix(background, stops[1], 0.15).mul(1.03).add(behind.mul(0.4)), light);
    const fogged = mix(behind, veiling, 0.55);
    let colour = mix(behind, fogged, clamp(mist, 0, 0.75));

    // A drop is clear: inside it the view is turned upside down and taken in wider, the
    // lights gathered into sharper points, with a thin dark edge, the lit view below
    // caught along its lower rim, and a glint.
    const wider = float(0.2).div(drops.radius.max(0.002));
    const seen = view.sample(uncentred(drops.centre.sub(p.sub(drops.centre).mul(wider)), resolution));
    const sharp = mix(seen.mul(seen).mul(1.6).add(seen.mul(0.7)), seen.mul(1.03), light);
    const r = length(drops.local);
    const edge = smoothstep(0.7, 1, r);
    const lowerRim = smoothstep(0.55, 0.95, r).mul(smoothstep(-0.7, 0.1, drops.local.y).oneMinus());
    const glint = smoothstep(0, 0.22, length(drops.local.sub(vec2(-0.3, 0.42)))).oneMinus();
    const inDrop = sharp.mul(edge.mul(mix(0.28, 0.3, light)).oneMinus())
      .add(behind.mul(lowerRim).mul(mix(0.9, 0.2, light))).add(vec3(glint.mul(0.22)));
    colour = mix(colour, inDrop, drops.mask);

    // The window's frame: a mullion and a transom, dark against the night, pale by day.
    const bar = (d, width) => smoothstep(width * 0.4, width, abs(d)).oneMinus();
    const frame = max(bar(p.x.sub(aspect.mul(0.31)), 0.013), bar(p.y.sub(0.33), 0.011));
    colour = mix(colour, mix(behind.mul(0.3), background.mul(0.92), light), frame.mul(0.55));

    return {
      colour: max(colour, 0).add(dither()),
      frame: ({ dt, shared }) => {
        const s = shared.signals;
        rain.value = follow(rain.value, 0.3 + 0.7 * (s.energy?.value ?? 0.5), dt, 4);
        let run = dt * (0.11 + 0.3 * s.bass.value);
        // The running drops lurch on each beat.
        if (beatsSeen >= 0 && s.beats.value !== beatsSeen) run += 0.05;
        beatsSeen = s.beats.value;
        slide.value += run;
      },
      dispose: () => release(behind),
    };
  },
};
