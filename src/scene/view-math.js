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

// A view blended between `a` and `b`; `t` is clamped to 0…1 and eased with smoothstep.
export function mixView(a, b, t) {
  const c = Math.min(1, Math.max(0, t));
  const k = c * c * (3 - 2 * c);
  const mix = (from, to) => from.map((value, i) => value + (to[i] - value) * k);
  return { position: mix(a.position, b.position), target: mix(a.target, b.target) };
}

// How far a view's target may stray from the opening target, per axis.
const TARGET_MARGIN = 6;

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
