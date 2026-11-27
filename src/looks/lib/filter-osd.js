// Lettering a filter lays over the picture, as a video recorder or a camera writes its
// readouts in the corners of the screen: chunky dot-matrix capitals, white with a dark edge,
// set to whole device pixels so every dot comes out square at any size. Make one inside a
// filter's build function: it draws on a canvas.
import { CanvasTexture, NearestFilter, NoColorSpace } from 'three/webgpu';
import { floor, max, mix, step, texture, vec2, vec4 } from 'three/tsl';
import { CAP_HEIGHT, GLYPH_WIDTH, glyphOf } from './dotmatrix.js';

// Shapes the dot-matrix font lacks, as rows of dots: the transport's arrows, a stop square,
// a recording dot and the degree sign.
const EXTRA = {
  '°': ['.##..', '#..#.', '#..#.', '.##..', '.....', '.....', '.....'],
  '▶': ['#....', '##...', '###..', '####.', '###..', '##...', '#....'],
  '◀': ['...#.', '..##.', '.###.', '####.', '.###.', '..##.', '...#.'],
  '■': ['.....', '#####', '#####', '#####', '#####', '#####', '.....'],
  '●': ['.....', '.###.', '#####', '#####', '#####', '.###.', '.....'],
};
const bitsOf = (rows) => rows.map((row) => [...row].reduce((bits, dot) => (bits << 1) | (dot === '#' ? 1 : 0), 0));
const EXTRA_BITS = Object.fromEntries(Object.entries(EXTRA).map(([character, rows]) => [character, bitsOf(rows)]));

// On the canvas: a font dot is DOT pixels square, the dark edge EDGE pixels round every dot,
// a character ADVANCE pixels on from the last, and a line of text ROW pixels below the last.
const DOT = 3;
const EDGE = 2;
const ADVANCE = (GLYPH_WIDTH + 1) * DOT;
const ROW = CAP_HEIGHT * DOT + 2 * EDGE + 4;
const CAP_PX = CAP_HEIGHT * DOT;

// `columns` characters and `rows` lines of text fit in each corner. `cap` is the height of a
// capital as a share of the screen's height (rounded to whole pixels a canvas pixel), and
// `margin` the room left between the lettering and the screen's edges, as shares of the
// screen's width and height.
export function createCorners({ resolution }, { columns = 16, rows = 3, cap = 0.026, margin = [0.06, 0.07] } = {}) {
  const blockW = columns * ADVANCE + 2 * EDGE;
  const blockH = rows * ROW;
  const canvas = document.createElement('canvas');
  canvas.width = blockW * 2;
  canvas.height = blockH * 2;
  const ctx = canvas.getContext('2d');
  const sheet = new CanvasTexture(canvas);
  sheet.colorSpace = NoColorSpace;
  sheet.flipY = false;
  sheet.generateMipmaps = false;
  sheet.minFilter = NearestFilter;
  sheet.magFilter = NearestFilter;
  const map = texture(sheet);

  // Draws `text` with its first dot's top left corner at (x, y), in the current fill style,
  // each dot grown by `grow` pixels on every side.
  function dots(text, x, y, grow) {
    let left = x;
    for (const character of text) {
      const rows = EXTRA_BITS[character] ?? glyphOf(character);
      rows.slice(0, CAP_HEIGHT).forEach((bits, r) => {
        for (let c = 0; c < GLYPH_WIDTH; c++) {
          if (bits & (1 << (GLYPH_WIDTH - 1 - c))) ctx.fillRect(left + c * DOT - grow, y + r * DOT - grow, DOT + 2 * grow, DOT + 2 * grow);
        }
      });
      left += ADVANCE;
    }
  }

  // The corners by name: which block of the canvas each takes, and whether its text sits
  // against the block's right edge.
  const CORNERS = { tl: [0, 0], tr: [1, 0], bl: [0, 1], br: [1, 1] };

  // A line of text: `corner` is 'tl', 'tr', 'bl' or 'br', `row` counts from the top of the
  // corner's block (the bottom corners' last row is nearest the screen's bottom edge).
  // `fill` is a CSS colour; the edge is always near black.
  function write(corner, row, text, fill = '#f2f2f2') {
    const [bx, by] = CORNERS[corner];
    const chars = [...text].slice(0, columns);
    const width = chars.length * ADVANCE - DOT;
    const x = bx * blockW + EDGE + (bx ? blockW - 2 * EDGE - width : 0);
    const y = by * blockH + row * ROW + (ROW - CAP_PX) / 2;
    const line = chars.join('');
    ctx.fillStyle = '#060606';
    dots(line, x, y, EDGE);
    ctx.fillStyle = fill;
    dots(line, x, y, 0);
  }

  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  const update = () => {
    sheet.needsUpdate = true;
  };

  // The lettering at screen point `at` (0 to 1 from the top left), as display colour and
  // coverage (0 or 1). Each canvas pixel is a whole number of device pixels, and the
  // corners' blocks start on whole pixels, so the dots stay crisp and even.
  const scale = max(1, floor(resolution.y.mul(cap / CAP_PX).add(0.5)));
  const block = vec2(blockW, blockH).mul(scale);
  const room = floor(resolution.mul(vec2(...margin)));
  const at = (point) => {
    const px = point.mul(resolution);
    const side = vec2(step(0.5, point.x), step(0.5, point.y));
    const origin = mix(room, resolution.sub(room).sub(block), side);
    const local = floor(px.sub(origin).div(scale));
    const inside = step(0, local.x).mul(step(local.x, blockW - 1)).mul(step(0, local.y)).mul(step(local.y, blockH - 1));
    const texel = local.add(side.mul(vec2(blockW, blockH))).add(0.5).div(vec2(canvas.width, canvas.height));
    const ink = map.sample(texel);
    return vec4(ink.rgb, ink.a.mul(inside));
  };

  clear();
  update();
  return { write, clear, update, at, dispose: () => sheet.dispose() };
}
