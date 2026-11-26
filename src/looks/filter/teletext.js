// A teletext page: the picture rebuilt in chunky blocks, two across and three down in each
// of the page's forty by twenty-five character cells, every cell in one of teletext's eight
// colours on black. Above it, a header with the date and the ticking time and a title band
// that steps to a new colour on the beat; along the bottom, four coloured prompts. Beats
// brighten the blocks a little, and a drop rolls the page up the screen like a weak signal.
import { CanvasTexture, HalfFloatType, NearestFilter, NoColorSpace } from 'three/webgpu';
import { Fn, Loop, abs, clamp, float, floor, int, ivec2, max, min, mix, mod, rtt, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { GLYPH_WIDTH, drawText } from '../lib/dotmatrix.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { fullHueOf, onsetOf, toDisplay } from '../lib/filter-kit.js';

// The page: forty character cells across and twenty-five rows down, each cell two blocks
// across and three down.
const COLUMNS = 40;
const ROWS = 25;
const ACROSS = COLUMNS * 2;
const DOWN = ROWS * 3;
// The page's shape, width over height. It stretches to fill a screen between these, and
// beyond them keeps to the nearer one, centred, with black either side.
const NARROWEST = 0.8;
const WIDEST = 1.7;
// A black border round the page, this share of the screen's shorter side, as a television
// kept its teletext clear of the picture's edges (where curved glass would lose it).
const BORDER = 0.07;
// A character cell in dots, as the page's canvas holds it: a letter five dots wide and nine
// tall (the last two for descenders), with a dot of space beside it and a row above.
const CELL = [GLYPH_WIDTH + 1, 10];
// Taps read over each block, across and down.
const TAPS = [8, 8];
// A tap is ink where it differs from what is behind the ridge by this much in some channel,
// and a block lights where this share of its taps are ink.
const INK = 0.18;
const LIT = 0.06;
// A colour brought to full strength counts a channel as on from this bright (display values).
const CHANNEL_ON = 0.6;

// Teletext's eight colours, by their numbers: red 1, green 2, blue 4, and their sums.
const [BLACK, RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN, WHITE] = [0, 1, 2, 3, 4, 5, 6, 7];
const CSS = ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'];
// The title band's colours, each with the lettering set on it, in the order beats step
// through them.
const BANDS = [[BLUE, YELLOW], [RED, WHITE], [GREEN, BLUE], [MAGENTA, WHITE], [CYAN, BLUE], [YELLOW, BLUE]];
// What each subpage says under the title; the page turns through them on its own.
const SUBPAGES = ['Sound in eight colours', 'Two blocks by three', 'Keep it tuned here'];
// The coloured prompts along the bottom row: colour, label and the column it starts in.
const PROMPTS = [[RED, 'palette', 1], [GREEN, 'colours', 11], [YELLOW, 'preset', 21], [CYAN, 'index', 31]];
// The rows of text, and the title band's.
const HEADER = 0;
const BAND = [1, 3];
const FOOTER = 24;

// Beats brighten the blocks, at most once every FLASH_GAP seconds (three times a second at
// most, so the page never flashes faster than that), fading over FLASH_FADE; and they step
// the band to its next colour at most every STEP_GAP seconds. With less motion asked for,
// the blocks stay steady and the band steps at most every STILL_STEP_GAP.
const FLASH_GAP = 0.34;
const FLASH_FADE = 0.12;
const FLASH_WHITE = 0.18;
const FLASH_GAIN = 0.12;
const STEP_GAP = 0.34;
const STILL_STEP_GAP = 2;
// Seconds a subpage shows, and while nothing is heard.
const SUBPAGE_SECONDS = 5;
const QUIET_SUBPAGE_SECONDS = 2.5;
// A drop rolls the page once up the screen in this many seconds, a black bar this share of
// the page's height following it round.
const ROLL_SECONDS = 0.9;
const BLANKING = 0.1;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n) => String(n).padStart(2, '0');
// The header's date and time, as `Thu 26 Nov` and `14:05:32`.
const dateOf = (d) => `${DAYS[d.getDay()]} ${two(d.getDate())} ${MONTHS[d.getMonth()]}`;
const timeOf = (d) => `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;

// A colour's teletext number: each channel on or off, once the brightest is brought to full.
// Ink with no hue of its own (black lines on a light ground) shows white.
function numberOf(rgb) {
  const shown = toDisplay(rgb);
  const top = max(max(shown.r, shown.g), shown.b);
  const on = step(vec3(CHANNEL_ON), shown.div(top.max(1e-4)));
  return top.lessThan(0.02).select(float(WHITE), on.x.add(on.y.mul(2)).add(on.z.mul(4)));
}

// Teletext number `n` (a float node) as a 1 in one of eight places, over two vec4s.
const PLACES = [vec4(0, 1, 2, 3), vec4(4, 5, 6, 7)];
const oneOf = (n) => PLACES.map((places) => step(abs(places.sub(n)), vec4(0.5)));

// The colour with the most weight among seven tallies (numbers 1 to 7 over two vec4s).
function heaviest(low, high) {
  let n = float(RED);
  let most = low.y;
  for (const [weight, number] of [[low.z, GREEN], [low.w, YELLOW], [high.x, BLUE], [high.y, MAGENTA], [high.z, CYAN], [high.w, WHITE]]) {
    n = weight.greaterThan(most).select(float(number), n);
    most = max(weight, most);
  }
  return n;
}

// Teletext number `n` as a colour.
const colourOf = (n) => vec3(mod(n, 2), mod(floor(n.div(2)), 2), floor(n.div(4)));

export default {
  name: 'teletext',
  build: (context) => {
    const { colour, uv: screen, resolution, background, stops } = context;
    const ground = groundOf(context);
    // A row faded into what is behind it is read in the colour it was before it faded, so
    // far rows keep their hue on a light ground as on a dark one.
    const fullHue = fullHueOf(background, stops);

    // Where the page sits on the screen: its size and its top left corner, in screen uv.
    // Lengths are worked out in screen heights first.
    const aspect = resolution.x.div(resolution.y);
    const border = min(aspect, 1).mul(BORDER);
    const room = vec2(aspect, 1).sub(border.mul(2));
    const shape = clamp(room.x.div(room.y), NARROWEST, WIDEST);
    const tall = min(room.y, room.x.div(shape));
    const size = vec2(tall.mul(shape).div(aspect), tall);
    const corner = vec2(1).sub(size).mul(0.5);

    // Each block: whether it is lit, the number of the colour with most ink in it and how
    // much ink that is, and the share of it that is ink. Many taps over the block, so a
    // thin line anywhere in it counts, and moving lines light blocks steadily.
    const blocks = rtt(Fn(() => {
      const block = floor(uv().mul(vec2(ACROSS, DOWN)));
      const low = vec4(0).toVar();
      const high = vec4(0).toVar();
      const inked = float(0).toVar();
      Loop({ start: int(0), end: int(TAPS[0]), name: 'i' }, ({ i }) => {
        Loop({ start: int(0), end: int(TAPS[1]), name: 'j' }, ({ j }) => {
          const within = vec2(float(i).add(0.5).div(TAPS[0]), float(j).add(0.5).div(TAPS[1]));
          const at = corner.add(block.add(within).div(vec2(ACROSS, DOWN)).mul(size));
          const c = colour.sample(at).rgb;
          const behind = ground(at);
          const apart = abs(c.sub(behind));
          const ink = max(max(apart.r, apart.g), apart.b);
          const counts = step(INK, ink);
          inked.addAssign(counts);
          const [a, b] = oneOf(numberOf(fullHue(c, behind)));
          low.addAssign(a.mul(counts.mul(ink)));
          high.addAssign(b.mul(counts.mul(ink)));
        });
      });
      const share = inked.div(TAPS[0] * TAPS[1]);
      // Number 0 (black) never takes ink, so the most in any place is the heaviest colour's.
      const most = low.max(high);
      const weight = max(max(most.x, most.y), max(most.z, most.w));
      return vec4(step(LIT, share), heaviest(low, high), weight.div(TAPS[0] * TAPS[1]), share);
    })(), ACROSS, DOWN, { type: HalfFloatType });

    // Each cell's one colour: the one with most ink over its lit blocks.
    const cells = rtt(Fn(() => {
      const cell = floor(uv().mul(vec2(COLUMNS, ROWS)));
      let low = vec4(0);
      let high = vec4(0);
      for (let down = 0; down < 3; down++) {
        for (let across = 0; across < 2; across++) {
          const b = blocks.load(ivec2(cell.mul(vec2(2, 3)).add(vec2(across, down))));
          const [x, y] = oneOf(b.y);
          const weight = b.x.mul(b.z);
          low = low.add(x.mul(weight));
          high = high.add(y.mul(weight));
        }
      }
      return vec4(colourOf(heaviest(low, high)), 1);
    })(), COLUMNS, ROWS, { type: HalfFloatType });

    // The page's text rows, painted on a canvas a dot to a pixel; the rows the picture
    // shows through are left clear.
    const canvas = document.createElement('canvas');
    canvas.width = COLUMNS * CELL[0];
    canvas.height = ROWS * CELL[1];
    const ctx = canvas.getContext('2d');
    const fillRow = (row, hue) => {
      ctx.fillStyle = CSS[hue];
      ctx.fillRect(0, row * CELL[1], canvas.width, CELL[1]);
    };
    // Double-height lettering takes the row it is written in and the one below.
    const write = (text, column, row, hue, double = false) => {
      ctx.fillStyle = CSS[hue];
      drawText(ctx, text, column * CELL[0], row * CELL[1] + (double ? 2 : 1), { dot: [1, double ? 2 : 1], advance: CELL[0] });
    };
    let band = 0;
    let subpage = 1;
    function paint(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fillRow(HEADER, BLACK);
      write('P100', 1, HEADER, WHITE);
      write('PULSR 100', 7, HEADER, YELLOW);
      write(dateOf(now), 18, HEADER, WHITE);
      write(timeOf(now), 30, HEADER, YELLOW);
      const [paper, lettering] = BANDS[band];
      for (let row = BAND[0]; row <= BAND[1]; row++) fillRow(row, paper);
      write('PULSR', 2, BAND[0], lettering, true);
      write(`${subpage}/${SUBPAGES.length}`, 36, BAND[0], lettering);
      write(SUBPAGES[subpage - 1], 2, BAND[1], lettering);
      fillRow(FOOTER, BLACK);
      for (const [hue, label, column] of PROMPTS) write(label, column, FOOTER, hue);
    }
    paint(new Date());
    const sheet = new CanvasTexture(canvas);
    // Every colour on the page is 0 or 1 in each channel, the same in any colour space.
    sheet.colorSpace = NoColorSpace;
    sheet.flipY = false;
    sheet.generateMipmaps = false;
    sheet.minFilter = NearestFilter;
    sheet.magFilter = NearestFilter;
    sheet.needsUpdate = true;
    const page = texture(sheet);

    const flash = uniform(0);
    const roll = uniform(0);

    // The page at screen point `at`: the blocks where `picture` asks for them and the page's
    // text over them, black beyond the page's edges.
    const show = (at, picture) => {
      const p = at.sub(corner).div(size);
      const onPage = step(0, p.x).mul(step(p.x, 1)).mul(step(0, p.y)).mul(step(p.y, 1));
      // Rolling, the page moves up through one height of itself and a black bar.
      const v = mod(p.y.add(roll.mul(1 + BLANKING)), 1 + BLANKING);
      const shown = step(v, 1);
      const q = vec2(clamp(p.x, 0, 0.99999), min(v, 0.99999));
      const text = page.sample(q);
      if (!picture) return text.rgb.mul(text.a).mul(onPage.mul(shown));
      const block = clamp(floor(q.mul(vec2(ACROSS, DOWN))), vec2(0), vec2(ACROSS - 1, DOWN - 1));
      const cell = clamp(floor(q.mul(vec2(COLUMNS, ROWS))), vec2(0), vec2(COLUMNS - 1, ROWS - 1));
      const lit = blocks.load(ivec2(block)).x;
      const hue = cells.load(ivec2(cell)).rgb;
      const glow = mix(hue, vec3(1), flash.mul(FLASH_WHITE)).mul(flash.mul(FLASH_GAIN).add(1));
      return mix(glow.mul(lit), text.rgb, text.a).mul(onPage.mul(shown));
    };
    // Four samples a quarter of a pixel apart, so the edges of blocks and dots land evenly
    // however the page's grid falls on the screen's pixels.
    const pixel = vec2(1).div(resolution);
    const samples = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([x, y]) => show(screen.add(pixel.mul(vec2(x, y))), true));
    // A filter after this one sees the page without the ridge behind it: its text on black.
    const output = handOn(vec4(samples.reduce((a, b) => a.add(b)).mul(0.25), 1), (at) => show(at, false));

    let beatsSeen = -1;
    let sinceFlash = Infinity;
    let sinceStep = Infinity;
    let subpageFor = 0;
    let second = -1;
    let rolling = -1;
    const dropped = onsetOf('drop');

    return {
      output,
      frame: ({ dt, shared }) => {
        const s = shared.signals;
        const still = (shared.still?.value ?? 0) > 0.5;
        let changed = false;
        sinceFlash += dt;
        sinceStep += dt;
        const beats = s.beats?.value ?? 0;
        if (beatsSeen >= 0 && beats !== beatsSeen) {
          if (!still && sinceFlash >= FLASH_GAP) {
            flash.value = 1;
            sinceFlash = 0;
          }
          if (sinceStep >= (still ? STILL_STEP_GAP : STEP_GAP)) {
            band = (band + 1) % BANDS.length;
            sinceStep = 0;
            changed = true;
          }
        }
        beatsSeen = beats;
        flash.value *= Math.exp(-dt / FLASH_FADE);

        subpageFor += dt;
        if (subpageFor >= ((s.silence?.value ?? 0) > 0.5 ? QUIET_SUBPAGE_SECONDS : SUBPAGE_SECONDS)) {
          subpage = (subpage % SUBPAGES.length) + 1;
          subpageFor = 0;
          changed = true;
        }

        if (dropped(s) && !still && rolling < 0) rolling = 0;
        if (rolling >= 0) {
          rolling += dt;
          const t = Math.min(rolling / ROLL_SECONDS, 1);
          roll.value = t * t * (3 - 2 * t);
          if (t >= 1) {
            rolling = -1;
            roll.value = 0;
          }
        }

        // The header's clock is repainted as each second turns.
        const now = new Date();
        const tick = Math.floor(now.getTime() / 1000);
        if (tick !== second) {
          second = tick;
          changed = true;
        }
        if (changed) {
          paint(now);
          sheet.needsUpdate = true;
        }
      },
      dispose: () => {
        blocks.dispose();
        cells.dispose();
        sheet.dispose();
      },
    };
  },
};
