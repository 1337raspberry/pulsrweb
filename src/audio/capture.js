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

// Gets sound into the analyser worklet from a shared tab or screen, the microphone or
// the built-in test signal. `onFrames` gets each message the analyser posts, `onEnded`
// is called when the share is stopped from outside the page.
export function createCapture({ onFrames, onEnded, log }) {
  let context = null;
  let analyser = null;
  let monitor = null;
  // The node feeding the analyser, the stream behind it (if any) and what it is.
  let input = null;
  let stream = null;
  let kind = 'none';
  let stopSignal = null;
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
  // next call starts over.
  async function ensureAudio() {
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
    if (context.state !== 'running') await context.resume();
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
    if (kind !== 'none') log(`stopped: ${kind}`);
    kind = 'none';
  }

  // Wires a granted stream to the analyser. A stream without sound is given back.
  function attach(granted, label) {
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
    kind = surface ? `${label} (${surface})` : label;
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

  async function microphone() {
    stop();
    const failed = (error) => {
      log(`microphone failed: ${error.name}: ${error.message}`);
      return { ok: false, why: error.name === 'NotAllowedError' ? 'cancelled' : 'error', error };
    };
    let pending = null;
    try {
      pending = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 },
      });
      // A refusal is read below; this keeps it from counting as unhandled in the meantime.
      pending.catch(() => {});
      await ensureAudio();
    } catch (error) {
      // A microphone granted after the set-up failed is let go at once.
      pending?.then((granted) => {
        for (const track of granted.getTracks()) track.stop();
      }, () => {});
      return failed(error);
    }
    try {
      return attach(await pending, 'microphone');
    } catch (error) {
      return failed(error);
    }
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
    testSignal,
    stop,
    dropVideo,
    measureDelay,
    setAudible,
    get kind() {
      return kind;
    },
    get context() {
      return context;
    },
    get stream() {
      return stream;
    },
  };
}
