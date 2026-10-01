/**
 * A small score format for the game's music, compiled to a list of note events.
 *
 *  - chords:  "Dmaj7:4 Bm7:4 G/B:2 A:2"  symbol:beats (the harmony every generator follows)
 *  - line:    "F#5/1.5 E5/0.5 D5/2 r/1 A4"  note/beats, the duration carries over; r = rest
 *  - pad:     held chords, voiced across one or several instruments
 *  - arp:     chord tones by index ("0 1 2 3 2 1"), one per step
 *  - bass:    "x..5 x.o." per step: x root, 5 fifth, o octave, 3 third, . rest
 *  - drums:   one string per instrument, one character per step: X accent, x normal, o soft
 *
 * Times are in beats; the player turns them into seconds with the piece's tempo.
 */

export interface Ev {
  t: number;
  /** Instrument bank, or "perc" for one-shots. */
  inst: string;
  midi: number;
  /** Percussion key when inst is "perc". */
  hit?: string;
  dur: number;
  vel: number;
}

export type Part =
  | { line: string; inst: string; vel?: number; oct?: number; legato?: number; from?: number; every?: number }
  | { pad: string[]; oct?: number; vel?: number; strike?: number; from?: number; top?: boolean }
  | { arp: string; inst: string; step: number; oct: number; vel?: number; ring?: number; from?: number; every?: number }
  | { bass: string; inst: string; step: number; oct: number; vel?: number; legato?: number; from?: number; every?: number }
  | { drums: Record<string, string>; step: number; vel?: number; from?: number; every?: number };

