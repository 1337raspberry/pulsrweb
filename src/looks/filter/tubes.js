// Every line becomes a glass tube of neon on a dark wall: a white-hot core, coloured glass
// either side of it, and a soft haze round it that swells with the bass.
// A backdrop stays on the wall, dimmed, and only the ridge's own lines light up.
import { clamp, float, max, mix, vec3, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { fullHueOf, signal, standoutOf } from '../lib/filter-kit.js';

export default {
  name: 'tubes',
  build: (context) => {
    const { colour, uv, background, stops, light, signals } = context;
    const bass = signal(signals, 'bass');
    const level = signal(signals, 'level');
    const standout = standoutOf(background, stops);
    const fullHue = fullHueOf(background, stops);
    const ground = groundOf(context);
    const behind = ground(uv);
    // A tube is wherever the picture is lit above what is behind it (on a light palette,
    // inked below it), so neither a backdrop nor a dark silhouette against one becomes neon.
    const lift = max(colour.rgb.sub(behind).mul(float(1).sub(light.mul(2))), vec3(0));
    const core = standout(lift.add(background));
    // Its colour is the line's own, at full strength; on a light palette the glass is white,
    // as unlit tubes look by day.
    const own = mix(fullHue(colour.rgb, behind), vec3(1), light.mul(0.85));
    const marks = vec4(own.mul(core), core);
    // The glass: each line spread to a few pixels across, keeping the colour of the tube
    // nearest.
    const spread = gaussianBlur(marks, 1, 2, { resolutionScale: 0.5 });
    const haze = bloom(marks, float(0.5).add(bass.mul(0.6)), 0.4, 0);
    const wide = spread.getTextureNode().sample(uv);
    const glass = clamp(wide.a.mul(2.4).sub(core.mul(0.6)), 0, 1);
    const hue = mix(wide.rgb.div(wide.a.max(1e-3)), own, core);
    // The wall is what is behind the ridge, dimmed; a filter after this one is told so.
    const wall = (at) => ground(at).mul(0.3);
    const tube = hue.mul(glass).mul(0.85).add(mix(hue, vec3(1), 0.7).mul(core).mul(level.mul(0.3).add(0.9)));
    const shine = haze.rgb.mul(hue.add(0.2)).mul(0.6);
    const output = handOn(vec4(wall(uv).add(tube).add(shine), 1), wall);

    return { output, dispose: () => { spread.dispose(); haze.dispose(); } };
  },
};
