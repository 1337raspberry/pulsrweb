// Sparks rising off the ridge's peaks like cinders from a fire: each is born where the
// sound was loud, at the moment it was (read back from the ridge's own history), and drifts
// up and back over the hills, cooling as it goes. On a light background, flecks of soot.
import { cos, exp, float, fract, int, mix, pow, select, sin, smoothstep, varying, vec3 } from 'three/tsl';
import { centred, dither, stars } from '../lib/backdrop-kit.js';
import { createMotes, glowOrInk, softDot } from '../lib/motes.js';

export default {
  name: 'cinders',
  // A warm night: dark overhead, the glow of a fire low down behind the ridge.
  colour: ({ uv, background, stops, light, resolution, time }) => {
    const p = centred(uv, resolution);
    const fire = mix(stops[2], vec3(1, 0.45, 0.15), 0.5);
    const glow = exp(p.y.add(0.1).max(0).mul(-5)).mul(0.16).mul(smoothstep(-0.5, -0.1, p.y));
    const night = mix(background.mul(0.75), background.mul(0.45), smoothstep(-0.3, 0.5, p.y)).add(fire.mul(glow))
      .add(vec3(stars(p, { cells: 46, share: 0.14, seed: 6, resolution, time, twinkle: 0.2 }).mul(0.3).mul(smoothstep(0.05, 0.35, p.y))));
    const page = mix(background, mix(background, fire, 0.12), glow.mul(4));
    return mix(night, page, light).add(dither());
  },
  props: ({ stops, light, ridge, time }) => {
    const u = ridge.u;
    // Cinders leave from the row nearest the camera, which shows the newest sound.
    const nearRow = ridge.rowAt(select(u.flow.lessThan(0.5), int(1), int(u.rows).sub(1)));
    const motes = createMotes({
      count: 3600,
      make: ([a, b, c, d]) => {
        // Each lives its own span over and over; the history reaches back about 100 rows.
        const life = mix(1.3, 2.8, b).min(float(100).div(u.speed.max(1)));
        const age = fract(time.div(life).add(c)).mul(life);
        const t = age.div(life);
        const along = mix(float(0.5).sub(u.span.mul(0.5)), float(0.5).add(u.span.mul(0.5)), a);
        // How loud the ridge was here when this cinder was born.
        const born = ridge.levelAt(along, int(age.mul(u.speed)).min(ridge.capacity - 1));
        const base = vec3(along.sub(0.5).mul(ridge.WIDTH), born.mul(nearRow.rise), nearRow.z);
        const climb = age.mul(mix(0.7, 1.5, d)).sub(age.mul(age).mul(0.08));
        const curl = vec3(sin(age.mul(2.3).add(a.mul(40))), 0, cos(age.mul(1.9).add(b.mul(40)))).mul(age.mul(0.22));
        const position = base.add(vec3(0, climb, age.mul(-0.7))).add(curl);
        // Only cinders born where it was loud glow, flickering, cooling as they rise.
        const heat = varying(smoothstep(0.08, 0.45, born).mul(pow(t.oneMinus(), 1.4)).mul(sin(time.mul(23).add(a.mul(100))).mul(0.3).add(0.7)));
        const cooling = varying(t);
        // A hot core in a soft glow.
        const m = softDot(0.02).pow(4).mul(1.4).add(softDot(0.02).mul(0.25));
        const ember = mix(mix(stops[2], vec3(1, 0.85, 0.55), 0.45).mul(2.6), stops[1].mul(0.7), cooling);
        return {
          position,
          size: mix(0.045, 0.095, d).mul(t.mul(0.5).oneMinus()),
          colour: glowOrInk(ember.mul(heat.mul(m)), vec3(0.1, 0.09, 0.09), heat.mul(m).mul(0.7), light),
        };
      },
    });
    return { object: motes.object, dispose: motes.dispose };
  },
};
