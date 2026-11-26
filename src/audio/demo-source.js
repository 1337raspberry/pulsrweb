// A silent stand-in for music: levels made from the clock alone, so the ridge has
// something to draw before anything is shared. It is a handful of narrow peaks gathered
// around the middle of the row, each flickering on its own, which stacks into rows that
// look like successive pulses. Read the same way as the frame ring.

// Taller peaks that roam the middle, beside the settings' count of narrow ones.
const LEADS = 2;

const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// Smooth noise in 0…1 along `x`; each `seed` is a separate track.
function noise(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const k = f * f * (3 - 2 * f);
  const at = (n) => hash(n + seed * 57.31);
  return at(i) * (1 - k) + at(i + 1) * k;
}

// `params` holds the ridge's level curve and axis, and the signal's own tuning (the
// `demo…` settings), all read on every call: the levels are written so that they come out
// of the level curve as the shape meant, at the place on the axis meant.
export function createDemo(params, bands = 64) {
  const shape = new Float32Array(bands);
  const tuned = (name, fallback) => (Number.isFinite(params[name]) ? params[name] : fallback);

  // Fills `out` (left bands, then right) with the levels for time `t` in seconds.
  function read(t, out) {
    shape.fill(0);
    // How far either side of the middle the peaks stand, how many there are, and their
    // height, width, flicker rate and how seldom each one is up.
    const reach = tuned('demoSpread', 0.27);
    const voices = Math.round(tuned('demoPeaks', 7));
    const tall = tuned('demoHeight', 1);
    const wide = tuned('demoWidth', 1);
    const rate = tuned('demoRate', 13);
    const sparse = tuned('demoSparse', 3);
    const add = (centre, width, height) => {
      for (let k = 0; k < bands; k++) {
        // Where band `k` falls across the span once the axis is bent.
        const along = (k / (bands - 1)) ** params.axisCurve;
        const d = (along - centre) / width;
        if (d > -4 && d < 4) shape[k] += height * Math.exp(-0.5 * d * d);
      }
    };
    for (let v = 0; v < voices; v++) {
      // Voices nearer the middle stand taller. Each wanders slowly and flickers quickly,
      // about as fast as rows are cut, so neighbouring rows differ; the high power keeps
      // most of them down at any one moment.
      const home = 0.5 + ((v + 0.5) / voices - 0.5) * 2 * reach;
      const centre = home + (noise(t * 0.13, v) - 0.5) * 0.1;
      const width = (0.009 + 0.012 * noise(t * 0.4, v + 20)) * wide;
      const weight = 1 - 0.8 * (Math.abs(home - 0.5) / reach) ** 1.3;
      const flicker = noise(t * rate, v + 40) ** sparse * (0.3 + 0.7 * noise(t * 0.6, v + 60));
      add(centre, width, weight * flicker * 2.2 * tall);
    }
    for (let v = 0; v < LEADS; v++) {
      const centre = 0.5 + (noise(t * 0.09, v + 80) - 0.5) * 1.2 * reach;
      const width = (0.012 + 0.012 * noise(t * 0.5, v + 85)) * wide;
      add(centre, width, (0.25 + 1.1 * noise(t * rate * 0.85, v + 90) ** 2) * tall);
    }
    for (let k = 0; k < bands; k++) {
      const level = Math.min(shape[k], 1);
      // The level curve run backwards: a gain, a power, a floor cut.
      const raw = level < 0.002 ? 0 : params.floorCut + (1 - params.floorCut) * (level / params.gain) ** (1 / params.gamma);
      out[k] = raw;
      out[bands + k] = raw;
    }
    return true;
  }

  return { read };
}
