import { audioCtx, routes } from "./engine";

/**
 * Plays recorded instruments (VS Chamber Orchestra: Community Edition, CC0 - see
 * public/audio/CREDITS.txt). Each instrument is one MP3 holding a handful of notes; a note in
 * between is the nearest recording, re-pitched. Banks load on demand and stay in memory.
 *
 * Long notes on bowed and blown instruments are longer than the recordings, so they are
 * continued by overlapping a second take that starts after the attack (a cross-fade the ear
 * hears as one held note).
 */
export type Bus = "music" | "sfx";

/** A recorded note: key (MIDI note, or a name in the percussion bank), offset and length in seconds. */
interface Entry { k: number | string; o: number; d: number }
type BankMap = Record<string, Entry[]>;

const VERSION = 1;
const url = (f: string) => `${import.meta.env.BASE_URL}audio/${f}?v=${VERSION}`;

let map: BankMap | null = null;
let mapLoading: Promise<BankMap | null> | null = null;
const buffers = new Map<string, AudioBuffer>();
/** Seconds to add to the nominal offsets (browsers differ in how they trim MP3 padding). */
const shift = new Map<string, number>();
const loading = new Map<string, Promise<boolean>>();

/** Instruments whose notes can be held as long as the music asks. */
const SUSTAINED = new Set(["violins", "violas", "cellos", "basses", "solovln", "flute", "oboe", "clarinet", "bassoon", "horn", "trumpet", "trombone"]);

/** Seating of the orchestra, left (-1) to right (+1), and how much hall each one gets. */
export const SEAT: Record<string, { pan: number; verb: number; gain: number }> = {
  violins: { pan: -0.45, verb: 0.55, gain: 0.9 },
  solovln: { pan: -0.2, verb: 0.5, gain: 0.85 },
  violas: { pan: 0.1, verb: 0.55, gain: 0.8 },
  cellos: { pan: 0.4, verb: 0.5, gain: 0.85 },
  basses: { pan: 0.55, verb: 0.45, gain: 0.8 },
  spic: { pan: -0.4, verb: 0.35, gain: 0.85 },
  cellospic: { pan: 0.4, verb: 0.35, gain: 0.85 },
  pizz: { pan: -0.3, verb: 0.45, gain: 0.9 },
  harp: { pan: -0.6, verb: 0.55, gain: 0.85 },
  piano: { pan: 0.05, verb: 0.4, gain: 0.85 },
  flute: { pan: -0.15, verb: 0.55, gain: 0.8 },
  oboe: { pan: 0.15, verb: 0.55, gain: 0.75 },
  clarinet: { pan: -0.25, verb: 0.55, gain: 0.75 },
  bassoon: { pan: 0.25, verb: 0.5, gain: 0.8 },
  horn: { pan: -0.3, verb: 0.65, gain: 0.8 },
  trumpet: { pan: 0.25, verb: 0.55, gain: 0.7 },
  trombone: { pan: 0.4, verb: 0.55, gain: 0.75 },
  timp: { pan: 0.0, verb: 0.6, gain: 1.0 },
  glock: { pan: 0.35, verb: 0.6, gain: 0.55 },
  marimba: { pan: 0.3, verb: 0.4, gain: 0.8 },
  bells: { pan: 0.2, verb: 0.7, gain: 0.7 },
  perc: { pan: 0.0, verb: 0.45, gain: 1.0 },
};

async function loadMap(): Promise<BankMap | null> {
  if (map) return map;
  mapLoading ??= fetch(url("banks.json")).then((r) => r.json() as Promise<BankMap>).then((m) => (map = m)).catch(() => null);
  return mapLoading;
}

/** Loads instruments (once). Resolves to false if any could not be loaded. */
export async function loadBanks(names: string[]): Promise<boolean> {
  const ctx = audioCtx();
  if (!ctx) return false;
  const m = await loadMap();
  if (!m) return false;
  const all = await Promise.all(names.map((name) => {
    if (buffers.has(name)) return true;
    if (!m[name]) return false;
    let p = loading.get(name);
    if (!p) {
      p = fetch(url(`${name}.mp3`))
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => { buffers.set(name, buf); shift.set(name, measureShift(buf, m[name][0])); return true; })
        .catch(() => { loading.delete(name); return false; });
      loading.set(name, p);
    }
    return p;
  }));
  return all.every(Boolean);
}

export const hasBank = (name: string) => buffers.has(name);

/** Where the first recorded note really starts, against where the map says (MP3 padding). */
function measureShift(buf: AudioBuffer, first: Entry): number {
  const d = buf.getChannelData(0), sr = buf.sampleRate;
  const from = Math.max(0, Math.floor((first.o - 0.1) * sr)), to = Math.min(d.length, Math.floor((first.o + 0.2) * sr));
  let peak = 0;
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = from; i < to; i++) if (Math.abs(d[i]) > peak * 0.05) return Math.max(-0.05, Math.min(0.08, i / sr - first.o - 0.004));
  return 0;
}

// ------------------------------------------------------------ channel strips (shared pan + send)
const strips = new Map<string, GainNode>();
function strip(bus: Bus, pan: number, verb: number): GainNode {
  const key = `${bus}|${pan.toFixed(2)}|${verb.toFixed(2)}`;
  let g = strips.get(key);
  if (g) return g;
  const ctx = audioCtx()!;
  const r = routes(bus);
  g = ctx.createGain();
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(r.dry);
  if (verb > 0) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s).connect(r.verb); }
  strips.set(key, g);
  return g;
}

