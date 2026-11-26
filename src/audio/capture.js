import { listInputs } from './inputs.js';
import { startTestSignal } from './test-signal.js';

export const ms = (seconds) => (Number.isFinite(seconds) ? `${(seconds * 1000).toFixed(1)} ms` : 'unknown');
export const db = (peak) => (peak > 0 ? `${(20 * Math.log10(peak)).toFixed(1)} dBFS` : 'silent');
const sleep = (millis) => new Promise((resolve) => setTimeout(resolve, millis));

function describe(settings, keys) {
  return keys
    .filter((key) => settings[key] !== undefined)
    .map((key) => `${key}=${settings[key]}`)
    .join(' ');
}

// What each way of sharing asks the browser's picker for.
//   tab:    opens on the list of tabs, with screens left out and this page's own tab hidden
//   screen: opens on the screens, with the whole computer's sound on offer
function pickerOptions(route) {
  const audio = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    suppressLocalAudioPlayback: false,
  };
  if (route === 'tab') {
    return {
      video: { displaySurface: 'browser', frameRate: 1 },
      audio,
      monitorTypeSurfaces: 'exclude',
      selfBrowserSurface: 'exclude',
      systemAudio: 'exclude',
      windowAudio: 'exclude',
      surfaceSwitching: 'include',
    };
  }
  return {
    video: { displaySurface: 'monitor', frameRate: 1 },
    audio,
    monitorTypeSurfaces: 'include',
    systemAudio: 'include',
    windowAudio: 'system',
    surfaceSwitching: 'exclude',
  };
}

// What an input is asked for: the sound as it is, in stereo, with none of the clean-up a
// call wants, from `deviceId` or, without one, whichever input the browser offers.
const inputOptions = (deviceId) => ({
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 2,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  },
});

// How long a start that no click led to waits for the browser to let sound run, in ms.
const UNASKED_WAIT_MS = 250;

