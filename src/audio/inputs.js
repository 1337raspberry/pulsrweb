// The sound inputs a browser offers, and which of them carry the computer's own sound
// rather than a microphone's. A loopback input (a sound server's monitor, or a virtual
// device the visitor has installed) is a clean copy of what the computer plays, and the
// only way a browser without tab sharing gets to hear it.

// A monitor of an output, as PulseAudio and PipeWire name them. It always carries whatever
// that output plays.
const MONITOR = /\bmonitor of |\.monitor$/i;
// Virtual devices that do the same once the visitor has routed sound through them.
const VIRTUAL = /blackhole|loopback|stereo mix|what u hear|vb-audio|cable output|voicemeeter|soundflower/i;

export const isMonitor = (label) => MONITOR.test(label);
export const isLoopback = (label) => MONITOR.test(label) || VIRTUAL.test(label);

// The inputs in a list from `enumerateDevices()`, as { id, label, loopback }. Labels come
// only once an input has been allowed, so a list from before that is empty. The browser's
// stand-ins for "whichever is the default" are left out where the real ones are listed.
export function listInputs(devices) {
  const inputs = devices.filter((device) => device.kind === 'audioinput' && device.label);
  const real = inputs.filter((device) => device.deviceId !== 'default' && device.deviceId !== 'communications');
  return (real.length > 0 ? real : inputs).map((device) => ({
    id: device.deviceId,
    label: device.label,
    loopback: isLoopback(device.label),
  }));
}

// The input worth moving to without being asked: the one monitor, when the input in use
// is not a loopback already. With several monitors there is no telling which output the
// music is on, and a virtual device may have nothing routed to it, so those are left to
// the visitor.
export function better(inputs, current) {
  if (isLoopback(current)) return null;
  const monitors = inputs.filter((input) => isMonitor(input.label));
  return monitors.length === 1 ? monitors[0] : null;
}

// A label without the prefix Chromium gives its stand-in for the default input
// ("Default - Built-in Microphone").
export const plain = (label) => label.replace(/^(default|communications) - /i, '');

// Which of `inputs` is the one in use, given the id and label its track reports. A track
// opened without naming an input reports the stand-in's id, so it is then told by its label.
export function currentOf(inputs, id, label) {
  return inputs.find((input) => input.id === id) || inputs.find((input) => input.label === plain(label)) || null;
}
