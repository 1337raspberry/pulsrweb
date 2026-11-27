// The picture through a thermal camera: everything shown by how hot it is, from cold black
// and violet through red and orange to white-hot, the ridge's lines burning brightest in a
// soft glow of their own heat and the backdrop warm where it is bright, with a little sensor
// noise. Over it the camera's readouts: a crosshair with the spot temperature, and the scale
// of colours down one side between its limits. Louder music warms the scene; a beat flares
// the hottest parts.
import { HalfFloatType } from 'three/webgpu';
import { clamp, float, floor, max, mix, rand, rtt, smoothstep, step, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { createCorners } from '../lib/filter-osd.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { standoutOf, toLinear } from '../lib/filter-kit.js';

// The camera's colours for heat 0 to 1, as display values, the "iron" scale such cameras
// use: black, indigo, violet, crimson, orange, gold and white.
const IRON = [
  [0, [0.02, 0.0, 0.04]],
  [0.14, [0.12, 0.02, 0.38]],
  [0.3, [0.44, 0.02, 0.56]],
  [0.48, [0.82, 0.1, 0.36]],
  [0.64, [0.97, 0.4, 0.06]],
  [0.8, [1.0, 0.76, 0.12]],
  [1, [1.0, 0.98, 0.82]],
];
// The scale's place on the screen: its right edge this share of the width in from the
// screen's right, its top and bottom these shares of the height down, its width in CSS pixels.
const BAR_IN = 0.06;
const BAR_SPAN = [0.2, 0.8];
const BAR_WIDTH = 9;
// The crosshair's arms: their length, the gap at the middle, and their thickness, in CSS pixels.
const ARM = 13;
const GAP = 5;
const THICK = 2;

// Heat `h` (a float node) through the iron scale, as linear colour.
function ironOf(h) {
  let c = vec3(...IRON[0][1]);
  for (let i = 1; i < IRON.length; i++) {
    const [from] = IRON[i - 1];
    const [to, rgb] = IRON[i];
    c = mix(c, vec3(...rgb), clamp(h.sub(from).div(to - from), 0, 1));
  }
  return toLinear(c);
}

const two = (n) => String(n).padStart(2, '0');
const degrees = (t) => `${t.toFixed(1)}°`;

export default {
  name: 'thermal',
  build: (context) => {
    const { colour, uv: screen, resolution, pixelRatio, background, stops, time } = context;
    const standout = standoutOf(background, stops);
    const ground = groundOf(context);
    const osd = createCorners(context, { columns: 11, rows: 2 });
    // How warm the whole scene runs, and how hard the hottest parts flare.
    const warmth = uniform(0);
    const flare = uniform(0);

    // How far each point stands out from what is behind it, at half size: the sensor sees
    // the picture softer than the screen shows it.
    const marks = rtt(vec4(vec3(standout(colour.sample(uv()).rgb, ground(uv()))), 1), null, null, { type: HalfFloatType, resolutionScale: 0.5 });
    const halo = gaussianBlur(marks, 1, 6, { resolutionScale: 0.5 });

    // The backdrop's heat: warm where it is lit against the palette's background.
    const ambient = (at) => standout(ground(at), background).mul(0.45).add(0.045).add(warmth.mul(0.06));
    // Corners run a little cooler, as a camera's lens loses some of what it sees there.
    const fall = (at) => {
      const d = at.sub(0.5).mul(vec2(resolution.x.div(resolution.y), 1)).length();
      return float(1).sub(smoothstep(0.3, 0.95, d).mul(0.18));
    };
    const line = marks.sample(screen).r;
    const glow = halo.getTextureNode().sample(screen).r;
    let heat = ambient(screen).add(line.mul(0.95)).add(glow.mul(1.7)).add(max(line.add(glow).sub(0.5), 0).mul(flare.mul(0.6)));
    heat = heat.mul(fall(screen));
    // Sensor noise: a faint grain every frame, and the columns of the sensor each a touch
    // off from their neighbours.
    const px = screen.mul(resolution).div(pixelRatio);
    const grain = rand(vec2(floor(px.x.div(2)), floor(px.y.div(2)).add(floor(time.mul(30)).mul(97)))).sub(0.5).mul(0.035);
    const columns = rand(vec2(floor(px.x.div(2)), 7)).sub(0.5).mul(0.015);
    let picture = ironOf(clamp(heat.add(grain).add(columns), 0, 1));

    // The scale of colours, hot at the top, in a thin dark frame.
    const barRight = resolution.x.mul(1 - BAR_IN);
    const barLeft = barRight.sub(pixelRatio.mul(BAR_WIDTH));
    const barTop = resolution.y.mul(BAR_SPAN[0]);
    const barBottom = resolution.y.mul(BAR_SPAN[1]);
    const p = screen.mul(resolution);
    const inBar = step(barLeft, p.x).mul(step(p.x, barRight)).mul(step(barTop, p.y)).mul(step(p.y, barBottom));
    const frameW = pixelRatio.mul(1.5);
    const inFrame = step(barLeft.sub(frameW), p.x).mul(step(p.x, barRight.add(frameW))).mul(step(barTop.sub(frameW), p.y)).mul(step(p.y, barBottom.add(frameW)));
    const along = clamp(barBottom.sub(p.y).div(barBottom.sub(barTop)), 0, 1);
    picture = mix(mix(picture, vec3(0.005), inFrame), ironOf(along), inBar);

    // The crosshair: white arms with a dark edge, round a gap at the middle.
    const c = p.sub(resolution.mul(0.5)).div(pixelRatio).abs();
    const armOf = (along, across, grow) => step(GAP - grow, along).mul(step(along, GAP + ARM + grow)).mul(step(across, THICK / 2 + grow));
    const cross = max(armOf(c.x, c.y, 0), armOf(c.y, c.x, 0));
    const edge = max(armOf(c.x, c.y, 1), armOf(c.y, c.x, 1));
    picture = mix(mix(picture, vec3(0.005), edge), vec3(0.92), cross);

    // The readouts.
    const ink = osd.at(screen);
    picture = mix(picture, toLinear(ink.rgb), ink.a);

    // A filter after this one sees the backdrop's heat alone behind the ridge.
    const output = handOn(vec4(picture, 1), (at) => ironOf(clamp(ambient(at).mul(fall(at)), 0, 1)));

    let level = 0;
    let since = Infinity;
    let spot = 24;
    function frame({ dt, shared }) {
      const s = shared.signals;
      const calm = (shared.still?.value ?? 0) > 0.5;
      level += ((s.level?.value ?? 0) - level) * (1 - Math.exp(-dt / 1.2));
      warmth.value = level;
      flare.value = calm ? 0 : Math.max(flare.value * Math.exp(-dt / 0.2), s.beat?.value ?? 0);
      // The readouts change a few times a second, as a camera's do.
      since += dt;
      if (since < 0.25) return;
      since = 0;
      const energy = s.energy?.value ?? 0;
      spot += (24 + 14 * (s.level?.value ?? 0) + 4 * flare.value - spot) * 0.5 + (Math.random() - 0.5) * 0.2;
      const top = 33 + 9 * Math.max(energy, level);
      const bottom = 17.5 + 2 * level;
      const now = new Date();
      osd.clear();
      osd.write('tl', 0, `SP ${degrees(spot)}C`);
      osd.write('tl', 1, 'AUTO');
      osd.write('tr', 1, degrees(top));
      osd.write('br', 0, degrees(bottom));
      osd.write('bl', 1, `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`);
      osd.update();
    }

    return {
      output,
      frame,
      dispose: () => {
        marks.dispose();
        halo.dispose();
        osd.dispose();
      },
    };
  },
};
