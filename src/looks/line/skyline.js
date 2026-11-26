// Rows as streets of buildings: every band of the spectrum a flat-roofed tower, with
// narrow alleys between, and the curtains turned into dark facades whose windows light up
// with the music. Far off, the windows blend into a glow.
import { float, fract, fwidth, int, max, min, mix, select, smoothstep, step, varying, vec2, vec3 } from 'three/tsl';
import { random, seedOf, signal } from '../lib/line-kit.js';

// Points per band: band centres sit on every eighth point of a row.
const BAND = 8;
// Windows across each tower, and storeys per world unit of height.
const COLUMNS = 3;
const STOREYS = 7;

export default {
  name: 'skyline',
  build: (c) => {
    // A point's tower: the band whose centre is nearest. The first point of each tower
    // stays at street level, an alley between it and the next.
    const tower = (i) => i.add(BAND / 2).div(BAND);
    const roof = (i) => {
      const centre = min(tower(i).mul(BAND), c.points - 1);
      const alley = i.add(BAND / 2).mod(BAND).equal(int(0));
      return select(alley, float(0), c.row.heightAt(centre));
    };
    const lift = (i) => roof(i).sub(c.row.heightAt(i));

    // On the facade: which tower, which column of windows, which storey.
    const top = varying(roof(c.index));
    const x = c.pointIndex.add(BAND / 2).div(BAND);
    const height = c.up.mul(top).mul(c.row.rise);
    const grid = vec2(x.mul(COLUMNS), height.mul(STOREYS));
    const cell = grid.floor();
    const inCell = fract(grid);
    const pane = step(0.22, inCell.x).mul(step(inCell.x, 0.78)).mul(step(0.3, inCell.y)).mul(step(inCell.y, 0.8));
    // Keep windows off the alley's slope and off the roof's edge.
    const wall = step(0.18, fract(x)).mul(step(height, top.mul(c.row.rise).sub(0.12)));
    // More windows lit the louder it is, and a scatter more on each beat.
    const seed = seedOf(c.row);
    const id = cell.x.mod(4096).add(cell.y.mul(613).mod(4096));
    const share = signal(c, 'level').mul(0.55).add(0.22).add(signal(c, 'beat').mul(0.15));
    const lit = step(random(seed, id), share);
    // Windows too small to draw blend into the average glow of a lit facade.
    const tiny = smoothstep(0.25, 0.6, max(fwidth(grid.x), fwidth(grid.y)));
    const glow = mix(pane.mul(lit).mul(wall), share.mul(0.3).mul(wall), tiny);
    const warm = mix(c.stops[1], c.stops[2], random(seed, id.add(7)));
    // Facades are a shade off the ground: lighter on a dark background, a soft tone of the
    // palette's first colour on a light one.
    const facade = mix(c.ground, mix(c.stops[0], c.ground, mix(0.75, 0.45, c.light)), mix(0.25, 0.6, c.light));
    // By night the windows glow; by day they are dark glass.
    const window = mix(warm.mul(1.4), mix(c.ground, vec3(0), 0.45), c.light);
    return {
      lift,
      colour: c.faded(c.tint),
      width: 0.9,
      curtain: { colour: mix(facade, mix(facade, window, glow), c.fade) },
    };
  },
};
