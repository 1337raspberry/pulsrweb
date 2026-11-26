// Sparks thrown off the loudest points of each new row: short bright streaks that leap up,
// arc over under their own weight and die out within a second, left hanging in the air as
// the rows move on. Nothing is stored: each spark's whole flight follows from its row's age.
import { AdditiveBlending, DoubleSide, InstancedMesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { float, instanceIndex, int, max, mix, select, smoothstep, varying, vec3, vec4 } from 'three/tsl';
import { keepBrightest, px, random, seedOf, strokeThrough } from '../lib/line-kit.js';

// Sparks from each of this many of the newest rows, this many tries a row; most tries land
// on quiet points and come to nothing.
const ROWS = 16;
const TRIES = 64;
// Seconds a spark lives, and its fall, in world units a second squared.
const LIFE = 0.9;
const FALL = 7;

export default {
  name: 'sparks',
  build: (c) => {
    const light = c.light.value > 0.5;
    const geometry = new PlaneGeometry(1, 1, 1, 1);
    const material = new MeshBasicNodeMaterial({ side: DoubleSide });
    const k = int(instanceIndex).div(TRIES).add(1);
    const j = float(int(instanceIndex).mod(TRIES));
    const row = c.rowAt(k);
    const seed = seedOf(row);
    // Where along the row a spark leaves from, and whether that point is loud enough: the
    // louder the row was cut, the more of its points throw sparks.
    const point = int(random(seed, j).mul(c.points - 1));
    const level = row.heightAt(point);
    const throws = level.greaterThan(float(0.62).sub(row.born.beat.mul(0.25)).sub(row.born.level.mul(0.1)));
    // Its flight: seconds since the row was cut, and where the spark has got to by then,
    // from where the row stood when it was the live one.
    const t = row.depth.div(max(c.u.speed, 1e-3));
    const born = c.rowAt(int(0));
    const start = c.place(c.alongAt(point), level.mul(born.rise), born);
    const flight = vec3(random(seed, j.add(1000)).sub(0.5).mul(2.4), random(seed, j.add(2000)).mul(3).add(2).mul(level.add(0.4)), random(seed, j.add(3000)).sub(0.5).mul(1.6));
    const at = (s) => start.add(flight.mul(s)).sub(vec3(0, FALL / 2, 0).mul(s.mul(s)));
    const alive = throws.and(t.lessThan(LIFE)).and(row.shown);
    // A streak from where the spark was a moment ago to where it is now.
    const stroke = strokeThrough(c, (i) => at(select(i.equal(int(0)), max(t.sub(0.05), 0), t)), 2, px(c, 1).mul(c.u.lineWidth.min(2.5)));
    material.vertexNode = select(alive, stroke.position, vec4(0, 0, 2, 1));
    const heat = varying(float(1).sub(t.div(LIFE)).max(0));
    const hot = mix(c.stops[2], vec3(1), smoothstep(0.5, 1, heat)).mul(heat.mul(2.6));
    material.colorNode = light ? mix(c.ground, mix(c.stops[2], vec3(0), 0.4), heat) : hot;
    material.transparent = true;
    material.depthWrite = false;
    if (light) Object.assign(material, keepBrightest(c));
    else material.blending = AdditiveBlending;

    const sparks = new InstancedMesh(geometry, material, ROWS * TRIES);
    sparks.frustumCulled = false;
    return {
      colour: c.faded(c.tint),
      extras: [{
        object: sparks,
        dispose: () => {
          geometry.dispose();
          material.dispose();
        },
      }],
    };
  },
};
