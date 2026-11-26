// What the looks hear: numbers worked out from the sound's band levels each frame, for
// every part of a look to follow the music by. Plain arithmetic, so it can be tested
// without a renderer.
//
// The levels arrive as the analyser maps them (public/audio/level-mapper.js): for each
// band, ((dB - floor) / 55) ^ 0.6 against a running peak that keeps the loudest band near
// the top. Each frame they are turned back into decibels under that peak, then followed
// with time constants in seconds, so the signals move the same at any frame rate.
//
// Every signal is a number from 0 to 1 unless its comment says otherwise:
//   level, bass, mid, treble  loudness now, of everything and of the three ranges, each
//                             against its own recent loudest (1 there, 0 at 18 dB under)
//   beat       jumps to 0.6..1 on a low-end onset (a kick) and halves in about 0.1 s
//   hit        the same for an onset anywhere in the spectrum, halving in about 70 ms
//   beats      how many beats so far (a count)
//   sinceBeat  seconds since the last beat (up to 99)
//   pings      seconds since each of the last four beats, newest first (four numbers)
//   centroid   brightness: where the sound's weight sits, 0 all bass to 1 all treble
//   flux       how much is changing, absolute: calm music sits low, busy drums high
//   energy     slow, over seconds: how much is going on (changes, beats, level) against
//              the most there has been lately; low in a breakdown, rising through a build-up
//   drop       1 when the bass comes back after a lull, fading over about a second
//   silence    1 once nothing has been heard for a moment, 0 as soon as anything is
//   width      stereo spread: 0 for mono, towards 1 the more the bands are panned apart
//   clock      seconds that run faster when the music is fuller and stop in silence,
//              with a nudge on each beat (wraps at an hour)
//   hot        the height (as the ridge's levels, 0 to about 1.4) above which the
//              loudest 5% of the live row's points stand
//   peakAt     where along the row (0 to 1) the dominant peak above the bass stands
//   peakLevel  how strongly that peak stands out

// The analyser's mapping, undone: the decibels its levels span and the power it raises
// them by. Kept in step with public/audio/level-mapper.js and filter-bank.js.
const RANGE_DB = 55;
const EXPAND = 1 / 0.6;
const FREQ_LOW_HZ = 50;
const FREQ_HIGH_HZ = 16000;
// Where the bass ends and the treble begins, and the range the peak follower listens in.
const BASS_TOP_HZ = 205;
const TREBLE_FROM_HZ = 2050;
const PEAK_LOW_HZ = 200;
const PEAK_HIGH_HZ = 6000;

