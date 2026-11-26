// Veils of light rising from the newest rows like the northern lights: soft curtains,
// brightest at the line and fading upwards, with fine rays drifting along them and slow
// folds. On a light background they become coloured gauze that tints what is behind.
import { AdditiveBlending, DoubleSide, InstancedMesh, MeshBasicNodeMaterial, MultiplyBlending } from 'three/webgpu';
import { float, mix, mx_noise_float, positionGeometry, select, sin, smoothstep, varying, vec2, vec3 } from 'three/tsl';
import { seedOf, signal, smoothLevel } from '../lib/line-kit.js';

// Only the newest rows carry a veil: enough for a sky, few enough to stay light to draw.
const NEWEST = 22;

export default {
  name: 'veils',
  build: (c) => {
    const light = c.light.value > 0.5;
    const material = new MeshBasicNodeMaterial({ side: DoubleSide });
    // Each veil hangs from its row's line, taller over the loud parts of the row and when
    // the music is loud. Its height follows the row's level smoothed well out to either side,
    // so the veil's top edge flows instead of following every jag of the row.
    const top = c.level.mul(c.row.rise);
    const broad = smoothLevel(c, c.index, 4);
    const tall = c.row.rise.mul(broad.mul(0.9).add(0.15)).mul(signal(c, 'level').mul(0.5).add(0.75));
    // Veils rise from the loud parts of a row, not its quiet flats, and thin out over the
    // rows that carry them, so they never end in a hard edge.
    const loud = varying(smoothstep(0.04, 0.45, broad).mul(float(1).sub(float(c.row.k).div(NEWEST)).max(0).pow(1.5)));
    const hung = c.place(c.alongAt(c.index), select(positionGeometry.y.greaterThan(0), top.add(tall), top));
    material.positionNode = select(c.row.shown, hung, vec3(0));

    // On the veil, `up` runs 0 at the line to 1 at its top.
    const f = c.up.clamp(0, 1);
    const seed = seedOf(c.row);
    const drift = signal(c, 'clock').mul(0.4).add(c.time.mul(0.2));
    const rays = mx_noise_float(vec2(c.along.mul(80).add(drift), seed.mul(0.37).add(c.time.mul(0.04)))).mul(0.5).add(0.5);
    const folds = sin(c.along.mul(13).add(drift.mul(1.6)).add(f.mul(2.4)).add(seed)).mul(0.5).add(0.5);
    const glow = f.oneMinus().pow(1.6).mul(smoothstep(0, 0.1, f)).mul(rays.mul(0.7).add(0.3)).mul(folds.mul(0.45).add(0.55));
    const strength = glow.mul(loud).mul(c.fade).mul(signal(c, 'bass').mul(0.3).add(1));
    const colour = mix(c.stops[0], c.stops[2], f.pow(0.7));
    material.colorNode = light ? mix(vec3(1), colour, strength.mul(0.32)) : colour.mul(strength).mul(0.4);
    material.transparent = true;
    material.depthWrite = false;
    material.blending = light ? MultiplyBlending : AdditiveBlending;
    material.premultipliedAlpha = light;

    const veils = new InstancedMesh(c.geometry, material, c.count);
    veils.frustumCulled = false;
    return {
      colour: c.faded(c.tint),
      extras: [{
        object: veils,
        setRows: (rows) => { veils.count = Math.min(rows, NEWEST); },
        dispose: () => material.dispose(),
      }],
    };
  },
};
