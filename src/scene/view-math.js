// Pure helpers for the view, kept apart from three.js so they test without a GPU.

// The canvas backing store in device pixels; the ratio is capped at 2 to bound fill cost.
export function canvasSize(clientWidth, clientHeight, devicePixelRatio) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  return {
    width: Math.max(1, Math.round(clientWidth * ratio)),
    height: Math.max(1, Math.round(clientHeight * ratio)),
    ratio,
  };
}

// How far a view's target may stray from the opening target, per axis.
export const TARGET_MARGIN = 6;

const isPoint = (value) => Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n));

// A view that is safe to apply: `opening` when `view` is malformed or degenerate,
// otherwise `view` with its target kept near the opening target.
export function safeView(view, opening) {
  if (!view || typeof view !== 'object' || !isPoint(view.position) || !isPoint(view.target)) return opening;
  if (view.position.every((n, i) => n === view.target[i])) return opening;
  const target = view.target.map((n, i) =>
    Math.min(opening.target[i] + TARGET_MARGIN, Math.max(opening.target[i] - TARGET_MARGIN, n)),
  );
  return { position: [...view.position], target };
}

const rad = (degrees) => (degrees * Math.PI) / 180;

// Width in CSS pixels of the poster: the square the ridge fills when seen from the front,
// leaving room for a line of large type above and below it.
export function posterWidth(width, height) {
  return Math.max(1, Math.min(width * 0.8, height * 0.62));
}

// A pose says where the camera stands without fixing its lens: `azimuth` and `polar` are
// its direction from the target in radians (azimuth 0 is straight in front, polar 0 is
// overhead) and `framing` is the height of the scene visible at the target. The distance
// follows from the field of view, so a pose keeps its framing while the lens changes.
export function distanceFor(framing, fovDegrees) {
  return framing / (2 * Math.tan(rad(fovDegrees) / 2));
}

export function poseToPosition(pose, target, fovDegrees) {
  const d = distanceFor(pose.framing, fovDegrees);
  const flat = d * Math.sin(pose.polar);
  return [
    target[0] + flat * Math.sin(pose.azimuth),
    target[1] + d * Math.cos(pose.polar),
    target[2] + flat * Math.cos(pose.azimuth),
  ];
}

export function positionToPose(position, target, fovDegrees) {
  const [x, y, z] = position.map((n, i) => n - target[i]);
  const d = Math.hypot(x, y, z) || 1e-6;
  return {
    azimuth: Math.atan2(x, z),
    polar: Math.acos(Math.min(1, Math.max(-1, y / d))),
    framing: 2 * d * Math.tan(rad(fovDegrees) / 2),
  };
}

// The pose `home` turned to one side and brought in or out. `turn` is the share of the way
// round to the sideways limit on that side, below zero for the one side and above for the
// other, where a limit of infinity counts as half a turn; `zoom` multiplies the framing.
// `limits` holds the least and most `azimuth` and `framing` the camera may have.
export function roamedPose(home, { turn = 0, zoom = 1 }, limits) {
  const [least, most] = limits.azimuth;
  const reach = turn < 0 ? home.azimuth - least : most - home.azimuth;
  const [nearest, furthest] = limits.framing;
  return {
    azimuth: home.azimuth + turn * (Number.isFinite(reach) ? reach : Math.PI),
    polar: home.polar,
    framing: Math.min(furthest, Math.max(nearest, home.framing * zoom)),
  };
}

// A pose blended between `a` and `b`; `t` is clamped to 0…1 and eased with smoothstep.
export function mixPose(a, b, t) {
  const c = Math.min(1, Math.max(0, t));
  const k = c * c * (3 - 2 * c);
  const mix = (name) => a[name] + (b[name] - a[name]) * k;
  return { azimuth: mix('azimuth'), polar: mix('polar'), framing: mix('framing') };
}

// A slight, slow wander around `home`, `seconds` after it began: it starts at `home`,
// sways a few degrees to either side, rises and dips, and leans in a touch. The three
// periods share no factor, so the path takes a long time to repeat.
export function driftPose(home, seconds) {
  const turn = (period) => (2 * Math.PI * seconds) / period;
  return {
    azimuth: home.azimuth + rad(6) * Math.sin(turn(47)),
    polar: home.polar + rad(2.5) * Math.sin(turn(31)),
    framing: home.framing * (0.985 + 0.015 * Math.cos(turn(61))),
  };
}
