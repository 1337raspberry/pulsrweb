import { WAYS } from '../ways.js';

const $ = (id) => document.getElementById(id);

// What goes with a share besides its sound, for each way of sharing. The page asks for the
// picture only because the browser gives no sound without one; it is never read.
const PRIVATE = 'pulsr only listens: the picture is never used, and nothing you share leaves your computer';

// For each way of sharing: where the music plays, what the browser's picker shows and what
// to do in it, and the words that lead to the other way.
export const GUIDES = {
  tab: {
    play: 'go play some music in another tab, then come back and click ready',
    private: `chrome sends the tab’s picture along with its sound. ${PRIVATE}`,
    other: 'music in an app, not a tab? share your whole screen instead',
    panes: ['Chrome tab', 'Window'],
    chosen: 0,
    row: 'The tab your music is in',
    audio: 'Share with tab audio',
    lead: 'when you’re ready, click share, then pick the tab your music is in and click “Share with audio”',
    steps: ['pick the tab your music is in', 'leave “Share with tab audio” on', 'click “Share with audio”'],
    note: '',
  },
  screen: {
    play: 'go play some music in any app or player, then come back and click ready',
    private: `chrome sends your screen’s picture along with the computer’s sound. ${PRIVATE}`,
    other: 'music in a tab? share just that tab instead',
    panes: ['Chrome tab', 'Window', 'Entire screen'],
    chosen: 2,
    row: 'Your screen',
    audio: 'Share with system audio',
    lead: 'when you’re ready, click share, then pick your whole screen, switch its audio on and click “Share with audio”',
    steps: ['pick “Entire screen”, then your screen', 'switch on the audio along the bottom; it starts off', 'click “Share with audio”'],
    note: 'A Mac asks once for permission in System Settings, and Chrome may need a restart afterwards.',
  },
};

// Where a tab could be shared, said where it cannot be here.
const ELSEWHERE = {
  browser: 'or open this page in a chromium based browser (chrome, edge, brave…) if you have one, and share a tab’s audio there.',
  computer: 'on a computer, a chromium based browser (chrome, edge, brave…) can also listen to a tab or to everything it plays',
};

// The introduction: three steps, one on screen at a time. The first says what pulsr is,
// names the browser and system the page is on (`where`, from `detect`) and offers the ways
// of getting music in that work there (`offer`, from `offerFor`), each with a word on what
// it does. A tab or the screen leads to "go and play something", "ready" leads to a picture
// of the browser's picker, and "share" opens the real one; the later steps show only their
// own words. Files and inputs start at once. `onStart(route)` gets 'tab', 'screen', 'files'
// or 'mic'; `onClose()` is called when the visitor backs out.
export function createIntro({ where, offer, onStart, onClose }) {
  // The way of sharing the picture describes and the share button starts.
  let chosen = 'tab';
  let step = 1;

  function showGuide(route) {
    const guide = GUIDES[route];
    chosen = route;
    $('goplay').textContent = guide.play;
    $('private').textContent = guide.private;
    $('switch').textContent = guide.other;
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
    for (const i of [1, 2, 3]) $(`step${i}`).hidden = i !== n;
    for (const id of ['about', 'terminal']) $(id).hidden = n !== 1;
    if (!$('intro').hidden) $(`step${n}`).querySelector('button')?.focus({ preventScroll: true });
  }

  function setBusy(busy) {
    for (const button of $('card').querySelectorAll('button')) button.disabled = busy;
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
    for (const id of ['step1', 'step2', 'step3', 'terminal']) $(id).hidden = true;
    $('about').hidden = false;
  }

  function hide() {
    $('intro').hidden = true;
    setBusy(false);
  }

  // Says what went wrong with a share and what to do about it.
  function explain(route, result) {
    if (result.why === 'nofiles') return 'None of those were music files.';
    if (result.why === 'cancelled') return route === 'mic' ? 'No input was allowed.' : 'Nothing was shared.';
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

  // The line that names the setup, the names in bold.
  function greet() {
    const names = [where.browser, where.system].filter(Boolean);
    const line = $('you');
    line.replaceChildren();
    if (names.length > 0) {
      line.append('looks like you’re on ');
      names.forEach((name, i) => {
        if (i > 0) line.append(' on ');
        const strong = document.createElement('b');
        strong.textContent = name;
        line.append(strong);
      });
      line.append('. ');
    }
    line.append('to visualize your music you can:');
  }

  // One button for each way on offer: its name, and under it what it does.
  function listWays() {
    $('ways').replaceChildren(
      ...offer.ways.map((name, i) => {
        const way = WAYS[name];
        const button = document.createElement('button');
        button.className = i === 0 ? 'way main' : 'way';
        button.id = `way-${name}`;
        const label = document.createElement('b');
        label.textContent = way.label;
        const blurb = document.createElement('span');
        blurb.textContent = (where.mobile && way.blurbMobile) || way.blurb;
        button.append(label, blurb);
        button.addEventListener('click', () => {
          // Sharing is walked through first; files and inputs start at once.
          if (way.route === 'tab' || way.route === 'screen') {
            showGuide(way.route);
            setStep(2);
          } else {
            onStart(way.route);
          }
        });
        return button;
      }),
    );
  }

  // From the picture of one picker to the picture of the other.
  $('switch').addEventListener('click', () => showGuide(chosen === 'tab' ? 'screen' : 'tab'));
  $('ready').addEventListener('click', () => setStep(3));
  $('sharenow').addEventListener('click', () => onStart(chosen));
  $('alsomic').addEventListener('click', () => onStart('mic'));
  $('back').addEventListener('click', () => onClose());
  $('copylink').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $('copylink').textContent = 'copied, now paste it there';
    } catch {
      $('copylink').textContent = 'copy it from the address bar';
    }
  });

  $('m-site').textContent = location.host;
  showGuide('tab');
  greet();
  listWays();
  $('other').hidden = !offer.ways.includes('screen');
  $('elsewhere').hidden = !offer.elsewhere;
  $('elsewhere-text').textContent = ELSEWHERE[offer.elsewhere] ?? '';
  $('copylink').hidden = offer.elsewhere !== 'browser' || !navigator.clipboard;
  // An input is its own way in where the offer has one; elsewhere it is a line underneath.
  $('quiet').hidden = offer.ways.includes('mic') || offer.ways.includes('monitor');
  setStep(1);

  return { open, hide, fail, setBusy, showGuide, explain };
}
