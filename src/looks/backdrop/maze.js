// A walk through a brick maze behind the ridge, seen through the walker's eyes: down a
// corridor, round a corner, on again, keeping a hand on the right-hand wall so every
// passage is found in the end. It walks faster as the music fills out, the light reaches further
// down the corridor when it is loud, bright solids hang in the dead ends, and a drop turns
// the whole place upside down.
import { BoxGeometry, CanvasTexture, InstancedMesh, LinearMipmapLinearFilter, Matrix4, Mesh, MeshBasicNodeMaterial, NoColorSpace, OctahedronGeometry, PlaneGeometry, Quaternion, RepeatWrapping, Vector3 } from 'three/webgpu';
import { abs, dot, fog, mix, normalWorld, rangeFogFactor, texture, uniform, uv as surfaceUV, vec3 } from 'three/tsl';
import { createDiorama } from '../lib/backdrop-diorama.js';
import { follow } from '../lib/backdrop-kit.js';

// Cells along each side of the maze, and the size of a cell and of its walls in world units.
const CELLS = 10;
const CELL = 2;
const TALL = 2;
const THICK = 0.14;
const EYE = 1;
const FOV = 72;
// Cells a second the walker covers, in silence and with the music at its fullest.
const PACE = [0.45, 1.6];
// How much of a cell either side of a corner the walker spends looking round it, and how
// long turning right round in a dead end takes, as a share of the time a cell takes.
const SWEEP = 0.45;
const ABOUT = 1.1;
// How far down a corridor the light reaches, in silence and at full level.
const REACH = [7, 15];
// Seconds the place takes to turn over.
const ROLL = 1.6;

// The four ways out of a cell, clockwise from north: each a step in x and in z.
const WAYS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// A maze with exactly one route between any two cells, cut by a random depth-first walk.
// Returns, for every cell, which of its four ways are open.
function cutMaze() {
  const open = Array.from({ length: CELLS * CELLS }, () => [false, false, false, false]);
  const seen = new Uint8Array(CELLS * CELLS);
  const stack = [[0, 0]];
  seen[0] = 1;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const ways = [0, 1, 2, 3].filter((d) => {
      const [a, b] = [i + WAYS[d][0], j + WAYS[d][1]];
      return a >= 0 && b >= 0 && a < CELLS && b < CELLS && !seen[b * CELLS + a];
    });
    if (ways.length === 0) {
      stack.pop();
      continue;
    }
    const d = ways[Math.floor(Math.random() * ways.length)];
    const [a, b] = [i + WAYS[d][0], j + WAYS[d][1]];
    open[j * CELLS + i][d] = true;
    open[b * CELLS + a][(d + 2) % 4] = true;
    seen[b * CELLS + a] = 1;
    stack.push([a, b]);
  }
  return open;
}

// A square of pattern drawn in greys, to be multiplied by a colour: `draw(ctx, size)`.
function pattern(draw, repeat = 1) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const made = new CanvasTexture(canvas);
  made.colorSpace = NoColorSpace;
  made.wrapS = RepeatWrapping;
  made.wrapT = RepeatWrapping;
  made.repeat.set(repeat, repeat);
  made.minFilter = LinearMipmapLinearFilter;
  made.anisotropy = 8;
  return made;
}

// Courses of bricks in running bond, each brick its own shade, the mortar a little paler.
function bricks(ctx, size) {
  const across = 4;
  const courses = 8;
  const w = size / across;
  const h = size / courses;
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < courses; row++) {
    for (let k = -1; k < across; k++) {
      const shade = Math.round(105 + Math.random() * 75);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect((k + (row % 2) * 0.5) * w + 2, row * h + 2, w - 4, h - 4);
    }
  }
}

// Square tiles, alternately darker.
function tiles(ctx, size) {
  const half = size / 2;
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = (k + (k >> 1)) % 2 ? '#8a8a8a' : '#c4c4c4';
    ctx.fillRect((k % 2) * half, (k >> 1) * half, half, half);
  }
  ctx.strokeStyle = '#5c5c5c';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, half, half);
  ctx.strokeRect(half, half, half, half);
}

