// The ridge as two instanced meshes, one instance per row. A curtain hides whatever lies
// behind a row; a line of constant screen width traces its top. Row heights come from the
// history texture, so only uniforms change from frame to frame.
//
// What the ridge looks like is put together from a look's slots (see src/looks): the shape
// says where a row's points sit in the world, the tint what colour a point is, and the
// line what the line and the curtain are made of. The ground is what is behind the ridge
// at a pixel, which the curtain is painted with and the lines fade towards.

import {
  DataTexture,
  DoubleSide,
  FloatType,
  Group,
  InstancedMesh,
  MeshBasicNodeMaterial,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  RGBAFormat,
} from 'three/webgpu';
import {
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  float,
  instanceIndex,
  int,
  ivec2,
  max,
  min,
  mix,
  modelWorldMatrix,
  normalize,
  length,
  positionGeometry,
  round,
  select,
  sign,
  textureLoad,
  uniform,
  userData,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { MAX_ROWS } from '../ridge/params.js';
import { MARK_NAMES } from '../looks/shared.js';

// World width of a row; heights are `peak` times this scale.
export const WIDTH = 16;
const HEIGHT = 10;
// Share of a row's full rise that reaches the last gradient stop.
const GRADIENT_TOP = 0.6;
// Without rising, the newest history row starts where the live row is; it stays hidden
// until it has moved this share of a row back, so the two never fight for depth.
const EMERGE = 0.1;
// Rows coming towards the camera run this far in front of the scene's origin before they
// go, and reach the live shape's full height this share of the way in.
const LEAD = 6.4;
const LIVE_FULL = 0.7;

// `flow` is the index of the flow setting's choice: 0 away, 1 towards live.
const VALUE_UNIFORMS = ['rows', 'peak', 'lineWidth', 'spacing', 'depthScale', 'fadeCurve', 'alpha', 'trench', 'flow', 'span', 'axisCurve', 'speed'];
// What a line style may set on the line's material, and on the curtain's.
const MATERIAL_KEYS = [
  'transparent', 'blending', 'blendEquation', 'blendSrc', 'blendDst', 'blendEquationAlpha', 'blendSrcAlpha', 'blendDstAlpha',
  'depthWrite', 'depthTest', 'alphaTest', 'alphaToCoverage', 'premultipliedAlpha', 'side',
];

// 0 at `from`, 1 at `to`, eased between.
const ease = (from, to, x) => {
  const t = clamp(x.sub(from).div(float(to).sub(from)), 0, 1);
  return t.mul(t).mul(float(3).sub(t.mul(2)));
};

// `shared` holds the uniforms every part of a look reads: time, the sound's signals, the
// palette's background and stops (see src/looks/shared.js).
export function createRidgeMesh({ history, resolution, pixelRatio, shared }) {
  const points = history.width;
  const texture = new DataTexture(history.data, history.width, history.height, RedFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  // Each row's mark: what the sound was doing when it was cut, four numbers to a texel.
  const marks = new DataTexture(history.marks, MARK_NAMES.length / 4, history.height, RGBAFormat, FloatType);
  marks.minFilter = NearestFilter;
  marks.magFilter = NearestFilter;
  marks.generateMipmaps = false;
  marks.needsUpdate = true;

  const u = Object.fromEntries(VALUE_UNIFORMS.map((name) => [name, uniform(1)]));
  const rising = uniform(0);
  const phase = uniform(0);
  const newest = uniform(history.newest, 'int');
  // Rows cut so far, wrapped so it stays exact as a float.
  const cuts = uniform(0);
  const { background, stops, time, signals } = shared;
  const capacity = int(history.capacity);

  const away = u.flow.lessThan(0.5);
  const slides = away.and(rising.greaterThan(0.5));
  const alongAt = (index) => float(index).div(points - 1);

  // Everything about row `k` (an int node): 0 is the live row, k >= 1 is history row
  // k - 1 back. `age` runs from 0 at the newest row to 1 at the oldest shown. Flowing
  // away, the newest is nearest the camera and rows recede; flowing towards, it is
  // furthest and rows arrive.
  // `fold`, if given, says where along the spectrum each point of a row reads its level
  // from: a function of `along` (0 to 1) giving another, for a shape that mirrors or
  // repeats the spectrum.
  const rowAt = (k, fold = null) => {
    const live = k.equal(0);
    const depth = select(live, float(0), float(k).sub(1).add(phase));
    const age = clamp(depth.div(max(u.rows.sub(1), 1)), 0, 1);
    // 0 at the camera's end of the ridge, 1 at the far end.
    const far = select(away, age, age.oneMinus());
    const near = far.oneMinus();
    const zAway = select(live.and(slides), u.spacing.mul(phase.oneMinus()), depth.mul(u.spacing).negate());
    const zTowards = float(LEAD).sub(u.rows.sub(1).sub(depth).mul(u.spacing));
    const z = select(away, zAway, zTowards);
    const textureRow = select(live, int(0), newest.sub(k.sub(1)).add(capacity).mod(capacity).add(1));
    const shown = slides.or(k.notEqual(1)).or(phase.greaterThanEqual(EMERGE));
    // World height of a level of 1 on this row.
    const rise = u.peak.mul(HEIGHT).mul(u.depthScale.sub(1).mul(far).add(1));
    // The last row fades out over its final step back, so it never leaves in one frame.
    const leaving = clamp(u.rows.sub(1).sub(depth), 0, 1);
    const fade = u.alpha.mul(max(near, 1e-4).pow(u.fadeCurve)).mul(leaving);
    // What the row shows at point `index`, 0 to about 1. Flowing away, the levels it was
    // cut with. Flowing towards, the live levels, flat in the distance and full beside
    // the camera. A trench flattens the middle of every row.
    const heightAt = (index) => {
      const from = fold ? int(round(clamp(fold(alongAt(index)), 0, 1).mul(points - 1))) : index;
      const cut = textureLoad(texture, ivec2(from, textureRow)).x;
      const now = textureLoad(texture, ivec2(from, int(0))).x.mul(ease(0, LIVE_FULL, near));
      const across = alongAt(index).sub(0.5).abs().mul(2);
      const walls = select(u.trench.greaterThan(0), ease(u.trench.mul(0.3), u.trench, across), float(1));
      return select(away, cut, now).mul(walls);
    };
    // The signals as they were when the row was cut, by name, and the row's number in
    // the order rows were cut, which it keeps for as long as it is shown.
    const texels = [0, 1].map((i) => textureLoad(marks, ivec2(i, textureRow)));
    const born = Object.fromEntries(MARK_NAMES.map((name, i) => [name, texels[i >> 2]['xyzw'[i & 3]]]));
    const serial = cuts.sub(float(k));
    return { k, live, depth, age, far, near, z, textureRow, shown, rise, fade, heightAt, born, serial };
  };

  // The level `back` rows ago (an int node, 0 the live row) at `along`, 0 to 1 across.
  const levelAt = (along, back) => {
    const point = int(round(clamp(along, 0, 1).mul(points - 1)));
    const row = select(back.equal(0), int(0), newest.sub(back.sub(1)).add(capacity).mod(capacity).add(1));
    return textureLoad(texture, ivec2(point, row)).x;
  };
  shared.ridge = { texture, marks, points, capacity: history.capacity, newest, phase, cuts, u, rowAt, alongAt, levelAt, WIDTH, HEIGHT, LEAD, EMERGE, LIVE_FULL };

  const geometry = new PlaneGeometry(1, 1, points - 1, 1);
  const count = MAX_ROWS + 1;
  const curtain = new InstancedMesh(geometry, new MeshBasicNodeMaterial(), count);
  const line = new InstancedMesh(geometry, new MeshBasicNodeMaterial(), count);
  for (const mesh of [curtain, line]) mesh.frustumCulled = false;

  const object = new Group();
  object.add(curtain, line);
  // A shape may draw the ridge more than once (a reflection, a facing wall): each copy is
  // another pair of meshes with the same materials, told apart by its number.
  const copy = userData('copy', 'float');
  for (const mesh of [curtain, line]) mesh.userData.copy = 0;
  let copies = [];
  // Whatever else the current line style draws, each `{ object, frame?, setRows?, dispose? }`.
  let extras = [];
  let rows = count;

  // Builds the two materials for `look`: `{ shape, line, tint, ground, veil }`, the first
  // three entries of their slots, `ground` a colour node for what is behind the ridge, and
  // `veil` what the backdrop would paint the curtains with, if anything.
  function setLook(look) {
    const row = rowAt(int(instanceIndex), look.shape.fold ?? null);
    const index = int(round(positionGeometry.x.add(0.5).mul(points - 1)));
    // World position of a point `along` a row (0 to 1) at `height` world units above its base.
    const place = (along, height, r = row) => look.shape.place({ ...shared, along, height, row: r, u, copy, phase, cuts, WIDTH });
    const level = row.heightAt(index);

    // The fragment's side of things: what a pixel of the line knows about where it is.
    const v = {
      // Height through the gradient's range, and the raw level.
      t: varying(clamp(level.div(GRADIENT_TOP), 0, 1)),
      height: varying(level),
      fade: varying(row.fade),
      along: varying(alongAt(index)),
      pointIndex: varying(float(index)),
      // -1 to 1 across the line's width; on the curtain, `up` is 0 at its foot and 1 at its top.
      across: varying(positionGeometry.y.mul(2)),
      up: varying(positionGeometry.y.add(0.5)),
      near: varying(row.near),
      far: varying(row.far),
      age: varying(row.age),
    };
    const ground = look.ground;
    const paint = {
      ...shared,
      ...v,
      u, resolution, pixelRatio, ground, copy, phase, cuts,
      // A colour faded towards what is behind the ridge, as the row's age asks.
      faded: (colour) => mix(ground, colour, v.fade),
      // The vertex's side: the row, the point, and the means to place others.
      // `rowAt` reads the spectrum as the shape folds it.
      row, index, level, points, texture, alongAt, levelAt, place, WIDTH,
      rowAt: (k) => rowAt(k, look.shape.fold ?? null),
    };
    // The tint's colour, for this pixel of the line or, given other values for any of
    // the context's (`t`, `along`, `height`, ...), for something else a style draws.
    const tintOf = (other = {}) => look.tint.colour({ ...paint, ...other });
    const toClip = (p) => cameraProjectionMatrix.mul(cameraViewMatrix).mul(modelWorldMatrix).mul(vec4(p, 1));
    // A point at or behind the eye has no place on screen; its w is held just in front.
    const toPixels = (clip) => clip.xy.div(max(clip.w, 1e-3)).mul(resolution).mul(0.5);
    // Which side of the line a vertex is on, -1 or 1.
    const side = sign(positionGeometry.y);
    // The clip-space position of a vertex of a stroke through the world points `at(i)`,
    // `half` pixels to either side: each vertex is projected with its neighbours, then
    // moved along the screen-space normal to its own side. For a material's `vertexNode`,
    // on the ridge's geometry.
    const stroke = (at, half) => {
      const clip = toClip(at(index)).toVar();
      const prev = toPixels(toClip(at(max(index.sub(1), 0))));
      const next = toPixels(toClip(at(min(index.add(1), points - 1))));
      // A row seen end-on has neighbours on the same pixel, and no direction of its own.
      const span = next.sub(prev).toVar();
      const dir = select(length(span).lessThan(1e-4), vec2(1, 0), normalize(span));
      const offset = vec2(dir.y.negate(), dir.x).mul(side).mul(half);
      return vec4(clip.xy.add(offset.mul(2).div(resolution).mul(clip.w)), clip.zw);
    };
    const c = { ...paint, tint: tintOf(), tintOf, stroke, side, geometry, count };
    const style = look.line.build(c) ?? {};

    // The line traces each row's top: its level, plus whatever the style lifts or shifts
    // each point by.
    const lift = style.lift ?? (() => float(0));
    const shift = style.shift ?? (() => float(0));
    const lifted = (i) => row.heightAt(i).add(lift(i));
    const topAt = (i) => place(alongAt(i).add(shift(i)), lifted(i).mul(row.rise));
    const half = u.lineWidth.mul(pixelRatio).mul(0.5).mul(style.width ?? 1);
    const lineMaterial = new MeshBasicNodeMaterial({ side: DoubleSide });
    // A hidden row lands past the far plane.
    lineMaterial.vertexNode = select(row.shown, stroke(topAt, half), vec4(0, 0, 2, 1));
    lineMaterial.colorNode = style.colour ?? c.faded(c.tint);
    if (style.opacity) {
      lineMaterial.opacityNode = style.opacity;
      lineMaterial.transparent = true;
    }
    for (const key of MATERIAL_KEYS) if (key in style) lineMaterial[key] = style[key];

    // The curtain: from the row's foot to its top. A hidden row collapses to a point,
    // which draws nothing.
    const drape = style.curtain === false ? null : style.curtain ?? {};
    const curtainMaterial = new MeshBasicNodeMaterial({ side: DoubleSide });
    const foot = float(look.shape.floor ?? 0);
    const hung = place(alongAt(index).add(shift(index)), select(positionGeometry.y.greaterThan(0), lifted(index).mul(row.rise), foot));
    curtainMaterial.positionNode = select(row.shown, hung, vec3(0));
    if (drape) {
      curtainMaterial.colorNode = drape.colour ?? look.veil?.(c) ?? ground;
      if (drape.opacity) {
        curtainMaterial.opacityNode = drape.opacity;
        curtainMaterial.transparent = true;
      }
      for (const key of MATERIAL_KEYS) if (key in drape) curtainMaterial[key] = drape[key];
    }
    // Pushed back in depth so a row's own line always wins over its curtain.
    curtainMaterial.polygonOffset = true;
    curtainMaterial.polygonOffsetFactor = 1;
    curtainMaterial.polygonOffsetUnits = 1;

    for (const mesh of [curtain, line]) mesh.material.dispose();
    curtain.material = curtainMaterial;
    line.material = lineMaterial;
    curtain.visible = !!drape;
    line.visible = style.line !== false;

    for (const mesh of copies) object.remove(mesh);
    copies = [];
    for (let i = 1; i < (look.shape.copies ?? 1); i++) {
      for (const [material, visible] of [[curtainMaterial, curtain.visible], [lineMaterial, line.visible]]) {
        const mesh = new InstancedMesh(geometry, material, count);
        mesh.frustumCulled = false;
        mesh.userData.copy = i;
        mesh.visible = visible;
        mesh.count = rows;
        copies.push(mesh);
        object.add(mesh);
      }
    }

    for (const extra of extras) {
      object.remove(extra.object);
      extra.dispose?.();
    }
    extras = [...(style.extras ?? []), ...(look.shape.extras?.(c) ?? [])];
    for (const extra of extras) {
      object.add(extra.object);
      extra.setRows?.(rows);
    }
  }

  // Takes a full settings object; writes uniforms and the row count only.
  function setValues(values) {
    for (const name of VALUE_UNIFORMS) u[name].value = values[name];
    rising.value = values.rising ? 1 : 0;
    rows = Math.min(Math.max(Math.round(values.rows), 1), count);
    for (const mesh of [curtain, line, ...copies]) mesh.count = rows;
    for (const extra of extras) extra.setRows?.(rows);
  }

  // `tick` is the frame's `{ seconds, dt, ... }`, for whatever the line style animates on its own.
  function frame(ridge, tick) {
    if (history.update(ridge, shared.mark)) {
      texture.needsUpdate = true;
      marks.needsUpdate = true;
    }
    newest.value = history.newest;
    cuts.value = ridge.cuts % 1048576;
    phase.value = ridge.phase;
    for (const extra of extras) extra.frame?.(tick);
  }

  return { object, setValues, setLook, frame };
}
