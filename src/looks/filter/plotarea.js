// Keeps the ridge inside a chart's plot area: the picture shows only within the rectangle
// a spreadsheet leaves empty for it, and the backdrop alone everywhere else.
import { Vector4 } from 'three/webgpu';
import { uniform, vec4 } from 'three/tsl';
import { sheetLayout } from '../lib/chartbox.js';
import { groundOf, handOn } from '../lib/filter-ground.js';

export default {
  name: 'plotarea',
  build: (context) => {
    const { colour, uv, resolution, pixelRatio } = context;
    const ground = groundOf(context);
    // The plot area's left, top, right and bottom, 0 to 1 from the screen's top left.
    const edges = uniform(new Vector4(0, 0, 1, 1));
    const place = () => {
      const ratio = pixelRatio.value || 1;
      const width = Math.max(resolution.value.x / ratio, 2);
      const height = Math.max(resolution.value.y / ratio, 2);
      const { plot } = sheetLayout(width, height);
      edges.value.set(plot.x / width, plot.y / height, (plot.x + plot.width) / width, (plot.y + plot.height) / height);
    };
    place();
    const inside = uv.x.greaterThan(edges.x).and(uv.x.lessThan(edges.z)).and(uv.y.greaterThan(edges.y)).and(uv.y.lessThan(edges.w));
    // The backdrop is left as it was, so a filter after this one sees the same ground.
    const output = handOn(vec4(inside.select(colour.rgb, ground(uv)), 1), ground);
    return { output, frame: place };
  },
};
