// The lines leave fading ghosts of where they have just been, so the picture's motion
// shows as a soft smear behind it: longer in quiet passages, crisper when it is loud.
import { vec2 } from 'three/tsl';
import { createTrails } from '../lib/filter-trails.js';

export default {
  name: 'echo',
  build: (context) => {
    // Full size: with no zoom the memory is read back pixel for pixel and stays sharp.
    const trails = createTrails(context, vec2(0.5, 0.5), { scale: 1 });
    let level = 0;
    function frame({ dt, shared }) {
      const loud = shared.signals.level?.value ?? 0;
      level += (loud - level) * (1 - Math.exp(-dt / 0.6));
      trails.frame(dt, { zoom: 1, twist: 0, decay: 0.9 + 0.06 * (1 - level) });
    }
    return { output: trails.output, frame, dispose: trails.dispose };
  },
};
