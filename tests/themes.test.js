import { expect, test } from 'vitest';
import { THEMES, findGradient, findTheme } from '../src/themes.js';

test('the table is pulsr’s', () => {
  expect(THEMES.length).toBe(24);
  expect(new Set(THEMES.map((t) => t.name)).size).toBe(24);
  expect(THEMES[0].name).toBe('greyscale');
  expect(findTheme('nord').gradients[0]).toEqual({ name: 'frost', stops: ['#5e81ac', '#81a1c1', '#88c0d0'] });
  for (const t of THEMES) {
    expect(t.gradients.at(-1).name).toBe('text');
    expect(t.gradients.at(-1).stops).toEqual([t.text, t.text, t.text]);
  }
});

test('lookups fall back', () => {
  expect(findTheme('nope').name).toBe('tokyo-night');
  const t = findTheme('nord');
  expect(findGradient(t, 'nope')).toBe(t.gradients[0]);
  expect(findGradient(t, 'text').name).toBe('text');
});