// A band with no level reads this far under the peak.
const FLOOR_DB = -RANGE_DB;
const FLOOR_POWER = 10 ** (FLOOR_DB / 10);
// Loudness reads 1 at a range's recent loudest and 0 WINDOW_DB under it. The recent
// loudest forgets FORGET_DB a second and never sits under REF_FLOOR_DB, so silence reads 0;
// a range's own never sits more than RANGE_SLACK_DB under the whole sound's, so a range
// that is missing stays low instead of being turned up to fill the window.
const WINDOW_DB = 18;
const FORGET_DB = 3;
const REF_FLOOR_DB = FLOOR_DB + WINDOW_DB;
const RANGE_SLACK_DB = 12;
// Fast loudness rises in 10 ms and falls in 120 ms.
const RISE = 0.01;
const FALL = 0.12;
// Onsets: how far each band has risen over the last ONSET_LAG seconds, from
// ONSET_FLOOR_DB up, kept for HISTORY frames so the lag is the same at any frame rate.
const ONSET_FLOOR_DB = -50;
const ONSET_LAG = 0.025;
const HISTORY = 16;
// A beat needs this share of the low bands each to have risen LIFT_DB over the lag.
const LIFT_DB = 3;
const LIFTED_SHARE = 0.3;
// A rise through the threshold may fire for this long after, once its gate opens.
const ARMED = 0.05;
// A frame this long is a stall, not music: nothing fires on it.
const MAX_ONSET_DT = 0.1;
// Brightness weighs each band by how far it stands above this many dB under the peak.
const CENTROID_FLOOR_DB = -40;
const FLUX_DB = 2;
// Energy: the busiest lately is forgotten this much a second and never counts as less
// than BUSIEST_FLOOR, so calm music stays calm; under CALM counts as a lull.
const BUSIEST_FORGET = 0.01;
const BUSIEST_FLOOR = 0.35;
const CALM = 0.7;
// A drop: a beat with the bass this far above its own slow mean, at most every DROP_GAP s.
const DROP_DB = 9;
const DROP_GAP = 8;
// Every level under this is digital silence.
const QUIET_LEVEL = 0.02;
const HOT_BINS = 64;
const HOT_TOP = 1.4;
const HOT_SHARE = 0.05;
const HOT_FLOOR = 0.12;
const CLOCK_WRAP = 3600;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (from, to, x) => {
  const t = clamp01((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};
// Share of the way an exponential follower with time constant `tau` moves in `dt` seconds.
const share = (dt, tau) => 1 - Math.exp(-dt / tau);
// A band's power under the analyser's peak, from its mapped level.
const powerOf = (level) => (level > 0 ? 10 ** ((RANGE_DB / 10) * (level ** EXPAND - 1)) : FLOOR_POWER);

// An onset detector. It fires when its onset function rises through a threshold that
// follows the music's own recent onsets (their mean plus `margin` times their spread),
// once per crossing, at most once per `refractory` seconds, and only while its gate is
// open (a crossing waits up to ARMED seconds for it). While more than `cap` onsets a
// second have fired over the last few seconds it grows stricter, raising its threshold
// and lengthening its refractory time with it, so dense music fires on its accents
// rather than on every frame.
function createDetector({ floor, margin, refractory, cap, decay }) {
  return {
    floor, margin, refractory, cap, decay,
    mean: 0, spread: 0, strictness: 1, rate: 0, last: 0, lastThreshold: Infinity, armed: 0, since: 99, pulse: 0,
  };
}

// Moves detector `d` on by `dt` seconds with onset function value `value`; `open` says
// whether its gate is open this frame. Returns the firing's strength, 0.6 to 1, or 0.
function detect(d, value, dt, open) {
  const threshold = d.mean + d.margin * d.strictness * d.spread + d.floor;
  d.armed = value > threshold && d.last <= d.lastThreshold ? ARMED : Math.max(d.armed - dt, 0);
  const fires = d.armed > 0 && open && dt > 0 && dt <= MAX_ONSET_DT && d.since >= d.refractory * d.strictness;
  d.pulse *= Math.exp(-dt / d.decay);
  d.since = Math.min(d.since + dt, 99);
  let strength = 0;
  if (fires) {
    strength = 0.6 + 0.4 * clamp01((value - threshold) / (threshold - d.mean + 0.1));
    d.pulse = Math.max(d.pulse, strength);
    d.since = 0;
    d.armed = 0;
  }
  const a = share(dt, 1.5);
  d.mean += a * (value - d.mean);
  d.spread += a * (Math.abs(value - d.mean) - d.spread);
  if (dt > 0) d.rate += share(dt, 2) * ((fires ? 1 / dt : 0) - d.rate);
  d.strictness = Math.min(Math.max(d.strictness * Math.exp(1.5 * dt * (d.rate / d.cap - 1)), 1), 3);
  d.last = value;
  d.lastThreshold = threshold;
  return strength;
}

// `bands` is the number of frequency bands per channel.
export function createSignals(bands) {
  // Every signal by name: a number, or a list of four numbers.
  const values = {
    level: 0, bass: 0, mid: 0, treble: 0,
    beat: 0, hit: 0, beats: 0, sinceBeat: 99, pings: [99, 99, 99, 99],
    centroid: 0.5, flux: 0, energy: 0, drop: 0, silence: 1, width: 0, clock: 0,
    hot: HOT_FLOOR, peakAt: 0.5, peakLevel: 0,
  };

  // Which range each band is in (0 bass, 1 mid, 2 treble), how many bands each range has,
  // and the bands the peak follower listens to.
  const range = new Uint8Array(bands);
  const sizes = [0, 0, 0];
  let peakFrom = 0;
  let peakTo = bands - 1;
  for (let k = 0; k < bands; k++) {
    const hz = FREQ_LOW_HZ * (FREQ_HIGH_HZ / FREQ_LOW_HZ) ** (k / (bands - 1));
    range[k] = hz < BASS_TOP_HZ ? 0 : hz < TREBLE_FROM_HZ ? 1 : 2;
    sizes[range[k]] += 1;
    if (hz < PEAK_LOW_HZ) peakFrom = k + 1;
    if (hz <= PEAK_HIGH_HZ) peakTo = k;
  }
  const counts = [bands, ...sizes];

  // Per band: decibels this frame, the level the onset function compares and what it was
  // ONSET_LAG ago, and the peak follower's slow mean and scores.
  const db = new Float64Array(bands);
  const floored = new Float64Array(bands);
  const before = new Float64Array(bands);
  // The last HISTORY frames of floored levels, a ring, and when each was seen.
  const past = new Float64Array(HISTORY * bands).fill(ONSET_FLOOR_DB);
  const pastAt = new Float64Array(HISTORY).fill(-Infinity);
  let head = 0;
  let now = 0;
  const usual = new Float64Array(bands).fill(FLOOR_DB);
  const score = new Float64Array(bands);
  // Per range (the whole sound, bass, mid, treble): power summed this frame, fast
  // loudness in dB, and the recent loudest.
  const sums = new Float64Array(4);
  const loud = new Float64Array(4).fill(FLOOR_DB);
  const loudest = new Float64Array(4).fill(REF_FLOOR_DB);
  const beat = createDetector({ floor: 3, margin: 2, refractory: 0.15, cap: 3, decay: 0.15 });
  const hit = createDetector({ floor: 0.5, margin: 1.6, refractory: 0.08, cap: 8, decay: 0.1 });
  const bins = new Float64Array(HOT_BINS);
  let activity = 0;
  let busiest = BUSIEST_FLOOR;
  let lull = 1;
  let bassUsual = FLOOR_DB;
  let sinceDrop = DROP_GAP;
  let quietFor = 0;
  let change = 0;
  // The band the peak follower holds, and a band that has been beating it.
  let held = -1;
  let challenger = -1;
  let challengedFor = 0;

  // `ridge` is the Ridge: `ridge.raw` holds the latest frame of levels, 0 to 1, the left
  // channel's bands then the right's; `ridge.grained` and `ridge.axis` the live row's
  // heights and where the spectrum falls on it; `ridge.p` its settings. `dt` is the time
  // since the last call, in seconds, and `heard` whether any sound is arriving.
  function update(ridge, dt, heard = true) {
    const raw = ridge.raw;
    let top = 0;
    for (let i = 0; i < 2 * bands; i++) if (raw[i] > top) top = raw[i];
    // Nothing heard reads as silence, whatever is left in the levels.
    const quiet = !heard || top < QUIET_LEVEL;

    // Decibels under the analyser's peak, per band, from the two channels' power.
    sums.fill(0);
    let apart = 0;
    let together = 0;
    for (let k = 0; k < bands; k++) {
      const left = quiet ? FLOOR_POWER : powerOf(raw[k]);
      const right = quiet ? FLOOR_POWER : powerOf(raw[bands + k]);
      const power = (left + right) / 2;
      db[k] = 10 * Math.log10(power);
      sums[0] += power;
      sums[1 + range[k]] += power;
      apart += Math.abs(left - right);
      together += left + right;
    }

    // Loudness, each range against its own recent loudest.
    const forget = FORGET_DB * dt;
    for (let g = 0; g < 4; g++) {
      const x = 10 * Math.log10(sums[g] / counts[g]);
      loud[g] += share(dt, x > loud[g] ? RISE : FALL) * (x - loud[g]);
      const floor = g === 0 ? REF_FLOOR_DB : Math.max(REF_FLOOR_DB, loudest[0] - RANGE_SLACK_DB);
      loudest[g] = Math.max(loud[g], loudest[g] - forget, floor);
    }
    values.level = clamp01(1 + (loud[0] - loudest[0]) / WINDOW_DB);
    values.bass = clamp01(1 + (loud[1] - loudest[1]) / WINDOW_DB);
    values.mid = clamp01(1 + (loud[2] - loudest[2]) / WINDOW_DB);
    values.treble = clamp01(1 + (loud[3] - loudest[3]) / WINDOW_DB);

    // The onset function: how far each band has risen over the last ONSET_LAG seconds,
    // counting a rise only past its neighbours' levels too, so energy sliding between
    // neighbouring bands (vibrato, a bend) is not an onset.
    now += dt;
    for (let k = 0; k < bands; k++) floored[k] = Math.max(db[k], ONSET_FLOOR_DB);
    levelsAgo(now - ONSET_LAG);
    let riseAll = 0;
    let lowNow = 0;
    let lowThen = 0;
    let lifted = 0;
    for (let k = 0; k < bands; k++) {
      const then = Math.max(before[k], before[Math.max(k - 1, 0)], before[Math.min(k + 1, bands - 1)]);
      riseAll += Math.max(0, floored[k] - then);
      if (range[k] === 0) {
        lowNow += 10 ** (floored[k] / 10);
        lowThen += 10 ** (before[k] / 10);
        if (floored[k] - before[k] >= LIFT_DB) lifted += 1;
      }
    }
    // The low end's onset function is the rise of its total power. A kick lifts most of
    // the low bands at once; noise lifts a few at a time, and a new bass note one or two,
    // so a beat also needs LIFTED_SHARE of the low bands to have risen together.
    const riseLow = Math.max(0, 10 * Math.log10(lowNow / lowThen));
    const coherent = lifted >= LIFTED_SHARE * counts[1];
    if (dt > 0) {
      past.set(floored, head * bands);
      pastAt[head] = now;
      head = (head + 1) % HISTORY;
    }
    riseAll /= bands;

    const struck = detect(beat, riseLow, dt, coherent && values.bass >= 0.4);
    const pings = values.pings;
    for (let i = 0; i < 4; i++) pings[i] = Math.min(pings[i] + dt, 99);
    if (struck > 0) {
      values.beats += 1;
      pings.copyWithin(1, 0, 3);
      pings[0] = 0;
    }
    values.beat = beat.pulse;
    values.sinceBeat = beat.since;
    detect(hit, riseAll, dt, values.level >= 0.3);
    values.hit = hit.pulse;

    // Brightness: the mean band number, each band weighed by how far it stands above a floor.
    let weight = 0;
    let moment = 0;
    for (let k = 0; k < bands; k++) {
      const w = db[k] - CENTROID_FLOOR_DB;
      if (w > 0) {
        weight += w;
        moment += k * w;
      }
    }
    if (weight > 0) values.centroid += share(dt, 0.3) * (moment / (weight * (bands - 1)) - values.centroid);

    change += share(dt, 0.25) * (riseAll - change);
    values.flux = 1 - Math.exp(-change / FLUX_DB);

    quietFor = quiet ? quietFor + dt : 0;
    values.silence = smoothstep(0.3, 1, quietFor);

    // Energy: how much is going on, over the last few seconds, against the most there has
    // been lately. The analyser keeps the loudest band near the top whatever the volume, so
    // this counts activity rather than loudness: changes, low-end beats and level. A long
    // silence starts the count afresh; it never reads a calm song as busier than it is.
    const busy = 0.5 * values.flux + 0.3 * Math.min(beat.rate / 2, 1) + 0.2 * values.level;
    activity += share(dt, busy > activity ? 2 : 3) * (busy - activity);
    busiest = quietFor >= 2 ? BUSIEST_FLOOR : Math.max(activity, busiest - BUSIEST_FORGET * dt, BUSIEST_FLOOR);
    values.energy = clamp01(activity / busiest) * (1 - values.silence);
    // A lull is a calm stretch that lasts: it builds over a second or two under CALM.
    lull += share(dt, values.energy < CALM ? 1.5 : 3) * ((values.energy < CALM ? 1 : 0) - lull);

    // A drop: a beat at the end of a lull that finds the bass loud and well above where it
    // has been for the last few seconds, at most once every DROP_GAP seconds.
    sinceDrop = Math.min(sinceDrop + dt, 99);
    values.drop *= Math.exp(-dt / 1.2);
    if (struck > 0 && lull >= 0.5 && values.bass >= 0.8 && loud[1] - bassUsual > DROP_DB && sinceDrop >= DROP_GAP) {
      values.drop = 1;
      sinceDrop = 0;
    }
    bassUsual += share(dt, 4) * (loud[1] - bassUsual);

    if (together > 0) values.width += share(dt, 0.5) * (apart / together - values.width);

    values.clock = (values.clock + dt * (0.2 + 0.8 * values.energy) * (1 - values.silence) + 0.1 * struck) % CLOCK_WRAP;

    followHot(ridge, dt);
    followPeak(ridge, dt, quiet);
    return values;
  }

  // Fills `before` with the floored levels as they were at time `at`, between the two
  // kept frames either side of it (the newer of them may be this frame's).
  function levelsAgo(at) {
    let newer = -1;
    for (let i = 1; i <= HISTORY; i++) {
      const j = (head - i + HISTORY) % HISTORY;
      if (pastAt[j] === -Infinity) break;
      if (pastAt[j] <= at) {
        const later = newer < 0 ? now : pastAt[newer];
        const w = later > pastAt[j] ? Math.min(Math.max((at - pastAt[j]) / (later - pastAt[j]), 0), 1) : 0;
        for (let k = 0; k < bands; k++) {
          const a = past[j * bands + k];
          const b = newer < 0 ? floored[k] : past[newer * bands + k];
          before[k] = a + (b - a) * w;
        }
        return;
      }
      newer = j;
    }
    // Not that long kept yet: the oldest frame there is, or this one at the very start.
    for (let k = 0; k < bands; k++) before[k] = newer < 0 ? floored[k] : past[newer * bands + k];
  }

  // The height above which the loudest share of the live row's points stand, from a
  // histogram of the row's heights over the last few seconds.
  function followHot(ridge, dt) {
    const heights = ridge.grained;
    const axis = ridge.axis;
    if (!heights || !axis || dt <= 0) return;
    const keep = Math.exp(-dt / 3);
    for (let b = 0; b < HOT_BINS; b++) bins[b] *= keep;
    for (let j = 0; j < heights.length; j++) {
      if (axis[j] < 0) continue;
      bins[Math.min(HOT_BINS - 1, Math.max(0, Math.floor((heights[j] / HOT_TOP) * HOT_BINS)))] += dt;
    }
    let total = 0;
    for (let b = 0; b < HOT_BINS; b++) total += bins[b];
    let hot = HOT_FLOOR;
    let above = 0;
    for (let b = HOT_BINS - 1; b >= 0 && total > 0; b--) {
      if (above + bins[b] >= HOT_SHARE * total) {
        const within = (HOT_SHARE * total - above) / bins[b];
        hot = ((b + 1 - within) / HOT_BINS) * HOT_TOP;
        break;
      }
      above += bins[b];
    }
    values.hot = Math.max(hot, HOT_FLOOR);
  }

  // The dominant peak above the bass: the loudest band between PEAK_LOW_HZ and
  // PEAK_HIGH_HZ, with a bonus for standing above its own last two seconds. The follower
  // holds a band until another beats it by 3 dB for 30 ms, so it does not flicker between
  // two that are nearly level, and glides to where the new one stands on the row.
  function followPeak(ridge, dt, quiet) {
    const slow = share(dt, 2);
    let best = -1;
    for (let k = peakFrom; k <= peakTo; k++) {
      score[k] = db[k] + 0.5 * (db[k] - usual[k]);
      if (db[k] > ONSET_FLOOR_DB && (best < 0 || score[k] > score[best])) best = k;
    }
    for (let k = 0; k < bands; k++) usual[k] += slow * (db[k] - usual[k]);
    if (quiet || best < 0) {
      held = -1;
      challenger = -1;
      values.peakLevel += share(dt, 0.2) * (0 - values.peakLevel);
      return;
    }
    if (held < 0) {
      held = best;
    } else if (best !== held && score[best] > score[held] + 3) {
      challengedFor = best === challenger ? challengedFor + dt : dt;
      challenger = best;
      if (challengedFor >= 0.03) {
        held = best;
        challenger = -1;
      }
    } else {
      challenger = -1;
    }
    // A parabola through the held band and its neighbours places the peak between bands.
    let offset = 0;
    if (held > peakFrom && held < peakTo) {
      const a = score[held - 1];
      const b = score[held];
      const c = score[held + 1];
      const bend = a - 2 * b + c;
      if (bend < 0) offset = Math.min(Math.max((0.5 * (a - c)) / bend, -0.5), 0.5);
    }
    const p = ridge.p ?? {};
    const span = Math.min(Math.max(p.span ?? 1, 0.05), 1);
    const along = (1 - span) / 2 + span * ((held + offset) / (bands - 1)) ** (p.axisCurve ?? 1);
    values.peakAt += share(dt, 0.06) * (along - values.peakAt);
    const strength = clamp01((db[held] + 30) / 30);
    values.peakLevel += share(dt, strength > values.peakLevel ? 0.02 : 0.2) * (strength - values.peakLevel);
  }

  return { values, update, bands };
}
