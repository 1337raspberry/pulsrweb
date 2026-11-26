// The status line along the bottom while listening: what is playing, an optional hint,
// and the key buttons. It shows with the options, or on its own while it has a hint, and
// fades once the pointer has rested this long, in ms.
const REST_AFTER_MS = 2500;

const $ = (id) => document.getElementById(id);

export function createStatus({ onStop }) {
  let restTimer = null;
  let listening = false;
  let open = false;

  function sync() {
    $('status').hidden = !(listening && (open || !$('hint').hidden));
  }

  // Brings the page's fading parts back, and lets them fade once the pointer rests.
  function stir() {
    document.body.classList.remove('resting');
    clearTimeout(restTimer);
    restTimer = setTimeout(() => document.body.classList.add('resting'), REST_AFTER_MS);
  }

  function hint(text) {
    $('hint').textContent = text;
    $('hint').hidden = !text;
    $('status').classList.toggle('hold', !!text);
    sync();
  }

  function show(text, stopLabel) {
    $('what').textContent = text;
    $('end').lastChild.textContent = stopLabel;
    listening = true;
    hint('');
    stir();
  }

  function hide() {
    listening = false;
    hint('');
  }

  // Whether the options are open, which the line shows alongside.
  function setOpen(on) {
    open = on;
    sync();
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

  return { show, hide, hint, stir, setOpen, addKey };
}
