// Pipes being laid through the space behind the ridge: fat glossy tubes that grow a step at
// a time, turn at right angles with a ball at every bend, and fill the space until it is
// cleared and begun again. They grow faster as the music fills out, the newest stretch of
// each glows, and a beat lights every joint for a moment.
import { AmbientLight, CylinderGeometry, DirectionalLight, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshPhongNodeMaterial, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu';
import { attribute, exp, fog, mix, positionLocal, rangeFogFactor, uniform, vec3 } from 'three/tsl';
import { createDiorama, swingOf } from '../lib/backdrop-diorama.js';
import { ramp3 } from '../lib/colour.js';

// The space the pipes are laid in, in cells one world unit across: wide, tall, deep.
const GRID = [31, 19, 10];
// How far in front of the nearest cells the eye stands, and its field of view in degrees.
const BACK = 9;
const FOV = 50;
const RADIUS = 0.27;
const JOINT = 0.4;
// Pipes being laid at once, and the most stretches and joints there can ever be.
const HEADS = 3;
const MOST_RUNS = 900;
const MOST_JOINTS = 700;
// Cells a second each pipe grows, in silence and with the music at its fullest.
const PACE = [0.5, 2.6];
// A pipe keeps straight on this often when it can, and ends itself after about this many cells.
const STRAIGHT = 0.62;
const LONGEST = 90;
// The space is cleared once this share of what the eye can see of it is pipe, over this
// many seconds.
const FULL = 0.22;
const CLEARING = 1.6;
// How long, in seconds, a newly laid stretch takes to cool.
const COOLING = 1.4;
// Cells laid before the pipes are first seen, so they never open on an empty space.
const HEAD_START = 110;

const DIRECTIONS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const UP = new Vector3(0, 1, 0);

export default {
  name: 'pipes',
  build: ({ renderer, resolution, uv, background, stops, light, time, signals }) => {
    const diorama = createDiorama({ renderer, resolution, uv, fov: FOV, near: 0.5, far: 80 });
    const { scene, camera } = diorama;
    scene.backgroundNode = background;
    // Far pipes sink into the background's colour.
    scene.fogNode = fog(background, rangeFogFactor(BACK + 1, BACK + GRID[2] + 3));
    const sun = new DirectionalLight(0xffffff, 2.4);
    sun.position.set(-4, 7, 9);
    scene.add(sun, new AmbientLight(0xffffff, 0.55));

    // 1 while the pipes stand, falling to 0 as they are cleared away.
    const standing = uniform(1);
    // Each stretch and joint carries where its pipe's colour sits in the palette, when it
    // was laid, and how dark its pipe's paint is.
    const material = (thin) => {
      const m = new MeshPhongNodeMaterial();
      const laid = attribute('laid', 'vec3');
      const tone = ramp3(stops, laid.x).mul(laid.z);
      // Lighter than the line colours on a dark background, so the pipes read as painted
      // metal; left as they are on a light one.
      const paint = mix(mix(tone, vec3(1), 0.12), tone, light);
      const fresh = exp(time.sub(laid.y).max(0).div(-COOLING));
      m.colorNode = paint;
      m.emissiveNode = paint.mul(fresh.mul(0.3).add(signals.beat.mul(thin ? 0.03 : 0.25)));
      m.shininess = 70;
      m.specular.setScalar(0.55);
      // Cleared pipes shrink to nothing: a stretch keeps its length and loses its girth.
      m.positionNode = positionLocal.mul(thin ? vec3(standing, 1, standing) : vec3(standing));
      return m;
    };
    const flock = (geometry, most, thin) => {
      const laid = new InstancedBufferAttribute(new Float32Array(most * 3), 3);
      laid.setUsage(DynamicDrawUsage);
      geometry.setAttribute('laid', laid);
      const mesh = new InstancedMesh(geometry, material(thin), most);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { mesh, laid, geometry };
    };
    // A stretch is a unit length of pipe lying along y; a joint is a ball.
    const runs = flock(new CylinderGeometry(RADIUS, RADIUS, 1, 14, 1, true), MOST_RUNS, true);
    const joints = flock(new SphereGeometry(1, 16, 10), MOST_JOINTS, false);

    const taken = new Uint8Array(GRID[0] * GRID[1] * GRID[2]);
    const cellOf = ([x, y, z]) => (z * GRID[1] + y) * GRID[0] + x;
    const worldOf = ([x, y, z], out) => out.set(x - (GRID[0] - 1) / 2, y - (GRID[1] - 1) / 2, z - (GRID[2] - 1));
    // Pipes keep to the part of the space the eye can see, with a cell to spare all round:
    // `wide` and `tall` are half the view's size a unit away.
    let tall = Math.tan((FOV * Math.PI) / 360);
    let wide = tall * 1.6;
    const inside = ([x, y, z]) => {
      if (x < 0 || y < 0 || z < 0 || x >= GRID[0] || y >= GRID[1] || z >= GRID[2]) return false;
      const away = BACK + GRID[2] - 1 - z;
      return Math.abs(x - (GRID[0] - 1) / 2) <= away * wide + 1 && Math.abs(y - (GRID[1] - 1) / 2) <= away * tall + 1;
    };
    const step = (cell, d) => [cell[0] + DIRECTIONS[d][0], cell[1] + DIRECTIONS[d][1], cell[2] + DIRECTIONS[d][2]];
    const free = (cell) => inside(cell) && taken[cellOf(cell)] === 0;

    const turns = DIRECTIONS.map(([x, y, z]) => new Quaternion().setFromUnitVectors(UP, new Vector3(x, y, z)));
    const matrix = new Matrix4();
    const at = new Vector3();
    const size = new Vector3();
    const round = new Quaternion();

    let filled = 0;
    // How many cells the eye can see.
    let room = 1;
    let clearing = 0;
    let heads = [];

    function putJoint(index, cell, radius, { tone, shade }, seconds, along = 0, d = 0) {
      worldOf(cell, at);
      at.x += DIRECTIONS[d][0] * along;
      at.y += DIRECTIONS[d][1] * along;
      at.z += DIRECTIONS[d][2] * along;
      joints.mesh.setMatrixAt(index, matrix.compose(at, round, size.setScalar(radius)));
      joints.laid.setXYZ(index, tone, seconds, shade);
    }
    function addJoint(cell, pipe, seconds) {
      if (joints.mesh.count >= MOST_JOINTS) return;
      putJoint(joints.mesh.count, cell, JOINT, pipe, seconds);
      joints.mesh.count += 1;
    }
    function putRun(head, seconds) {
      const length = Math.min(head.grown, 1);
      worldOf(head.from, at);
      at.x += DIRECTIONS[head.d][0] * length * 0.5;
      at.y += DIRECTIONS[head.d][1] * length * 0.5;
      at.z += DIRECTIONS[head.d][2] * length * 0.5;
      runs.mesh.setMatrixAt(head.run, matrix.compose(at, turns[head.d], size.set(1, Math.max(length, 1e-3), 1)));
      runs.laid.setXYZ(head.run, head.tone, seconds, head.shade);
      // The ball that rides the open end of the pipe.
      putJoint(head.tip, head.from, RADIUS, head, seconds, length, head.d);
    }

    // The ways on from `cell` that are free, never straight back.
    const waysOn = (cell, d) => DIRECTIONS.map((_, k) => k).filter((k) => k !== (d ^ 1) && free(step(cell, k)));

    // Starts head `i` on a new pipe somewhere free, or leaves it idle if nowhere is.
    function begin(i, seconds) {
      const head = heads[i];
      head.idle = true;
      for (let tries = 0; tries < 40; tries++) {
        const cell = GRID.map((n) => Math.floor(Math.random() * n));
        if (!free(cell)) continue;
        const ways = waysOn(cell, -1);
        if (ways.length === 0 || runs.mesh.count >= MOST_RUNS) continue;
        taken[cellOf(cell)] = 1;
        filled += 1;
        Object.assign(head, { idle: false, from: cell, d: ways[Math.floor(Math.random() * ways.length)], grown: 0, cells: 0, tone: Math.random(), shade: 0.5 + 0.5 * Math.random(), run: runs.mesh.count });
        runs.mesh.count += 1;
        taken[cellOf(step(cell, head.d))] = 1;
        filled += 1;
        addJoint(cell, head, seconds);
        return;
      }
    }

    // Carries head `i` on from the end of the stretch it has just finished.
    function carryOn(i, seconds) {
      const head = heads[i];
      const cell = step(head.from, head.d);
      head.cells += 1;
      const ways = waysOn(cell, head.d);
      const spent = head.cells >= LONGEST || runs.mesh.count >= MOST_RUNS || ways.length === 0;
      if (spent) {
        // The pipe ends in a ball, and the head goes off to start another.
        addJoint(cell, head, seconds);
        begin(i, seconds);
        return;
      }
      const d = ways.includes(head.d) && Math.random() < STRAIGHT ? head.d : ways[Math.floor(Math.random() * ways.length)];
      if (d !== head.d) addJoint(cell, head, seconds);
      Object.assign(head, { from: cell, d, grown: head.grown - 1, run: runs.mesh.count });
      runs.mesh.count += 1;
      taken[cellOf(step(cell, d))] = 1;
      filled += 1;
    }

    function reset(seconds) {
      taken.fill(0);
      filled = 0;
      tall = Math.tan((FOV * Math.PI) / 360);
      wide = tall * camera.aspect;
      room = 0;
      for (let x = 0; x < GRID[0]; x++) for (let y = 0; y < GRID[1]; y++) for (let z = 0; z < GRID[2]; z++) if (inside([x, y, z])) room += 1;
      runs.mesh.count = 0;
      // The first joints are the balls riding each pipe's open end.
      joints.mesh.count = HEADS;
      heads = Array.from({ length: HEADS }, (_, i) => ({ tip: i, idle: true }));
      for (let i = 0; i < HEADS; i++) begin(i, seconds);
    }

    // Lays pipe for `dt` seconds at `pace` cells a second. Returns how many heads have
    // nowhere left to go.
    function lay(seconds, dt, pace) {
      let idle = 0;
      for (let i = 0; i < HEADS; i++) {
        const head = heads[i];
        if (head.idle) begin(i, seconds);
        if (head.idle) {
          idle += 1;
          // Out of sight until it has somewhere to go.
          joints.mesh.setMatrixAt(head.tip, matrix.makeScale(0, 0, 0));
          continue;
        }
        head.grown += dt * pace;
        while (!head.idle && head.grown >= 1) {
          putRun({ ...head, grown: 1 }, seconds);
          carryOn(i, seconds);
        }
        if (!head.idle) putRun(head, seconds);
      }
      return idle;
    }

    let begun = false;
    function frame({ seconds, dt, shared, camera: eye }) {
      const s = shared.signals;
      if (!begun) {
        // The first time, the space already has some pipe in it, laid long enough ago to
        // have cooled.
        begun = true;
        diorama.render();
        reset(seconds);
        for (let n = 0; n < HEAD_START; n++) lay(seconds - 60, 1 / HEADS, 1);
      }
      if (clearing > 0) {
        clearing = Math.max(clearing - dt, 0);
        standing.value = clearing / CLEARING;
        if (clearing === 0) {
          reset(seconds);
          standing.value = 1;
        }
      } else {
        const pace = PACE[0] + (PACE[1] - PACE[0]) * s.energy.value * (1 - s.silence.value);
        const idle = lay(seconds, dt, pace);
        if (filled >= FULL * room || idle === HEADS || runs.mesh.count >= MOST_RUNS) clearing = CLEARING;
      }
      for (const { mesh, laid } of [runs, joints]) {
        mesh.instanceMatrix.needsUpdate = true;
        laid.needsUpdate = true;
      }
      // The eye leans the way the visitor has swung the ridge's camera, and sways a little
      // by itself, so the pipes have some depth to them.
      const { turn, dip } = swingOf(eye);
      const a = -turn * 0.5 + Math.sin(seconds * 0.07) * 0.12;
      const p = dip * 0.35 + Math.sin(seconds * 0.05) * 0.04;
      const far = BACK + (GRID[2] - 1) / 2;
      const middle = -(GRID[2] - 1) / 2;
      camera.position.set(Math.sin(a) * Math.cos(p) * far, Math.sin(p) * far, middle + Math.cos(a) * Math.cos(p) * far);
      camera.lookAt(0, 0, middle);
      diorama.render();
    }

    return {
      // Held back a little towards the background, so the ridge stays the brightest thing.
      colour: mix(background, diorama.colour, 0.8),
      // The pipes are behind everything: the ridge's hills are the empty background, and
      // hide them outright.
      veil: () => background,
      solid: true,
      frame,
      dispose() {
        for (const { mesh, geometry } of [runs, joints]) {
          geometry.dispose();
          mesh.material.dispose();
          mesh.dispose();
        }
        diorama.dispose();
      },
    };
  },
};
