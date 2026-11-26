// Music files from the visitor's own computer: which of what was picked or dropped can be
// played, and in what order. The files are read where they are; nothing is uploaded.

// Sound files by their ending, for the systems that give a file no type.
const ENDINGS = /\.(mp3|m4a|m4b|aac|flac|ogg|oga|opus|wav|weba)$/i;
// A dropped folder is searched no further than this many files.
const MOST = 2000;

export const playable = (file) => /^audio\//.test(file.type) || ENDINGS.test(file.name);

// A file's name without its ending, for showing while it plays.
export const title = (file) => file.name.replace(/\.[^.]+$/, '');

const byPath = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// The playable ones of `found` ({ file, path } each) in the order of a file listing:
// folder by folder, numbers by their value, so track 2 comes before track 10.
export function arrange(found) {
  return found
    .filter(({ file }) => playable(file))
    .sort((a, b) => byPath.compare(a.path, b.path))
    .map(({ file }) => file);
}

// What a file input holds, arranged. A file picked through a folder carries its path.
export const picked = (files) => arrange([...files].map((file) => ({ file, path: file.webkitRelativePath || file.name })));

const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject));
const batchOf = (reader) => new Promise((resolve, reject) => reader.readEntries(resolve, reject));

async function walk(entry, found) {
  if (found.length >= MOST) return;
  if (entry.isFile) {
    // Only sound files are opened; a type-less one is told by its ending.
    if (ENDINGS.test(entry.name)) found.push({ file: await fileOf(entry), path: entry.fullPath });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = entry.createReader();
  // A folder is read a batch at a time until a batch comes back empty.
  for (let batch = await batchOf(reader); batch.length > 0; batch = await batchOf(reader)) {
    for (const inner of batch) await walk(inner, found);
  }
}

// Everything playable in a drop, looking inside dropped folders. The drop's entries are
// taken before the first wait, because the browser empties the drop once its event is over.
export async function dropped(dataTransfer) {
  const items = [...(dataTransfer.items || [])].filter((item) => item.kind === 'file');
  const entries = items.map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null));
  const loose = [...dataTransfer.files];
  if (entries.length === 0 || entries.some((entry) => !entry)) return picked(loose);
  const found = [];
  for (const entry of entries) {
    try {
      await walk(entry, found);
    } catch {
      // A folder that cannot be read is passed over; the rest of the drop still plays.
    }
  }
  // An entry's file can be type-less where the plain file was not, so the plain files count too.
  for (const file of loose) {
    if (playable(file) && !found.some((one) => one.file.name === file.name && one.file.size === file.size)) {
      found.push({ file, path: `/${file.name}` });
    }
  }
  return arrange(found);
}
