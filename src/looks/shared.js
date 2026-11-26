// The uniforms every part of a look can read: the time, the sound's signals, the palette's
// colours, and where the camera is.
import { Color, Matrix4, Vector2, Vector3, Vector4 } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { createSignals } from './signals.js';

// The signals stamped on each row as it is cut, in the order a row's mark holds them
// (see HistoryRows); a row reads them back as `row.born.<name>`.
export const MARK_NAMES = ['level', 'bass', 'mid', 'treble', 'beat', 'beats', 'peakAt', 'energy'];

export function createShared(bands) {
  const measured = createSignals(bands);
  // One uniform per signal: a float, or four of them for a signal that is a list.
  const signals = Object.fromEntries(
    Object.entries(measured.values).map(([name, value]) => [name, uniform(typeof value === 'number' ? 0 : new Vector4())]),
  );
  const time = uniform(0);
  const mark = new Float32Array(MARK_NAMES.length);
  // The scene's camera, for pictures drawn outside the scene: its place in the world, its
  // world matrix, the inverse of its projection, and the matrix that takes a world point
  // to clip space.
  const camera = {
    position: uniform(new Vector3()),
    world: uniform(new Matrix4()),
    projectionInverse: uniform(new Matrix4()),
    viewProjection: uniform(new Matrix4()),
    near: uniform(1),
    far: uniform(1000),
  };
  let last = null;

  // Brings the time and the signals up to `seconds`. `heard` says whether any sound is
  // arriving. Returns the time since the last call, in seconds.
  function update(ridge, seconds, heard = true) {
    const dt = last === null ? 0 : Math.min(Math.max(seconds - last, 0), 0.25);
    last = seconds;
    time.value = seconds;
    const values = measured.update(ridge, dt, heard);
    for (const name in signals) {
      if (typeof values[name] === 'number') signals[name].value = values[name];
      else signals[name].value.fromArray(values[name]);
    }
    MARK_NAMES.forEach((name, i) => { mark[i] = typeof values[name] === 'number' ? values[name] : 0; });
    return dt;
  }

  function updateCamera(from) {
    camera.position.value.copy(from.position);
    camera.world.value.copy(from.matrixWorld);
    camera.projectionInverse.value.copy(from.projectionMatrixInverse);
    camera.viewProjection.value.multiplyMatrices(from.projectionMatrix, from.matrixWorldInverse);
    camera.near.value = from.near;
    camera.far.value = from.far;
  }

  return {
    time,
    signals,
    // The palette: its background, its three line colours low to high, and the colour its
    // lettering is set in. `light` is 1 on a light background and 0 on a dark one.
    background: uniform(new Color()),
    stops: [uniform(new Color()), uniform(new Color()), uniform(new Color())],
    ink: uniform(new Color()),
    light: uniform(0),
    camera,
    // 1 while the visitor has asked their system for less motion, 0 otherwise.
    still: uniform(0),
    // Where the pointer is on the picture, 0 to 1 from the top left.
    pointer: uniform(new Vector2(0.5, 0.5)),
    // The ridge's own data, for a part of a look that wants to read it; set by the ridge's mesh.
    ridge: null,
    mark,
    update,
    updateCamera,
    measured,
  };
}
