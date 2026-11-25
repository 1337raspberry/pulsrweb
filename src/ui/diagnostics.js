import { db } from '../audio/capture.js';

const $ = (id) => document.getElementById(id);

// The diagnostics panel: a log, live stats, and buttons for checking a capture.
// `onTestSignal` starts the test signal; the optional `onStart(route)` and `onStop()`
// do the same for the share, microphone and stop buttons so the page follows along.
// Without them those buttons call the capture directly.
export function createDiagnostics({
  capture,
  onTestSignal,
  onStart = (route) => (route === 'mic' ? capture.microphone() : capture.share(route)),
  onStop = () => capture.stop(),
}) {
  const started = performance.now();
  const lines = [];
  let lastTick = performance.now();

  function log(text) {
    const stamp = ((performance.now() - started) / 1000).toFixed(1).padStart(6);
    lines.push(`${stamp}  ${text}`);
    const view = $('log');
    view.textContent = lines.slice(-14).join('\n');
    view.scrollTop = view.scrollHeight;
  }

  function report() {
    const canvas = $('ridge');
    const head = [
      'pulsr web report',
      `agent: ${navigator.userAgent}`,
      `platform: ${navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform}`,
      `screen: ${canvas.width}x${canvas.height} device px, ratio ${devicePixelRatio}`,
      $('stats').textContent,
      '',
    ];
    return head.concat(lines).join('\n');
  }

  function refreshButtons() {
    const live = capture.kind !== 'none';
    $('stop').disabled = !live;
    $('measure').disabled = !live;
    const stream = capture.stream;
    $('dropvideo').disabled = !(stream && stream.getVideoTracks().some((track) => track.readyState === 'live'));
  }

  // Shows the counts gathered since the last call.
  function tick({ paints, frames, peak, lateMs, kind, sampleRate }) {
    const now = performance.now();
    const span = (now - lastTick) / 1000;
    lastTick = now;
    $('stats').textContent =
      `source  ${kind}\n` +
      `paint   ${(paints / span).toFixed(0)} fps   analysis ${(frames / span).toFixed(0)} frames/s   ` +
      `arriving ${lateMs.toFixed(1)} ms late\n` +
      `input   ${db(peak)}${sampleRate ? `   ${sampleRate} Hz` : ''}`;
    $('level').style.width = `${Math.max(0, Math.min(1, 1 + (peak > 0 ? 20 * Math.log10(peak) : -90) / 60)) * 100}%`;
    refreshButtons();
  }

  function toggle() {
    $('panel').hidden = !$('panel').hidden;
  }

  $('share').addEventListener('click', () => onStart('screen'));
  $('mic').addEventListener('click', () => onStart('mic'));
  $('tone').addEventListener('click', () => onTestSignal());
  $('stop').addEventListener('click', () => onStop());
  $('dropvideo').addEventListener('click', async () => {
    const pending = capture.dropVideo();
    refreshButtons();
    await pending;
  });
  $('measure').addEventListener('click', () => capture.measureDelay());
  $('audible').addEventListener('change', (event) => capture.setAudible(event.target.checked));
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(report());
      log('report copied');
    } catch {
      log('the clipboard refused; select the log by hand');
    }
  });

  capture.setAudible($('audible').checked);
  refreshButtons();

  return { log, tick, toggle, report };
}
