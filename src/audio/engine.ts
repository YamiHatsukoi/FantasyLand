/**
 * Web Audio engine: two buses (music and sound effects, each with its own switch and volume,
 * remembered on the device), a concert-hall reverb both can send to, and small synthesis
 * helpers (oscillators and noise through filters and envelopes). Recorded instruments are
 * played by sampler.ts on top of this.
 */
export interface AudioSettings { music: boolean; sfx: boolean; musicVol: number; sfxVol: number }

const KEY = "fl_audio";
const load = (): AudioSettings => {
  try { return { music: true, sfx: true, musicVol: 0.55, sfxVol: 0.8, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { music: true, sfx: true, musicVol: 0.55, sfxVol: 0.8 }; }
};
export const settings: AudioSettings = load();

let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode;
/** Inputs of the hall reverb, one per bus so muting a bus also mutes its echo. */
let musicVerb: GainNode, sfxVerb: GainNode;
let noiseBuf: AudioBuffer | null = null;
const readyHooks: (() => void)[] = [];

export const audioCtx = () => ctx;
export const buses = () => ({ sfx: sfxBus, music: musicBus });
/** Where a voice goes: the dry bus and the bus's reverb send. */
export const routes = (bus: "sfx" | "music") => (bus === "music" ? { dry: musicBus, verb: musicVerb } : { dry: sfxBus, verb: sfxVerb });
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
  comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  // one shared hall: each bus's send passes through that bus's volume first
  const hall = ctx.createConvolver();
  hall.buffer = hallImpulse(ctx, 2.6);
  const ret = ctx.createGain(); ret.gain.value = 0.55;
  hall.connect(ret).connect(master);
  musicVerb = ctx.createGain(); musicVerb.connect(hall);
  sfxVerb = ctx.createGain(); sfxVerb.connect(hall);
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
  const sv = settings.sfx ? settings.sfxVol : 0, mv = settings.music ? settings.musicVol * 0.6 : 0;
  sfxBus.gain.setTargetAtTime(sv, t, 0.05);
  musicBus.gain.setTargetAtTime(mv, t, 0.25);
  sfxVerb.gain.setTargetAtTime(sv, t, 0.05);
  musicVerb.gain.setTargetAtTime(mv, t, 0.25);
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

/**
 * Impulse response of a warm concert hall: a short pre-delay, a few early reflections, then
 * a dense tail that decays to -60 dB over `rt60` seconds and darkens as it fades (high
 * frequencies die first, as in a real room). Left and right are decorrelated for width.
 */
function hallImpulse(c: BaseAudioContext, rt60: number): AudioBuffer {
  const sr = c.sampleRate, len = Math.floor(sr * (rt60 + 0.3));
  const buf = c.createBuffer(2, len, sr);
  const pre = Math.floor(0.018 * sr);
  const tau = rt60 / Math.log(1000);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0, seed = ch ? 0x9e3779b9 : 0x7f4a7c15;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      // one-pole low-pass whose cutoff falls from ~9 kHz to ~1.5 kHz along the tail
      const fc = 1500 + 7500 * Math.exp(-t / 0.35);
      const a = Math.exp((-2 * Math.PI * fc) / sr);
      lp = a * lp + (1 - a) * rnd();
      const swell = Math.min(1, t / 0.03); // diffuse build-up
      d[i] = lp * Math.exp(-t / tau) * swell * 1.6;
    }
    // early reflections
    for (const [ms, g] of [[11, 0.5], [19, 0.36], [27, 0.3], [38, 0.24], [53, 0.2], [71, 0.15]] as const) {
      const k = pre + Math.floor(((ms + (ch ? 3 : 0)) / 1000) * sr);
      if (k < len) d[k] += g * (ch ? -1 : 1);
    }
  }
  return buf;
}
