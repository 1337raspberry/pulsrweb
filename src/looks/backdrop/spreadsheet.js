// A spreadsheet: menus, a toolbar, a formula bar and a grid of cells holding the spectrum
// as figures, the newest row of the ridge in column B and older ones to its right, each
// cell shaded by its value. A chart floats over the grid with an empty plot area for the
// ridge to be drawn in. The sheet takes its colours from the palette, so a dark palette
// is the same sheet in a dark theme. The selected cell follows the loudest band on a beat.
import { CanvasTexture, Color, LinearFilter, SRGBColorSpace } from 'three/webgpu';
import { texture } from 'three/tsl';
import { SERIES, seriesColour, sheetLayout } from '../lib/chartbox.js';

const SANS = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
// The sheet is redrawn this many times a second, and drawn with at most this many canvas
// pixels to a CSS pixel.
const REDRAWS = 8;
const FINEST = 2;
const MENUS = ['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Help'];
const TABS = ['Sheet1', 'Sheet2', 'Sheet3'];
// The level that reaches the last colour of a cell's shading, and of the chart's axis.
const FULL = 0.6;

const mixed = (a, b, t) => a.map((channel, i) => channel + (b[i] - channel) * t);
const css = (c, alpha = 1) => `rgba(${c.map((channel) => Math.round(Math.min(Math.max(channel, 0), 1) * 255)).join(',')},${alpha})`;
const brightness = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;

// A column's letters: A to Z, then AA, AB and on.
function lettersOf(index) {
  let name = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) name = String.fromCharCode(65 + (n % 26)) + name;
  return name;
}

