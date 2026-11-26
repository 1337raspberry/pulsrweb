// The two lines of large type around the ridge on the cover, set like a record sleeve: a
// title spread across the top and a line of the same width underneath, which is a button.

import { posterWidth } from '../scene/view-math.js';

const $ = (id) => document.getElementById(id);

export function createPoster({ onPrompt }) {
  const title = $('title');
  const prompt = $('prompt');

  // One span per letter, so the title can be spread to the poster's width.
  const text = title.textContent.trim();
  title.setAttribute('aria-label', text);
  title.replaceChildren(
    ...[...text].map((letter) => {
      const span = document.createElement('span');
      span.textContent = letter;
      span.setAttribute('aria-hidden', 'true');
      return span;
    }),
  );

  // Sizes the poster for the window, then the prompt's type so its text spans the poster.
  function fit() {
    const width = posterWidth(window.innerWidth, window.innerHeight);
    document.documentElement.style.setProperty('--poster', `${width}px`);
    prompt.style.fontSize = '100px';
    const natural = prompt.getBoundingClientRect().width;
    if (natural > 0) prompt.style.fontSize = `${(100 * width) / natural}px`;
  }

  prompt.addEventListener('click', () => onPrompt());
  window.addEventListener('resize', fit);
  fit();

  return { fit };
}
