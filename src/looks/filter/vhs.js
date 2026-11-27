// A home video playing back on an old recorder: soft colour bleeding sideways past sharper
// brightness, washed colours over lifted blacks, faint scanlines and the head-switching
// flicker along the bottom, under the recorder's own lettering (PLAY, the tape counter, the
// tape speed) and the camcorder's date stamp. A drop winds the tape on or back for a moment,
// bars of noise streaking through the picture; a beat knocks the tracking.
import { abs, clamp, cos, float, floor, fract, mat3, max, mix, mx_noise_float, rand, smoothstep, step, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { createCorners } from '../lib/filter-osd.js';
import { groundOf, handOn } from '../lib/filter-ground.js';
import { onsetOf, toDisplay, toLinear } from '../lib/filter-kit.js';

// Colour to the brightness and two colour-difference signals of analogue video, and back.
// Given plain numbers, `mat3` reads them a row at a time, as matrices are written.
const TO_YIQ = mat3(0.299, 0.587, 0.114, 0.596, -0.274, -0.322, 0.211, -0.523, 0.312);
const TO_RGB = mat3(1, 0.956, 0.621, 1, -0.272, -0.647, 1, -1.106, 1.703);

// One tape line every LINE CSS pixels. Colour is carried at a fraction of the brightness's
// sharpness: it is averaged over CHROMA_TAPS taps spread across CHROMA_SPAN CSS pixels, and
// arrives CHROMA_LAG pixels late, so it trails to the right of what it colours.
const LINE = 2;
const CHROMA_TAPS = 8;
const CHROMA_SPAN = 16;
const CHROMA_LAG = 3;
// How much colour survives the tape, and how far blacks are lifted (display values).
const CHROMA_GAIN = 1.7;
const LIFT = 0.055;
// The share of the screen's height at the bottom where the heads switch.
const HEAD = 0.02;
// A seek: how long it lasts, in seconds, and how many bars of noise run through the picture.
const SEEK_SECONDS = 1.15;
const BARS = 3;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const two = (n) => String(n).padStart(2, '0');
// The tape counter, as hours, minutes and seconds: `0:12:34`.
const counterOf = (seconds) => {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
};
// The camcorder's stamp: `2:05 PM` over `NOV.27 2026`.
const clockOf = (d) => `${d.getHours() % 12 || 12}:${two(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
const dateOf = (d) => `${MONTHS[d.getMonth()]}.${two(d.getDate())} ${d.getFullYear()}`;
const ease = (from, to, x) => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

export default {
  name: 'vhs',
  build: (context) => {
    const { colour, uv, resolution, pixelRatio, time } = context;
    const osd = createCorners(context, { columns: 12, rows: 2 });
    // A knock to the tracking (1 just after a beat), and the height of the tape it tears.
    const nudge = uniform(0);
    const bandAt = uniform(0.6);
    // A seek: how strong (0 none, 1 in full), which way (1 on, -1 back), and how far into it.
    const seek = uniform(0);
    const way = uniform(1);
    const seekClock = uniform(0);

    const css = pixelRatio.div(resolution.x);
    // The noise and the tape's faults change once a video frame, 30 times a second.
    const frameNo = floor(time.mul(30));

    // The camcorder wrote its stamp into the picture, so it plays back from the tape too.
    const stampInk = vec3(1, 0.74, 0.3);
    const recorded = (read) => (p) => {
      const stamp = osd.at(p);
      const lettered = step(0.5, p.y).mul(stamp.a);
      return mix(toDisplay(read(p)), mix(vec3(0.02), stampInk, stamp.r), lettered);
    };

    // The tape playing a picture read by `read(point)` (display values), at screen point
    // `at`; with `lettering`, the recorder's own lettering on top.
    const play = (read, at, lettering) => {
      const lineH = pixelRatio.mul(LINE);
      const line = floor(at.y.mul(resolution.y).div(lineH));
      // The time base wanders a little, line to line.
      const wobble = mx_noise_float(vec2(line.mul(0.045), time.mul(1.3))).mul(0.45);
      // A beat tears a few lines around the band sideways for a moment.
      const band = float(1).sub(smoothstep(0.004, 0.025, abs(at.y.sub(bandAt)))).mul(nudge);
      const tear = band.mul(rand(vec2(line, frameNo)).sub(0.3)).mul(14);
      // Where the heads switch, the bottom few lines are bent sideways, and the point
      // where they start jitters from frame to frame.
      const headTop = float(1 - HEAD).sub(rand(vec2(frameNo, 3.7)).mul(0.005));
      const foot = step(headTop, at.y);
      const bend = foot.mul(clamp(at.y.sub(headTop).div(HEAD), 0, 1).mul(16).add(6).add(rand(vec2(line, frameNo.add(11))).mul(5)));
      // Seeking, bars of noise travel through the picture, slanted a little, their edges
      // ragged; the lines in them are torn far sideways.
      const travel = seekClock.mul(way).mul(1.6);
      const phase = fract(at.y.mul(BARS).add(at.x.sub(0.5).mul(0.12)).sub(travel));
      const ragged = rand(vec2(line, frameNo.add(5))).mul(0.05);
      const bar = float(1).sub(smoothstep(0.05, 0.1, abs(phase.sub(0.5)).add(ragged))).mul(seek);
      const rip = bar.mul(rand(vec2(line, frameNo.add(17))).sub(0.5)).mul(70).add(seek.mul(mx_noise_float(vec2(line.mul(0.02), seekClock.mul(9))).mul(5)));
      const s = vec2(at.x.add(wobble.add(tear).sub(bend).add(rip).mul(css)), at.y);

      // Brightness: softened a little, then sharpened round its edges as a recorder's
      // picture control does, which leaves a faint ring beside every line.
      const lumaAt = (dx) => TO_YIQ.mul(read(s.add(vec2(css.mul(dx), 0)))).x;
      const soft = lumaAt(0).mul(0.5).add(lumaAt(-1).add(lumaAt(1)).mul(0.25));
      const wide = lumaAt(-3).add(lumaAt(3)).mul(0.5);
      let y = soft.add(soft.sub(wide).mul(0.35));
      // Colour: averaged wide and late.
      let iq = vec2(0);
      for (let k = 0; k < CHROMA_TAPS; k++) {
        const dx = -CHROMA_LAG + ((k + 0.5) / CHROMA_TAPS - 0.5) * CHROMA_SPAN;
        iq = iq.add(TO_YIQ.mul(read(s.add(vec2(css.mul(dx), 0)))).yz);
      }
      iq = iq.mul(CHROMA_GAIN / CHROMA_TAPS);

      // Tape noise: a fine grain in the brightness and slow blotches of colour along the
      // lines, both most visible in the dark.
      const grain = rand(vec2(floor(at.x.mul(resolution.x).div(pixelRatio.mul(1.5))), line.add(frameNo.mul(613)))).sub(0.5).mul(0.035);
      const blotch = vec2(mx_noise_float(vec3(at.x.mul(resolution.x).div(pixelRatio.mul(22)), line.mul(0.35), frameNo.mul(0.71))), mx_noise_float(vec3(at.x.mul(resolution.x).div(pixelRatio.mul(22)), line.mul(0.35), frameNo.mul(0.71).add(40)))).mul(0.03);
      y = y.add(grain);
      iq = iq.add(blotch);

      // The head-switching lines and the seek's bars are snow: streaks of white along each
      // line, with no colour left in them.
      const streak = rand(vec2(floor(at.x.mul(resolution.x).div(pixelRatio.mul(4))), line.add(frameNo.mul(97))));
      const snow = step(0.55, streak).mul(0.75).add(streak.mul(0.2));
      const noisy = max(bar.mul(0.8), foot.mul(0.16)).add(band.mul(0.18));
      y = mix(y, snow, noisy);
      iq = iq.mul(float(1).sub(max(bar, foot.mul(0.6))));

      // Washed out, with the blacks lifted, as a tape plays back.
      y = y.mul(1 - LIFT).add(LIFT);
      let c = clamp(TO_RGB.mul(vec3(y, iq)), 0, 1);
      if (lettering) {
        const ink = osd.at(at);
        c = mix(c, ink.rgb, ink.a.mul(step(at.y, 0.5)));
      }
      // Faint scanlines: each tape line darkest at its edges.
      const across = fract(at.y.mul(resolution.y).div(lineH));
      c = c.mul(float(0.955).add(cos(across.mul(Math.PI * 2)).mul(0.045)));
      return toLinear(c);
    };

    const ground = groundOf(context);
    const output = handOn(vec4(play(recorded((p) => colour.sample(p).rgb), uv, true), 1), (at) => play(recorded(ground), at, false));

    // The counter starts at the page's own time, then runs with the tape.
    let tape = null;
    let seekFor = -1;
    let forward = false;
    let shown = '';
    const beaten = onsetOf('beat');
    const dropped = onsetOf('drop');

    function frame({ seconds, dt, shared }) {
      const signals = shared.signals;
      const still = (shared.still?.value ?? 0) > 0.5;
      if (tape === null) tape = seconds;
      if (beaten(signals) && !still) {
        nudge.value = 1;
        bandAt.value = 0.12 + Math.random() * 0.72;
      }
      nudge.value *= Math.exp(-dt / 0.2);

      // Each drop winds the other way from the last.
      if (dropped(signals) && seekFor < 0) {
        seekFor = 0;
        forward = !forward;
        way.value = forward ? 1 : -1;
      }
      let speed = 1;
      if (seekFor >= 0) {
        seekFor += dt;
        seekClock.value = seekFor;
        // The bars flash through the picture, so with less motion asked for the tape
        // winds with only its lettering to show it.
        seek.value = still ? 0 : ease(0, 0.08, seekFor) * (1 - ease(SEEK_SECONDS - 0.3, SEEK_SECONDS, seekFor));
        speed = forward ? 30 : -30;
        if (seekFor >= SEEK_SECONDS) {
          seekFor = -1;
          seek.value = 0;
        }
      }
      tape = Math.max(0, tape + dt * speed);

      const now = new Date();
      const mode = seekFor < 0 ? 'PLAY ▶' : forward ? 'FF ▶▶' : 'REW ◀◀';
      const lines = [mode, counterOf(tape), clockOf(now), dateOf(now)];
      const key = lines.join('|');
      if (key === shown) return;
      shown = key;
      osd.clear();
      osd.write('tl', 0, lines[0]);
      osd.write('tr', 0, lines[1]);
      osd.write('tr', 1, 'SP');
      osd.write('br', 0, lines[2]);
      osd.write('br', 1, lines[3]);
      osd.update();
    }

    return { output, frame, dispose: osd.dispose };
  },
};