export default {
  name: 'spreadsheet',
  build: ({ uv, background, stops, ink, resolution, pixelRatio, ridge }) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const sheet = new CanvasTexture(canvas);
    sheet.colorSpace = SRGBColorSpace;
    sheet.generateMipmaps = false;
    sheet.minFilter = LinearFilter;
    sheet.magFilter = LinearFilter;

    let layout = null;
    // Where along the spectrum the selected cell is, 0 to 1; it sits in the newest column.
    let selected = 0.3;
    let beatsSeen = -1;
    let sinceDrawn = Infinity;
    const scratch = new Color();
    // A palette colour as the canvas wants it, and as the shaders mix it.
    const shown = (colour) => scratch.copy(colour).convertLinearToSRGB().toArray();
    const linear = (colour) => colour.toArray();

    // Matches the canvas to the screen. Says whether its size changed.
    function fit() {
      const ratio = pixelRatio.value || 1;
      const width = Math.max(resolution.value.x / ratio, 2);
      const height = Math.max(resolution.value.y / ratio, 2);
      const scale = Math.min(ratio, FINEST);
      const across = Math.round(width * scale);
      const down = Math.round(height * scale);
      if (layout && canvas.width === across && canvas.height === down) return false;
      // A texture keeps the size it was first drawn at, so a new size needs a new one.
      sheet.dispose();
      canvas.width = across;
      canvas.height = down;
      layout = sheetLayout(width, height);
      return true;
    }

    // The mean level of the spectrum between `from` and `to` (0 to 1 across it), `back`
    // rows ago, or null for a row the ridge no longer keeps.
    function levelOf(data, from, to, back) {
      if (!data || back > data.capacity) return null;
      const line = back === 0 ? 0 : ((((data.newest.value - (back - 1)) % data.capacity) + data.capacity) % data.capacity) + 1;
      const levels = data.texture.image.data;
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        const along = from + ((to - from) * (i + 0.5)) / 4;
        sum += levels[line * data.points + Math.min(Math.floor(along * data.points), data.points - 1)];
      }
      return sum / 4;
    }

    function paint(data) {
      const L = layout;
      const scale = canvas.width / L.width;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const paper = shown(background.value);
      const text = shown(ink.value);
      const colours = stops.map((stop) => shown(stop.value));
      const accent = colours[0];
      // Lettering on the accent colour: whichever of the paper and the text stands out.
      const onAccent = Math.abs(brightness(accent) - brightness(paper)) > Math.abs(brightness(accent) - brightness(text)) ? paper : text;
      const chrome = mixed(paper, text, 0.06);
      const rule = mixed(paper, text, 0.15);
      const firm = mixed(paper, text, 0.32);
      const quiet = mixed(text, paper, 0.3);
      const series = (n) => css(scratch.fromArray(seriesColour(n, stops.map((stop) => linear(stop.value)), linear(background.value))).convertLinearToSRGB().toArray());
      const line = (x, y, width, height, colour) => {
        ctx.fillStyle = css(colour);
        ctx.fillRect(x, y, width, height);
      };
      const write = (string, x, y, { colour = text, size = 12, weight = 400, align = 'left', italic = false } = {}) => {
        ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${SANS}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = css(colour);
        ctx.fillText(string, x, y);
      };

      line(0, 0, L.width, L.height, paper);

      // The grid: a column of band numbers, then the ridge's rows as columns of figures.
      const columns = Math.ceil((L.width - L.header) / L.column);
      const rows = Math.ceil((L.gridBottom - L.gridTop) / L.row);
      const bands = Math.max(rows - 1, 1);
      const { box, plot } = L;
      const pick = Math.min(Math.floor(selected * bands), bands - 1);
      let sum = 0;
      let counted = 0;
      let picked = 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, L.gridTop, L.width, L.gridBottom - L.gridTop);
      ctx.clip();
      for (let i = 0; i < columns; i++) {
        const x = L.header + i * L.column;
        for (let j = 0; j < rows; j++) {
          const y = L.gridTop + j * L.row;
          const hidden = x >= box.x && x + L.column <= box.x + box.width && y >= box.y && y + L.row <= box.y + box.height;
          if (j === 0) {
            if (!hidden) write(i === 0 ? 'Band' : `Series${i}`, x + L.column - 7, y + L.row / 2 + 0.5, { size: 11.5, weight: 600, align: 'right' });
            continue;
          }
          if (i === 0) {
            if (!hidden) write(String(j), x + L.column - 7, y + L.row / 2 + 0.5, { size: 11.5, align: 'right', colour: quiet });
            continue;
          }
          const level = levelOf(data, (j - 1) / bands, j / bands, i - 1);
          if (level === null) continue;
          sum += level * 100;
          counted += 1;
          if (i === 1 && j - 1 === pick) picked = level;
          if (hidden) continue;
          // Shaded by its value, up through the palette's colours.
          const t = Math.min(Math.max(level / FULL, 0), 1);
          const shade = t < 0.5 ? mixed(colours[0], colours[1], t * 2) : mixed(colours[1], colours[2], t * 2 - 1);
          ctx.fillStyle = css(shade, Math.min(t * 1.5, 1) * 0.5);
          ctx.fillRect(x, y, L.column, L.row);
          write((level * 100).toFixed(1), x + L.column - 7, y + L.row / 2 + 0.5, { size: 11.5, align: 'right' });
        }
      }
      for (let i = 0; i <= columns; i++) line(L.header + i * L.column, L.gridTop, 1, L.gridBottom - L.gridTop, rule);
      for (let j = 0; j <= rows; j++) line(L.header, L.gridTop + j * L.row, L.width - L.header, 1, rule);
      // The selected cell, with its fill handle.
      const cell = { x: L.header + L.column, y: L.gridTop + (pick + 1) * L.row };
      ctx.strokeStyle = css(accent);
      ctx.lineWidth = 2;
      ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, L.column, L.row);
      line(cell.x + L.column - 3, cell.y + L.row - 3, 7, 7, paper);
      line(cell.x + L.column - 2, cell.y + L.row - 2, 5, 5, accent);
      ctx.restore();

      // The row numbers and the column letters, the selected cell's own picked out.
      line(0, L.gridTop, L.header, L.gridBottom - L.gridTop, chrome);
      line(0, L.gridTop - L.letters, L.width, L.letters, chrome);
      const marked = mixed(chrome, accent, 0.28);
      line(0, cell.y, L.header, L.row, marked);
      line(cell.x, L.gridTop - L.letters, L.column, L.letters, marked);
      for (let j = 0; j < rows; j++) {
        const y = L.gridTop + j * L.row;
        if (y + L.row / 2 < L.gridBottom) write(String(j + 1), L.header / 2, y + L.row / 2 + 0.5, { size: 11, align: 'center', colour: quiet, weight: j === pick + 1 ? 700 : 400 });
        line(0, y, L.header, 1, rule);
      }
      for (let i = 0; i < columns; i++) {
        const x = L.header + i * L.column;
        write(lettersOf(i), x + L.column / 2, L.gridTop - L.letters / 2 + 0.5, { size: 11, align: 'center', colour: quiet, weight: i === 1 ? 700 : 400 });
        line(x, L.gridTop - L.letters, 1, L.letters, rule);
      }
      line(L.header, L.gridTop - L.letters, 1, L.gridBottom - L.gridTop + L.letters, firm);
      line(0, L.gridTop, L.width, 1, firm);
      line(0, L.gridTop - L.letters, L.width, 1, rule);

      // The formula bar: the selected cell's name, and what it holds.
      const formulaTop = L.menu + L.tools;
      line(0, formulaTop, L.width, L.formula, paper);
      const nameBox = L.header + L.column;
      write(`B${pick + 2}`, 10, formulaTop + L.formula / 2 + 0.5, { size: 12 });
      line(nameBox, formulaTop + 4, 1, L.formula - 8, rule);
      write('fx', nameBox + 12, formulaTop + L.formula / 2 + 0.5, { size: 12.5, italic: true, colour: quiet });
      line(nameBox + 34, formulaTop + 4, 1, L.formula - 8, rule);
      write((picked * 100).toFixed(4), nameBox + 44, formulaTop + L.formula / 2 + 0.5, { size: 12 });

      // The toolbar: a font and a size, then the usual rows of small buttons.
      if (L.tools) {
        const top = L.menu;
        const middle = top + L.tools / 2 + 0.5;
        line(0, top, L.width, L.tools, chrome);
        line(0, top + L.tools - 1, L.width, 1, rule);
        let x = 12;
        const boxed = (label, width) => {
          line(x, top + 7, width, L.tools - 14, firm);
          line(x + 1, top + 8, width - 2, L.tools - 16, paper);
          write(label, x + 8, middle, { size: 12 });
          ctx.beginPath();
          ctx.moveTo(x + width - 15, middle - 2);
          ctx.lineTo(x + width - 7, middle - 2);
          ctx.lineTo(x + width - 11, middle + 3);
          ctx.fillStyle = css(quiet);
          ctx.fill();
          x += width + 8;
        };
        const gap = () => {
          line(x + 4, top + 8, 1, L.tools - 16, rule);
          x += 14;
        };
        boxed('Sans', 104);
        boxed('11', 50);
        gap();
        write('B', x + 12, middle, { size: 13.5, weight: 700, align: 'center' });
        write('I', x + 38, middle, { size: 13.5, italic: true, align: 'center' });
        write('U', x + 64, middle, { size: 13.5, align: 'center' });
        line(x + 59, middle + 8, 10, 1, text);
        x += 82;
        gap();
        // Left, centre and right alignment, each a little stack of lines.
        for (let a = 0; a < 3; a++) {
          [14, 9, 14, 7].forEach((length, n) => line(x + 4 + ((14 - length) * a) / 2, middle - 6 + n * 4, length, 1.5, quiet));
          x += 26;
        }
        gap();
        ['$', '%', '.00'].forEach((label) => {
          write(label, x + 12, middle, { size: 12.5, align: 'center', colour: quiet });
          x += 28;
        });
        gap();
        // The fill colour, the lettering's colour and the sum.
        write('A', x + 12, middle - 2, { size: 13, weight: 600, align: 'center' });
        line(x + 5, middle + 7, 14, 3, colours[2]);
        x += 28;
        line(x + 5, middle - 8, 14, 11, mixed(paper, text, 0.5));
        line(x + 6, middle - 7, 12, 9, paper);
        line(x + 5, middle + 7, 14, 3, accent);
        x += 28;
        gap();
        write('Σ', x + 12, middle, { size: 14, align: 'center', colour: quiet });
        x += 28;
        // The chart button, pressed, as the chart is the thing selected.
        line(x + 1, top + 6, 26, L.tools - 12, mixed(chrome, accent, 0.25));
        [7, 12, 9].forEach((tall, n) => {
          ctx.fillStyle = series(n);
          ctx.fillRect(x + 6 + n * 6, middle + 7 - tall, 4, tall);
        });
      }

      // The menu bar, in the accent colour.
      line(0, 0, L.width, L.menu, accent);
      line(11, 8, 15, 15, onAccent);
      line(12, 15, 13, 1, accent);
      line(18, 9, 1, 13, accent);
      let menuX = 38;
      for (const menu of MENUS) {
        write(menu, menuX, L.menu / 2 + 0.5, { size: 12.5, colour: onAccent });
        menuX += ctx.measureText(menu).width + 16;
        if (menuX > L.width - 60) break;
      }
      if (menuX < L.width - 150) write('spectrum.csv', L.width - 14, L.menu / 2 + 0.5, { size: 12.5, colour: onAccent, align: 'right' });

      // The sheets' tabs, and the status bar with the figures' average, count and sum.
      line(0, L.gridBottom, L.width, L.tabs, chrome);
      line(0, L.gridBottom, L.width, 1, firm);
      let tabX = L.header;
      TABS.forEach((tab, n) => {
        ctx.font = `${n === 0 ? 600 : 400} 12px ${SANS}`;
        const width = ctx.measureText(tab).width + 28;
        if (n === 0) {
          line(tabX, L.gridBottom, width, L.tabs, paper);
          line(tabX, L.gridBottom + L.tabs - 3, width, 3, accent);
        }
        write(tab, tabX + width / 2, L.gridBottom + L.tabs / 2, { size: 12, align: 'center', weight: n === 0 ? 600 : 400, colour: n === 0 ? text : quiet });
        tabX += width;
        line(tabX, L.gridBottom + 6, 1, L.tabs - 12, rule);
      });
      write('+', tabX + 16, L.gridBottom + L.tabs / 2, { size: 15, align: 'center', colour: quiet });
      const statusTop = L.gridBottom + L.tabs;
      line(0, statusTop, L.width, L.status, chrome);
      line(0, statusTop, L.width, 1, rule);
      write('Ready', 12, statusTop + L.status / 2 + 0.5, { size: 11.5, colour: quiet });
      if (!L.narrow && counted) {
        const figures = `Average: ${(sum / counted).toFixed(2)}      Count: ${counted}      Sum: ${sum.toFixed(1)}`;
        write(figures, L.width - 150, statusTop + L.status / 2 + 0.5, { size: 11.5, colour: quiet, align: 'right' });
      }
      if (!L.narrow) {
        line(L.width - 126, statusTop + L.status / 2, 70, 1, quiet);
        line(L.width - 93, statusTop + L.status / 2 - 4, 3, 9, quiet);
        write('100%', L.width - 12, statusTop + L.status / 2 + 0.5, { size: 11.5, colour: quiet, align: 'right' });
      }

      // The chart: a title, the axes' figures, a legend, and the plot area left empty.
      line(box.x, box.y, box.width, box.height, firm);
      line(box.x + 1, box.y + 1, box.width - 2, box.height - 2, paper);
      write('Chart Title', box.x + box.width / 2, box.y + 22, { size: 15, align: 'center', colour: mixed(text, paper, 0.15) });
      for (let g = 0; g <= 5; g++) {
        const y = Math.round(plot.y + (plot.height * g) / 5);
        line(plot.x, y, plot.width, 1, g === 5 ? firm : rule);
        write(String(100 - g * 20), plot.x - 8, y + 0.5, { size: 11, align: 'right', colour: quiet });
      }
      const every = Math.max(Math.ceil(bands / Math.max(Math.floor(plot.width / 46), 1)), 1);
      for (let band = 1; band <= bands; band += every) {
        write(String(band), plot.x + (plot.width * (band - 0.5)) / bands, plot.y + plot.height + 13, { size: 11, align: 'center', colour: quiet });
      }
      const entries = Math.max(Math.min(SERIES, Math.floor((box.width - 30) / 76)), 1);
      const legendY = box.y + box.height - 19;
      let legendX = box.x + box.width / 2 - (entries * 76 - 12) / 2;
      for (let n = 0; n < entries; n++) {
        ctx.fillStyle = series(n);
        ctx.fillRect(legendX, legendY - 4, 9, 9);
        write(`Series${n + 1}`, legendX + 14, legendY + 1, { size: 11, colour: quiet });
        legendX += 76;
      }
      // The handles of a selected chart, at its corners and the middles of its sides.
      for (const [fx, fy] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.arc(box.x + (box.width - 1) * fx + 0.5, box.y + (box.height - 1) * fy + 0.5, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = css(paper);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = css(mixed(paper, text, 0.5));
        ctx.stroke();
      }
      sheet.needsUpdate = true;
    }

    fit();
    paint(ridge);

    return {
      colour: texture(sheet, uv).rgb,
      frame: ({ dt, shared }) => {
        const resized = fit();
        // On a beat the selection jumps to the band the spectrum peaks in.
        const s = shared.signals;
        if (beatsSeen >= 0 && s.beats.value !== beatsSeen) selected = Math.min(Math.max(s.peakAt?.value ?? 0, 0), 0.999);
        beatsSeen = s.beats.value;
        sinceDrawn += dt;
        if (!resized && sinceDrawn < 1 / REDRAWS) return;
        sinceDrawn = 0;
        paint(shared.ridge);
      },
      dispose: () => sheet.dispose(),
    };
  },
};
