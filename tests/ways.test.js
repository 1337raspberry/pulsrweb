import { expect, test } from 'vitest';
import { WAYS, detect, named, offerFor } from '../src/ways.js';

const UA = {
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:161.0) Gecko/20100101 Firefox/161.0',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:161.0) Gecko/20100101 Firefox/161.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15',
  safariPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1',
  chromePhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/158.0.0.0 Mobile/15E148 Safari/604.1',
  chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) pulsr/0.1.0 Chrome/158.0.0.0 Electron/45.5.0 Safari/537.36',
};
const chromium = (brand, platform, mobile = false) => ({
  brands: [{ brand: 'Not)A;Brand', version: '8' }, { brand: 'Chromium', version: '158' }, ...(brand ? [{ brand, version: '158' }] : [])],
  platform,
  mobile,
});

test('the browser and system are told from what the browser says of itself', () => {
  expect(detect({ userAgent: UA.firefoxLinux })).toEqual({ browser: 'firefox', system: 'linux', chromium: false, mobile: false, desktop: false });
  expect(detect({ userAgent: UA.firefoxMac })).toMatchObject({ browser: 'firefox', system: 'macos' });
  expect(detect({ userAgent: UA.safariMac })).toEqual({ browser: 'safari', system: 'macos', chromium: false, mobile: false, desktop: false });
  expect(detect({ userAgent: UA.safariMac, maxTouchPoints: 5 })).toMatchObject({ browser: 'safari', system: 'ipados', mobile: true });
  expect(detect({ userAgent: UA.safariPhone })).toEqual({ browser: 'safari', system: 'ios', chromium: false, mobile: true, desktop: false });
  // Chrome on an iPhone is Safari underneath.
  expect(detect({ userAgent: UA.chromePhone })).toEqual({ browser: 'chrome', system: 'ios', chromium: false, mobile: true, desktop: false });
  expect(detect({ userAgent: UA.chrome, userAgentData: chromium('Google Chrome', 'macOS') })).toEqual({
    browser: 'chrome', system: 'macos', chromium: true, mobile: false, desktop: false,
  });
  expect(detect({ userAgent: UA.chrome, userAgentData: chromium('Microsoft Edge', 'Windows') })).toMatchObject({ browser: 'edge', system: 'windows' });
  expect(detect({ userAgent: UA.chrome, userAgentData: chromium('Brave', 'Linux') })).toMatchObject({ browser: 'brave', system: 'linux' });
  expect(detect({ userAgent: UA.chrome, userAgentData: chromium('', 'Chrome OS') })).toMatchObject({ browser: 'chromium', system: 'chromeos' });
  expect(detect({ userAgent: UA.chrome, userAgentData: chromium('Google Chrome', 'Android', true) })).toMatchObject({ system: 'android', mobile: true });
  expect(detect()).toEqual({ browser: '', system: '', chromium: false, mobile: false, desktop: false });
});

test('the desktop app is told from a browser, and has no browser to name', () => {
  expect(detect({ userAgent: UA.desktop, userAgentData: chromium('', 'macOS') })).toEqual({
    browser: '', system: 'macos', chromium: true, mobile: false, desktop: true,
  });
  expect(named('desktop-linux')).toEqual({ browser: '', system: 'linux', chromium: true, mobile: false, desktop: true });
});

test('a setup can be named', () => {
  expect(named('firefox-linux')).toEqual({ browser: 'firefox', system: 'linux', chromium: false, mobile: false, desktop: false });
  expect(named('Edge-Windows')).toEqual({ browser: 'edge', system: 'windows', chromium: true, mobile: false, desktop: false });
  expect(named('chrome-ios')).toEqual({ browser: 'chrome', system: 'ios', chromium: false, mobile: true, desktop: false });
  expect(named('chrome-android')).toMatchObject({ chromium: true, mobile: true });
  for (const text of ['', null, 'other', 'firefox']) expect(named(text), String(text)).toBe(null);
});

test('each setup is offered only what works there, and files everywhere', () => {
  const offer = (text, options) => offerFor(named(text), options);
  expect(offer('chrome-macos')).toEqual({ ways: ['tab', 'screen', 'files'], elsewhere: null });
  expect(offer('edge-windows').ways).toEqual(['tab', 'screen', 'files']);
  expect(offer('chrome-linux')).toEqual({ ways: ['tab', 'files'], elsewhere: null });
  expect(offer('firefox-linux')).toEqual({ ways: ['monitor', 'files'], elsewhere: 'browser' });
  expect(offer('firefox-windows')).toEqual({ ways: ['files', 'mic'], elsewhere: 'browser' });
  expect(offer('safari-macos')).toEqual({ ways: ['files', 'mic'], elsewhere: 'browser' });
  expect(offer('safari-ios')).toEqual({ ways: ['files', 'mic'], elsewhere: 'computer' });
  expect(offer('chrome-android')).toEqual({ ways: ['files', 'mic'], elsewhere: 'computer' });
  expect(offer('firefox-android')).toEqual({ ways: ['files', 'mic'], elsewhere: 'computer' });
  // A Chromium browser without the sharing call is offered what any browser is.
  expect(offer('chrome-macos', { displayMedia: false })).toEqual({ ways: ['files', 'mic'], elsewhere: 'browser' });
  expect(offerFor(detect())).toEqual({ ways: ['files', 'mic'], elsewhere: 'browser' });
  // The desktop app hears the computer on every system, with nothing to share.
  for (const system of ['macos', 'windows', 'linux']) {
    expect(offer(`desktop-${system}`), system).toEqual({ ways: ['system', 'files', 'mic'], elsewhere: null });
  }
  for (const text of ['chrome-macos', 'chrome-linux', 'firefox-linux', 'safari-ios', 'chrome-android', 'desktop-macos']) {
    const { ways } = offer(text);
    expect(ways, text).toContain('files');
    for (const way of ways) expect(WAYS[way], way).toBeDefined();
  }
});

test('every way has a label and a short word on what it does', () => {
  for (const [name, way] of Object.entries(WAYS)) {
    expect(['system', 'tab', 'screen', 'files', 'mic'], name).toContain(way.route);
    expect(way.label.length, name).toBeLessThanOrEqual(40);
    expect(way.blurb.length, name).toBeLessThanOrEqual(120);
  }
});
