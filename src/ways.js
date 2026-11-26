// Which browser and system the page is on, and which ways of getting music in are known to
// work there. The introduction offers only those.

// The ways in. `route` is what starting one asks the capture for.
export const WAYS = {
  tab: {
    route: 'tab',
    label: 'share a tab + its audio',
    blurb: 'play music in another tab and pulsr listens in',
  },
  screen: {
    route: 'screen',
    label: 'share your screen + its audio',
    blurb: 'hears everything this computer plays, so spotify or any other app works',
  },
  files: {
    route: 'files',
    label: 'use your own files',
    blurb: 'pick music files or drop them on this page. they never leave your computer',
    // On a phone or tablet there is nothing to drop.
    blurbMobile: 'pick music files from this device. they never leave it',
  },
  monitor: {
    route: 'mic',
    label: 'allow the “Monitor of …” microphone',
    blurb: 'when firefox asks which microphone, pick “Monitor of <your output device>”, it mirrors everything your computer plays',
  },
  mic: {
    route: 'mic',
    label: 'listen through a microphone',
    blurb: 'pulsr hears the room, or any other sound input you pick',
  },
};

// Browsers built on Chromium, by the names they are shown under.
const CHROMIUM = ['chrome', 'edge', 'brave', 'opera', 'vivaldi', 'arc', 'chromium'];
const MOBILE = ['android', 'ios', 'ipados'];

const BRANDS = { 'Google Chrome': 'chrome', 'Microsoft Edge': 'edge', 'Chromium': 'chromium' };
const PLATFORMS = { 'macOS': 'macos', 'Windows': 'windows', 'Linux': 'linux', 'Chrome OS': 'chromeos', 'Chromium OS': 'chromeos', 'Android': 'android' };
// The made-up brand Chromium lists beside the real ones ("Not A;Brand" and the like).
const FILLER = /^not[^a-z]*a[^a-z]*brand$/i;

function browserOf(userAgent, brands) {
  if (brands.some((entry) => entry.brand === 'Chromium')) {
    const named = brands.find((entry) => entry.brand !== 'Chromium' && !FILLER.test(entry.brand));
    return named ? (BRANDS[named.brand] ?? named.brand.toLowerCase()) : 'chromium';
  }
  if (/Firefox\/|FxiOS\//.test(userAgent)) return 'firefox';
  if (/EdgiOS\//.test(userAgent)) return 'edge';
  if (/CriOS\//.test(userAgent)) return 'chrome';
  if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return 'safari';
  return '';
}

function systemOf(userAgent, platform, maxTouchPoints) {
  if (PLATFORMS[platform]) return PLATFORMS[platform];
  if (/Android/.test(userAgent)) return 'android';
  if (/iPhone|iPod/.test(userAgent)) return 'ios';
  // An iPad says it is a Mac, and is told from one by its touch screen.
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ipados';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'macos';
  if (/Windows/.test(userAgent)) return 'windows';
  if (/CrOS/.test(userAgent)) return 'chromeos';
  if (/Linux|X11/.test(userAgent)) return 'linux';
  return '';
}

// Where the page is, from what the browser says of itself: { browser, system, chromium,
// mobile }, the names lower-case and empty where they cannot be told. `chromium` is about
// the engine, so Chrome on an iPhone, which is Safari underneath, is not.
export function detect({ userAgent = '', userAgentData = null, maxTouchPoints = 0 } = {}) {
  const brands = userAgentData?.brands ?? [];
  const system = systemOf(userAgent, userAgentData?.platform ?? '', maxTouchPoints);
  return {
    browser: browserOf(userAgent, brands),
    system,
    chromium: brands.some((entry) => entry.brand === 'Chromium'),
    mobile: userAgentData?.mobile ?? MOBILE.includes(system),
  };
}

// A browser and system by name, as in "firefox-linux", for seeing the page as another
// setup does. Null for anything else.
export function named(text) {
  const [browser, system] = (text || '').toLowerCase().split('-');
  if (!browser || !system) return null;
  const mobile = MOBILE.includes(system);
  return { browser, system, chromium: CHROMIUM.includes(browser) && system !== 'ios' && system !== 'ipados', mobile };
}

// What to offer at `where`: `ways` in order, the first the one to lead with, and
// `elsewhere`, which says where a tab could be shared when it cannot be here ('browser'
// for another browser on this computer, 'computer' from a phone or tablet).
// `displayMedia` says the browser has the sharing call at all.
export function offerFor(where, { displayMedia = true } = {}) {
  if (where.chromium && !where.mobile && displayMedia) {
    // The whole computer's sound comes with a shared screen on every system but Linux,
    // where the browser passes on a tab's sound only.
    return { ways: where.system === 'linux' ? ['tab', 'files'] : ['tab', 'screen', 'files'], elsewhere: null };
  }
  const elsewhere = where.mobile ? 'computer' : 'browser';
  // Firefox on Linux lists the monitor of each sound output among its microphones.
  if (where.browser === 'firefox' && where.system === 'linux') return { ways: ['monitor', 'files'], elsewhere };
  return { ways: ['files', 'mic'], elsewhere };
}
