// The three.js stage: renderer, scene, camera and orbit controls on the ridge canvas.
// WebGPU where the browser has it, WebGL 2 otherwise.

import { Color, PerspectiveCamera, Scene, Vector2, WebGPURenderer } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { canvasSize, mixView, safeView } from './view-math.js';

// The view the page opens with, and the one resetView() returns to.
const OPENING_VIEW = { position: [0, 9.5, 15.5], target: [0, 2, -7] };
const GLIDE_SECONDS = 0.6;
const rad = (degrees) => (degrees * Math.PI) / 180;

// Starts the renderer on `canvas`; rejects if neither backend starts. `onLost(info)` is
// called if the graphics device or context is lost later, after which nothing draws.
export async function createStage(canvas, { forceWebGL = false, onLost } = {}) {
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL });
  try {
    await renderer.init();
  } catch (error) {
    // Releasing a renderer that never started can itself fail; the first error is the one to report.
    try {
      Promise.resolve(renderer.dispose()).catch(() => {});
    } catch {}
    throw error;
  }
  const backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
  // Both backends report a lost device or context through this hook.
  const reportLoss = renderer.onDeviceLost;
  renderer.onDeviceLost = (info) => {
    reportLoss.call(renderer, info);
    if (onLost) onLost(info);
  };

  const scene = new Scene();
  scene.background = new Color();
  const camera = new PerspectiveCamera(30, 1, 0.01, 100);
  camera.position.set(...OPENING_VIEW.position);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...OPENING_VIEW.target);
  controls.enableDamping = true;
  controls.enablePan = false;
  // Keeps the camera in front of and above the ridge, and not so close that the ribbons break up.
  const front = Math.atan2(
    OPENING_VIEW.position[0] - OPENING_VIEW.target[0],
    OPENING_VIEW.position[2] - OPENING_VIEW.target[2],
  );
  controls.minAzimuthAngle = front - rad(70);
  controls.maxAzimuthAngle = front + rad(70);
  controls.minPolarAngle = rad(20);
  controls.maxPolarAngle = rad(88);
  controls.minDistance = 8;
  controls.maxDistance = 60;
  controls.update();

  // Canvas size in device pixels, and the pixel ratio behind it, for shaders.
  const resolution = uniform(new Vector2(1, 1));
  const pixelRatio = uniform(1);

  // The backing store follows the CSS size; the stylesheet owns the CSS size.
  function resize() {
    const size = canvasSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    renderer.setPixelRatio(1);
    renderer.setSize(size.width, size.height, false);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    resolution.value.set(size.width, size.height);
    pixelRatio.value = size.ratio;
  }

  new ResizeObserver(resize).observe(canvas);
  // A pixel-ratio query matches only one ratio, so it is renewed after each change.
  function watchRatio() {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener(
      'change',
      () => {
        resize();
        watchRatio();
      },
      { once: true },
    );
  }
  watchRatio();
  resize();

  function setBackground(hex) {
    scene.background.set(hex);
  }

  function setFov(degrees) {
    camera.fov = degrees;
    camera.updateProjectionMatrix();
  }

  function getView() {
    return { position: camera.position.toArray(), target: controls.target.toArray() };
  }

  // Spends any leftover damping velocity (a drag's coast) so it cannot nudge a view
  // written afterwards: with damping off, one update applies it in full and clears it.
  function settle() {
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
  }

  function setView(view) {
    const safe = safeView(view, OPENING_VIEW);
    glide = null;
    settle();
    camera.position.set(...safe.position);
    controls.target.set(...safe.target);
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let glide = null;

  function resetView() {
    if (reducedMotion.matches) setView(OPENING_VIEW);
    else {
      settle();
      glide = { from: getView(), start: null };
    }
  }

  // A drag takes over from a glide.
  controls.addEventListener('start', () => {
    glide = null;
  });

  // Advances any glide, then the controls' damping, then draws. `now` is in ms.
  function render(now = performance.now()) {
    if (glide) {
      if (glide.start === null) glide.start = now;
      const t = (now - glide.start) / 1000 / GLIDE_SECONDS;
      const view = mixView(glide.from, OPENING_VIEW, t);
      camera.position.set(...view.position);
      controls.target.set(...view.target);
      if (t >= 1) glide = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, controls, backend, resolution, pixelRatio, resize, setBackground, setFov, getView, setView, resetView, render };
}
