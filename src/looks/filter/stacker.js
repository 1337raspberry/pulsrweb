// The picture rebuilt in chunky bevelled blocks on a square grid: a block wherever the
// ridge's lines pass, in their colour, and the backdrop showing through the empty cells. A
// few pieces of four squares in the palette's colours drop a cell at a time through the
// empty space, turning now and then, and vanish in a flash where they come to rest; on the
// beat a whole row of the grid lights up white, as if it had been cleared.
import { UnsignedByteType, Vector2, Vector4 } from 'three/webgpu';
import { Fn, abs, clamp, float, floor, fract, ivec2, max, min, mix, rtt, smoothstep, step, uniform, uniformArray, uv, vec3, vec4 } from 'three/tsl';
import { createCells } from '../lib/filter-cells.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { fullHueOf, onsetOf, toDisplay, toLinear } from '../lib/filter-kit.js';

// About this many cells across the screen's shorter side.
const CELLS = 60;
// A cell is a block where its strongest line stands out from what is behind it this much.
const LIT = 0.22;
// The seven ways four squares join edge to edge, each as its squares in a box of `size`
// cells; a piece turns within its box.
const SHAPES = [
  { size: 4, squares: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { size: 2, squares: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { size: 3, squares: [[0, 1], [1, 1], [2, 1], [1, 0]] },
  { size: 3, squares: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { size: 3, squares: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { size: 3, squares: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { size: 3, squares: [[2, 0], [0, 1], [1, 1], [2, 1]] },
];
// At most this many pieces at once, each stepping down a cell every STEP seconds (sooner
// when the music is busy), resting FLASH seconds in a flash before it goes.
const PIECES = 6;
const STEP = 0.18;
const FLASH = 0.22;
// Seconds between one piece and the next, at least and at most.
const SPAWN = [0.5, 1.5];
// A cleared row flashes over ROW_FADE seconds, at most once every ROW_GAP seconds.
const ROW_FADE = 0.28;
const ROW_GAP = 0.4;

// The squares of a piece turned `turns` quarter turns clockwise within its box.
function squaresOf(shape, turns) {
  let squares = shape.squares;
  for (let t = 0; t < turns % 4; t++) squares = squares.map(([x, y]) => [shape.size - 1 - y, x]);
  return squares;
}

export default {
  name: 'stacker',
  build: (context) => {
    const { uv: screen, resolution, pixelRatio, background, stops, renderer } = context;
    const ground = groundOf(context);
    const fullHue = fullHueOf(background, stops);
    const ratio = pixelRatio.value || 1;
    // The cell's size in CSS pixels, fixed when the filter is built.
    const cellPx = Math.max(5, Math.round(Math.min(resolution.value.x, resolution.value.y) / ratio / CELLS));
    const cells = createCells(context, [cellPx, cellPx], { ground });

    // Each cell's colour (display values) and how far it stands out, a byte each, so the
    // grid can be read back to steer the falling pieces by the blocks really drawn.
    const gridSize = uniform(new Vector2(1, 1));
    const blocks = rtt(Fn(() => {
      const cell = floor(uv().mul(gridSize));
      const c = cells.at(cell);
      return vec4(toDisplay(c.rgb), clamp(c.a, 0, 1));
    })(), 1, 1, { type: UnsignedByteType });

    // The falling pieces' squares: cell x, cell y, which of the palette's stops, and how far
    // into its landing flash (0 falling, 1 just landed).
    const squares = uniformArray(Array.from({ length: PIECES * 4 }, () => new Vector4(-9, -9, 0, 0)), 'vec4');
    const still = context.still ?? float(0);
    const rowAt = uniform(-9);
    const rowsLit = uniform(1);
    const rowFlash = uniform(0);

    // A bevelled block of colour `c` at position `f` within its cell (0 to 1, y down): a
    // lighter edge top and left, a darker one bottom and right, a thin dark gap round it.
    const size = cells.size;
    const f = fract(screen.mul(resolution).div(size));
    const pixel = float(1).div(size.x);
    const edge = min(min(f.x, f.y), min(f.x.oneMinus(), f.y.oneMinus()));
    const gap = pixelRatio.mul(0.75).div(size.x);
    const inGap = float(1).sub(smoothstep(gap.sub(pixel.mul(0.5)), gap.add(pixel.mul(0.5)), edge));
    const bevel = float(1).sub(smoothstep(float(0.15).sub(pixel.mul(0.5)), float(0.15).add(pixel.mul(0.5)), edge));
    const upper = float(1).sub(smoothstep(float(1).sub(pixel), float(1).add(pixel), f.x.add(f.y)));
    const block = (c) => {
      const face = c.mul(float(1.08).sub(f.y.mul(0.16)));
      const lit = mix(c.mul(1.25), vec3(1), 0.38);
      const shade = c.mul(0.42);
      const rim = mix(shade, lit, upper);
      return mix(mix(face, rim, bevel), c.mul(0.12), inGap);
    };

    const cell = floor(screen.mul(resolution).div(size));
    const here = blocks.load(ivec2(cell));
    const isBlock = step(LIT, here.a);
    // A block takes its line's colour at full strength (a thin line read over a cell comes
    // out paler than it was drawn), faded part of the way into what is behind it where the
    // line was a far, faint one.
    const behind = ground(screen);
    const full = fullHue(toLinear(here.rgb), behind);
    const tone = mix(behind, full, mix(0.5, 1, smoothstep(LIT, 0.75, here.a)));
    let picture = mix(behind, block(tone), isBlock);

    // The pieces over the blocks.
    let piece = float(0);
    let hue = float(0);
    let landing = float(0);
    for (let k = 0; k < PIECES * 4; k++) {
      const s = squares.element(k);
      const on = step(abs(cell.x.sub(s.x)), 0.5).mul(step(abs(cell.y.sub(s.y)), 0.5));
      piece = max(piece, on);
      hue = mix(hue, s.z, on);
      landing = mix(landing, s.w, on);
    }
    const stop = mix(mix(stops[0], stops[1], step(0.5, hue)), stops[2], step(1.5, hue));
    const flashOf = (amount) => amount.mul(still.oneMinus());
    picture = mix(picture, block(mix(stop, vec3(1.4), flashOf(landing))), piece);

    // A cleared row: the whole row in white blocks, fading.
    const inRow = step(rowAt.sub(0.5), cell.y).mul(step(cell.y, rowAt.add(rowsLit).sub(0.5)));
    picture = mix(picture, block(vec3(1.3)), inRow.mul(flashOf(rowFlash)));

    // Everything is redrawn as blocks, so a filter after this one sees only the backdrop
    // behind them.
    const output = handOn(vec4(picture, 1), ground);

    // ---- the pieces' moves, worked out on the CPU from the grid read back ----
    let across = 1;
    let down = 1;
    let filled = new Uint8Array(1);
    let reading = false;
    let readAgo = 0;
    const isWebGL = Boolean(renderer?.backend?.isWebGLBackend);
    const live = [];
    let stepClock = 0;
    let untilSpawn = 0.3;
    let sinceRow = Infinity;
    const beaten = onsetOf('beat');
    const dropped = onsetOf('drop');

    // Whether cell (x, y) is taken: by a block, the screen's sides or bottom, or a piece
    // other than `except`. Above the top is open.
    const blockedAt = (x, y) => x < 0 || x >= across || y >= down || (y >= 0 && filled[y * across + x] === 1);
    const takenBy = (x, y, except) => live.some((p) => p !== except && p.landed < 0 && squaresOf(SHAPES[p.shape], p.turns).some(([sx, sy]) => p.x + sx === x && p.y + sy === y));
    const fits = (p, x, y, turns) => squaresOf(SHAPES[p.shape], turns).every(([sx, sy]) => !blockedAt(x + sx, y + sy) && !takenBy(x + sx, y + sy, p));

    function read() {
      if (reading || !renderer?.readRenderTargetPixelsAsync) return;
      reading = true;
      const w = blocks.renderTarget.width;
      const h = blocks.renderTarget.height;
      renderer.readRenderTargetPixelsAsync(blocks.renderTarget, 0, 0, w, h).then((data) => {
        reading = false;
        if (w !== across || h !== down || !data || data.length < w * h * 4) return;
        const next = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
          // WebGL keeps a target's rows bottom first.
          const row = isWebGL ? h - 1 - y : y;
          for (let x = 0; x < w; x++) next[y * w + x] = data[(row * w + x) * 4 + 3] / 255 >= LIT ? 1 : 0;
        }
        filled = next;
      }, () => {
        reading = false;
      });
    }

    function spawn() {
      const shape = Math.floor(Math.random() * SHAPES.length);
      const turns = Math.floor(Math.random() * 4);
      const box = SHAPES[shape].size;
      for (let tries = 0; tries < 8; tries++) {
        const x = Math.floor(Math.random() * Math.max(1, across - box + 1));
        const p = { shape, turns, x, y: -box, hue: Math.floor(Math.random() * 3), landed: -1 };
        // Only into a column whose top is open, so a piece has room to fall.
        if (fits(p, x, p.y, turns) && !blockedAt(x + Math.floor(box / 2), 0) && !blockedAt(x + Math.floor(box / 2), 1)) {
          live.push(p);
          return;
        }
      }
    }

    function step1() {
      for (const p of live) {
        if (p.landed >= 0) continue;
        // Turned or nudged sideways now and then, where there is room.
        if (Math.random() < 0.22 && fits(p, p.x, p.y, p.turns + 1)) p.turns += 1;
        else if (Math.random() < 0.18) {
          const dx = Math.random() < 0.5 ? -1 : 1;
          if (fits(p, p.x + dx, p.y, p.turns)) p.x += dx;
        }
        if (fits(p, p.x, p.y + 1, p.turns)) p.y += 1;
        else p.landed = 0;
      }
    }

    function frame({ dt, shared }) {
      cells.frame();
      const r = pixelRatio.value;
      const w = Math.max(1, Math.ceil(resolution.value.x / (cellPx * r)));
      const h = Math.max(1, Math.ceil(resolution.value.y / (cellPx * r)));
      if (w !== across || h !== down) {
        across = w;
        down = h;
        filled = new Uint8Array(w * h);
        gridSize.value.set(w, h);
        blocks.setSize(w, h);
        live.length = 0;
      }
      readAgo += dt;
      if (readAgo >= 0.1) {
        readAgo = 0;
        read();
      }

      const signals = shared.signals;
      const calm = (shared.still?.value ?? 0) > 0.5;
      // A piece the ridge has grown into comes to rest where it is.
      for (const p of live) if (p.landed < 0 && !fits(p, p.x, p.y, p.turns)) p.landed = 0;
      for (const p of live) if (p.landed >= 0) p.landed += dt;
      for (let i = live.length - 1; i >= 0; i--) if (live[i].landed > FLASH) live.splice(i, 1);

      stepClock += dt * (1 + 0.8 * (signals.energy?.value ?? 0));
      if (stepClock >= STEP) {
        stepClock %= STEP;
        step1();
      }
      untilSpawn -= dt;
      if (untilSpawn <= 0 && live.length < PIECES) {
        spawn();
        untilSpawn = SPAWN[0] + Math.random() * (SPAWN[1] - SPAWN[0]);
      }

      // A beat clears the fullest row of blocks; a drop clears four.
      sinceRow += dt;
      const big = dropped(signals);
      const hit = beaten(signals);
      if ((hit || big) && !calm && sinceRow >= ROW_GAP) {
        sinceRow = 0;
        let best = Math.floor(down * 0.7);
        let most = -1;
        for (let y = 0; y < down; y++) {
          let count = 0;
          for (let x = 0; x < across; x++) count += filled[y * across + x];
          // A little chance in it, so the same row is not lit every time.
          const score = count + Math.random() * across * 0.25;
          if (score > most) {
            most = score;
            best = y;
          }
        }
        const rows = big ? 4 : 1;
        rowAt.value = Math.min(best, Math.max(0, down - rows));
        rowsLit.value = rows;
        rowFlash.value = 1;
      }
      rowFlash.value = Math.max(0, rowFlash.value - dt / ROW_FADE);

      // Hand the squares to the shader.
      let k = 0;
      for (const p of live) {
        const flash = p.landed < 0 ? 0 : 1 - p.landed / FLASH;
        for (const [sx, sy] of squaresOf(SHAPES[p.shape], p.turns)) {
          squares.array[k++].set(p.x + sx, p.y + sy, p.hue, flash);
        }
      }
      while (k < PIECES * 4) squares.array[k++].set(-9, -9, 0, 0);
    }

    return {
      output,
      frame,
      dispose: () => {
        cells.dispose();
        blocks.dispose();
      },
    };
  },
};
