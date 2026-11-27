// A spiky pipe being laid through the air: every row is a ring round the pipe with its
// peaks pointing out, put down where the pipe's end is, and the pipe runs straight between
// square bends, turning now one way, now another, while the oldest rings are taken up.
import { DoubleSide, Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { cos, float, positionGeometry, sin, TWO_PI } from 'three/tsl';
import { squash } from '../lib/shape-kit.js';
import { carriedAcross, evenly, laidPath, rowsBack } from '../lib/shape-path.js';

// The points the pipe may run through: a few across, up and back, the space the front view
// looks at.
const ACROSS = [-6, -3, 0, 3, 6];
const UP = [2.5, 5, 7.5];
const BACK = [-14, -11, -8, -5, -2];
// Radius of the bends, of the pipe, and the limit and scale of its peaks.
const BEND = 1.2;
const BORE = 0.85;
const CAP = 1.5;
const SCALE = 0.45;
// Rows are this far apart along the pipe, in multiples of the spacing setting.
const STRIDE = 0.8;
// Rings reach this far into the core, so no gap opens between a ring and the core.
const SINK = 0.2;
// How many straight lengths the pipe is laid in before it finds its way back to where it
// began, and how much likelier it is to carry straight on than to take any one turn.
const LENGTHS = 1400;
const STRAIGHT = 5;

// A small, steady source of numbers from 0 up to 1, so the pipe's route is the same on
// every visit.
function numbers(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The six ways a pipe can run; each way's opposite is its neighbour in the list.
const WAYS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const SIZES = [ACROSS.length, UP.length, BACK.length];
const inside = (n) => n.every((v, i) => v >= 0 && v < SIZES[i]);
const step = (n, way) => n.map((v, i) => v + WAYS[way][i]);
const nameOf = (n) => n.join(',');

// The route: from the middle, a length at a time, carrying on or turning but never back on
// itself, and keeping clear of where it has just been; then the shortest way home that
// arrives going a way the first length can follow on from.
function route() {
  const random = numbers(7);
  const start = [2, 1, 2];
  let node = start;
  let way = 0;
  const nodes = [start];
  const visited = new Map([[nameOf(start), 0]]);
  for (let i = 1; i < LENGTHS; i++) {
    const options = [];
    for (let next = 0; next < 6; next++) {
      if (next === (way ^ 1)) continue;
      const to = step(node, next);
      if (!inside(to)) continue;
      const last = visited.get(nameOf(to));
      const recent = last !== undefined && i - last < 24;
      options.push({ next, to, weight: (next === way ? STRAIGHT : 1) * (recent ? 0.03 : 1) });
    }
    let pick = random() * options.reduce((sum, o) => sum + o.weight, 0);
    const chosen = options.find((o) => (pick -= o.weight) <= 0) ?? options[options.length - 1];
    way = chosen.next;
    node = chosen.to;
    nodes.push(node);
    visited.set(nameOf(node), i);
  }
  // Breadth first over where the pipe is and which way it runs.
  const firstWay = WAYS.findIndex((w) => w.every((v, i) => v === nodes[1][i] - start[i]));
  const goal = (n, w) => nameOf(n) === nameOf(start) && w !== (firstWay ^ 1);
  const from = new Map([[`${nameOf(node)}|${way}`, null]]);
  let frontier = [[node, way]];
  let found = null;
  while (frontier.length && !found) {
    const after = [];
    for (const [n, w] of frontier) {
      for (let next = 0; next < 6 && !found; next++) {
        if (next === (w ^ 1)) continue;
        const to = step(n, next);
        const id = `${nameOf(to)}|${next}`;
        if (!inside(to) || from.has(id)) continue;
        from.set(id, `${nameOf(n)}|${w}`);
        if (goal(to, next)) found = id;
        else after.push([to, next]);
      }
    }
    frontier = after;
  }
  const home = [];
  for (let id = found; id && id !== `${nameOf(node)}|${way}`; id = from.get(id)) home.unshift(id.split('|')[0].split(',').map(Number));
  // The last node of the way home is the start itself, which begins the loop.
  return [...nodes, ...home.slice(0, -1)];
}

// The route as points in the world, its square corners rounded off.
function trace() {
  const nodes = route().map((n) => [ACROSS[n[0]], UP[n[1]], BACK[n[2]]]);
  const count = nodes.length;
  const points = [];
  const dir = (a, b) => {
    const d = b.map((v, i) => v - a[i]);
    const length = Math.hypot(...d);
    return d.map((v) => v / length);
  };
  for (let k = 0; k < count; k++) {
    const at = nodes[k];
    const into = dir(nodes[(k - 1 + count) % count], at);
    const out = dir(at, nodes[(k + 1) % count]);
    if (into.every((v, i) => Math.abs(v - out[i]) < 1e-6)) {
      points.push(at);
      continue;
    }
    // A quarter circle from BEND before the corner to BEND after it.
    const centre = at.map((v, i) => v - into[i] * BEND + out[i] * BEND);
    for (let j = 0; j <= 12; j++) {
      const a = (j / 12) * (Math.PI / 2);
      points.push(centre.map((v, i) => v + BEND * (-out[i] * Math.cos(a) + into[i] * Math.sin(a))));
    }
  }
  const { samples, length } = evenly(points, 0.15);
  return { samples, length, across: carriedAcross(samples) };
}

const path = laidPath(trace);

// A ring of the pipe at `s` world units along it: the point `angle` round it, `out` from
// the pipe's middle.
const ring = (s, angle, out) => {
  const { centre, across, up } = path.at(s);
  return centre.add(across.mul(cos(angle)).add(up.mul(sin(angle))).mul(out));
};

const back = (row, u, phase) => path.head.sub(rowsBack(row, u, phase).mul(u.spacing.mul(STRIDE)));

export default {
  name: 'plumbing',
  layout: { sleeve: false, tilt: 24, framing: 10, target: [0, 4.8, -8], orbit: { azimuth: 'free', polar: [15, 110] } },
  // The camera travels with the pipe, keeping a few lengths behind its newest ring.
  lead: () => path.behind(3),
  floor: -SINK,
  // Each ring reads the spectrum up one side and back down the other, so the two ends of a
  // ring meet in the bass.
  fold: (along) => along.mul(2).sub(1).abs().oneMinus(),
  place: ({ along, height, row, u, phase }) =>
    ring(back(row, u, phase), along.mul(TWO_PI), float(BORE).add(squash(height.mul(SCALE), CAP))),
  // The pipe itself, in the colour of empty space, from the newest ring to the oldest, hides
  // the far side of every ring. It is made where it is drawn, from the same path.
  extras: (c) => {
    const { ground, u } = c;
    const geometry = new PlaneGeometry(1, 1, 24, 320);
    const material = new MeshBasicNodeMaterial({ side: DoubleSide });
    const along = positionGeometry.y.add(0.5);
    const s = path.head.sub(along.mul(u.rows.add(1)).mul(u.spacing.mul(STRIDE)));
    material.positionNode = ring(s, positionGeometry.x.add(0.5).mul(TWO_PI), float(BORE - 0.03));
    material.colorNode = ground;
    material.polygonOffset = true;
    material.polygonOffsetFactor = 2;
    material.polygonOffsetUnits = 2;
    const core = new Mesh(geometry, material);
    core.frustumCulled = false;
    return [
      path.extra(c, STRIDE),
      {
        object: core,
        dispose() {
          geometry.dispose();
          material.dispose();
        },
      },
    ];
  },
};