export interface Piece {
  bpm: number;
  /** Beats per bar (3 for a waltz). */
  meter: number;
  chords: string;
  parts: Part[];
  /** Semitones added to every pitched note (re-keying a piece for another region). */
  transpose?: number;
  /** Swing: the second eighth of each beat is late by this fraction of a beat. */
  swing?: number;
  /** Jingles play once instead of looping. */
  once?: boolean;
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteNum(s: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad note ${s}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

const QUAL: [string, number[]][] = [
  ["maj7", [0, 4, 7, 11]], ["m7b5", [0, 3, 6, 10]], ["madd9", [0, 3, 7, 14]], ["add9", [0, 4, 7, 14]], ["m7", [0, 3, 7, 10]], ["m6", [0, 3, 7, 9]],
  ["sus4", [0, 5, 7]], ["sus2", [0, 2, 7]], ["dim7", [0, 3, 6, 9]], ["dim", [0, 3, 6]], ["aug", [0, 4, 8]], ["7sus4", [0, 5, 7, 10]],
  ["9", [0, 4, 7, 10, 14]], ["7", [0, 4, 7, 10]], ["6", [0, 4, 7, 9]], ["m", [0, 3, 7]], ["5", [0, 7]], ["", [0, 4, 7]],
];

export interface Chord { root: number; tones: number[]; bass: number }

/** "F#m7/A" -> pitch classes. */
export function parseChord(sym: string): Chord {
  const [main, slash] = sym.split("/");
  const m = /^([A-G])(#|b)?(.*)$/.exec(main);
  if (!m) throw new Error(`bad chord ${sym}`);
  const root = (PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  const q = QUAL.find(([k]) => k === m[3]);
  if (!q) throw new Error(`bad chord quality ${sym}`);
  let bass = root;
  if (slash) { const b = /^([A-G])(#|b)?$/.exec(slash); if (!b) throw new Error(`bad bass ${sym}`); bass = (PC[b[1]] + (b[2] === "#" ? 1 : b[2] === "b" ? -1 : 0) + 12) % 12; }
  return { root, tones: q[1], bass };
}

interface Span { t: number; dur: number; chord: Chord }

function chordSpans(s: string): Span[] {
  let t = 0;
  return s.trim().split(/\s+/).filter((x) => x !== "|").map((tok) => {
    const [sym, d] = tok.split(":");
    const dur = Number(d ?? 4);
    const span = { t, dur, chord: parseChord(sym) };
    t += dur;
    return span;
  });
}

const at = (spans: Span[], t: number) => spans.find((s) => t >= s.t - 1e-6 && t < s.t + s.dur - 1e-6) ?? spans[spans.length - 1];

/** The chord's inversion whose notes sit closest around `centre` (smooth voice leading). */
function voicing(c: Chord, centre: number): number[] {
  const n = Math.min(4, c.tones.length);
  let best: number[] = [], score = Infinity;
  for (let inv = 0; inv < n; inv++) for (const oct of [-1, 0, 1]) {
    const v = Array.from({ length: n }, (_, i) => ladder(c, Math.floor(centre / 12) - 1 + oct, inv + i));
    const mid = (v[0] + v[v.length - 1]) / 2;
    const sc = Math.abs(mid - centre);
    if (sc < score) { score = sc; best = v; }
  }
  return best;
}

/** Lowest note of pitch class `pc` at or above MIDI `floor`. */
const above = (pc: number, floor: number) => floor + ((((pc - floor) % 12) + 12) % 12);

/** Chord tones from octave `oct` up, as an endless ladder (index 0 = root). */
function ladder(c: Chord, oct: number, i: number): number {
  const base = 12 * (oct + 1) + c.root;
  const n = c.tones.length;
  const k = ((i % n) + n) % n;
  return base + c.tones[k] + 12 * Math.floor(i / n);
}

export function parseLine(s: string): { midi: number | null; dur: number }[] {
  let dur = 1;
  return s.trim().split(/\s+/).filter((x) => x !== "|").map((tok) => {
    const [n, d] = tok.split("/");
    if (d) dur = Number(d);
    return { midi: n === "r" ? null : noteNum(n), dur };
  });
}

export const lineLength = (s: string) => parseLine(s).reduce((a, x) => a + x.dur, 0);
export const chordsLength = (s: string) => chordSpans(s).reduce((a, x) => a + x.dur, 0);

/** Repeats a part every `every` beats from `from` (default: once from 0). */
function repeats(len: number, from = 0, every?: number): number[] {
  const out: number[] = [];
  for (let s = from; s < len - 1e-6; s += every ?? len) { out.push(s); if (!every) break; }
  return out;
}

export function compile(p: Piece): { events: Ev[]; length: number } {
  const spans = chordSpans(p.chords);
  const length = spans.reduce((a, s) => a + s.dur, 0);
  const tr = p.transpose ?? 0;
  const ev: Ev[] = [];
  const push = (e: Ev) => { if (e.t < length - 1e-6) ev.push(e); };

  for (const part of p.parts) {
    if ("line" in part) {
      const notes = parseLine(part.line);
      const span = notes.reduce((a, x) => a + x.dur, 0);
      // a line shorter than the piece loops
      for (const s0 of repeats(length, part.from, part.every ?? (span < length ? span : undefined))) {
        let t = s0;
        for (const n of notes) {
          if (n.midi !== null) push({ t, inst: part.inst, midi: n.midi + 12 * (part.oct ?? 0) + tr, dur: n.dur * (part.legato ?? 1), vel: part.vel ?? 0.8 });
          t += n.dur;
        }
      }
    } else if ("pad" in part) {
      const oct = part.oct ?? 3;
      const centre = 12 * (oct + 1) + 7;
      for (const sp of spans) {
        if (part.from !== undefined && sp.t < part.from) continue;
        const c = sp.chord;
        const notes = voicing(c, centre);
        const strike = part.strike ?? sp.dur;
        for (let t = sp.t; t < sp.t + sp.dur - 1e-6; t += strike) {
          const d = Math.min(strike, sp.t + sp.dur - t);
          const vel = part.vel ?? 0.6;
          if (part.pad.length === 1) { for (const m of notes) push({ t, inst: part.pad[0], midi: m + tr, dur: d, vel }); continue; }
          // first instrument: the bass note an octave below; the others share the chord, low to high
          push({ t, inst: part.pad[0], midi: above(c.bass, centre - 19) + tr, dur: d, vel });
          const upper = part.pad.slice(1);
          notes.forEach((m, i) => {
            const who = part.top && i === notes.length - 1 ? upper[upper.length - 1] : upper[Math.min(upper.length - (part.top ? 2 : 1), Math.floor((i * upper.length) / notes.length))] ?? upper[0];
            push({ t, inst: who, midi: m + tr, dur: d, vel: vel * 0.9 });
          });
        }
      }
    } else if ("arp" in part) {
      const pat = part.arp.trim().split(/\s+/).map((x) => (x === "." ? null : Number(x)));
      for (const s0 of repeats(length, part.from, part.every)) {
        const end = part.every ? Math.min(length, s0 + part.every) : length;
        for (let t = s0, i = 0; t < end - 1e-6; t += part.step, i++) {
          const k = pat[i % pat.length];
          if (k === null) continue;
          const c = at(spans, t).chord;
          push({ t, inst: part.inst, midi: ladder(c, part.oct, k) + tr, dur: part.step * (part.ring ?? 2), vel: (part.vel ?? 0.6) * (i % pat.length === 0 ? 1.08 : 1) });
        }
      }
    } else if ("bass" in part) {
      const pat = part.bass.replace(/\s+/g, "");
      for (const s0 of repeats(length, part.from, part.every)) {
        const end = part.every ? Math.min(length, s0 + part.every) : length;
        for (let t = s0, i = 0; t < end - 1e-6; t += part.step, i++) {
          const ch = pat[i % pat.length];
          if (ch === ".") continue;
          // held until the next onset in the pattern
          let len = 1;
          while (len < pat.length && pat[(i + len) % pat.length] === ".") len++;
          const c = at(spans, t).chord;
          const root = above(c.bass, 12 * (part.oct + 1));
          const off = ch === "5" ? 7 : ch === "o" ? 12 : ch === "3" ? c.tones[1] : 0;
          push({ t, inst: part.inst, midi: root + off + tr, dur: part.step * len * (part.legato ?? 0.95), vel: part.vel ?? 0.7 });
        }
      }
    } else {
      for (const [name, pat0] of Object.entries(part.drums)) {
        const pat = pat0.replace(/\s+/g, "");
        for (const s0 of repeats(length, part.from, part.every)) {
          const end = part.every ? Math.min(length, s0 + part.every) : length;
          for (let t = s0, i = 0; t < end - 1e-6; t += part.step, i++) {
            const ch = pat[i % pat.length];
            if (ch === "." ) continue;
            const v = (part.vel ?? 0.8) * (ch === "X" ? 1.15 : ch === "o" ? 0.6 : 0.9);
            if (name === "timp" || name === "timp5") {
              const c = at(spans, t).chord;
              const pc = name === "timp5" ? (c.root + 7) % 12 : c.root;
              push({ t, inst: "timp", midi: above(pc, 41) + tr - (above(pc, 41) + tr > 55 ? 12 : 0), dur: 2, vel: v });
            } else push({ t, inst: "perc", hit: name, midi: 0, dur: 1, vel: v });
          }
        }
      }
    }
  }
  if (p.swing) for (const e of ev) { const f = e.t % 1; if (Math.abs(f - 0.5) < 1e-6) e.t += p.swing * 0.5; }
  ev.sort((a, b) => a.t - b.t);
  return { events: ev, length };
}

/** Every instrument bank a piece needs. */
export function banksOf(p: Piece): string[] {
  const s = new Set<string>();
  for (const part of p.parts) {
    if ("pad" in part) part.pad.forEach((i) => s.add(i));
    else if ("drums" in part) for (const k of Object.keys(part.drums)) s.add(k.startsWith("timp") ? "timp" : "perc");
    else s.add(part.inst);
  }
  return [...s];
}
