import { expect, test } from 'vitest';
import { PALETTES, findGradient, findPalette } from '../src/palettes.js';

const HEX = /^#[0-9a-f]{6}$/;

test('the table is the page’s palette, then one palette per family of pulsr’s themes', () => {
  expect(PALETTES.map((p) => p.name)).toEqual([
    'greyscale', 'catppuccin', 'dracula', 'nord', 'gruvbox', 'solarized', 'tokyo-night', 'gotham', 'rose-pine',
    'everforest', 'kanagawa', 'one-dark', 'ayu',
  ]);
  expect(PALETTES[0].gradients[0]).toEqual({
    name: 'white', background: '#000000', text: '#bbbbbb', stops: ['#ffffff', '#ffffff', '#ffffff'],
  });
  expect(findPalette('nord').gradients[0]).toMatchObject({ name: 'frost', background: '#2e3440', stops: ['#5e81ac', '#81a1c1', '#88c0d0'] });
});

test('every entry is a whole colour scheme with a name of its own', () => {
  for (const p of PALETTES) {
    expect(new Set(p.gradients.map((g) => g.name)).size, p.name).toBe(p.gradients.length);
    for (const g of p.gradients) {
      expect(g.background, g.name).toMatch(HEX);
      expect(g.text, g.name).toMatch(HEX);
      expect(g.stops.length, g.name).toBe(3);
      for (const stop of g.stops) expect(stop, g.name).toMatch(HEX);
    }
  }
});

test('variants keep their own backgrounds within a family', () => {
  const catppuccin = findPalette('catppuccin');
  expect(catppuccin.gradients.length).toBe(10);
  expect(catppuccin.gradients[0].name).toBe('mocha blue-pink');
  expect(findGradient(catppuccin, 'mocha blue-pink').background).toBe('#1e1e2e');
  expect(findGradient(catppuccin, 'latte blue-pink').background).toBe('#eff1f5');
  const solarized = findPalette('solarized');
  expect(findGradient(solarized, 'dark cyan-yellow').stops).toEqual(findGradient(solarized, 'light cyan-yellow').stops);
  expect(findGradient(solarized, 'light cyan-yellow').background).toBe('#fdf6e3');
});

test('no palette offers the same lines twice on backgrounds of one kind', () => {
  const light = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.5;
  };
  for (const p of PALETTES) {
    const seen = new Set(p.gradients.map((g) => `${g.stops.join()} ${light(g.background)}`));
    expect(seen.size, p.name).toBe(p.gradients.length);
  }
});

test('each scheme has a plain entry, white on a dark background and black on a light one', () => {
  const all = PALETTES.flatMap((p) => p.gradients);
  const plain = all.filter((g) => /(^| )(white|black)$/.test(g.name));
  expect(plain.length).toBe(16);
  for (const g of plain) {
    const dark = parseInt(g.background.slice(1, 3), 16) < 128;
    expect(g.name.split(' ').pop(), `${g.name} on ${g.background}`).toBe(dark ? 'white' : 'black');
    expect(g.stops, g.name).toEqual(Array(3).fill(dark ? '#ffffff' : '#000000'));
  }
  expect(all.filter((g) => /(^| )text$/.test(g.name))).toEqual([]);
  expect(findGradient(findPalette('catppuccin'), 'latte black').background).toBe('#eff1f5');
  expect(findGradient(findPalette('catppuccin'), 'mocha white').background).toBe('#1e1e2e');
  expect(findGradient(findPalette('solarized'), 'light black').stops[0]).toBe('#000000');
});

test('lookups fall back', () => {
  expect(findPalette('nope').name).toBe('tokyo-night');
  const p = findPalette('nord');
  expect(findGradient(p, 'nope')).toBe(p.gradients[0]);
  expect(findGradient(p, 'white').name).toBe('white');
});
