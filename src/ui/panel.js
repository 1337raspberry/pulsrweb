// The control panel, top right: the basic settings and two buttons, with everything else
// folded away under `more`.
import { Pane } from 'tweakpane';
import { SETTINGS } from '../settings.js';

const FOLDERS = ['levels', 'motion', 'shape', 'depth', 'camera', 'cover'];
// How long the copy button shows what happened, in ms.
const COPIED_MS = 2000;
const GRADIENT = SETTINGS.find((s) => s.name === 'gradient');

export function createPanel({ values, onChange, onResetView, onCopyLink }) {
  const container = document.createElement('div');
  container.id = 'controls';
  document.body.append(container);
  const pane = new Pane({ container });
  // Tweakpane writes into this copy; changes reach the page only through onChange.
  const model = { ...values };
  // Set while the panel catches up with `values`, so that does not echo back.
  let refreshing = false;

  function bind(parent, s, index) {
    const params = { label: s.label, index };
    if (s.kind === 'number') Object.assign(params, { min: s.min, max: s.max, step: s.step });
    const choices = s.choices ?? s.choicesFor?.(model.theme);
    if (choices) params.options = choices.map((c) => ({ text: c, value: c }));
    return parent.addBinding(model, s.name, params).on('change', (event) => {
      if (!refreshing) onChange(s.name, event.value);
    });
  }

  const basics = SETTINGS.filter((s) => s.group === 'basic');
  const bindings = new Map(basics.map((s) => [s.name, bind(pane, s)]));
  let gradientTheme = model.theme;
  pane.addButton({ title: 'reset view' }).on('click', () => onResetView());
  // `onCopyLink` resolves to a few words on how it went, shown on the button for a moment.
  const copy = pane.addButton({ title: 'copy link' });
  let copied = null;
  copy.on('click', async () => {
    copy.title = (await onCopyLink()) || 'copy link';
    clearTimeout(copied);
    copied = setTimeout(() => { copy.title = 'copy link'; }, COPIED_MS);
  });

  const more = pane.addFolder({ title: 'more', expanded: false });
  for (const title of FOLDERS) {
    const folder = more.addFolder({ title, expanded: false });
    for (const s of SETTINGS.filter((x) => x.folder === title)) bind(folder, s);
  }

  // Shows `values` as they are now; the gradient list follows the theme.
  function refresh() {
    refreshing = true;
    try {
      Object.assign(model, values);
      if (model.theme !== gradientTheme) {
        pane.remove(bindings.get('gradient'));
        bindings.set('gradient', bind(pane, GRADIENT, basics.indexOf(GRADIENT)));
        gradientTheme = model.theme;
      }
      pane.refresh();
    } finally {
      refreshing = false;
    }
  }

  const show = () => { container.hidden = false; };
  const hide = () => { container.hidden = true; };
  const toggle = () => { container.hidden = !container.hidden; };

  hide();
  return { show, hide, toggle, refresh };
}
