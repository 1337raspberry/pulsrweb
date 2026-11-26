// A total eclipse over the ridge: a black disc in a pearly corona whose streamers are the
// live spectrum wrapped around the circle, bass at the bottom and treble at the top. A
// strong beat flashes a diamond ring on the edge of the disc.
import { abs, atan, clamp, cos, exp, float, length, max, mix, mx_noise_float, PI, pow, sin, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import { centred, createView, dither, follow, recentLevel, stars } from '../lib/backdrop-kit.js';

// The diamond ring fires at most this often, in seconds.
const RING_GAP = 1.6;

export default {
  name: 'eclipse',
  build: ({ uv, background, stops, light, resolution, ridge, time }) => {
    const view = createView();
    const glow = uniform(0.5);
    // The diamond ring: where on the edge it shines (radians) and how brightly.
    const ringAt = uniform(0.6);
    const ring = uniform(0);
    let ringSince = RING_GAP;
    const p = centred(uv, resolution);
    const horizon = clamp(view.horizon, 0.45, 0.66);
    const radius = 0.1;
    const q = p.sub(vec2(0, horizon.sub(0.5).add(0.2)));
    const r = length(q);
    // 0 straight down, PI straight up, the same on either side.
    const angle = atan(q.x, q.y.negate());
    const t = abs(angle).div(PI);
    const span = ridge.u.span;
    const level = recentLevel(ridge, mix(float(0.5).sub(span.mul(0.5)), float(0.5).add(span.mul(0.5)), t), 4);

    // Fine fibres running out from the disc, turning slowly, and streamers whose reach at
    // each angle is the level there.
    const fibre = pow(mx_noise_float(vec2(angle.mul(38), r.mul(4).sub(time.mul(0.03)))).mul(0.5).add(0.5), 2.5);
    const streak = pow(mx_noise_float(vec2(angle.mul(9), r.mul(1.2).sub(time.mul(0.02)))).mul(0.5).add(0.5), 1.5);
    const reach = float(radius).mul(level.mul(2.1).add(0.3).add(streak.mul(0.5)));
    const out = max(r.sub(radius), 0);
    const corona = exp(out.div(reach).mul(-2.2)).mul(fibre.mul(0.9).add(0.35)).add(exp(out.mul(-60)).mul(0.6));
    const pearl = mix(vec3(1, 0.96, 0.9), stops[1], 0.18);
    const limb = exp(abs(r.sub(radius)).mul(-700)).mul(0.9);
    const disc = smoothstep(radius - 0.0015, radius, r).oneMinus();

    // The diamond ring: a bright bead on the edge with a short cross of light.
    const bead = q.sub(vec2(sin(ringAt), cos(ringAt).negate()).mul(radius));
    const beadLight = exp(length(bead).mul(-160)).mul(2.2)
      .add(exp(abs(bead.x).mul(-500)).mul(exp(abs(bead.y).mul(-24))).add(exp(abs(bead.y).mul(-500)).mul(exp(abs(bead.x).mul(-24)))).mul(0.6));

    // During totality the sky goes dark, with a sunset all round the horizon.
    const height = p.y.sub(horizon.sub(0.5));
    const twilight = exp(height.abs().mul(-9)).mul(0.3);
    const sky = mix(background.mul(0.55), stops[2], twilight).mul(mix(1, 0.75, smoothstep(0, 0.3, height)));
    const starLight = stars(p, { cells: 44, share: 0.22, seed: 9, resolution, time, twinkle: 0.2 });
    let colour = sky.add(vec3(starLight.mul(0.5)));
    colour = colour.add(pearl.mul(corona.mul(glow.mul(0.6).add(0.55)))).add(stops[2].mul(limb));
    colour = mix(colour, vec3(0), disc).add(vec3(1, 0.97, 0.9).mul(beadLight.mul(ring)));
    // On a light background the corona is drawn in ink round a pale disc.
    const ink = mix(background, mix(stops[0], vec3(0), 0.6), clamp(corona.mul(0.5), 0, 0.85));
    const paper = mix(ink, mix(background, vec3(1), 0.5), disc);
    return {
      colour: mix(colour, paper, light).add(dither()),
      frame: ({ dt, camera, shared }) => {
        view.update(camera);
        const s = shared.signals;
        glow.value = follow(glow.value, s.level.value, dt, 1.2);
        ringSince += dt;
        if (s.beat.value > 0.85 && ringSince > RING_GAP) {
          ringSince = 0;
          ring.value = 1;
          // Somewhere on the upper half of the edge, clear of the ridge.
          ringAt.value = Math.PI + (Math.random() - 0.5) * 2.4;
        }
        ring.value *= Math.exp(-dt / 0.35);
      },
    };
  },
};
