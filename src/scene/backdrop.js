// What is behind the ridge. A backdrop entry (see src/looks/backdrop) can paint a picture
// for the whole screen, put things of its own in the scene, or both. The picture is drawn
// once a frame into a texture; the scene's background, the ridge's curtains and the fade
// of its lines all read that texture at their own pixel, so the ridge hides itself over
// any picture just as it does over a flat colour.
import { rtt, screenUV, uv, vec2 } from 'three/tsl';

export function createBackdrop({ scene, shared, resolution, pixelRatio }) {
  let made = null;
  // The texture the current picture is drawn into, if there is a picture.
  let picture = null;

  // Puts `entry` up. Returns the ground, a colour node for what is behind a pixel, and
  // the veil, if the backdrop has one: what it would paint the ridge's curtains with.
  function set(entry) {
    if (made) {
      if (made.object) scene.remove(made.object);
      made.dispose?.();
      made = null;
    }
    if (picture) {
      picture.renderTarget.dispose();
      picture = null;
    }
    const context = { ...shared, resolution, pixelRatio, uv: uv() };
    made = entry.build ? entry.build(context) : {};
    const colour = made.colour ?? entry.colour?.(context);
    let ground = shared.background;
    if (colour) {
      // The picture's own coordinates run from the bottom left corner, as a texture's do;
      // the screen's run from the top left.
      picture = rtt(colour);
      ground = picture.sample(vec2(screenUV.x, screenUV.y.oneMinus())).rgb;
    }
    scene.backgroundNode = ground;
    if (entry.props) Object.assign(made, entry.props({ ...context, ground }));
    if (made.object) scene.add(made.object);
    // `groundAt(uv)` is the ground at any screen point, 0 to 1 from the top left, for a
    // filter that wants to tell the ridge from what is behind it.
    const drawn = picture;
    const groundAt = (at) => (drawn ? drawn.sample(vec2(at.x, at.y.oneMinus())).rgb : shared.background);
    return { ground, groundAt, veil: made.veil ?? entry.veil ?? null };
  }

  // `tick` is the frame's `{ seconds, dt, camera, ... }`.
  function frame(tick) {
    made?.frame?.(tick);
  }

  return { set, frame };
}
