// The ridge as a film of oil on water: colours shift with the angle it is seen from, so
// moving the camera slides rainbows across the peaks; the palette keeps its lightness.
import { cameraPosition, cos, cross, dot, int, max, min, mix, normalize, sRGBTransferEOTF, varying, vec3 } from 'three/tsl';
import { fromLab, ramp3, toLab } from '../lib/colour.js';

export default {
  name: 'oilslick',
  colour: ({ row, rowAt, index, place, alongAt, points, ridge, t, stops, signals }) => {
    // Where this point is in the world, and the surface's normal there: across the row to
    // its neighbours, and back to the same point on the row behind.
    const at = (i, r) => place(alongAt(i), r.heightAt(i).mul(r.rise), r);
    const here = at(index, row);
    const sideways = at(min(index.add(1), points - 1), row).sub(at(max(index.sub(1), 0), row));
    const back = at(index, rowAt(min(row.k.add(1), int(ridge.capacity)))).sub(here);
    const normal = varying(normalize(cross(sideways, back)));
    const world = varying(here);
    const facing = dot(normalize(normal), normalize(cameraPosition.sub(world))).abs();
    // A thin film: the colour it reflects cycles with its thickness times how obliquely it
    // is seen. Taller peaks are thicker; beats and the music's clock nudge it.
    const thickness = t.mul(0.7).add(0.3).add(signals.beat.mul(0.12)).add(signals.clock.mul(0.03));
    const film = cos(facing.mul(thickness).mul(1.3).add(vec3(0, 0.33, 0.67)).mul(Math.PI * 2)).mul(0.5).add(0.5);
    const base = toLab(ramp3(stops, t));
    const sheen = toLab(sRGBTransferEOTF(film));
    return fromLab(vec3(base.x, mix(base.yz, sheen.yz, 0.75).mul(1.2)));
  },
};
