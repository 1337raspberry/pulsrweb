// A spreadsheet's measurements: where its bars, its grid and the chart floating over the
// grid sit on a screen, and the colours a chart gives its series. Shared by the backdrop
// that draws the sheet, the filter that keeps the ridge inside the chart, and the tint that
// colours the rows as series.

// A chart has this many series colours before they come round again: the palette's three,
// then the same three paler.
export const SERIES = 6;
// How far the second three are mixed towards the background.
export const PALER = 0.45;

// The plot area's reach from the screen's middle, as shares of the screen's height: how far
// above it and below it, and how wide it is. They suit a view that stands the front row's
// foot at the lower edge (see the `vlookup` preset's layout).
const PLOT = { above: 0.2, below: 0.28, across: 1.18 };

// Everything's place on a screen `width` by `height` CSS pixels, in CSS pixels from the top
// left: the bars' heights, the grid's cells, the chart's box and the plot area inside it.
export function sheetLayout(width, height) {
  const narrow = width < 620;
  const menu = 30;
  const tools = narrow ? 0 : 36;
  const formula = 26;
  const letters = 22;
  const tabs = 26;
  const status = 22;
  const header = narrow ? 34 : 44;
  const column = narrow ? 62 : 76;
  const row = 21;
  const gridTop = menu + tools + formula + letters;
  const gridBottom = height - tabs - status;

  // The chart. The ridge is drawn about the screen's middle at a size that follows the
  // screen's height, so the plot area is measured from the same middle: down to where the
  // front row's foot stands, up past its tallest peaks, and as wide as the row. The chart's
  // box (the plot area with room round it for a title, the axes' figures and a legend) stays
  // inside the grid, giving up some of the plot area on a narrow or a shallow screen.
  const pad = { left: 44, right: 20, top: 42, bottom: 62 };
  const least = { x: header + 8 + pad.left, y: gridTop + 6 + pad.top };
  const most = { x: width - 6 - pad.right, y: gridBottom - 6 - pad.bottom };
  const left = Math.round(Math.max(width / 2 - (height * PLOT.across) / 2, least.x));
  const right = Math.round(Math.max(Math.min(width / 2 + (height * PLOT.across) / 2, most.x), left + 40));
  const top = Math.round(Math.max(height / 2 - height * PLOT.above, least.y));
  const bottom = Math.round(Math.max(Math.min(height / 2 + height * PLOT.below, most.y), top + 40));
  const plot = { x: left, y: top, width: right - left, height: bottom - top };
  const box = { x: left - pad.left, y: top - pad.top, width: plot.width + pad.left + pad.right, height: plot.height + pad.top + pad.bottom };

  return { narrow, width, height, menu, tools, formula, letters, tabs, status, header, column, row, gridTop, gridBottom, box, plot };
}

// The colour of series `n` (0 up), from the palette's `stops` and `background`, each an
// [r, g, b]. A palette of one colour gives six strengths of it instead.
export function seriesColour(n, stops, background) {
  const i = ((n % SERIES) + SERIES) % SERIES;
  const plain = stops[0].every((channel, j) => Math.abs(channel - stops[2][j]) < 0.02);
  const paler = plain ? i * 0.13 : i >= 3 ? PALER : 0;
  return stops[i % 3].map((channel, j) => channel + (background[j] - channel) * paler);
}
