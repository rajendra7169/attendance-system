/**
 * Tiny ambient soundscape generator using only the Web Audio API.
 * Zero asset bytes — sounds are synthesized at runtime.
 *
 * - Plays soft wind, water flow, and occasional bird chirps
 * - All toggleable from one global instance
 */

let ctx = null;
let masterGain = null;
let activeNodes = [];
let chirpTimer = null;
let started = false;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function createNoiseBuffer(c, duration = 2) {
  const buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function startWind() {
  const c = getCtx();
  if (!c) return;
  const noise = c.createBufferSource();
  noise.buffer = createNoiseBuffer(c, 4);
  noise.loop = true;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 350;

  const gain = c.createGain();
  gain.gain.value = 0.03;

  // Gentle wind volume modulation
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.1;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain).connect(gain.gain);
  lfo.start();

  noise.connect(filter).connect(gain).connect(masterGain);
  noise.start();

  activeNodes.push(noise, filter, gain, lfo, lfoGain);
}

function startWater() {
  const c = getCtx();
  if (!c) return;
  const noise = c.createBufferSource();
  noise.buffer = createNoiseBuffer(c, 4);
  noise.loop = true;

  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 800;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2500;

  const gain = c.createGain();
  gain.gain.value = 0.025;

  noise.connect(hp).connect(lp).connect(gain).connect(masterGain);
  noise.start();
  activeNodes.push(noise, hp, lp, gain);
}

function chirp() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  const freq = 2400 + Math.random() * 1800;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + 0.18);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.25);
}

function scheduleChirps() {
  const next = 3000 + Math.random() * 8000;
  chirpTimer = setTimeout(() => {
    chirp();
    if (Math.random() < 0.35) setTimeout(chirp, 250 + Math.random() * 350);
    scheduleChirps();
  }, next);
}

export function startSoundscape() {
  if (started) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  startWind();
  startWater();
  scheduleChirps();
  started = true;
}

export function stopSoundscape() {
  if (!started) return;
  activeNodes.forEach((n) => {
    try {
      if (n.stop) n.stop();
      else if (n.disconnect) n.disconnect();
    } catch {
      // ignore
    }
  });
  activeNodes = [];
  if (chirpTimer) clearTimeout(chirpTimer);
  chirpTimer = null;
  started = false;
}

export function playCheckInChime() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  const now = c.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.08;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}

export function isSoundscapeActive() {
  return started;
}
