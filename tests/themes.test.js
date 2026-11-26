import { expect, test } from 'vitest';
import { THEMES, findGradient, findTheme } from '../src/themes.js';

test('the table is the opening theme, then pulsr’s', () => {
  expect(THEMES.length).toBe(25);
  expect(new Set(THEMES.map((t) => t.name)).size).toBe(25);
  expect(THEMES[0].name).toBe('division');
  expect(THEMES[0].gradients[0]).toEqual({ name: 'white', stops: ['#ffffff', '#ffffff', '#ffffff'] });
  expect(THEMES[1].name).toBe('greyscale');
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