// ------------------------------------------------------------ voices
let voices = 0;
const MAX_VOICES = 72;

export interface NoteOpts {
  /** Absolute AudioContext time to start (defaults to now). */
  when?: number;
  /** 0..1.2, louder is also a little brighter in the recordings we pick. */
  vel?: number;
  bus?: Bus;
  pan?: number;
  verb?: number;
  attack?: number;
  release?: number;
  /** Extra pitch bend in semitones (sound effects). */
  bend?: number;
  /** Slide the pitch by this many semitones over the note (sound effects). */
  glide?: number;
}

function nearest(list: Entry[], midi: number): Entry {
  let best = list[0];
  for (const e of list) if (Math.abs((e.k as number) - midi) < Math.abs((best.k as number) - midi)) best = e;
  return best;
}

function voice(name: string, e: Entry, rate: number, when: number, offset: number, len: number, peak: number, attack: number, release: number, out: AudioNode, glide?: number) {
  const ctx = audioCtx()!;
  const buf = buffers.get(name)!;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, when);
  if (glide) src.playbackRate.exponentialRampToValueAtTime(rate * 2 ** (glide / 12), when + len);
  const g = ctx.createGain();
  // the fades must fit inside the note, or the envelope points come out of order (a click)
  const a = Math.min(attack, len * 0.5), rel = Math.min(release, len - a);
  // silent until the envelope starts: a take that begins mid-note must not let a sample through at full level
  g.gain.value = 0;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + a);
  g.gain.setValueAtTime(peak, when + len - rel);
  g.gain.linearRampToValueAtTime(0, when + len);
  src.connect(g).connect(out);
  const start = e.o + (shift.get(name) ?? 0) + offset;
  // the recording itself ends at e.o + e.d (re-pitched, it lasts d / rate)
  const avail = (e.d - offset) / rate;
  src.start(when, start, Math.min(avail, len + 0.05) * rate);
  voices++;
  src.onended = () => { voices--; g.disconnect(); };
}

/**
 * Plays `midi` on an instrument for `dur` seconds. Plucked and struck instruments ring out
 * naturally (dur only shortens them); held instruments are extended as needed.
 */
export function note(name: string, midi: number, dur: number, o: NoteOpts = {}) {
  const ctx = audioCtx();
  const list = map?.[name];
  if (!ctx || !list || !buffers.has(name)) return;
  if (voices >= MAX_VOICES && o.bus !== "sfx") return;
  const seat = SEAT[name] ?? { pan: 0, verb: 0.4, gain: 0.8 };
  const when = Math.max(ctx.currentTime, o.when ?? ctx.currentTime);
  const e = nearest(list, midi);
  const rate = 2 ** ((midi + (o.bend ?? 0) - (e.k as number)) / 12);
  const vel = o.vel ?? 0.8;
  const peak = seat.gain * vel * vel * 1.2;
  const out = strip(o.bus ?? "music", o.pan ?? seat.pan, o.verb ?? seat.verb);
  const release = o.release ?? (SUSTAINED.has(name) ? Math.min(0.35, dur * 0.4) : 0.25);
  const attack = o.attack ?? 0.004;
  const natural = e.d / rate;
  if (!SUSTAINED.has(name) || dur + release <= natural - 0.05) {
    const len = SUSTAINED.has(name) ? dur + release : Math.min(natural, Math.max(dur + release, 0.05));
    voice(name, e, rate, when, 0, len, peak, attack, Math.min(release, len * 0.6), out, o.glide);
    return;
  }
  // held longer than the recording: chain takes that skip the attack, cross-fading 0.4 s
  const skip = 0.45, fade = 0.4;
  const firstLen = natural - 0.05;
  voice(name, e, rate, when, 0, firstLen, peak, attack, fade, out);
  let t = when + firstLen - fade;
  const end = when + dur + release;
  const segLen = (e.d - skip) / rate - 0.05;
  for (let i = 0; i < 6 && t < end - 0.15; i++) {
    const len = Math.min(segLen, end - t);
    const last = t + len >= end - 0.01;
    voice(name, e, rate, t, skip, len, peak, fade, last ? release : fade, out);
    t += len - fade;
  }
}

/** A one-shot from the percussion bank ("kick", "crash", "gong"...). */
export function hit(key: string, o: NoteOpts & { rate?: number } = {}) {
  const ctx = audioCtx();
  const e = map?.perc?.find((x) => x.k === key);
  if (!ctx || !e || !buffers.has("perc")) return;
  const when = Math.max(ctx.currentTime, o.when ?? ctx.currentTime);
  const rate = (o.rate ?? 1) * 2 ** ((o.bend ?? 0) / 12);
  const vel = o.vel ?? 0.8;
  const out = strip(o.bus ?? "music", o.pan ?? 0, o.verb ?? SEAT.perc.verb);
  voice("perc", e, rate, when, 0, e.d / rate, vel * vel * 1.1, 0.002, 0.15, out, o.glide);
}

export const activeVoices = () => voices;