export default {
  name: 'maze',
  build: ({ renderer, resolution, uv, background, stops, light, signals }) => {
    const diorama = createDiorama({ renderer, resolution, uv, fov: FOV, near: 0.05, far: 60 });
    const { scene, camera } = diorama;
    scene.backgroundNode = background;
    // The corridor fades into the background's colour where the light gives out.
    const reach = uniform(REACH[0]);
    scene.fogNode = fog(background, rangeFogFactor(0.5, reach));
    const open = cutMaze();
    const disposables = [];
    const keep = (thing) => {
      disposables.push(thing);
      return thing;
    };

    // Walls facing east and west are in full light, those facing north and south in
    // shade, so a corner shows as a corner without any lamp.
    const facing = abs(normalWorld.x).mul(0.3).add(0.7);
    const paintOf = (tone) => mix(mix(tone, vec3(1), 0.08), tone, light);
    // The walls and floors are painted well back towards the background, so that lines in
    // the palette's own colours still stand out in front of them.
    const dull = (tone, share) => mix(background, paintOf(tone), share);

    const brick = keep(pattern(bricks));
    const wallMaterial = keep(new MeshBasicNodeMaterial());
    wallMaterial.colorNode = dull(stops[1], 0.36).mul(texture(brick, surfaceUV()).r).mul(facing);
    const box = keep(new BoxGeometry(1, 1, 1));
    const places = [];
    const put = (x, z, wide, deep) => places.push(new Matrix4().compose(new Vector3(x, TALL / 2, z), new Quaternion(), new Vector3(wide, TALL, deep)));
    for (let j = 0; j < CELLS; j++) {
      for (let i = 0; i < CELLS; i++) {
        const x = (i + 0.5) * CELL;
        const z = (j + 0.5) * CELL;
        if (!open[j * CELLS + i][0]) put(x, j * CELL, CELL + THICK, THICK);
        if (!open[j * CELLS + i][3]) put(i * CELL, z, THICK, CELL + THICK);
        if (j === CELLS - 1) put(x, CELLS * CELL, CELL + THICK, THICK);
        if (i === CELLS - 1) put(CELLS * CELL, z, THICK, CELL + THICK);
      }
    }
    const walls = new InstancedMesh(box, wallMaterial, places.length);
    places.forEach((m, k) => walls.setMatrixAt(k, m));
    walls.frustumCulled = false;
    scene.add(walls);

    const side = CELLS * CELL;
    const slab = keep(new PlaneGeometry(side, side));
    const floorMaterial = keep(new MeshBasicNodeMaterial());
    floorMaterial.colorNode = dull(stops[0], 0.3).mul(texture(keep(pattern(tiles, CELLS))).r).mul(0.8);
    const floor = new Mesh(slab, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(side / 2, 0, side / 2);
    const ceilingMaterial = keep(new MeshBasicNodeMaterial());
    ceilingMaterial.colorNode = dull(stops[0], 0.22).mul(texture(keep(pattern(tiles, CELLS * 2))).r);
    const ceiling = new Mesh(slab, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(side / 2, TALL, side / 2);
    scene.add(floor, ceiling);

    // A bright solid turning under the ceiling of every dead end, out of the walker's way,
    // lit from above and swelling on the beat.
    const gemMaterial = keep(new MeshBasicNodeMaterial());
    const lit = dot(normalWorld, vec3(0.3, 0.8, 0.5)).mul(0.45).add(0.75);
    gemMaterial.colorNode = paintOf(stops[2]).mul(lit).mul(signals.beat.mul(0.8).add(1));
    gemMaterial.fog = false;
    const gemGeometry = keep(new OctahedronGeometry(0.2, 0));
    const ends = [];
    open.forEach((ways, k) => {
      if (k > 0 && ways.filter(Boolean).length === 1) ends.push(new Vector3(((k % CELLS) + 0.5) * CELL, TALL - 0.42, (Math.floor(k / CELLS) + 0.5) * CELL));
    });
    const gems = new InstancedMesh(gemGeometry, gemMaterial, Math.max(ends.length, 1));
    gems.count = ends.length;
    gems.frustumCulled = false;
    scene.add(gems);
    const turnOf = new Quaternion();
    const tilt = new Vector3(0.4, 1, 0.2).normalize();
    const matrix = new Matrix4();
    const size = new Vector3();

    const yawOf = (d) => (-d * Math.PI) / 2;
    const ease = (t) => t * t * (3 - 2 * t);
    // From angle `a` to angle `b` the short way round, `t` of the way.
    const between = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
    // The way out of cell (i, j) for a walker who came in heading `d`: the first open one
    // of right, straight on, left, back.
    const wayOn = (i, j, d) => [1, 0, 3, 2].map((k) => (d + k) % 4).find((k) => open[j * CELLS + i][k]);

    // The walker: the cell it is leaving, the way it is heading, the ways it was heading
    // before and will head next, and how far it is towards the next cell (0 to 1). In a
    // dead end it stops to turn right round: `about` is how far through that it is.
    const first = open[0][2] ? 2 : 1;
    const walker = { i: 0, j: 0, d: first, before: first, next: wayOn(WAYS[first][0], WAYS[first][1], first), done: 0, about: -1 };
    let rolled = 0;
    let rolling = 0;
    let dropped = false;
    let swell = 0;

    function frame({ seconds, dt, shared }) {
      const s = shared.signals;
      const full = s.energy.value * (1 - s.silence.value);
      const pace = PACE[0] + (PACE[1] - PACE[0]) * full;
      let left = dt * pace;
      // A long frame may finish one move and start the next.
      for (let moves = 0; moves < 4 && left > 0; moves++) {
        if (walker.about >= 0) {
          const room = (1 - walker.about) * ABOUT;
          if (left < room) {
            walker.about += left / ABOUT;
            break;
          }
          left -= room;
          walker.about = -1;
          walker.before = walker.d;
          continue;
        }
        const room = 1 - walker.done;
        if (left < room) {
          walker.done += left;
          break;
        }
        left -= room;
        walker.i += WAYS[walker.d][0];
        walker.j += WAYS[walker.d][1];
        walker.before = walker.d;
        walker.d = walker.next;
        walker.next = wayOn(walker.i + WAYS[walker.d][0], walker.j + WAYS[walker.d][1], walker.d);
        walker.done = 0;
        if (walker.d === (walker.before + 2) % 4) walker.about = 0;
      }
      const forward = walker.about >= 0 ? 0 : walker.done;
      const x = (walker.i + 0.5 + WAYS[walker.d][0] * forward) * CELL;
      const z = (walker.j + 0.5 + WAYS[walker.d][1] * forward) * CELL;
      // It looks round a corner as it comes to it: the turn starts SWEEP of a cell before
      // the corner and ends as far after it, without the walker stopping.
      let yaw = yawOf(walker.d);
      const ahead = walker.next !== walker.d && walker.next !== (walker.d + 2) % 4;
      if (walker.about >= 0) yaw = yawOf(walker.before) + Math.PI * ease(walker.about);
      else if (forward < SWEEP && walker.before !== walker.d) yaw = between(yawOf(walker.before), yaw, ease(0.5 + forward / (2 * SWEEP)));
      else if (forward > 1 - SWEEP && ahead) yaw = between(yaw, yawOf(walker.next), ease((forward - (1 - SWEEP)) / (2 * SWEEP)));
      // A drop turns the place over, and the next one turns it back.
      if (s.drop.value > 0.8 && !dropped && rolling === 0 && shared.still.value < 0.5) rolling = ROLL;
      dropped = s.drop.value > 0.8;
      if (rolling > 0) {
        rolling = Math.max(rolling - dt, 0);
        if (rolling === 0) rolled = 1 - rolled;
      }
      const over = rolling > 0 ? 1 - rolling / ROLL : 0;
      const roll = (rolled + over * over * (3 - 2 * over)) * Math.PI;
      camera.position.set(x, EYE + Math.sin(forward * Math.PI * 2) * 0.025, z);
      camera.rotation.set(0, yaw, roll, 'YXZ');

      reach.value = follow(reach.value, REACH[0] + (REACH[1] - REACH[0]) * s.level.value, dt, 0.25);
      swell = follow(swell, s.beat.value, dt, 0.06);
      turnOf.setFromAxisAngle(tilt, seconds * 0.9);
      ends.forEach((at, k) => gems.setMatrixAt(k, matrix.compose(at, turnOf, size.setScalar(1 + 0.35 * swell))));
      gems.instanceMatrix.needsUpdate = true;
      diorama.render();
    }

    return {
      colour: diorama.colour,
      // The ridge's hills are smoked glass: the maze behind them shows through dimly.
      veil: (c) => mix(background, c.ground, 0.3),
      solid: true,
      frame,
      dispose() {
        for (const thing of disposables) thing.dispose();
        walls.dispose();
        gems.dispose();
        diorama.dispose();
      },
    };
  },
};
