// A small 3D scene of a backdrop's own, drawn each frame into a texture that the backdrop
// paints as its picture: for a backdrop made of real lit objects rather than a formula per
// pixel. The ridge then hides itself over it like over any other picture.
import { HalfFloatType, PerspectiveCamera, RenderTarget, Scene, Vector3 } from 'three/webgpu';
import { texture, vec2 } from 'three/tsl';

// `renderer`, `resolution` and `uv` are the backdrop's own context. The scene is drawn at
// `scale` of the screen's resolution. Returns the `scene` and its `camera` to fill and
// move, `colour` (the picture, a colour node for the backdrop to return), `render()` to
// call once a frame, and `dispose()`.
export function createDiorama({ renderer, resolution, uv, fov = 50, near = 0.1, far = 200, scale = 1 }) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(fov, 1, near, far);
  const target = new RenderTarget(1, 1, { type: HalfFloatType, samples: 4 });

  function render() {
    const width = Math.max(1, Math.round(resolution.value.x * scale));
    const height = Math.max(1, Math.round(resolution.value.y * scale));
    if (target.width !== width || target.height !== height) {
      target.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    const before = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(before);
  }

  return {
    scene,
    camera,
    // A backdrop's picture runs from the bottom left; a drawn scene's rows are stored from
    // the top.
    colour: texture(target.texture, vec2(uv.x, uv.y.oneMinus())).rgb,
    render,
    dispose: () => target.dispose(),
  };
}

const gaze = new Vector3();
// How far the visitor has swung the main camera off straight ahead: `turn` to the side and
// `dip` downward, in radians, for a diorama that leans the same way so the two views agree.
export function swingOf(camera) {
  camera.getWorldDirection(gaze);
  return { turn: Math.atan2(gaze.x, -gaze.z), dip: Math.asin(Math.min(Math.max(-gaze.y, -1), 1)) };
}
