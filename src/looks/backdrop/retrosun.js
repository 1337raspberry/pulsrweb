// Synthwave: a banded sun on the horizon, black mountains with neon ridgelines, and a neon
// grid floor running to the horizon with a line under every row, moving back with them.
// Each beat sends a ring of light out across the floor from the front of the ridge.
import { abs, clamp, exp, fract, fwidth, int, length, max, mix, select, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import { centred, createView, dither, floorHit, follow, gridLine, stars } from '../lib/backdrop-kit.js';

export default {
  name: 'retrosun',
  build: ({ uv, background, stops, light, resolution, camera, ridge, signals, time }) => {
    const view = createView();
    const bassSlow = uniform(0);
    const p = centred(uv, resolution);
    // The horizon painted: the true one where the camera shows it, else held on the screen.
    const horizon = clamp(view.horizon, 0.36, 0.66);
    const above = uv.y.greaterThan(horizon);
    const height = uv.y.sub(horizon);

    // The sky: dark overhead, a hot haze down at the horizon, a few faint stars.
    const hot = mix(background, stops[2], 0.42);
    let sky = mix(hot, mix(background.mul(0.7), stops[1].mul(0.08), 0.3), smoothstep(0, 0.3, height));
    const star = stars(p, { cells: 46, share: 0.22, seed: 3, resolution, time, twinkle: 0.3 });
    sky = sky.add(vec3(star.mul(0.7).mul(smoothstep(0.1, 0.3, height))));

    // The sun, sitting on the horizon with slots cut through its lower half that widen
    // towards the bottom and slide slowly down.
    const radius = 0.21;
    const s = p.sub(vec2(0, horizon.sub(0.5).add(0.12)));
    const r = length(s);
    const yn = s.y.div(radius);
    const band = fract(yn.mul(7).add(time.mul(0.06)));
    const slot = smoothstep(-1, 0.3, yn).oneMinus().mul(0.6);
    const aa = fwidth(band).max(1e-4);
    const cut = smoothstep(0, aa, band).mul(smoothstep(slot.sub(aa), slot, band).oneMinus());
    const disc = smoothstep(radius - 0.002, radius, r).oneMinus().mul(cut.oneMinus());
    const sunColour = mix(stops[1], mix(stops[2], vec3(1, 0.9, 0.55), 0.35).mul(1.08), smoothstep(-1, 1, yn));
    const halo = exp(max(r.sub(radius), 0).mul(-7)).mul(bassSlow.mul(0.25).add(0.16));
    sky = mix(sky.add(stops[2].mul(halo)), sunColour, disc);

    // The floor, as the scene's camera sees it: a line under every row (row 1, the newest
    // history row, sits on line 0) and lines running away every world unit.
    const floor = floorHit(uv, camera, 0);
    const z1 = ridge.rowAt(int(1)).z;
    const z2 = ridge.rowAt(int(2)).z;
    const rowLines = gridLine(floor.point.z.sub(z1).div(z2.sub(z1)), 1.4);
    const runLines = gridLine(floor.point.x, 1.4);
    const fog = exp(floor.distance.mul(-0.018));
    // A ring of light running out from the front of the ridge after each beat.
    const out = length(vec2(floor.point.x, floor.point.z.sub(z1)));
    const since = signals.sinceBeat;
    const ring = exp(out.sub(since.mul(22)).div(1.6).pow(2).negate()).mul(exp(since.mul(-1.1)));
    const lines = max(rowLines, runLines);
    // About white, so a glow filter picks out the ring and the nearest lines, not the floor.
    const neon = stops[0].mul(lines.mul(fog)).add(stops[2].mul(ring.mul(lines.mul(0.9).add(0.12))));
    let ground = mix(background.mul(0.22), hot.mul(0.7), fog.oneMinus()).add(neon);
    // Where the floor reaches the painted horizon it glows like the haze it runs into.
    ground = mix(ground, hot, smoothstep(-0.05, 0, height));

    let colour = select(above, sky, ground);
    // The horizon itself: a bright thread and a soft band of glow.
    const thread = abs(height);
    colour = colour.add(stops[2].mul(exp(thread.mul(-320)).mul(0.9).add(exp(thread.mul(-24)).mul(0.22))));

    // The curtains: black mountains, a touch lighter towards their ridgelines and hazier
    // far back.
    const veil = (c) => {
      const night = mix(background.mul(0.16), vec3(0.012, 0.004, 0.03), 0.5);
      const body = mix(night, night.add(stops[1].mul(0.05)), c.up);
      return mix(body, c.ground, c.far.mul(0.3));
    };

    return {
      colour: clamp(colour, 0, 8).add(dither()),
      veil,
      frame: ({ dt, camera: seen, shared }) => {
        view.update(seen);
        bassSlow.value = follow(bassSlow.value, shared.signals.bass.value, dt, 0.8);
      },
    };
  },
};
