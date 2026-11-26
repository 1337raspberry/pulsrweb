const $ = (id) => document.getElementById(id);

// What the browser's picker shows for each way of sharing, and what to do in it.
const GUIDES = {
  tab: {
    panes: ['Chrome tab', 'Window'],
    chosen: 0,
    row: 'The tab your music is in',
    audio: 'Share with tab audio',
    lead: 'when you’re ready, click share, then pick the tab your music is in and click “Share with audio”',
    steps: ['pick the tab your music is in', 'leave “Share with tab audio” on', 'click “Share with audio”'],
    note: '',
  },
  screen: {
    panes: ['Chrome tab', 'Window', 'Entire screen'],
    chosen: 2,
    row: 'Your screen',
    audio: 'Share with system audio',
    lead: 'when you’re ready, click share, then pick your whole screen, switch its audio on and click “Share with audio”',
    steps: ['pick “Entire screen”, then your screen', 'switch on the audio along the bottom; it starts off', 'click “Share with audio”'],
    note: 'A Mac asks once for permission in System Settings, and Chrome may need a restart afterwards.',
  },
};

// The introduction: three steps, one on screen at a time. The first says what pulsr is
// and its button leads to "go and play something", "ready" leads to a picture of the
// browser's picker, and "share" opens the real one. The later steps show only their own
// words. `onStart(route)` gets 'tab', 'screen' or 'mic'; `onClose()` is called when the
// visitor backs out.
export function createIntro({ canShare, onStart, onClose }) {
  // The way of sharing the picture describes and the share button starts.
  let chosen = 'tab';
  let step = 1;

  function showGuide(route) {
    const guide = GUIDES[route];
    chosen = route;
    $('lead').textContent = guide.lead;
    // The mock of the picker: its panes, the row to pick and the audio switch.
    $('m-panes').replaceChildren(
      ...guide.panes.map((name, i) => {
        const pane = document.createElement('span');
        pane.textContent = name;
        if (i === guide.chosen) pane.className = 'on';
        return pane;
      }),
    );
    $('m-row').textContent = guide.row;
    $('m-audio').textContent = guide.audio;
    $('steps').replaceChildren(
      ...guide.steps.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }),
    );
    $('note').textContent = guide.note;
    $('note').hidden = !guide.note;
  }

  function setStep(n) {
    step = n;
    for (const i of [1, 2, 3]) $(`step${i}`).hidden = !canShare || i !== n;
    for (const id of ['about', 'terminal']) $(id).hidden = canShare && n !== 1;
    const button = $(`step${n}`).querySelector('button');
    if (canShare && !$('intro').hidden) button.focus({ preventScroll: true });
  }

  function setBusy(busy) {
    for (const id of ['start', 'ready', 'sharenow', 'usemic']) $(id).disabled = busy;
  }

  // Opens at `at`, or where it was left. `notice` is a line about what just went wrong.
  function open({ notice = '', at = step } = {}) {
    $('intro').hidden = false;
    $('notice').textContent = notice;
    $('notice').hidden = !notice;
    setBusy(false);
    setStep(at);
  }

  // Shows only the opening words and `notice`, with no way to start: for when nothing can be drawn.
  function fail(notice) {
    open({ notice });
    for (const id of ['step1', 'step2', 'step3', 'fallback', 'terminal']) $(id).hidden = true;
    $('about').hidden = false;
  }

  function hide() {
    $('intro').hidden = true;
    setBusy(false);
  }

  // Says what went wrong with a share and what to do about it.
  function explain(route, result) {
    if (result.why === 'cancelled') return 'Nothing was shared.';
    if (result.why === 'blocked') {
      return (
        'macOS blocked the share. Allow Chrome under System Settings, Privacy & Security, ' +
        'Screen & System Audio Recording, then restart Chrome.'
      );
    }
    if (result.why === 'noaudio') {
      if (route === 'mic') return 'The microphone gave no sound.';
      if (route === 'tab' && result.surface !== 'browser') {
        return 'A window was shared, and a window comes without sound here. Pick from the “Chrome tab” list instead.';
      }
      if (route === 'tab') {
        return 'That tab came through without sound: “Share with tab audio” was off. It is the switch along the bottom of Chrome’s box.';
      }
      return 'That came through without sound: the audio switch along the bottom of Chrome’s box starts off.';
    }
    return result.error ? `That did not work: ${result.error.message}` : 'That did not work.';
  }

  $('start').addEventListener('click', () => {
    showGuide('tab');
    setStep(2);
  });
  $('ready').addEventListener('click', () => setStep(3));
  $('sharenow').addEventListener('click', () => onStart(chosen));
  $('usemic').addEventListener('click', () => onStart('mic'));
  $('back').addEventListener('click', () => onClose());

  $('m-site').textContent = location.host;
  showGuide('tab');
  // Without tab sharing, the microphone is the one way in.
  $('fallback').hidden = canShare;
  setStep(1);

  return { open, hide, fail, setBusy, showGuide, explain };
}
