// The three.js stage: renderer, scene, camera and orbit controls on the ridge canvas.
// WebGPU where the browser has it, WebGL 2 otherwise.
//
// The camera has two lenses. The cover is seen through a very long one, which flattens
// the ridge into a drawing; everything else through the `fov` setting. Moving between
// them keeps the framing, so the ridge holds its size while its depth opens up.

import { Color, PerspectiveCamera, Scene, Vector2, WebGPURenderer } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WIDTH } from './ridge-mesh.js';
import { canvasSize, distanceFor, driftPose, mixPose, posterWidth, poseToPosition, positionToPose, safeView } from './view-math.js';

const rad = (degrees) => (degrees * Math.PI) / 180;

// Two layouts. The sleeve's front view is fitted to the poster and looks at the middle of
// the ridge's depth, at this height; pulsr's own looks at a fixed point from closer in and
// lower down, showing this much of the scene's height there.
const SLEEVE_TARGET_Y = 0.75;
const SLEEVE_DEPTH = 23.7;
const CLASSIC_TARGET = [0, 2, -7];
const CLASSIC_FRAMING = 12.7;
// Straight in front and 40 degrees up, where the rows stack into the sleeve's square.
const FRONT = { azimuth: 0, polar: rad(50) };
// Where the front view may look down from, in degrees above level.
const MIN_TILT = 5;
const MAX_TILT = 85;
const COVER_FOV = 2;
// How much of the scene's height the camera may show at the target, closest and furthest.
const MIN_FRAMING = 5;
const MAX_FRAMING = 70;
// The camera's clip planes sit this far either side of the target.
const CLIP_REACH = 80;
const GLIDE_SECONDS = 0.6;
const LENS_SECONDS = 2.4;
// How long the camera takes to reach the front view of a layout just switched to, and how
// long the drift takes to reach its full sway, in seconds.
const REHOME_SECONDS = 1.2;
const DRIFT_EASE_SECONDS = 4;

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
  const camera = new PerspectiveCamera(COVER_FOV, 1, 1, 1000);
  // The front view's direction and the point it looks at follow the ridge's layout.
  let sleeve = true;
  let front = { ...FRONT };
  let centre = [0, SLEEVE_TARGET_Y, -SLEEVE_DEPTH / 2];
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...centre);
  controls.enableDamping = true;
  controls.enablePan = false;
  // Keeps the camera in front of and above the ridge.
  controls.minAzimuthAngle = FRONT.azimuth - rad(70);
  controls.maxAzimuthAngle = FRONT.azimuth + rad(70);
  controls.minPolarAngle = rad(20);
  controls.maxPolarAngle = rad(88);

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

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const target = () => controls.target.toArray();

  // The lens: `fov` is what the camera has now, on its way to the cover's or the setting's.
  let fov = COVER_FOV;
  let liveFov = 30;
  let flat = true;
  let lens = null;

  // A script places the camera each frame in place of the controls: `pose(seconds)` gives
  // where, `blend` eases into it from where the camera was, and `once` hands the camera
  // back to the controls when the blend is over.
  let script = null;
  // Whether the cover is showing, and whether the camera drifts when nothing else has it.
  let covering = true;
  let wander = false;
  let driftAt = 0;
  let dragging = false;
  let lastNow = performance.now();

  // The front pose: on the sleeve, framed so a row is as wide on screen as the poster.
  function home() {
    if (!sleeve) return { ...front, framing: CLASSIC_FRAMING };
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    return { ...front, framing: (WIDTH * height) / posterWidth(width, height) };
  }

  const poseNow = () => positionToPose(camera.position.toArray(), target(), fov);

  function place(pose) {
    camera.position.set(...poseToPosition(pose, target(), fov));
    camera.lookAt(controls.target);
  }

  function run(pose, seconds, once = false) {
    const blend = seconds > 0 && !reducedMotion.matches ? { from: poseNow(), seconds } : null;
    script = { pose, blend, once, start: lastNow };
  }

  // Sends the lens to the cover's or the setting's; `snap` skips the move.
  function setLens(toFlat, snap = false) {
    flat = toFlat;
    const goal = flat ? COVER_FOV : liveFov;
    if (snap) {
      const pose = poseNow();
      fov = goal;
      place(pose);
    }
    lens = goal === fov ? null : { from: fov, to: goal, start: lastNow };
  }

  // The cover: the front pose, held until goLive(). The sleeve is seen through the long
  // lens. With no `seconds` the camera is there at once.
  function showCover(seconds = 0) {
    covering = true;
    wander = false;
    run(home, seconds);
    setLens(sleeve, seconds === 0);
  }

  // Opens the lens up and hands the camera over: to `view` if one is given, else it stays
  // in front. With `drift` and no view, it starts a slight wander after `delayMs`, which
  // lasts until the camera is moved by hand.
  function goLive({ view = null, drift = false, delayMs = 0 } = {}) {
    covering = false;
    setLens(false);
    if (view) setView(view);
    else run(home, 0, true);
    wander = drift && !view;
    driftAt = lastNow + delayMs;
  }

  function setDrift(on) {
    wander = on;
    if (!on && script && script.drift) script = null;
    driftAt = lastNow;
  }

  const isDrifting = () => wander;

  // Follows the ridge: `depth` is how far back its rows reach, `tilt` the degrees the front
  // view looks down from, and `sleeve` which layout it is. The camera keeps its direction
  // and framing, except that a change of layout sends it to the new front view.
  function setLayout({ depth, tilt, sleeve: toSleeve = true }) {
    const changed = toSleeve !== sleeve;
    if (changed && !script) settle();
    const pose = poseNow();
    sleeve = toSleeve;
    front = { azimuth: 0, polar: rad(90 - Math.min(MAX_TILT, Math.max(MIN_TILT, tilt))) };
    centre = sleeve ? [0, SLEEVE_TARGET_Y, -depth / 2] : [...CLASSIC_TARGET];
    controls.target.set(...centre);
    place(pose);
    if (!changed) return;
    if (covering) {
      run(home, REHOME_SECONDS);
      setLens(sleeve);
    } else {
      run(home, REHOME_SECONDS, true);
    }
  }

  function setBackground(hex) {
    scene.background.set(hex);
  }

  function setFov(degrees) {
    liveFov = degrees;
    if (!flat) setLens(false);
  }

  // Views are written as they would be through the setting's lens, whatever the camera has now.
  function getView() {
    return { position: poseToPosition(poseNow(), target(), liveFov), target: target() };
  }

  // Spends any leftover damping velocity (a drag's coast) so it cannot nudge a view
  // written afterwards: with damping off, one update applies it in full and clears it.
  function settle() {
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
  }

  function setView(view) {
    const opening = { position: poseToPosition(home(), centre, liveFov), target: centre };
    const safe = safeView(view, opening);
    if (!script) settle();
    const from = poseNow();
    controls.target.set(...safe.target);
    const to = positionToPose(safe.position, safe.target, liveFov);
    place(from);
    run(() => to, GLIDE_SECONDS, true);
  }

  function resetView() {
    if (!script) settle();
    const from = poseNow();
    controls.target.set(...centre);
    place(from);
    run(home, GLIDE_SECONDS, true);
  }

  // A move by hand takes the camera from any script, and ends the drift for good.
  controls.addEventListener('start', () => {
    script = null;
    dragging = true;
    wander = false;
  });
  controls.addEventListener('end', () => {
    dragging = false;
  });

  // Moves the lens and the camera on to `now` (ms), then draws.
  function render(now = performance.now()) {
    lastNow = now;

    if (lens) {
      const t = reducedMotion.matches ? 1 : (now - lens.start) / 1000 / LENS_SECONDS;
      const c = Math.min(1, Math.max(0, t));
      const next = lens.from + (lens.to - lens.from) * c * c * (3 - 2 * c);
      // The camera backs away as the lens lengthens, so the framing holds.
      const pose = poseNow();
      fov = next;
      place(pose);
      if (c >= 1) lens = null;
    }
    camera.fov = fov;
    controls.minDistance = distanceFor(MIN_FRAMING, fov);
    controls.maxDistance = distanceFor(MAX_FRAMING, fov);

    // The drift sways around wherever the camera stands when it begins, easing in.
    if (!script && wander && !dragging && !reducedMotion.matches && now >= driftAt) {
      const base = poseNow();
      run((seconds) => mixPose(base, driftPose(base, seconds), seconds / DRIFT_EASE_SECONDS), 0);
      script.drift = true;
    }

    if (script) {
      const seconds = (now - script.start) / 1000;
      let pose = script.pose(seconds);
      if (script.blend) {
        const t = seconds / script.blend.seconds;
        pose = mixPose(script.blend.from, pose, t);
        if (t >= 1) script.blend = null;
      }
      place(pose);
      if (script.once && !script.blend) script = null;
    } else {
      controls.update();
    }

    // The clip planes follow the camera, so depth stays precise from far away.
    const distance = camera.position.distanceTo(controls.target);
    camera.near = Math.max(0.5, distance - CLIP_REACH);
    camera.far = distance + CLIP_REACH;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  showCover();

  return {
    renderer, scene, camera, controls, backend, resolution, pixelRatio,
    resize, setBackground, setFov, setDrift, isDrifting, setLayout, getView, setView, resetView, showCover, goLive, render,
  };
}
