// A drum loop with a bass line and an arpeggio, made in the page, for looking at the
// picture without any capture. Plays into `bus`; the returned function stops scheduling.
export function startTestSignal(context, bus) {
  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  const tone = (type, hz, at, length, level, endHz) => {
    const osc = new OscillatorNode(context, { type, frequency: hz });
    const amp = new GainNode(context, { gain: 0 });
    amp.gain.setValueAtTime(level, at);
    amp.gain.exponentialRampToValueAtTime(0.0005, at + length);
    if (endHz) osc.frequency.exponentialRampToValueAtTime(endHz, at + length * 0.4);
    osc.connect(amp).connect(bus);
    osc.start(at);
    osc.stop(at + length + 0.02);
  };
  const burst = (filterType, hz, at, length, level) => {
    const src = new AudioBufferSourceNode(context, { buffer: noise, loop: true });
    const filter = new BiquadFilterNode(context, { type: filterType, frequency: hz, Q: 0.8 });
    const amp = new GainNode(context, { gain: 0 });
    amp.gain.setValueAtTime(level, at);
    amp.gain.exponentialRampToValueAtTime(0.0005, at + length);
    src.connect(filter).connect(amp).connect(bus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + length + 0.02);
  };

  const sixteenth = 60 / 122 / 4;
  const bass = [55, 55, 65.41, 49];
  const arp = [440, 523.25, 659.25, 783.99, 659.25, 523.25, 880, 659.25];
  let step = 0;
  let next = context.currentTime + 0.1;
  const schedule = () => {
    while (next < context.currentTime + 0.25) {
      const s = step % 16;
      const bar = Math.floor(step / 16);
      if (s % 4 === 0) tone('sine', 150, next, 0.32, 0.6, 45);
      if (s === 4 || s === 12) {
        burst('bandpass', 1800, next, 0.16, 0.5);
        tone('triangle', 190, next, 0.1, 0.3);
      }
      burst('highpass', 7000, next, s % 4 === 2 ? 0.09 : 0.03, s % 4 === 2 ? 0.4 : 0.15);
      if (s % 4 === 2 || s === 15) tone('sawtooth', bass[bar % 4], next, 0.2, 0.3);
      if (s % 2 === 0 && bar % 8 >= 1) tone('triangle', arp[(step / 2) % 8], next, 0.22, 0.25);
      step += 1;
      next += sixteenth;
    }
  };
  schedule();
  const timer = setInterval(schedule, 50);
  return () => clearInterval(timer);
}
