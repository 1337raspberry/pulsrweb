// The status line along the bottom while listening: what is playing, an optional hint,
// and the key buttons. It fades once the pointer has rested this long, in ms.
const REST_AFTER_MS = 2500;

const $ = (id) => document.getElementById(id);

export function createStatus({ onStop }) {
  let restTimer = null;

  // Brings the status line back, and lets it fade once the pointer rests.
  function stir() {
    document.body.classList.remove('resting');
    clearTimeout(restTimer);
    restTimer = setTimeout(() => document.body.classList.add('resting'), REST_AFTER_MS);
  }

  function hint(text) {
    $('hint').textContent = text;
    $('hint').hidden = !text;
    $('status').classList.toggle('hold', !!text);
  }

  function show(text, stopLabel) {
    $('what').textContent = text;
    $('end').lastChild.textContent = stopLabel;
    $('status').hidden = false;
    hint('');
    stir();
  }

  function hide() {
    $('status').hidden = true;
    hint('');
  }

  // Wires the key button marked `letter`, adding it to the line if it is not there yet.
  function addKey(letter, label, onPress) {
    const existing = [...$('status').querySelectorAll('button.key')].find((button) => button.firstChild.textContent === letter);
    const button = existing || document.createElement('button');
    if (!existing) {
      button.className = 'key';
      const mark = document.createElement('b');
      mark.textContent = letter;
      button.append(mark, label);
      $('status').append(button);
    }
    button.addEventListener('click', onPress);
    return button;
  }

  $('end').addEventListener('click', () => onStop());

  return { show, hide, hint, stir, addKey };
}
