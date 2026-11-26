import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { GUIDES } from '../src/ui/intro.js';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Modules find their elements by id, so two elements sharing one would cross their wires.
test('every id in the page is used once', () => {
  const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  expect(ids.length).toBeGreaterThan(20);
  expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
});

// Both ways of sharing hand the page a picture it has no use for, and each says so.
test('every way of sharing says the picture is unused and nothing leaves the computer', () => {
  expect(Object.keys(GUIDES)).toEqual(['tab', 'screen']);
  for (const [route, guide] of Object.entries(GUIDES)) {
    expect(guide.private, route).toMatch(/picture is never used, and nothing you share leaves your computer$/);
    for (const key of ['play', 'other', 'lead', 'row', 'audio']) expect(guide[key], `${route} ${key}`).toEqual(expect.any(String));
    expect(guide.steps.length, route).toBe(3);
  }
  expect(GUIDES.screen.play).toMatch(/any app or player/);
  // The last step, where the share is made, has the place the words go.
  const last = page.slice(page.indexOf('id="step3"'));
  expect(last).toMatch(/id="sharenow"[^]*id="private"/);
});
