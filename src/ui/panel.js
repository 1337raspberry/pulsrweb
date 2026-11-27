// The control panel, top right: the basic settings and two buttons, with everything else
// folded away under `more`. One button copies the look as text, and a box under it holds
// that text, to copy out or to paste another look over.
import { Pane } from 'tweakpane';
import { SETTINGS } from '../settings.js';

const FOLDERS = ['music reactivity', 'motion', 'shape', 'depth', 'camera', 'cover'];
// How long the copy button shows what happened, in ms.
const COPIED_MS = 2000;
const COLOURS = SETTINGS.find((s) => s.name === 'colours');

export function createPanel({ values, onChange, onResetView, onCopyLook, onWild, lookText, onPasteLook }) {
  const container = document.createElement('div');
  container.id = 'controls';
  document.body.append(container);
  const pane = new Pane({ container });
  // Tweakpane writes into this copy; changes reach the page only through onChange.
  const model = { ...values };
  // Set while the panel catches up with `values`, so that does not echo back.
  let refreshing = false;

  // One bubble for the whole panel, shown beside the label the pointer is on.
  const bubble = document.createElement('div');
  bubble.id = 'help';
  bubble.setAttribute('role', 'tooltip');
  bubble.hidden = true;
  document.body.append(bubble);

  // Hovering the label of `row` says what its setting does; the label takes a help cursor.
  function explain(row, text) {
    const label = row.querySelector('.tp-lblv_l');
    if (!label) return;
    label.classList.add('explained');
    label.addEventListener('pointerenter', () => {
      const at = label.getBoundingClientRect();
      bubble.textContent = text;
      bubble.style.top = `${at.top + at.height / 2}px`;
      bubble.style.right = `${window.innerWidth - container.getBoundingClientRect().left + 8}px`;
      bubble.hidden = false;
    });
    label.addEventListener('pointerleave', () => { bubble.hidden = true; });
  }

  function bind(parent, s, index) {
    const params = { label: s.label, index };
    if (s.kind === 'number') Object.assign(params, { min: s.min, max: s.max, step: s.step });
    const choices = s.choices ?? s.choicesFor?.(model.palette);
    if (choices) params.options = choices.map((c) => ({ text: c, value: c }));
    const binding = parent.addBinding(model, s.name, params).on('change', (event) => {
      if (!refreshing) onChange(s.name, event.value);
    });
    explain(binding.element, s.help);
    return binding;
  }

  const basics = SETTINGS.filter((s) => s.group === 'basic');
  const bindings = new Map(basics.map((s) => [s.name, bind(pane, s)]));
  // What a look is put together from, one list per slot.
  const look = pane.addFolder({ title: 'look', expanded: true });
  for (const s of SETTINGS.filter((x) => x.group === 'look')) bind(look, s);
  // Not part of a look: how far the R key's roll of a random one goes.
  const rolling = { wild: false };
  const wilder = pane.addBinding(rolling, 'wild', { label: 'even more random' }).on('change', (event) => onWild(event.value));
  explain(wilder.element, 'R rolls every shape, depth and camera slider and moves the camera: all but music reactivity');
  // The palette the colours list was built for.
  let listed = model.palette;
  const reset = pane.addButton({ title: 'reset view' }).on('click', () => onResetView());
  reset.element.title = 'puts the camera back at the front view';
  // `onCopyLook` resolves to a few words on how it went, shown on the button for a moment.
  const copy = pane.addButton({ title: 'copy look' });
  copy.element.title = 'copies this look as text, to keep or to send to someone';
  let copied = null;
  copy.on('click', async () => {
    copy.title = (await onCopyLook()) || 'copy look';
    clearTimeout(copied);
    copied = setTimeout(() => { copy.title = 'copy look'; }, COPIED_MS);
  });
  // The look as text. Typing or pasting another over it and pressing enter puts that one on.
  const written = { look: '' };
  const box = pane.addBinding(written, 'look', { label: 'paste look' }).on('change', (event) => {
    if (!refreshing) onPasteLook(event.value);
  });
  explain(box.element, 'this look as text: copy it out, or paste another in and press enter');
  // The camera moves without the panel hearing of it, so the text is brought up to date as
  // the box is entered.
  box.element.addEventListener('focusin', () => showLook());
  function showLook() {
    if (written.look === lookText()) return;
    const was = refreshing;
    refreshing = true;
    written.look = lookText();
    box.refresh();
    refreshing = was;
  }

  const more = pane.addFolder({ title: 'more', expanded: false });
  for (const title of FOLDERS) {
    const folder = more.addFolder({ title, expanded: false });
    for (const s of SETTINGS.filter((x) => x.folder === title)) bind(folder, s);
  }

  // Shows `values` as they are now; the colours list follows the palette.
  function refresh() {
    refreshing = true;
    try {
      Object.assign(model, values);
      written.look = lookText();
      if (model.palette !== listed) {
        pane.remove(bindings.get('colours'));
        bindings.set('colours', bind(pane, COLOURS, basics.indexOf(COLOURS)));
        listed = model.palette;
      }
      pane.refresh();
    } finally {
      refreshing = false;
    }
  }

  const show = () => {
    container.hidden = false;
    showLook();
  };
  const hide = () => {
    container.hidden = true;
    bubble.hidden = true;
  };
  const toggle = () => {
    container.hidden = !container.hidden;
    showLook();
  };

  hide();
  return { show, hide, toggle, refresh };
}
