// A sheet of characters drawn once into a canvas, for pictures and filters that set text
// on the GPU: a square grid of cells, one character in each, white on black, with how much
// of its cell each character covers, so a filter can pick characters by how dark they read.
// Make one inside a look's build function: it needs a document.
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three/webgpu';
import { dFdx, dFdy, floor, fract, mod, texture, vec2 } from 'three/tsl';

// Characters by kind. `katakana` are the half-width forms, as in falling-code rain.
export const CHARACTERS = {
  digits: '0123456789',
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  signs: ':.=*+-<>|"_',
  katakana: 'ｦｧｨｩｪｫｬｭｮｯｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
  ascii: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
};

// The system's monospaced faces, best first.
export const MONOSPACE = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

// A character no font draws, to compare against.
const NOWHERE = '\u{10FFFD}';

// Whether the system's fonts draw `character`: a missing one comes out the same as a
// character no font has (an empty box, or nothing at all).
export function canDraw(character, family = MONOSPACE) {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const draw = (text) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `${size * 0.75}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
    return ctx.getImageData(0, 0, size, size).data;
  };
  const seen = draw(character);
  const blank = draw(NOWHERE);
  let differs = false;
  let inked = false;
  for (let i = 0; i < seen.length; i += 4) {
    if (seen[i] !== blank[i]) differs = true;
    if (seen[i] > 0) inked = true;
  }
  return differs && inked;
}

// Draws `characters` (a string) into a sheet. `cell` is the pixels per cell, `family` the
// font, `weight` its weight, `scale` the character's size against its cell, and `mirror`
// draws each one back to front.
//
// Returns `{ texture, count, side, coverage, sample, blurred, dispose }`. `sample(index, grid)` is
// how much of its cell character `index` (a float node, 0 to count - 1) covers at `grid`:
// a coordinate whose whole part picks a cell on the screen and whose fraction runs 0 to 1
// across that cell from its bottom left. The sheet is read with the slopes of `grid`
// itself, so its mipmaps do not show seams where the cells meet.
export function createGlyphs(characters, { cell = 64, family = MONOSPACE, weight = 400, scale = 0.78, mirror = false } = {}) {
  const list = [...characters];
  const count = list.length;
  const side = Math.max(1, Math.ceil(Math.sqrt(count)));
  const canvas = document.createElement('canvas');
  canvas.width = side * cell;
  canvas.height = side * cell;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = `${weight} ${Math.round(cell * scale)}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  list.forEach((character, i) => {
    ctx.save();
    ctx.translate(((i % side) + 0.5) * cell, (Math.floor(i / side) + 0.5) * cell);
    if (mirror) ctx.scale(-1, 1);
    ctx.fillText(character, 0, 0);
    ctx.restore();
  });

  // Share of each cell the character's ink covers.
  const coverage = new Float32Array(count);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < count; i++) {
    const x0 = (i % side) * cell;
    const y0 = Math.floor(i / side) * cell;
    let sum = 0;
    for (let y = y0; y < y0 + cell; y++) for (let x = x0; x < x0 + cell; x++) sum += pixels[(y * canvas.width + x) * 4];
    coverage[i] = sum / (255 * cell * cell);
  }

  const sheet = new CanvasTexture(canvas);
  sheet.colorSpace = NoColorSpace;
  sheet.flipY = false;
  sheet.generateMipmaps = true;
  sheet.minFilter = LinearMipmapLinearFilter;
  sheet.magFilter = LinearFilter;
  sheet.needsUpdate = true;
  const map = texture(sheet);

  // Where in the sheet a point of a cell on the screen reads from.
  const sheetAt = (index, grid) => {
    const i = floor(index);
    const local = fract(grid);
    // The sheet's rows run down from the top; a cell's own y runs up.
    return vec2(mod(i, side).add(local.x), floor(i.div(side)).add(local.y.oneMinus())).div(side);
  };
  const sample = (index, grid) => {
    const dx = dFdx(grid).div(side);
    const dy = dFdy(grid).div(side);
    return map.sample(sheetAt(index, grid)).grad(vec2(dx.x, dx.y.negate()), vec2(dy.x, dy.y.negate())).r;
  };
  // The character blurred, read from the sheet's mipmap `level` (about log2 of the cell's
  // pixels down): a soft glow around it that stays within its cell.
  const blurred = (index, grid, level) => map.sample(sheetAt(index, grid)).level(level).r;

  return { texture: sheet, count, side, coverage, sample, blurred, dispose: () => sheet.dispose() };
}

// The characters' numbers from the emptiest to the fullest, for a ramp from dark to light.
export const byCoverage = (glyphs) => [...glyphs.coverage.keys()].sort((a, b) => glyphs.coverage[a] - glyphs.coverage[b]);
