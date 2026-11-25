const $ = (id) => document.getElementById(id);

// What the browser's picker shows for each way of sharing, and what to do in it.
const GUIDES = {
  tab: {
    panes: ['Chrome tab', 'Window'],
    chosen: 0,
    row: 'The tab your music is in',
    audio: 'Share with tab audio',
    steps: ['Pick the tab your music is in.', 'Leave “Share with tab audio” on.', 'Press “Share with audio”.'],
    note: '',
    lede: 'Your music as a ridge of lines. Play something in another tab, then share that tab here.',
    action: 'Share a tab',
    other: 'share everything this computer plays',
  },
  screen: {
    panes: ['Chrome tab', 'Window', 'Entire screen'],
    chosen: 2,
    row: 'Your screen',
    audio: 'Share with system audio',
    steps: ['Pick “Entire screen”, then your screen.', 'Switch on the audio along the bottom. It starts off.', 'Press “Share with audio”.'],
    note: 'A Mac asks once for permission in System Settings, and Chrome may need a restart afterwards.',
    lede: 'Your music as a ridge of lines. Play something on this computer, then share its sound here.',
    action: 'Share this computer’s sound',
    other: 'share one tab',
  },
};

// The opening text: what pulsr is, a picture of the browser's picker, and the buttons
// that start a share. `onStart(route)` gets 'tab', 'screen' or 'mic'.
export function createIntro({ canShare, onStart }) {
  // The way of sharing the text describes and its main button starts.
  let chosen = 'tab';

  function showGuide(route) {
    const guide = GUIDES[route];
    chosen = route;
    $('lede').textContent = guide.lede;
    $('start').textContent = guide.action;
    $('everything').textContent = guide.other;
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

  function setBusy(busy) {
    for (const id of ['start', 'everything', 'usemic', 'micfirst']) $(id).disabled = busy;
  }

  function show(notice = '') {
    $('intro').hidden = false;
    $('notice').textContent = notice;
    $('notice').hidden = !notice;
    setBusy(false);
  }

  // Shows only the lede and `notice`, with no way to start: for when nothing can be drawn.
  function fail(notice) {
    show(notice);
    for (const id of ['start', 'guide', 'others', 'fallback']) $(id).closest('p, div').hidden = true;
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

  $('start').addEventListener('click', () => onStart(chosen));
  $('everything').addEventListener('click', () => onStart(chosen === 'tab' ? 'screen' : 'tab'));
  $('usemic').addEventListener('click', () => onStart('mic'));
  $('micfirst').addEventListener('click', () => onStart('mic'));

  $('m-site').textContent = location.host;
  showGuide('tab');
  if (!canShare) {
    // Without tab sharing, the microphone is the one way in.
    for (const id of ['start', 'guide', 'others']) $(id).closest('p, div').hidden = true;
    $('fallback').hidden = false;
    $('lede').textContent = 'Your music as a ridge of lines.';
  }

  return { show, hide, fail, setBusy, showGuide, explain };
}
