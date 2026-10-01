/**
 * Tiny Web Audio engine. Everything is synthesised (no audio files): oscillators and noise
 * through filters and envelopes. Two buses, music and sound effects, each with its own switch
 * and volume, remembered on the device.
 */
export interface AudioSettings { music: boolean; sfx: boolean; musicVol: number; sfxVol: number }

const KEY = "fl_audio";
const load = (): AudioSettings => {
  try { return { music: true, sfx: true, musicVol: 0.55, sfxVol: 0.8, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { music: true, sfx: true, musicVol: 0.55, sfxVol: 0.8 }; }
};
export const settings: AudioSettings = load();

let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode;
let noiseBuf: AudioBuffer | null = null;
const readyHooks: (() => void)[] = [];

export const audioCtx = () => ctx;
export const buses = () => ({ sfx: sfxBus, music: musicBus });
/** Runs once the audio context exists (it can only start after a user gesture). */
export const onAudioReady = (fn: () => void) => { if (ctx) fn(); else readyHooks.push(fn); };

function create() {
  if (ctx) { if (ctx.state === "suspended" && !document.hidden) void ctx.resume(); return; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  // a gentle limiter so stacked effects never clip
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  applySettings();
  for (const fn of readyHooks.splice(0)) fn();
}

export function initAudio() {
  const unlock = () => create();
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
  // nothing plays in a hidden tab (saves battery; background battles skip their effects anyway)
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend(); else void ctx.resume();
  });
}

export function applySettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  if (!ctx) return;
  const t = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(settings.sfx ? settings.sfxVol : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music ? settings.musicVol * 0.6 : 0, t, 0.25);
}

// ------------------------------------------------------------ building blocks
export interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  at?: number; // seconds from now
  attack?: number;
  release?: number;
  slide?: number; // end frequency
  detune?: number;
  lp?: number; // low-pass cutoff
  hp?: number;
  bus?: "sfx" | "music";
  vibrato?: number;
}

export function tone(freq: number, dur: number, o: ToneOpts = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
  if (o.detune) osc.detune.value = o.detune;
  if (o.vibrato) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 6; lg.gain.value = o.vibrato;
    lfo.connect(lg).connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.1);
  }
  const g = ctx.createGain();
  const peak = o.gain ?? 0.15, a = o.attack ?? 0.005, r = o.release ?? Math.max(0.02, dur * 0.8);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.setValueAtTime(peak, t0 + Math.max(a, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node: AudioNode = osc;
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; node = node.connect(f); }
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = o.hp; node = node.connect(f); }
  node.connect(g).connect(o.bus === "music" ? musicBus : sfxBus);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

export interface NoiseOpts {
  gain?: number;
  at?: number;
  attack?: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number; // filter sweep target
  q?: number;
  bus?: "sfx" | "music";
}

export function noise(dur: number, o: NoiseOpts = {}) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? "bandpass";
  f.frequency.setValueAtTime(o.freq ?? 1200, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t0 + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(o.bus === "music" ? musicBus : sfxBus);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
}

/** Note number to frequency (A4 = 69). */
export const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
