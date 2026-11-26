// A worn video tape: colour smeared to the right of the picture, every tape line wobbling a
// little, white flecks of noise, ragged lines at the bottom where the heads switch, and a
// band of bad tracking that a beat throws somewhere new.
import { abs, float, floor, mat3, mix, mx_noise_float, rand, sin, smoothstep, step, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { onsetOf, signal } from '../lib/filter-kit.js';

// Colour to the luma and two colour-difference signals of analogue video, and back. Given
// plain numbers, `mat3` reads them a row at a time, as matrices are written.
const TO_YIQ = mat3(0.299, 0.587, 0.114, 0.596, -0.274, -0.322, 0.211, -0.523, 0.312);
const TO_RGB = mat3(1, 0.956, 0.621, 1, -0.272, -0.647, 1, -1.106, 1.703);

export default {
  name: 'tracking',
  build: (context) => {
    const { colour, uv, resolution, pixelRatio, time, signals } = context;
    const bass = signal(signals, 'bass');
    const treble = signal(signals, 'treble');
    const beat = signals.hit ?? signal(signals, 'beat');
    const bandAt = uniform(0.6);
    const px = pixelRatio.div(resolution.x);

    // The tape playing a picture read by `read(point)`, at screen point `at`.
    const play = (read, at) => {
      // One tape line every two CSS pixels.
      const line = floor(at.y.mul(resolution.y).div(pixelRatio.mul(2)));
      const wobble = mx_noise_float(vec2(line.mul(0.07), time.mul(2))).mul(0.6).add(sin(line.mul(0.9).add(time.mul(13))).mul(0.2)).mul(bass.mul(2).add(1));
      // The bad band: lines torn sideways, worse just after a beat.
      const band = float(1).sub(smoothstep(0, 0.07, abs(at.y.sub(bandAt)))).mul(beat.mul(0.8).add(0.25));
      const tear = band.mul(rand(vec2(line, floor(time.mul(30)))).sub(0.5)).mul(30);
      // The bottom few lines, where the heads switch, slide about.
      const foot = smoothstep(0.955, 0.985, at.y).mul(rand(vec2(line, floor(time.mul(20)))).sub(0.5)).mul(24);
      const shove = wobble.add(tear).add(foot).mul(pixelRatio).div(resolution.x);
      const s = at.add(vec2(shove, 0));

      // Brightness keeps its edges; colour is smeared over a few pixels and trails to the
      // right.
      const luma = TO_YIQ.mul(read(s)).x;
      let chroma = vec3(0);
      for (let k = 0; k < 5; k++) chroma = chroma.add(TO_YIQ.mul(read(s.sub(vec2(px.mul(k * 1.5 + 2), 0)))));
      chroma = chroma.div(5);
      let c = TO_RGB.mul(vec3(luma, chroma.y.mul(0.9), chroma.z.mul(0.9)));
      // Washed out a touch, with lifted blacks, as a tape plays back (a little goes a long
      // way near black).
      c = c.mul(0.94).add(0.006);
      // Dropouts, short white streaks along a line, more with the treble; and the band's
      // snow.
      const fleck = step(float(0.9993).sub(treble.mul(0.001)), rand(vec2(floor(at.x.mul(resolution.x).div(pixelRatio.mul(14))), line.add(floor(time.mul(60))))));
      const snow = rand(vec2(at.x.mul(resolution.x), line.add(time))).mul(band).mul(0.25);
      return mix(c, vec3(0.9), fleck.mul(0.7)).add(snow);
    };

    const onBeat = onsetOf('beat');
    function frame({ shared }) {
      if (onBeat(shared.signals) && Math.random() < 0.5) bandAt.value = 0.15 + Math.random() * 0.75;
    }
    // The backdrop plays from the same tape, and a filter after this one is told so.
    const ground = groundOf(context);
    const output = handOn(vec4(play((p) => colour.sample(p).rgb, uv), 1), (at) => play(ground, at));
    return { output, frame };
  },
};
