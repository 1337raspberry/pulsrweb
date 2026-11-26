import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Modules find their elements by id, so two elements sharing one would cross their wires.
test('every id in the page is used once', () => {
  const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  expect(ids.length).toBeGreaterThan(20);
  expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
});
