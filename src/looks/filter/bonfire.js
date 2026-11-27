// The picture on fire: the ridge's lines are the fuel, and flames lick up off every one of
// them, flickering and breaking into tongues, cooling as they climb from white-hot through
// the palette's colours, highest first, to nothing. Louder music feeds taller flames and a
// beat fans them. On a light background, smoke and ink curl up off the lines instead.
import { float, max, mix, mx_noise_float, smoothstep, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { feedback } from '../lib/filter-feedback.js';
import { groundOf } from '../lib/filter-ground.js';
import { shoulder, standoutOf } from '../lib/filter-kit.js';

// The heat is kept at half the canvas's size: flames are soft, and it halves the cost.
const SCALE = 0.5;
// How fast the flames rise, in screen heights a second, quiet and loud; and how much heat a
// flame loses a second, quiet and loud (a line burns at about 1).
const RISE = [0.2, 0.32];
const COOL = [1.7, 0.75];

export default {
  name: 'bonfire',
  build: (context) => {
    const { colour, uv, resolution, background, stops, light, time } = context;
    const standout = standoutOf(background, stops);
    const ground = groundOf(context);
    // Set each frame: how far this frame's heat moves up (uv), how far the flames have risen
    // in all (screen heights, for the noise that rides up with them), the heat lost a
    // second, how hard a line burns, and how hard the last beat fanned the fire.
    const rise = uniform(0);
    const climbed = uniform(0);
    const cool = uniform(COOL[0]);
    const burn = uniform(0.9);
    const fan = uniform(0);
    const step60 = uniform(1);

    const aspect = resolution.x.div(resolution.y);
    const texel = vec2(1).div(resolution.mul(SCALE));

    const memory = feedback(({ previous, uv: at, fresh }) => {
      // Noise that rides up with the flames, so each tongue keeps its shape as it climbs.
      const q = vec2(at.x.mul(aspect), at.y.add(climbed));
      // The heat here is what was a little below a moment ago, swaying side to side.
      const sway = mx_noise_float(vec3(q.mul(vec2(4, 2.5)), time.mul(0.5))).mul(fan.mul(2).add(1.2));
      const from = at.add(vec2(sway.mul(texel.x).mul(step60), rise));
      const old = previous.sample(from).r;
      // Each column of flame cools at its own rate, which breaks the fire into tongues of
      // different heights; a finer noise frays their edges.
      const broad = mx_noise_float(vec3(q.mul(vec2(8, 3)), time.mul(0.9))).mul(0.5).add(0.5);
      const fine = mx_noise_float(vec3(q.mul(vec2(23, 8)), time.mul(1.8))).mul(0.5).add(0.5);
      const rate = mix(0.15, 3.4, broad.mul(0.65).add(fine.mul(0.35)).clamp(0, 1).pow(1.4));
      const lost = cool.mul(rate).mul(fan.mul(-0.45).add(1)).mul(step60).div(60);
      const kept = old.sub(lost).max(0);
      // Fresh heat from the lines in this texel: four taps cover the canvas pixels under it.
      let fuel = float(0);
      for (const [dx, dy] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
        const p = at.add(texel.mul(vec2(dx, dy)));
        fuel = max(fuel, standout(colour.sample(p).rgb, ground(p)));
      }
      // A line burns unevenly, hot spots running along it and flickering.
      const flicker = mx_noise_float(vec3(at.x.mul(aspect).mul(30), at.y.mul(30), time.mul(4))).mul(0.5).add(0.5);
      const lit = smoothstep(0.2, 0.8, fuel).mul(burn).mul(smoothstep(0.3, 0.75, flicker).mul(1.15));
      const heat = max(kept.mul(fresh.oneMinus()), lit);
      return vec4(heat, 0, 0, 1);
    }, { scale: SCALE });

    // The flame's colour by its heat: white-hot, then the top stop, the middle, the bottom,
    // and nothing. On a light background it is ink instead, densest in the top stop's
    // colour, and nothing is white-hot.
    const h = memory.getTextureNode().sample(uv).r;
    const lower = mix(stops[0], stops[1], smoothstep(0.3, 0.55, h));
    const upper = mix(stops[1], stops[2], smoothstep(0.55, 0.8, h));
    const ramp = mix(lower, upper, smoothstep(0.5, 0.6, h));
    const flame = mix(ramp, vec3(1.6), smoothstep(0.9, 1.3, h).mul(light.oneMinus()));
    // A flame gives less light as it cools, so its tongues fade out at their tips even
    // where the palette's colours are all one; smoke thins the same way.
    const bright = smoothstep(0.02, 0.55, h);
    const dense = smoothstep(0.02, 0.9, h).mul(0.85);

    // The lines stay drawn through the fire, so the ridge still reads inside it.
    const picture = colour.rgb;
    const clear = float(1).sub(standout(picture, ground(uv)).mul(0.6));
    const glow = shoulder(max(picture.add(flame.mul(bright).mul(clear).mul(1.3)), vec3(0)), 0.85);
    const smoke = mix(picture, ramp, dense.mul(clear));
    const output = vec4(mix(glow, smoke, light), 1);

    let level = 0;
    function frame({ dt, shared }) {
      const s = shared.signals;
      const loud = Math.max(s.level?.value ?? 0, s.energy?.value ?? 0);
      level += (loud - level) * (1 - Math.exp(-dt / 0.5));
      const calm = (shared.still?.value ?? 0) > 0.5;
      // A beat fans the fire; with less motion asked for it burns steadily.
      fan.value = calm ? 0 : Math.max(fan.value * Math.exp(-dt / 0.25), s.beat?.value ?? 0);
      const speed = RISE[0] + (RISE[1] - RISE[0]) * level;
      step60.value = Math.min(Math.max(dt * 60, 0), 4);
      rise.value = speed * Math.min(dt, 1 / 15);
      climbed.value = (climbed.value + rise.value) % 1000;
      cool.value = COOL[0] + (COOL[1] - COOL[0]) * level;
      burn.value = 0.72 + 0.25 * level + 0.25 * fan.value;
    }

    return { output, frame, dispose: () => memory.dispose() };
  },
};
