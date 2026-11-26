// A wireframe landscape: beside every row, lines running from front to back through the
// middle of every band join the rows into a grid that rides the music, hidden behind the
// rows in front just as the rows are.
import { DoubleSide, InstancedMesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { clamp, float, instanceIndex, int, min, mix, round, varying } from 'three/tsl';
import { strokeThrough } from '../lib/line-kit.js';

// Band centres sit on every eighth point of a row.
const BAND = 8;
// As the ridge colours its rows: the share of a row's rise that reaches the last stop.
const GRADIENT_TOP = 0.6;

export default {
  name: 'grid',
  build: (c) => {
    const columns = Math.floor((c.points - 1) / BAND) + 1;
    const geometry = new PlaneGeometry(1, 1, c.count - 1, 1);
    const material = new MeshBasicNodeMaterial({ side: DoubleSide });
    // One column per band, through every row from the live one back; past the last row
    // shown, its points gather on that row.
    const point = int(instanceIndex).mul(BAND);
    const last = int(round(c.u.rows)).sub(1);
    const rowOf = (k) => c.rowAt(min(k, last));
    const at = (k) => {
      const r = rowOf(k);
      return c.place(c.alongAt(point), r.heightAt(point).mul(r.rise), r);
    };
    const stroke = strokeThrough(c, at, c.count, c.u.lineWidth.mul(c.pixelRatio).mul(0.5));
    material.vertexNode = stroke.position;

    // Coloured as the rows are, by its own point's height on each row it crosses.
    const r = rowOf(stroke.index);
    const level = r.heightAt(point);
    const fade = varying(r.fade);
    const colour = c.tintOf({
      t: varying(clamp(level.div(GRADIENT_TOP), 0, 1)),
      height: varying(level),
      along: varying(c.alongAt(point)),
      pointIndex: varying(float(point)),
      age: varying(r.age),
      near: varying(r.near),
      far: varying(r.far),
      fade,
      row: r,
      index: point,
      level,
    });
    material.colorNode = mix(c.ground, colour, fade);

    const grid = new InstancedMesh(geometry, material, columns);
    grid.frustumCulled = false;
    return {
      colour: c.faded(c.tint),
      extras: [{
        object: grid,
        dispose: () => {
          geometry.dispose();
          material.dispose();
        },
      }],
    };
  },
};
