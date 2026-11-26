// Every line glows: a soft halo in the palette's own colours that swells with the bass.
// On a light background the halo soaks in as a darker bleed of ink instead.
import { exp, float, max, min, mix, smoothstep, vec3, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { groundOf } from '../lib/filter-ground.js';
import { shoulder, signal, standoutOf } from '../lib/filter-kit.js';

export default {
  name: 'glowup',
  build: (context) => {
    const { colour, uv, background, stops, light, signals } = context;
    const bass = signal(signals, 'bass');
    const beat = signal(signals, 'beat');
    const level = signal(signals, 'level');
    const standout = standoutOf(background, stops);
    // What glows is the light the ridge's marks add to what is behind them (on a light
    // palette, the light they take away), so the lines glow over any backdrop while the
    // backdrop itself, and a dark silhouette standing against it, do not; colour above 1
    // glows hardest. Faint texture an earlier filter leaves (scanlines, fog, glass) is not a
    // line, so only what clearly stands out glows.
    const behind = groundOf(context)(uv);
    const lineness = smoothstep(mix(0.08, 0.2, light), mix(0.3, 0.5, light), standout(colour.rgb, behind));
    const lift = max(colour.rgb.sub(behind).mul(float(1).sub(light.mul(2))), vec3(0));
    // A backdrop's own brightest parts, a sun or a lit window, keep a faint glow of their
    // own on a dark palette.
    const highlight = min(max(behind.sub(0.7), vec3(0)), vec3(1)).mul(light.oneMinus().mul(0.15));
    const source = vec4(lift.mul(lineness).add(highlight), 1);
    // Thin dark lines on a light page cover little, so their bleed needs more strength.
    const strength = float(0.7).add(bass.mul(0.8)).add(beat.mul(0.35)).mul(light.mul(0.8).add(1));
    const radius = float(0.3).add(level.mul(0.3));
    const glow = bloom(source, strength, radius, 0);
    // Light is added on a dark background. On a light one it is taken away, each colour in
    // proportion to how much of it the ink lacks, easing off as it nears a quarter of what
    // was there, so crowded lines never fill in solid.
    const added = shoulder(max(colour.rgb.add(glow.rgb), vec3(0)), 0.82);
    const base = max(colour.rgb, vec3(0));
    const room = max(base.mul(0.75), vec3(0.001));
    const soaked = base.sub(room.mul(float(1).sub(exp(glow.rgb.div(room).negate()))));
    const out = mix(added, soaked, light);

    // The wider mips lean towards the top stop, so the outer haze takes the palette's
    // highest colour while the inner glow keeps the line's own.
    const outer = [0, 0, 0.35, 0.55, 0.7];
    function frame() {
      const top = stops[2].value;
      const peak = Math.max(top.r, top.g, top.b, 1e-3);
      glow.bloomTintColors.forEach((tint, i) => {
        const k = outer[i];
        tint.set(1 - k + (k * top.r) / peak, 1 - k + (k * top.g) / peak, 1 - k + (k * top.b) / peak);
      });
    }

    return { output: vec4(out, 1), frame, dispose: () => glow.dispose() };
  },
};
