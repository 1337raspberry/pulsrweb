// A picture that remembers its last frame. Each frame `update({ previous, uv, fresh })` is
// drawn into one of two textures while the other holds the previous frame's result; then
// they swap. `previous` is a texture node that can be sampled anywhere (to zoom, twist or
// smear what was there), `uv` runs 0 to 1 from the top left over the remembered picture,
// and `fresh` is 1 on the first frame after the size changed, when there is nothing to
// remember yet. Modelled on three's AfterImageNode, which is the same idea with one fixed
// update.
import { HalfFloatType, Node, NodeMaterial, NodeUpdateType, QuadMesh, RenderTarget, RendererUtils, Vector2 } from 'three/webgpu';
import { context, passTexture, texture, uniform, uv } from 'three/tsl';

const drawn = /*@__PURE__*/ new Vector2();
const quad = /*@__PURE__*/ new QuadMesh();
let saved;

class FeedbackNode extends Node {
  static get type() {
    return 'FeedbackNode';
  }

  constructor(update, scale) {
    super('vec4');
    this.update = update;
    this.scale = scale;
    const options = { depthBuffer: false, type: HalfFloatType };
    // `writing` takes this frame's result; `kept` holds the last frame's.
    this.writing = new RenderTarget(1, 1, options);
    this.kept = new RenderTarget(1, 1, options);
    this.previous = texture(this.kept.texture);
    this.output = passTexture(this, this.writing.texture);
    this.fresh = uniform(1);
    this.material = new NodeMaterial();
    this.material.name = 'Feedback';
    this.updateBeforeType = NodeUpdateType.FRAME;
  }

  getTextureNode() {
    return this.output;
  }

  setup(builder) {
    this.material.contextNode = context(builder.getSharedContext());
    this.material.fragmentNode = this.update({ previous: this.previous, uv: uv(), fresh: this.fresh });
    this.material.needsUpdate = true;
    return this.output;
  }

  updateBefore({ renderer }) {
    renderer.getDrawingBufferSize(drawn);
    const w = Math.max(1, Math.floor(drawn.x * this.scale));
    const h = Math.max(1, Math.floor(drawn.y * this.scale));
    if (this.writing.width !== w || this.writing.height !== h) {
      this.writing.setSize(w, h);
      this.kept.setSize(w, h);
      this.fresh.value = 1;
    }
    saved = RendererUtils.resetRendererState(renderer, saved);
    this.previous.value = this.kept.texture;
    this.output.value = this.writing.texture;
    renderer.setRenderTarget(this.writing);
    quad.material = this.material;
    quad.name = 'Feedback';
    quad.render(renderer);
    RendererUtils.restoreRendererState(renderer, saved);
    // What was just written is the next frame's memory; `output` still points at it.
    [this.writing, this.kept] = [this.kept, this.writing];
    this.fresh.value = 0;
  }

  dispose() {
    this.writing.dispose();
    this.kept.dispose();
    this.material.dispose();
    super.dispose();
  }
}

// `scale` sizes the memory against the canvas: 0.5 keeps a quarter of the pixels, which
// suits soft trails and halves the cost.
export const feedback = (update, { scale = 1 } = {}) => new FeedbackNode(update, scale);
