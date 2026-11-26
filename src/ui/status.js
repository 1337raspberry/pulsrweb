// The status line along the bottom of the ridge: what is playing, an optional hint, the
// button that stops or starts the sound, and the key buttons. The page's fading parts,
// this line among them while sound plays, fade once the pointer has rested this long, in ms.
const REST_AFTER_MS = 2500;

const $ = (id) => document.getElementById(id);

// `onToggle()` is called by the button that stops or starts the sound.
export function createStatus({ onToggle }) {
  let restTimer = null;

  // Brings the page's fading parts back, and lets them fade once the pointer rests.
  function stir() {
    document.body.classList.remove('resting');
    clearTimeout(restTimer);
    restTimer = setTimeout(() => document.body.classList.add('resting'), REST_AFTER_MS);
  }

  function hint(text) {
    $('hint').textContent = text;
    $('hint').hidden = !text;
    // Held: a line with a hint does not fade with the pointer.
    $('status').classList.toggle('hold', !!text);
  }

  // `text` says what is going on and `label` what the stop or start button does next.
  function show(text, label) {
    $('what').textContent = text;
    $('end').lastChild.textContent = label;
    $('status').hidden = false;
    hint('');
    stir();
  }

  // Changes what the line says is going on, leaving the rest of it as it is.
  function say(text) {
    $('what').textContent = text;
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

  $('end').addEventListener('click', () => onToggle());

  return { show, say, hide, hint, stir, addKey };
}
