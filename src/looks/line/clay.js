// The rows fused into one solid relief, as if modelled in clay: a skin joins each row to the
// next, lit by a low light from the upper left of the view, darker down in the valleys, in the
// row's colours, with the rows themselves left as faint ridges along it.
import { DoubleSide, InstancedMesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { clamp, cross, dot, int, max, min, mix, modelWorldMatrix, normalize, positionGeometry, select, smoothstep, varying, vec3, vec4 } from 'three/tsl';

// As the ridge colours its rows: the share of a row's rise that reaches the last stop.
const GRADIENT_TOP = 0.6;
// Where the light comes from, in the camera's own axes: left, up, towards the viewer.
const KEY = [-0.75, 0.55, 0.5];

export default {
  name: 'clay',
  build: (c) => {
    const last = c.points - 1;
    // Each instance joins row `k` (its top edge) to the row behind it in time (its bottom
    // edge). For a moment after a cut the ridge hides its newest history row; the live row
    // is then joined straight to the one after it, and the hidden row's own strip folds away.
    const k = c.row.k;
    const hidden = c.rowAt(int(1)).shown.not();
    const a = c.row;
    const b = c.rowAt(select(k.equal(int(0)).and(hidden), int(2), k.add(1)));
    const gone = k.equal(int(1)).and(hidden);
    const top = positionGeometry.y.greaterThan(0);
    const i = c.index;
    const point = (r, j) => c.place(c.alongAt(j), r.heightAt(j).mul(r.rise), r);
    const before = max(i.sub(1), 0);
    const after = min(i.add(1), last);
    const here = select(top, point(a, i), point(b, i));
    const there = select(top, point(b, i), point(a, i));
    const run = select(top, point(a, after).sub(point(a, before)), point(b, after).sub(point(b, before)));
    // The surface's normal from its two directions, along the row and across to the next,
    // turned to face the eye; where two rows meet in one place, the shape's own up.
    const across = select(top, there.sub(here), here.sub(there));
    const level = select(top, a.heightAt(i), b.heightAt(i));
    const rise = select(top, a.rise, b.rise);
    const along = c.alongAt(i);
    const lifted = select(top, c.place(along, level.mul(rise).add(0.05), a), c.place(along, level.mul(rise).add(0.05), b)).sub(here);
    const crossed = cross(run, across);
    const normal = modelWorldMatrix.mul(vec4(select(crossed.length().lessThan(1e-6), lifted, crossed), 0)).xyz.normalize();
    const world = modelWorldMatrix.mul(vec4(here, 1)).xyz;
    const facing = select(dot(normal, c.camera.position.sub(world)).lessThan(0), normal.negate(), normal);

    const material = new MeshBasicNodeMaterial({ side: DoubleSide });
    material.positionNode = select(gone, vec3(0), here);
    // Behind the rows' own lines, which sit along the skin's edges.
    material.polygonOffset = true;
    material.polygonOffsetFactor = 2;
    material.polygonOffsetUnits = 2;

    // The light, fixed to the view so every shape is lit the same way on screen.
    const axis = (x, y, z) => c.camera.world.mul(vec4(x, y, z, 0)).xyz;
    const key = normalize(axis(...KEY));
    const up = normalize(axis(0, 1, 0));
    const n = normalize(varying(facing));
    const eye = normalize(varying(c.camera.position.sub(world)));
    const height = varying(level);
    const fade = varying(select(top, a.fade, b.fade));
    const tinted = c.tintOf({
      t: clamp(height.div(GRADIENT_TOP), 0, 1),
      height,
      fade,
      age: varying(select(top, a.age, b.age)),
      near: varying(select(top, a.near, b.near)),
      far: varying(select(top, a.far, b.far)),
    });
    // On a light background the clay is a pale one in the row's colour, so a dark tint still
    // shows its light and shade.
    const tint = mix(tinted, mix(tinted, vec3(1), 0.55), c.light);
    // A low light raking across a matte surface, wrapped a little round its shadows; valleys
    // sink into shade; a little sky from above and a little light caught along the edges seen
    // side on.
    const lambert = dot(n, key);
    const light = lambert.max(0).mul(0.75).add(lambert.mul(0.5).add(0.5).pow(2).mul(0.25));
    const sky = dot(n, up).mul(0.5).add(0.5);
    const valley = smoothstep(0, 0.3, height).mul(0.4).add(0.6);
    const rim = dot(n, eye).abs().oneMinus().pow(3).mul(0.15);
    const lit = tint.mul(light.mul(0.9).add(sky.mul(0.12)).mul(valley).add(0.05)).add(mix(tint, vec3(1), 0.5).mul(rim));
    material.colorNode = mix(c.ground, lit, fade);

    const skin = new InstancedMesh(c.geometry, material, c.count);
    skin.frustumCulled = false;
    // The shape reads which copy of the ridge it is placing; the skin is on the first.
    skin.userData.copy = 0;
    // Under the skin the rows' curtains still stand; the one at the camera's end of the
    // ridge is the relief's cut front face, clay in shadow, darkest at its foot.
    const cut = mix(c.ground, c.tint.mul(c.up.mul(0.2).add(0.1)), 0.9);
    return {
      width: 0.6,
      colour: c.faded(mix(c.tint, c.ground, 0.25)),
      curtain: { colour: mix(c.ground, cut, c.fade) },
      extras: [{
        object: skin,
        setRows: (rows) => { skin.count = Math.max(rows - 1, 0); },
        dispose: () => material.dispose(),
      }],
    };
  },
};
