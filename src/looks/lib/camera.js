// Helpers for pictures that are drawn outside the scene but want to line up with it.
import { normalize, vec2, vec4 } from 'three/tsl';

// The direction, in the world, of the ray from the eye through the screen point `uv`
// (0 to 1 from the bottom left). `camera` is the shared context's camera uniforms.
export const rayThrough = (uv, camera) => {
  const seen = camera.projectionInverse.mul(vec4(uv.mul(2).sub(1), 1, 1));
  return normalize(camera.world.mul(vec4(seen.xyz.div(seen.w), 0)).xyz);
};

// Where the world point `p` lands on the screen, 0 to 1 from the top left, as a filter's
// `uv` runs. Only meaningful for a point in front of the eye.
export const onScreen = (p, camera) => {
  const clip = camera.viewProjection.mul(vec4(p, 1));
  const at = clip.xy.div(clip.w).mul(0.5).add(0.5);
  return vec2(at.x, at.y.oneMinus());
};
