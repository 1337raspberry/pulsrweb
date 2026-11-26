// The list of sound inputs above the status line: one button each, the one in use
// marked, and those that carry the computer's own sound said to. `onPick(input)` gets
// the input chosen.
const $ = (id) => document.getElementById(id);

export function createInputs({ onPick }) {
  const list = $('inputs');

  function close() {
    list.hidden = true;
    list.replaceChildren();
  }

  // Shows `inputs` ({ id, label, loopback } each) with the one whose id is `current` marked.
  function open(inputs, current) {
    list.replaceChildren(
      ...inputs.map((input) => {
        const button = document.createElement('button');
        button.textContent = input.label;
        if (input.loopback) {
          const note = document.createElement('small');
          note.textContent = 'this computer’s sound';
          button.append(note);
        }
        if (input.id === current) button.setAttribute('aria-current', 'true');
        button.addEventListener('click', () => {
          close();
          onPick(input);
        });
        const item = document.createElement('li');
        item.append(button);
        return item;
      }),
    );
    list.hidden = false;
    (list.querySelector('[aria-current]') || list.querySelector('button'))?.focus({ preventScroll: true });
  }

  // A click anywhere else, or Escape, puts the list away.
  window.addEventListener('pointerdown', (event) => {
    if (!list.hidden && !list.contains(event.target)) close();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  return {
    open,
    close,
    get isOpen() {
      return !list.hidden;
    },
  };
}
