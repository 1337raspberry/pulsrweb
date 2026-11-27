// Two four-cornered figures of thin bright line, each corner travelling in a straight line
// and bouncing off the edges of the screen, each figure trailed by fading copies of where
// it has just been, their colours wandering slowly through the palette's. The corners
// travel faster as the music fills out and the lines thicken on the beat.
import { DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three/webgpu';
import { attribute, mix } from 'three/tsl';
import { createDiorama } from '../lib/backdrop-diorama.js';
import { follow } from '../lib/backdrop-kit.js';
import { ramp3 } from '../lib/colour.js';

const FIGURES = 2;
const CORNERS = 4;
// How many copies trail each figure, and how many seconds apart they are.
const COPIES = 9;
const APART = 0.11;
const FOV = 40;
const BACK = 10;
// World units a second a corner travels, in silence and with the music at its fullest.
const SPEED = [0.8, 4.2];
// A line's thickness as a share of the screen's height.
const THICK = 0.0032;
// How fast a figure's colour wanders through the palette, in passes a second.
const WANDER = 0.035;

const AXIS = new Vector3(0, 0, 1);

export default {
  name: 'ricochet',
  build: ({ renderer, resolution, uv, background, stops }) => {
    const diorama = createDiorama({ renderer, resolution, uv, fov: FOV, near: 1, far: 30 });
    const { scene, camera } = diorama;
    scene.backgroundNode = background;
    camera.position.set(0, 0, BACK);

    const most = FIGURES * CORNERS * (COPIES + 1);
    const geometry = new PlaneGeometry(1, 1);
    // Each line carries where its figure's colour sits in the palette and how old a copy it is.
    const drawn = new InstancedBufferAttribute(new Float32Array(most * 2), 2);
    drawn.setUsage(DynamicDrawUsage);
    geometry.setAttribute('drawn', drawn);
    const material = new MeshBasicNodeMaterial();
    const mark = attribute('drawn', 'vec2');
    material.colorNode = mix(ramp3(stops, mark.x), background, mark.y.mul(0.92));
    const lines = new InstancedMesh(geometry, material, most);
    lines.instanceMatrix.setUsage(DynamicDrawUsage);
    lines.frustumCulled = false;
    scene.add(lines);

    // Every corner: where it is and which way it is going. The view is `tall` from its
    // middle to its top and `wide` to its side.
    let tall = Math.tan((FOV * Math.PI) / 360) * BACK;
    let wide = tall * 1.6;
    const corners = Array.from({ length: FIGURES * CORNERS }, () => {
      const heading = Math.random() * Math.PI * 2;
      const pace = 0.7 + Math.random() * 0.6;
      return { x: (Math.random() * 2 - 1) * wide, y: (Math.random() * 2 - 1) * tall, vx: Math.cos(heading) * pace, vy: Math.sin(heading) * pace };
    });
    // Where every corner was, newest first: each entry all the corners' x and y in turn.
    const past = [];
    let sinceKept = APART;
    let swell = 0;

    const matrix = new Matrix4();
    const at = new Vector3();
    const size = new Vector3();
    const turn = new Quaternion();

    function frame({ seconds, dt, shared }) {
      const s = shared.signals;
      tall = Math.tan((FOV * Math.PI) / 360) * BACK;
      wide = tall * camera.aspect;
      const speed = SPEED[0] + (SPEED[1] - SPEED[0]) * s.energy.value * (1 - s.silence.value);
      for (const c of corners) {
        c.x += c.vx * speed * dt;
        c.y += c.vy * speed * dt;
        if (Math.abs(c.x) > wide) {
          c.x = Math.sign(c.x) * wide;
          c.vx = -Math.sign(c.x) * Math.abs(c.vx);
        }
        if (Math.abs(c.y) > tall) {
          c.y = Math.sign(c.y) * tall;
          c.vy = -Math.sign(c.y) * Math.abs(c.vy);
        }
      }
      sinceKept += dt;
      if (sinceKept >= APART) {
        sinceKept = 0;
        past.unshift(corners.flatMap((c) => [c.x, c.y]));
        past.length = Math.min(past.length, COPIES);
      }
      swell = follow(swell, s.beat.value, dt, 0.05);
      const thick = THICK * 2 * tall * (1 + 1.2 * swell);

      let n = 0;
      for (let copy = 0; copy <= past.length; copy++) {
        // Copy 0 is the figure itself, where its corners are this instant.
        const xy = copy === 0 ? corners.flatMap((c) => [c.x, c.y]) : past[copy - 1];
        for (let f = 0; f < FIGURES; f++) {
          const pass = (seconds * WANDER + f / FIGURES) % 1;
          const tone = 1 - Math.abs(2 * pass - 1);
          for (let k = 0; k < CORNERS; k++) {
            const a = 2 * (f * CORNERS + k);
            const b = 2 * (f * CORNERS + ((k + 1) % CORNERS));
            const dx = xy[b] - xy[a];
            const dy = xy[b + 1] - xy[a + 1];
            at.set((xy[a] + xy[b]) / 2, (xy[a + 1] + xy[b + 1]) / 2, -copy * 0.01);
            turn.setFromAxisAngle(AXIS, Math.atan2(dy, dx));
            lines.setMatrixAt(n, matrix.compose(at, turn, size.set(Math.hypot(dx, dy) + thick, thick, 1)));
            drawn.setXY(n, tone, copy / (COPIES + 1));
            n += 1;
          }
        }
      }
      lines.count = n;
      lines.instanceMatrix.needsUpdate = true;
      drawn.needsUpdate = true;
      diorama.render();
    }

    return {
      colour: diorama.colour,
      // The ridge's hills are smoked glass: the figures behind them show through dimly.
      veil: (c) => mix(background, c.ground, 0.3),
      solid: true,
      frame,
      dispose() {
        geometry.dispose();
        material.dispose();
        lines.dispose();
        diorama.dispose();
      },
    };
  },
};
