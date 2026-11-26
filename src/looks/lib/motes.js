// Specks in the air among the rows: snow, sparks, dust. One sprite drawn many times over,
// each copy placed by its own number alone, so nothing is kept from frame to frame and no
// compute pass is needed. The copies blend as light added to the picture, or as ink laid
// over it, chosen per pixel by the colour's alpha: 0 adds, more covers.
import { CustomBlending, OneFactor, OneMinusSrcAlphaFactor, Sprite, SpriteNodeMaterial } from 'three/webgpu';
import { hash, instanceIndex, length, mix, smoothstep, uv, vec4 } from 'three/tsl';

// `count` copies. `make(seeds)` is given four numbers from 0 to 1 that are the copy's own
// (TSL nodes, the same every frame) and returns `{ position, size, colour }`: the copy's
// place in the world, its size in world units, and its colour as a vec4 whose rgb is
// already multiplied by its alpha (alpha 0 for light that adds, more for ink that covers).
// Values worked out from the seeds for the colour belong to the vertex stage: wrap them in
// `varying(...)`.
export function createMotes({ count, make }) {
  const seeds = [1, 7919, 15485, 32452].map((k) => hash(instanceIndex.add(k)));
  const { position, size, colour } = make(seeds);
  const material = new SpriteNodeMaterial();
  material.positionNode = position;
  material.scaleNode = size;
  material.colorNode = colour;
  material.transparent = true;
  material.depthWrite = false;
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return { object: sprite, dispose: () => material.dispose() };
}

// A soft round speck on the sprite: 1 in the middle, 0 at the edge.
export const softDot = (hardness = 0.1) => smoothstep(hardness, 0.5, length(uv().sub(0.5))).oneMinus();

// `glow` added as light on a dark background, or `ink` laid over a light one at `cover`;
// `light` is the shared uniform. For a mote's colour.
export const glowOrInk = (glow, ink, cover, light) => vec4(mix(glow, ink.mul(cover), light), cover.mul(light));
