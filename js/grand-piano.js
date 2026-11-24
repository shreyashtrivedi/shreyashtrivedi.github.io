// Sampled concert grand. Uses the Salamander Grand Piano recordings
// (Alexander Holm, CC BY 3.0): one sample every minor third from A0 to C8,
// pitch-shifted to the notes in between, with a damper release and hall reverb.
window.GrandPiano = (() => {
  const LOCAL = 'assets/piano/';
  const REMOTE = 'https://tonejs.github.io/audio/salamander/'; // used when opened from file://
  const SAMPLE_MIDIS = Array.from({ length: 30 }, (_, k) => 21 + 3 * k);
  const LETTERS = ['A', 'C', 'Ds', 'Fs'];

  const buffers = new Map();
  const voices = new Set();
  let ctx = null;
  let master = null;
  let loading = null;
  let muted = false;
  let volume = 1;
  let meters = null; // left/right analysers for the VU meters
  let meterBuf = null;

  const sampleName = (m) => LETTERS[((m - 21) / 3) % 4] + Math.floor((m - 12) / 12);

  function context() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'playback' });

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9 * volume;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const hall = ctx.createConvolver();
    hall.buffer = impulse(2.8);

    master.connect(dry).connect(comp);
    master.connect(hall).connect(wet).connect(comp);
    comp.connect(ctx.destination);

    // taps for the VU meters, fed from the final mix (they make no sound themselves)
    const split = ctx.createChannelSplitter(2);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    meters = [ctx.createAnalyser(), ctx.createAnalyser()];
    comp.connect(split);
    meters.forEach((a, i) => {
      a.fftSize = 1024;
      split.connect(a, i);
      a.connect(sink);
    });
    sink.connect(ctx.destination);
    meterBuf = new Float32Array(1024);
    return ctx;
  }

  function impulse(seconds) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < rate * 0.012 ? i / (rate * 0.012) : 1);
      }
    }
    return buf;
  }

  async function fetchSample(m) {
    const file = sampleName(m) + '.mp3';
    let res;
    try {
      res = await fetch(LOCAL + file);
      if (!res.ok) throw new Error(res.status);
    } catch (e) {
      res = await fetch(REMOTE + file);
    }
    return decoder().decodeAudioData(await res.arrayBuffer());
  }

  // An offline context can decode before any click, so loading needn't wait for one.
  let offline = null;
  function decoder() {
    if (!offline) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      offline = new OAC(2, 1, 44100);
    }
    return offline;
  }

  // Starts downloading straight away; audio can't be heard until resume() after a click.
  function load(onProgress) {
    if (loading) return loading;
    let done = 0;
    loading = Promise.all(SAMPLE_MIDIS.map(async (m) => {
      try {
        buffers.set(m, await fetchSample(m));
      } catch (e) {
        console.warn('Piano sample failed:', sampleName(m), e);
      }
      onProgress && onProgress(++done / SAMPLE_MIDIS.length);
    })).then(() => buffers.size > 0);
    return loading;
  }

  function resume() {
    context();
    if (ctx.state === 'suspended') return ctx.resume();
    return Promise.resolve();
  }

  function nearest(m) {
    let best = null;
    for (const s of buffers.keys()) if (best === null || Math.abs(s - m) < Math.abs(best - m)) best = s;
    return best;
  }

  // Strike a string: start a sample at `when` (AudioContext seconds) and let it ring.
  function strike(midi, when, vel) {
    const base = nearest(midi);
    const src = ctx.createBufferSource();
    src.buffer = buffers.get(base);
    src.playbackRate.value = Math.pow(2, (midi - base) / 12);

    // softer notes are darker as well as quieter, like a real hammer
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1400 + 13000 * vel * vel;
    tone.Q.value = 0.2;

    const amp = ctx.createGain();
    const peak = 0.08 + Math.pow(vel, 1.4) * 0.95;
    amp.gain.setValueAtTime(peak, when);

    src.connect(tone).connect(amp).connect(master);
    src.start(when);
    const voice = { src, amp, peak };
    voices.add(voice);
    src.onended = () => voices.delete(voice);
    return voice;
  }

  // The damper falls on a ringing string.
  function damp(voice, at) {
    voice.amp.gain.setTargetAtTime(0, at, 0.16);
    try { voice.src.stop(at + 1.4); } catch (e) { /* already stopped */ }
  }

  // Schedule one note of fixed length. `when` is in AudioContext seconds.
  function play(midi, when, dur, vel = 0.6) {
    if (!ctx || !buffers.size) return;
    const voice = strike(midi, when, vel);
    voice.amp.gain.setValueAtTime(voice.peak, when + dur);
    damp(voice, when + dur);
  }

  // Live playing: the note sounds until noteOff (or until the sample dies away).
  function noteOn(midi, vel = 0.6) {
    if (!ctx || !buffers.size) return null;
    return strike(midi, ctx.currentTime + 0.003, vel);
  }

  function noteOff(voice) {
    if (!voice || !ctx) return;
    const t = ctx.currentTime;
    voice.amp.gain.cancelScheduledValues(t);
    voice.amp.gain.setValueAtTime(voice.peak, t);
    damp(voice, t);
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  // The audio clock read through the display clock, for animation: same time, no jumps.
  let clockOffset = null;
  function smoothNow() {
    if (!ctx) return 0;
    const wall = performance.now() / 1000;
    const raw = ctx.currentTime - wall;
    if (clockOffset === null || ctx.state !== 'running' || Math.abs(raw - clockOffset) > 0.05) clockOffset = raw;
    else clockOffset += (raw - clockOffset) * 0.03;
    return wall + clockOffset;
  }

  // The soft whisper of a page turning: filtered noise with a falling sweep.
  function rustle() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.7);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(2600, t);
    band.frequency.exponentialRampToValueAtTime(700, t + 0.6);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.05, t + 0.12);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    src.connect(band).connect(amp).connect(master);
    src.start(t);
  }

  function stopAll(fade = 0.35) {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const v of voices) {
      v.amp.gain.cancelScheduledValues(t);
      v.amp.gain.setTargetAtTime(0, t, fade / 3);
      try { v.src.stop(t + fade + 0.1); } catch (e) { /* already stopped */ }
    }
    voices.clear();
  }

  const applyGain = () => { if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9 * volume, ctx.currentTime, 0.05); };

  function setMuted(m) {
    muted = m;
    applyGain();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    applyGain();
  }

  // Loudness of the left and right channels right now (RMS, 0–1).
  function levels() {
    if (!meters) return [0, 0];
    return meters.map((a) => {
      a.getFloatTimeDomainData(meterBuf);
      let sum = 0;
      for (let i = 0; i < meterBuf.length; i++) sum += meterBuf[i] * meterBuf[i];
      return Math.sqrt(sum / meterBuf.length);
    });
  }

  return { load, resume, play, noteOn, noteOff, now, smoothNow, rustle, stopAll, setMuted, isMuted: () => muted, setVolume, getVolume: () => volume, levels, ready: () => buffers.size > 0 };
})();
