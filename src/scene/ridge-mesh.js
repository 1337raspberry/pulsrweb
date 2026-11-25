// The ridge as two instanced meshes, one instance per row. A curtain in the background
// colour hides whatever lies behind a row; a line of constant screen width traces its top.
// Row heights come from the history texture, so only uniforms change from frame to frame.

import {
  Color,
  DataTexture,
  DoubleSide,
  FloatType,
  Group,
  InstancedMesh,
  MeshBasicNodeMaterial,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
} from 'three/webgpu';
import {
  PI,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  float,
  instanceIndex,
  int,
  ivec2,
  max,
  min,
  mix,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  round,
  select,
  sign,
  textureLoad,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { MAX_ROWS } from '../ridge/params.js';

// World width of a row; heights are `peak` times this scale.
const WIDTH = 16;
const HEIGHT = 10;
// Share of a row's full rise that reaches the last gradient stop.
const GRADIENT_TOP = 0.6;
// Without rising, the newest history row starts where the live row is; it stays hidden
// until it has moved this share of a row back, so the two never fight for depth.
const EMERGE = 0.1;

const VALUE_UNIFORMS = ['rows', 'peak', 'lineWidth', 'spacing', 'depthScale', 'fadeCurve', 'alpha', 'edgeTaper'];

export function createRidgeMesh({ history, resolution, pixelRatio }) {
  const points = history.width;
  const texture = new DataTexture(history.data, history.width, history.height, RedFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const u = Object.fromEntries(VALUE_UNIFORMS.map((name) => [name, uniform(1)]));
  const rising = uniform(0);
  const phase = uniform(0);
  const newest = uniform(history.newest, 'int');
  const background = uniform(new Color());
  const stops = [uniform(new Color()), uniform(new Color()), uniform(new Color())];

  // Row placement: instance 0 is the live row, instance k >= 1 is history row k - 1 back.
  const k = int(instanceIndex);
  const live = k.equal(0);
  const depth = select(live, float(0), float(instanceIndex).sub(1).add(phase));
  const fade = clamp(depth.div(max(u.rows.sub(1), 1)), 0, 1);
  const z = select(live.and(rising.greaterThan(0.5)), u.spacing.mul(phase.oneMinus()), depth.mul(u.spacing).negate());
  const capacity = int(history.capacity);
  const textureRow = select(live, int(0), newest.sub(k.sub(1)).add(capacity).mod(capacity).add(1));
  const shown = rising.greaterThan(0.5).or(k.notEqual(1)).or(phase.greaterThanEqual(EMERGE));
  const rise = u.peak.mul(HEIGHT).mul(u.depthScale.sub(1).mul(fade).add(1));

  // Raised cosine over the first and last `edgeTaper` of the width, 1 between.
  const taperAt = (along) => {
    const fromEdge = min(along, along.oneMinus());
    const ramp = max(u.edgeTaper, 1e-6);
    return select(fromEdge.greaterThanEqual(u.edgeTaper), float(1), cos(PI.mul(fromEdge).div(ramp)).mul(-0.5).add(0.5));
  };
  const levelAt = (index) => textureLoad(texture, ivec2(index, textureRow)).x;
  const alongAt = (index) => float(index).div(points - 1);
  // Tapered level of point `index` and its world position on the row's top edge.
  const shapeAt = (index) => levelAt(index).mul(taperAt(alongAt(index)));
  const topAt = (index) => vec3(alongAt(index).sub(0.5).mul(WIDTH), shapeAt(index).mul(rise), z);

  const index = int(round(positionGeometry.x.add(0.5).mul(points - 1)));
  const shape = shapeAt(index);

  // Height through the three stops in two halves, then toward the background with depth.
  const lineColour = (() => {
    const t = varying(clamp(shape.div(GRADIENT_TOP), 0, 1));
    const a = varying(u.alpha.mul(fade.oneMinus().pow(u.fadeCurve)));
    const low = mix(stops[0], stops[1], t.mul(2));
    const high = mix(stops[1], stops[2], t.mul(2).sub(1));
    return mix(background, select(t.lessThan(0.5), low, high), a);
  })();

  const geometry = new PlaneGeometry(1, 1, points - 1, 1);

  const curtainMaterial = new MeshBasicNodeMaterial({ side: DoubleSide });
  // A hidden row collapses to zero width, which draws nothing.
  curtainMaterial.positionNode = vec3(
    select(shown, alongAt(index).sub(0.5).mul(WIDTH), float(0)),
    select(positionGeometry.y.greaterThan(0), shape.mul(rise), float(0)),
    z,
  );
  curtainMaterial.colorNode = background;
  // Pushed back in depth so a row's own line always wins over its curtain.
  curtainMaterial.polygonOffset = true;
  curtainMaterial.polygonOffsetFactor = 1;
  curtainMaterial.polygonOffsetUnits = 1;

  // The line: each vertex projected with its neighbours, then moved half the line width
  // along the screen-space normal, to the side the plane's y gives.
  const lineMaterial = new MeshBasicNodeMaterial({ side: DoubleSide });
  const toClip = (p) => cameraProjectionMatrix.mul(cameraViewMatrix).mul(modelWorldMatrix).mul(vec4(p, 1));
  const toPixels = (clip) => clip.xy.div(clip.w).mul(resolution).mul(0.5);
  const clip = toClip(topAt(index)).toVar();
  const prev = toPixels(toClip(topAt(max(index.sub(1), 0))));
  const next = toPixels(toClip(topAt(min(index.add(1), points - 1))));
  const dir = normalize(next.sub(prev));
  const offset = vec2(dir.y.negate(), dir.x).mul(sign(positionGeometry.y)).mul(u.lineWidth.mul(pixelRatio).mul(0.5));
  // A hidden row lands past the far plane.
  lineMaterial.vertexNode = select(
    shown,
    vec4(clip.xy.add(offset.mul(2).div(resolution).mul(clip.w)), clip.zw),
    vec4(0, 0, 2, 1),
  );
  lineMaterial.colorNode = lineColour;

  const count = MAX_ROWS + 1;
  const curtain = new InstancedMesh(geometry, curtainMaterial, count);
  const line = new InstancedMesh(geometry, lineMaterial, count);
  for (const mesh of [curtain, line]) mesh.frustumCulled = false;

  const object = new Group();
  object.add(curtain, line);

  // Takes a full settings object; writes uniforms and the row count only.
  function setValues(values) {
    for (const name of VALUE_UNIFORMS) u[name].value = values[name];
    rising.value = values.rising ? 1 : 0;
    const rows = Math.min(Math.max(Math.round(values.rows), 1), count);
    curtain.count = rows;
    line.count = rows;
  }

  function setTheme(theme, gradient) {
    background.value.set(theme.background);
    gradient.stops.forEach((colour, i) => stops[i].value.set(colour));
  }

  function frame(ridge) {
    if (history.update(ridge)) texture.needsUpdate = true;
    newest.value = history.newest;
    phase.value = ridge.phase;
  }

  return { object, setValues, setTheme, frame };
}
