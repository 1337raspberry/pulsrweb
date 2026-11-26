import { expect, test } from 'vitest';
import { better, currentOf, isLoopback, isMonitor, listInputs, plain } from '../src/audio/inputs.js';

const input = (deviceId, label, kind = 'audioinput') => ({ deviceId, label, kind });

test('an input that carries the computer’s own sound is told by its name', () => {
  for (const label of ['Monitor of Built-in Audio Analog Stereo', 'Default - Monitor of Built-in Audio', 'alsa_output.pci-0000.analog-stereo.monitor']) {
    expect(isMonitor(label), label).toBe(true);
    expect(isLoopback(label), label).toBe(true);
  }
  for (const label of ['BlackHole 2ch', 'Stereo Mix (Realtek Audio)', 'CABLE Output (VB-Audio Virtual Cable)', 'Loopback Audio']) {
    expect(isMonitor(label), label).toBe(false);
    expect(isLoopback(label), label).toBe(true);
  }
  for (const label of ['MacBook Pro Microphone', 'Studio Monitor Mic', 'USB Audio Device']) expect(isLoopback(label), label).toBe(false);
});

test('the list is the named sound inputs, without the stand-ins for the default', () => {
  const devices = [
    input('default', 'Default - Built-in Microphone'),
    input('communications', 'Communications - Built-in Microphone'),
    input('a1', 'Built-in Microphone'),
    input('b2', 'Monitor of Built-in Audio'),
    input('c3', 'Speakers', 'audiooutput'),
    input('d4', ''),
  ];
  expect(listInputs(devices)).toEqual([
    { id: 'a1', label: 'Built-in Microphone', loopback: false },
    { id: 'b2', label: 'Monitor of Built-in Audio', loopback: true },
  ]);
  // Before an input is allowed nothing has a name, and where only a stand-in is named it stays.
  expect(listInputs([input('', '')])).toEqual([]);
  expect(listInputs([input('default', 'Default')])).toEqual([{ id: 'default', label: 'Default', loopback: false }]);
});

test('only a lone monitor is moved to unasked, and only from a microphone', () => {
  const mic = { id: 'a', label: 'Built-in Microphone', loopback: false };
  const monitor = { id: 'b', label: 'Monitor of Built-in Audio', loopback: true };
  const hdmi = { id: 'c', label: 'Monitor of HDMI Audio', loopback: true };
  const virtual = { id: 'd', label: 'BlackHole 2ch', loopback: true };
  expect(better([mic, monitor], mic.label)).toBe(monitor);
  expect(better([mic, monitor, virtual], mic.label)).toBe(monitor);
  expect(better([mic, monitor, hdmi], mic.label)).toBe(null);
  expect(better([mic, virtual], mic.label)).toBe(null);
  expect(better([mic, monitor], monitor.label)).toBe(null);
  expect(better([mic, monitor], virtual.label)).toBe(null);
});

test('the input in use is found by its id, or by its label where the track reports the default stand-in', () => {
  const mic = { id: 'a', label: 'Built-in Microphone', loopback: false };
  const usb = { id: 'b', label: 'USB Audio Device', loopback: false };
  expect(currentOf([mic, usb], 'b', 'USB Audio Device')).toBe(usb);
  expect(currentOf([mic, usb], 'default', 'Default - Built-in Microphone')).toBe(mic);
  expect(currentOf([mic, usb], 'default', 'Something else')).toBe(null);
  expect(plain('Communications - Headset')).toBe('Headset');
  expect(plain('Built-in Microphone')).toBe('Built-in Microphone');
});
