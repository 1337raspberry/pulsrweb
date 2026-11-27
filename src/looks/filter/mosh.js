// The picture as a broken video stream: in patches that wander slowly across it, square
// blocks slide along motion of their own, dragging stale pixels with them in smears, and
// are redrawn from the live picture only now and then, as when a compressed video loses its
// key frames. The rest of the picture plays clean. A beat drops a key frame: the patches
// spread and melt harder for a moment; a drop melts all of it, then snaps it back clean.
import { floor, max, mix, mx_noise_float, rand, smoothstep, step, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { feedback } from '../lib/filter-feedback.js';
import { groundOf } from '../lib/filter-ground.js';
import { onsetOf, standoutOf } from '../lib/filter-kit.js';

// A block is this many CSS pixels square, as a video codec's macroblocks are.
const BLOCK = 16;
// How far blocks move in a 60th of a second, in CSS pixels, at rest and just after a beat.
const FLOW = [1.3, 4];
// The share of blocks that hold on to stale pixels instead of taking the live picture's
// new lines, and how many of them are redrawn whole in a 60th of a second.
const STALE = 0.42;
const REFRESH = 0.035;
// The patches that break up are where a slow, broad field (0 to 1 over the picture) stands
// above an edge: this one at rest, about a quarter of the picture, and this one just after
// a beat. The field has a feature every REACH blocks or so and drifts at DRIFT a second.
const EDGE = [0.57, 0.5];
const REACH = 22;
const DRIFT = 0.06;
// How long a beat's lost key frame lasts, and a drop's melt, in seconds.
const LOST = 0.35;
const MELT = 1;

export default {
  name: 'mosh',
  build: (context) => {
    const { colour, uv, resolution, pixelRatio, background, stops, time } = context;
    const standout = standoutOf(background, stops);
    const ground = groundOf(context);
    // Set each frame: how far blocks move (CSS pixels a 60th), the share of stale blocks
    // redrawn, which blocks are stale, a count of frames for fresh noise, the share of
    // blocks stale, 1 on the frame a melt snaps back, and the edge the breaking patches
    // stand above.
    const flow = uniform(FLOW[0]);
    const refresh = uniform(REFRESH);
    const pattern = uniform(0);
    const tick = uniform(0);
    const stale = uniform(STALE);
    const snap = uniform(0);
    const edge = uniform(EDGE[0]);
    const step60 = uniform(1);

    const memory = feedback(({ previous, uv: at, fresh }) => {
      const px = at.mul(resolution).div(pixelRatio);
      const block = floor(px.div(BLOCK));
      // Each block's motion follows a field that is smooth across the picture and changes
      // slowly, but is held whole within the block, so neighbours shear past each other.
      // The field leans downwards, the way the ridge comes towards the viewer.
      const field = vec2(
        mx_noise_float(vec3(block.mul(0.13), time.mul(0.3))),
        mx_noise_float(vec3(block.mul(0.13).add(17.3), time.mul(0.3))).add(0.35),
      );
      const move = field.mul(flow).mul(step60).mul(pixelRatio);
      // Read whole texels, so dragged pixels stay sharp instead of blurring away.
      const from = floor(at.mul(resolution).sub(move)).add(0.5).div(resolution);
      const old = previous.sample(from).rgb;
      const live = colour.sample(at).rgb;
      const behind = ground(at);
      // Stale blocks come in patches, as a codec loses whole regions at once.
      const patch = mx_noise_float(vec3(block.mul(0.21), pattern.mul(7.1))).mul(0.5).add(0.5).mul(0.75).add(rand(block.add(pattern.mul(13.7))).mul(0.25));
      const isStale = step(patch, stale);
      // A stale block keeps only what it drags; the others take the live picture's lines
      // where they are newer than what was there, so the ridge stays drawn with its smears
      // between. Both drift slowly back to the live picture, and some blocks are redrawn
      // whole each frame.
      const newer = smoothstep(0.05, 0.3, standout(live, behind).sub(standout(old, behind))).mul(isStale.oneMinus());
      const settle = mix(0.03, 0.006, isStale).mul(step60);
      const redrawn = step(rand(block.add(vec2(tick.mul(0.731), tick.mul(0.377)))), refresh.mul(step60));
      // Outside the breaking patches a block is simply the live picture.
      const clean = step(mx_noise_float(vec3(block.div(REACH), time.mul(DRIFT).add(31.7))).mul(0.5).add(0.5), edge);
      const take = max(max(max(newer.mul(0.92), settle), max(max(redrawn, snap), fresh)), clean);
      return vec4(mix(old, live, take.min(1)), 1);
    }, { scale: 1 });

    const output = vec4(memory.getTextureNode().sample(uv).rgb, 1);

    const beaten = onsetOf('beat');
    const dropped = onsetOf('drop');
    let lost = 0;
    let melt = 0;
    function frame({ dt, shared }) {
      const signals = shared.signals;
      const calm = (shared.still?.value ?? 0) > 0.5;
      step60.value = Math.min(Math.max(dt * 60, 0), 4);
      tick.value = (tick.value + 1) % 4096;
      snap.value = 0;
      if (!calm && beaten(signals)) {
        lost = LOST;
        pattern.value = Math.floor(Math.random() * 1000);
      }
      if (!calm && dropped(signals)) melt = MELT;
      lost = Math.max(0, lost - dt);
      if (melt > 0) {
        melt -= dt;
        if (melt <= 0) snap.value = 1;
      }
      const melting = melt > 0;
      const k = lost / LOST;
      // With less motion asked for, the blocks barely creep and nothing jumps.
      flow.value = calm ? 0.2 : melting ? FLOW[1] * 1.3 : FLOW[0] + (FLOW[1] - FLOW[0]) * k;
      refresh.value = melting || k > 0 ? 0 : REFRESH;
      stale.value = melting ? 1 : STALE;
      edge.value = melting ? -1 : calm ? EDGE[0] : EDGE[0] + (EDGE[1] - EDGE[0]) * k;
    }

    return { output, frame, dispose: () => memory.dispose() };
  },
};
