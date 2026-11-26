// What is behind the ridge, as a filter's own input shows it. A filter tells the ridge's
// marks from the backdrop by comparing its picture with this ground at the same point.
//
// The first filter sees the scene as drawn, so its ground is the backdrop itself. A second
// filter sees the first one's result, where the backdrop may have been folded, bent or
// replaced; the first says what became of it by handing on a ground of its own with
// `handOn`. A filter that hands nothing on is taken to have left the backdrop in place.
const handed = new WeakMap();

// Records, against the output node a filter returns, the ground of that output:
// `groundAfter(uv)` gives what is behind the ridge at a screen point (0 to 1 from the top
// left) once the filter has done its work. Returns `output`, for convenience.
export function handOn(output, groundAfter) {
  handed.set(output, groundAfter);
  return output;
}

// The ground for a filter's input, as a function of a screen point. `context` is what the
// filter's `build` was given.
export function groundOf({ colour, ground, background }) {
  // A filter after the first reads the one before through a texture made from its output.
  const before = colour?.isRTTNode ? handed.get(colour.node) : undefined;
  return before ?? ground ?? (() => background);
}
