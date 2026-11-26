import { expect, test } from 'vitest';
import { arrange, picked, playable, title } from '../src/audio/files.js';

const file = (name, type = '', webkitRelativePath = '') => ({ name, type, webkitRelativePath, size: 1 });

test('a sound file is told by its type or, without one, by its ending', () => {
  expect(playable(file('a.bin', 'audio/mpeg'))).toBe(true);
  expect(playable(file('a.FLAC'))).toBe(true);
  expect(playable(file('a.m4a', 'audio/x-m4a'))).toBe(true);
  expect(playable(file('cover.jpg', 'image/jpeg'))).toBe(false);
  expect(playable(file('notes.txt'))).toBe(false);
  expect(playable(file('mp3'))).toBe(false);
});

test('files play in the order of a listing, numbers by value, folder by folder', () => {
  const found = [
    { file: file('10 last.mp3'), path: '/album/10 last.mp3' },
    { file: file('2 second.mp3'), path: '/album/2 second.mp3' },
    { file: file('cover.jpg', 'image/jpeg'), path: '/album/cover.jpg' },
    { file: file('1 first.mp3'), path: '/album/1 first.mp3' },
    { file: file('1 other.mp3'), path: '/b side/1 other.mp3' },
  ];
  expect(arrange(found).map((one) => one.name)).toEqual(['1 first.mp3', '2 second.mp3', '10 last.mp3', '1 other.mp3']);
});

test('picked files are arranged by their path where a folder gave them one', () => {
  const list = [file('b.ogg', 'audio/ogg', 'set/2/b.ogg'), file('a.ogg', 'audio/ogg', 'set/10/a.ogg'), file('c.wav', 'audio/wav')];
  expect(picked(list).map((one) => one.name)).toEqual(['c.wav', 'b.ogg', 'a.ogg']);
  expect(picked([file('readme.md')])).toEqual([]);
});

test('a title is the name without its ending', () => {
  expect(title(file('03 - Song.Name.flac'))).toBe('03 - Song.Name');
  expect(title(file('untitled'))).toBe('untitled');
});