// Gets sound into the analyser worklet from a shared tab or screen, an input such as the
// microphone, the visitor's own files or the built-in test signal. `onFrames` gets each
// message the analyser posts. `onEnded(notice)` is called when the sound stops from
// outside the page, or when no file would play, with a line saying so. `onTrack` is told
// each file as it comes up: { name, index, count }.
export function createCapture({ onFrames, onEnded, onTrack = () => {}, log }) {
  let context = null;
  let analyser = null;
  let monitor = null;
  // The node feeding the analyser, the stream behind it (if any) and what it is.
  let input = null;
  let stream = null;
  let kind = 'none';
  let stopSignal = null;
  // The name of the input in use and its id, for telling it from the others on offer.
  let label = '';
  let inputId = '';
  // The page's own player, made once: an audio element and the node that brings it into
  // the context. With it, the files in line, which is up, and how many in a row would
  // not play.
  let player = null;
  let queue = [];
  let at = 0;
  let broken = 0;
  let audible = false;
  let pendingOnset = null;
  // Frames and loudest peak seen since the last reset, for the video-drop check.
  const watch = { frames: 0, peak: 0 };

  function onMessage(event) {
    const { positions, peak, onset } = event.data;
    watch.frames += positions.length;
    if (peak > watch.peak) watch.peak = peak;
    if (onset !== null && pendingOnset) {
      pendingOnset(onset);
      pendingOnset = null;
    }
    onFrames(event.data);
  }

  // Builds the context and analyser once; a failed attempt leaves nothing behind, so the
  // next call starts over. A browser holds a context still until the page has been
  // clicked: a start that a click led to waits for it to run, and one that came unasked
  // (a file dropped on the page) waits only a moment and reports through `wake`.
  async function ensureAudio(asked = true) {
    if (!context) {
      const fresh = new AudioContext({ latencyHint: 'interactive' });
      let node;
      try {
        await fresh.audioWorklet.addModule(import.meta.env.BASE_URL + 'audio/analyser.worklet.js');
        node = new AudioWorkletNode(fresh, 'pulsr-analyser', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 2,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
        });
      } catch (error) {
        fresh.close().catch(() => {});
        throw error;
      }
      context = fresh;
      analyser = node;
      analyser.port.onmessage = onMessage;
      // The analyser only runs while it leads somewhere; this path is silent.
      analyser.connect(new GainNode(context, { gain: 0 })).connect(context.destination);
      monitor = new GainNode(context, { gain: audible ? 0.25 : 0 });
      monitor.connect(context.destination);
      log(
        `audio context: ${context.sampleRate} Hz, base latency ${ms(context.baseLatency)}, ` +
          `output latency ${ms(context.outputLatency)}`,
      );
    }
    if (context.state === 'running') return;
    const resumed = context.resume();
    if (asked) await resumed;
    else await Promise.race([resumed.catch(() => {}), sleep(UNASKED_WAIT_MS)]);
  }

  function stop() {
    if (stopSignal) {
      stopSignal();
      stopSignal = null;
    }
    if (input) input.disconnect();
    input = null;
    if (stream) for (const track of stream.getTracks()) track.stop();
    stream = null;
    label = '';
    inputId = '';
    // Back to the browser's own choice of how the page's sound mixes with the system's.
    if (kind === 'files' && navigator.audioSession) navigator.audioSession.type = 'auto';
    if (kind !== 'none') log(`stopped: ${kind}`);
    kind = 'none';
  }

  // Wires a granted stream to the analyser. A stream without sound is given back.
  function attach(granted, name) {
    const [audio] = granted.getAudioTracks();
    const [video] = granted.getVideoTracks();
    const surface = video ? video.getSettings().displaySurface : undefined;
    if (video) log(`video track: ${describe(video.getSettings(), ['displaySurface', 'width', 'height', 'frameRate'])}`);
    if (!audio) {
      log('no audio track came with that choice: the audio switch was off or was not offered');
      for (const track of granted.getTracks()) track.stop();
      return { ok: false, why: 'noaudio', surface };
    }
    stream = granted;
    for (const track of granted.getTracks()) {
      track.addEventListener('ended', () => {
        log(`${track.kind} track ended`);
        if (track.kind === 'audio' && stream === granted) onEnded();
      });
      track.addEventListener('mute', () => log(`${track.kind} track muted`));
      track.addEventListener('unmute', () => log(`${track.kind} track unmuted`));
    }
    log(`audio track "${audio.label}"`);
    log(
      `audio settings: ${describe(audio.getSettings(), [
        'sampleRate',
        'channelCount',
        'echoCancellation',
        'noiseSuppression',
        'autoGainControl',
        'suppressLocalAudioPlayback',
        'restrictOwnAudio',
        'latency',
      ])}`,
    );
    try {
      input = context.createMediaStreamSource(new MediaStream([audio]));
      input.connect(analyser);
    } catch (error) {
      stop();
      throw error;
    }
    kind = surface ? `${name} (${surface})` : name;
    label = audio.label;
    inputId = audio.getSettings().deviceId || '';
    return { ok: true, surface };
  }

  async function share(route) {
    stop();
    const clicked = performance.now();
    const controller = 'CaptureController' in window ? new CaptureController() : undefined;
    let pending;
    try {
      pending = navigator.mediaDevices.getDisplayMedia({ ...pickerOptions(route), controller });
    } catch (error) {
      pending = Promise.reject(error);
    }
    const audioReady = ensureAudio().then(
      () => null,
      (error) => error,
    );

    let granted;
    try {
      granted = await pending;
    } catch (error) {
      const took = Math.round(performance.now() - clicked);
      log(`share failed after ${took} ms: ${error.name}: ${error.message}`);
      if (error.name !== 'NotAllowedError') return { ok: false, why: 'error', error };
      return { ok: false, why: /system/i.test(error.message) ? 'blocked' : 'cancelled' };
    }
    // Stay on this page instead of following the shared tab.
    if (controller) {
      try {
        controller.setFocusBehavior('no-focus-change');
      } catch (error) {
        log(`focus behaviour not set: ${error.name}`);
      }
    }
    log(`picker answered after ${((performance.now() - clicked) / 1000).toFixed(1)} s (${route})`);
    const failed = await audioReady;
    if (failed) {
      log(`audio set-up failed: ${failed.name}: ${failed.message}`);
      for (const track of granted.getTracks()) track.stop();
      return { ok: false, why: 'error', error: failed };
    }
    return attach(granted, route === 'tab' ? 'shared tab' : 'shared audio');
  }

  const refused = (error) => {
    log(`input failed: ${error.name}: ${error.message}`);
    return { ok: false, why: error.name === 'NotAllowedError' ? 'cancelled' : 'error', error };
  };

  // Listens through an input: the one with `deviceId`, or whichever the browser offers.
  async function microphone(deviceId) {
    stop();
    let pending = null;
    try {
      pending = navigator.mediaDevices.getUserMedia(inputOptions(deviceId));
      // A refusal is read below; this keeps it from counting as unhandled in the meantime.
      pending.catch(() => {});
      await ensureAudio();
    } catch (error) {
      // A microphone granted after the set-up failed is let go at once.
      pending?.then((granted) => {
        for (const track of granted.getTracks()) track.stop();
      }, () => {});
      return refused(error);
    }
    try {
      return attach(await pending, 'microphone');
    } catch (error) {
      return refused(error);
    }
  }

  // Moves to another input while one is in use, which stays if the new one is refused.
  async function switchInput(deviceId) {
    let granted;
    try {
      granted = await navigator.mediaDevices.getUserMedia(inputOptions(deviceId));
    } catch (error) {
      return refused(error);
    }
    stop();
    try {
      return attach(granted, 'microphone');
    } catch (error) {
      return refused(error);
    }
  }

  // The inputs on offer, as { id, label, loopback }. Empty until one has been allowed.
  async function inputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      return listInputs(await navigator.mediaDevices.enumerateDevices());
    } catch {
      return [];
    }
  }

  // Starts the element playing and says how it went: true, or the name of what stopped it.
  const play = () => player.element.play().then(() => true, (error) => error.name);

  // Puts the file that is up into the player and starts it.
  function load() {
    const file = queue[at];
    if (player.url) URL.revokeObjectURL(player.url);
    player.url = URL.createObjectURL(file);
    player.element.src = player.url;
    log(`file ${at + 1} of ${queue.length}: ${file.type || 'no type given'}, ${Math.round(file.size / 1024)} kB`);
    onTrack({ name: file.name, index: at, count: queue.length });
    return play();
  }

  // On to the next file, or back, round the end of the line.
  function advance(step) {
    at = (at + step + queue.length) % queue.length;
    return load();
  }

  // A file the browser cannot play is passed over. When none of them will, it stops.
  function skip() {
    broken += 1;
    log(`file ${at + 1} would not play: ${player.element.error?.message || 'unknown format'}`);
    if (broken < queue.length) {
      advance(1);
      return;
    }
    stop();
    queue = [];
    onEnded('None of those files would play in this browser.');
  }

  // Plays the visitor's own files through the page, one after another and round again,
  // analysing them on the way to the speakers. With no `list` it carries on from where the
  // last one was stopped. `waiting` in the answer means the browser wants a click before
  // it lets sound play, and `wake` is to be called from that click.
  async function files(list) {
    stop();
    if (list) {
      queue = list;
      at = 0;
    }
    if (queue.length === 0) return { ok: false, why: 'nofiles' };
    kind = 'files';
    const fresh = !!list || !player;
    if (!player) {
      const element = new Audio();
      element.addEventListener('ended', () => kind === 'files' && advance(1));
      element.addEventListener('error', () => kind === 'files' && skip());
      element.addEventListener('playing', () => (broken = 0));
      player = { element, node: null, url: null };
    }
    stopSignal = () => player.element.pause();
    // Without this an iPhone's silent switch mutes the page.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    broken = 0;
    // Started before the first wait, while the click that led here still counts.
    const started = fresh ? load() : play();
    await ensureAudio(false);
    // An element feeds one node for life, so the node is made once and kept.
    if (!player.node) player.node = context.createMediaElementSource(player.element);
    player.node.connect(analyser);
    player.node.connect(context.destination);
    input = player.node;
    const waiting = context.state !== 'running' || (await started) === 'NotAllowedError';
    if (waiting) log('the browser wants a click before it plays');
    return { ok: true, waiting };
  }

  function nextFile() {
    if (kind === 'files' && queue.length > 1) advance(1);
  }

  // Called from a click: lets the sound run where the browser was holding it back.
  async function wake() {
    if (!context) return;
    if (context.state !== 'running') await context.resume();
    if (kind === 'files' && player.element.paused) await play();
  }

  async function testSignal() {
    stop();
    await ensureAudio();
    const bus = new GainNode(context, { gain: 0.8 });
    bus.connect(analyser);
    bus.connect(monitor);
    input = bus;
    kind = 'test signal';
    log('test signal running');
    stopSignal = startTestSignal(context, bus);
    return { ok: true };
  }

  // Stops the video half of a share and says whether the audio half carries on.
  async function dropVideo() {
    if (!stream) return;
    for (const track of stream.getVideoTracks()) track.stop();
    log('video track stopped; watching the audio for 3 s');
    watch.frames = 0;
    watch.peak = 0;
    await sleep(3000);
    const audio = stream && stream.getAudioTracks()[0];
    if (!audio) return;
    log(
      `after stopping video: audio track is ${audio.readyState}${audio.muted ? ' and muted' : ''}, ` +
        `${watch.frames} frames analysed, peak ${db(watch.peak)}`,
    );
  }

  function click(at) {
    const osc = new OscillatorNode(context, { frequency: 1000 });
    const amp = new GainNode(context, { gain: 0 });
    amp.gain.setValueAtTime(0.5, at);
    amp.gain.setValueAtTime(0, at + 0.03);
    osc.connect(amp).connect(context.destination);
    osc.start(at);
    osc.stop(at + 0.05);
  }

  // Plays clicks through the speakers and times their arrival in the capture.
  async function measureDelay() {
    if (!context || kind === 'none') return;
    log('measuring: 6 clicks through the speakers. Pause any music first.');
    await sleep(600);
    const delays = [];
    for (let k = 0; k < 6; k++) {
      const playAt = context.currentTime + 0.15;
      const heard = new Promise((resolve) => {
        pendingOnset = resolve;
        setTimeout(() => resolve(null), 1200);
      });
      analyser.port.postMessage('arm');
      click(playAt);
      const onset = await heard;
      pendingOnset = null;
      analyser.port.postMessage('disarm');
      if (onset === null) log(`click ${k + 1}: not heard in the capture`);
      else if (onset < playAt) log(`click ${k + 1}: something else sounded first, skipped`);
      else delays.push(onset - playAt);
      await sleep(450);
    }
    if (delays.length === 0) {
      log('delay: no click was heard in the capture');
      return;
    }
    delays.sort((a, b) => a - b);
    const median = delays[delays.length >> 1];
    log(
      `delay: capture hears the page ${ms(median)} after it plays ` +
        `(${ms(delays[0])} to ${ms(delays[delays.length - 1])}, ${delays.length} clicks)`,
    );
    const output = context.outputLatency;
    if (output > 0) log(`delay: less the output latency of ${ms(output)}, the picture trails the sound by about ${ms(median - output)}`);
  }

  function setAudible(on) {
    audible = on;
    if (monitor) monitor.gain.value = on ? 0.25 : 0;
  }

  return {
    share,
    microphone,
    switchInput,
    inputs,
    files,
    nextFile,
    wake,
    testSignal,
    stop,
    dropVideo,
    measureDelay,
    setAudible,
    get kind() {
      return kind;
    },
    get label() {
      return label;
    },
    get inputId() {
      return inputId;
    },
    // How many files are in line.
    get queued() {
      return queue.length;
    },
    get context() {
      return context;
    },
    get stream() {
      return stream;
    },
  };
}
