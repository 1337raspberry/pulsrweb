// The picture printed on cheap newsprint: each of the palette's three colours is an ink
// laid down as a screen of dots at its own angle, so where they meet they form rosettes,
// and a beat knocks the plates a little out of register. A backdrop is printed too, at its
// own strength, while the ridge's thin lines are inked harder so they still show.
import { Matrix3, Vector2 } from 'three/webgpu';
import { abs, clamp, float, floor, fract, length, max, mix, mx_fractal_noise_float, sqrt, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { inside, luma, onsetOf, signal, standoutOf } from '../lib/filter-kit.js';

// Dot spacing in CSS pixels, and each plate's screen angle in degrees.
const PITCH = 5;
const ANGLES = [15, 75, 45];
// How much harder the ridge's lines are inked than the rest of the picture, and how a
// share of ink becomes a dot: at full size the dots overlap, so a backdrop's dots are kept to
// the size that prints its own tone.
const LIFT = 2.6;
const TONE = 0.6;

export default {
  name: 'pressrun',
  build: (context) => {
    const { colour, uv, resolution, pixelRatio, background, stops, light, signals } = context;
    const bass = signal(signals, 'bass');
    const standout = standoutOf(background, stops);
    const ground = groundOf(context);
    // Each plate's share of a colour: the colour less the paper, written in terms of the
    // three inks less the paper. Worked out on the CPU when the palette changes; a palette
    // whose inks are all one colour prints with one plate.
    const plates = uniform(new Matrix3());
    const single = uniform(0);
    const shift = [uniform(new Vector2()), uniform(new Vector2()), uniform(new Vector2())];
    // A backdrop's colours are not made of the palette's inks, and written in terms of them
    // they can need ink taken away; so only the inks that add are kept, in amounts that
    // print the backdrop as bright (or as dark) as it is.
    const inkLuma = stops.map((ink) => luma(ink.sub(background)));
    const backdropShares = (under) => {
      const raw = max(plates.mul(under.sub(background)), vec3(0));
      const printed = inkLuma[0].mul(raw.x).add(inkLuma[1].mul(raw.y)).add(inkLuma[2].mul(raw.z));
      return raw.mul(clamp(abs(luma(under.sub(background))).div(abs(printed).max(1e-3)), 0, 1));
    };

    // Each dot reads the picture softened to about its own size, so its size follows how
    // much ink is round it.
    const blur = gaussianBlur(colour, 1, 2, { resolutionScale: 0.5 });
    const soft = blur.getTextureNode();
    const px = uv.mul(resolution);
    const pitch = pixelRatio.mul(PITCH);
    let paper = background.mul(mx_fractal_noise_float(px.div(pixelRatio).mul(0.35)).mul(0.035).add(0.985));
    ANGLES.forEach((degrees, p) => {
      const a = (degrees * Math.PI) / 180;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      const at = px.add(shift[p].mul(pixelRatio));
      const turned = vec2(at.x.mul(c).add(at.y.mul(s)), at.y.mul(c).sub(at.x.mul(s))).div(pitch);
      const middle = floor(turned).add(0.5).mul(pitch);
      const centrePx = vec2(middle.x.mul(c).sub(middle.y.mul(s)), middle.y.mul(c).add(middle.x.mul(s))).sub(shift[p].mul(pixelRatio));
      const seen = soft.sample(centrePx.div(resolution)).rgb;
      // A line a pixel or two wide spread over a dot's area is thin ink, so the ridge's marks
      // (the picture less what is behind them) are lifted to print; what is behind them, the
      // backdrop, prints as it is.
      const under = ground(centrePx.div(resolution));
      const share = plates.mul(seen.sub(under).mul(LIFT)).add(backdropShares(under).mul(TONE));
      const alone = standout(seen, under).mul(LIFT).add(standout(under).mul(TONE));
      const weight = single.greaterThan(0.5).select(p === 2 ? alone : float(0), p === 0 ? share.x : p === 1 ? share.y : share.z);
      const cover = clamp(weight, 0, 1);
      const radius = sqrt(cover).mul(pitch).mul(0.72).mul(bass.mul(0.15).add(1));
      const dot = inside(length(fract(turned).sub(0.5)).mul(pitch), radius, float(0.75)).mul(cover.greaterThan(0.02).select(float(1), float(0)));
      const ink = stops[p];
      const printed = paper.mul(mix(vec3(1), ink.div(background.max(0.02)).min(1), dot));
      const lit = paper.add(ink.sub(background).mul(dot));
      paper = mix(lit, printed, light);
    });

    const m = new Matrix3();
    const onBeat = onsetOf('beat');
    function frame({ dt, shared }) {
      const bg = background.value;
      const columns = stops.map((u) => [u.value.r - bg.r, u.value.g - bg.g, u.value.b - bg.b]);
      m.set(
        columns[0][0], columns[1][0], columns[2][0],
        columns[0][1], columns[1][1], columns[2][1],
        columns[0][2], columns[1][2], columns[2][2],
      );
      const det = m.determinant();
      single.value = Math.abs(det) < 1e-4 ? 1 : 0;
      if (!single.value) plates.value.copy(m.invert());
      // A beat knocks each plate a pixel or three out of register; they settle back.
      const beat = onBeat(shared.signals);
      shift.forEach((u) => {
        u.value.multiplyScalar(Math.exp(-dt / 0.25));
        if (beat && u.value.lengthSq() < 0.25) {
          const a = Math.random() * Math.PI * 2;
          u.value.set(Math.cos(a), Math.sin(a)).multiplyScalar(1 + 2 * Math.random());
        }
      });
    }

    // The whole picture is printed on the paper, which is what a filter after this sees
    // behind the ridge.
    return { output: handOn(vec4(paper, 1), () => background), frame, dispose: () => blur.dispose() };
  },
};
