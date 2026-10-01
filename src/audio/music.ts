import { applySettings, audioCtx, buses, mtof, noise, onAudioReady, settings, tone } from "./engine";

/**
 * Generative background music. A theme is a tempo, a key and mode, a chord progression and a
 * set of instruments (pad, plucked melody, bell, bass, drums). Melodies are phrases of four
 * bars generated from a seed and repeated with variations, so each place has its own tune.
 */
interface Theme {
  bpm: number;
  root: number; // MIDI note
  mode: number[];
  prog: number[]; // scale degree of each bar's chord
  pad?: { lp: number; gain: number };
  lead?: { density: number; oct: number; type: OscillatorType; gain: number; len?: number };
  bell?: number; // chance per bar
  bass?: "drone" | "pulse" | "eighths" | "octaves";
  drums?: "soft" | "heart" | "battle" | "boss";
  seed: number;
}

const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

const FAMILY_KEY: Record<string, [number, number[]]> = {
  forest: [57, DORIAN], desert: [52, PHRYGIAN], swamp: [55, AEOLIAN], tundra: [59, AEOLIAN], fungal: [54, DORIAN], volcano: [52, HARMONIC],
  reef: [58, DORIAN], bamboo: [60, [0, 2, 4, 7, 9, 12, 14]], crystal: [61, IONIAN], autumn: [57, AEOLIAN], ruins: [55, PHRYGIAN],
  sakura: [62, [0, 2, 4, 7, 9, 12, 14]], bonewaste: [50, PHRYGIAN], jungle: [56, DORIAN], glacier: [60, AEOLIAN],
};

export function themeFor(name: string): Theme {
  if (name === "title") return { bpm: 66, root: 62, mode: IONIAN, prog: [0, 5, 3, 4], pad: { lp: 1300, gain: 0.03 }, lead: { density: 0.22, oct: 12, type: "triangle", gain: 0.05, len: 3 }, bell: 0.5, bass: "drone", seed: 11 };
  if (name === "sanctuary") return { bpm: 88, root: 60, mode: IONIAN, prog: [0, 4, 5, 3], pad: { lp: 1500, gain: 0.025 }, lead: { density: 0.42, oct: 12, type: "triangle", gain: 0.055 }, bell: 0.25, bass: "pulse", drums: "soft", seed: 27 };
  if (name === "battle") return { bpm: 136, root: 57, mode: AEOLIAN, prog: [0, 5, 6, 4], pad: { lp: 900, gain: 0.018 }, lead: { density: 0.7, oct: 12, type: "square", gain: 0.03, len: 1 }, bass: "eighths", drums: "battle", seed: 41 };
  if (name === "boss") return { bpm: 146, root: 52, mode: HARMONIC, prog: [0, 5, 1, 4], pad: { lp: 800, gain: 0.022 }, lead: { density: 0.6, oct: 12, type: "sawtooth", gain: 0.022, len: 1 }, bass: "octaves", drums: "boss", seed: 53 };
  if (name.startsWith("dungeon:")) {
    const fam = name.slice(8);
    const [root, mode] = FAMILY_KEY[fam] ?? [57, AEOLIAN];
    let h = 7; for (const c of fam) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { bpm: 70 + (h % 14), root, mode, prog: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 4], [0, 4, 5, 3]][h % 4], pad: { lp: 750, gain: 0.03 }, lead: { density: 0.2, oct: 0, type: "triangle", gain: 0.05, len: 4 }, bell: 0.3, bass: "drone", drums: h % 3 === 0 ? "heart" : undefined, seed: h };
  }
  return themeFor("sanctuary");
}

// ------------------------------------------------------------ player
let current = "";
let theme: Theme | null = null;
let timer = 0;
let nextT = 0;
let step = 0;
let phrase: (number | null)[] = [];
let rngS = 1;
const rnd = () => { rngS = (rngS * 1664525 + 1013904223) >>> 0; return rngS / 4294967296; };

const noteOf = (t: Theme, degree: number, oct = 0) => {
  const n = t.mode.length;
  const d = ((degree % n) + n) % n;
  return t.root + t.mode[d] + 12 * (Math.floor(degree / n) + oct / 12);
};

function makePhrase(t: Theme) {
  rngS = t.seed * 9973 + 1;
  const out: (number | null)[] = [];
  const lead = t.lead;
  for (let bar = 0; bar < 4; bar++) {
    const chord = t.prog[bar % t.prog.length];
    for (let s = 0; s < 16; s++) {
      const strong = s % 4 === 0;
      const p = lead ? lead.density * (strong ? 1.4 : s % 2 === 0 ? 0.8 : 0.35) : 0;
      if (rnd() < p) {
        // chord tones on strong beats, scale steps in between
        const deg = strong ? chord + [0, 2, 4][Math.floor(rnd() * 3)] : chord + Math.floor(rnd() * 6) - 1;
        out.push(deg + 7);
      } else out.push(null);
    }
  }
  return out;
}

function schedule(t: Theme, s: number, at: number) {
  const spb = 60 / t.bpm, six = spb / 4;
  const bar = Math.floor(s / 16), inBar = s % 16;
  const chord = t.prog[bar % t.prog.length];
  const rel = Math.max(0, at - (audioCtx()?.currentTime ?? 0));
  const o = { bus: "music" as const, at: rel };
  // pad: the bar's chord, swelling
  if (t.pad && inBar === 0) for (const d of [0, 2, 4]) {
    const f = mtof(noteOf(t, chord + d, -12));
    tone(f, spb * 4.1, { ...o, type: "sawtooth", gain: t.pad.gain, lp: t.pad.lp, attack: spb * 1.2, release: spb * 1.6, detune: 7 });
    tone(f, spb * 4.1, { ...o, type: "sawtooth", gain: t.pad.gain * 0.8, lp: t.pad.lp, attack: spb * 1.2, release: spb * 1.6, detune: -7 });
  }
  // melody: the phrase, with an occasional variation on its second time round
  const lead = t.lead;
  if (lead) {
    let n = phrase[s % phrase.length];
    if (n !== null && bar % 8 >= 4 && rnd() < 0.25) n += rnd() < 0.5 ? 1 : -1;
    if (n !== null) tone(mtof(noteOf(t, n, lead.oct)), six * (lead.len ?? 2) * 1.6, { ...o, type: lead.type, gain: lead.gain, lp: lead.type === "triangle" ? 5000 : 2600, attack: 0.008, release: six * (lead.len ?? 2) });
  }
  if (t.bell && inBar === 8 && rnd() < t.bell) {
    const f = mtof(noteOf(t, chord + 4, 24));
    for (const [m, g] of [[1, 0.03], [2.76, 0.012], [5.4, 0.006]] as const) tone(f * m, 2.4, { ...o, type: "sine", gain: g, release: 2.2 });
  }
  // bass
  const bf = mtof(noteOf(t, chord, -24));
  if (t.bass === "drone" && inBar === 0) tone(bf, spb * 4, { ...o, type: "sine", gain: 0.08, attack: spb, release: spb * 1.5 });
  if (t.bass === "pulse" && inBar % 4 === 0) tone(bf, spb * 0.9, { ...o, type: "triangle", gain: 0.08, release: spb * 0.6 });
  if (t.bass === "eighths" && inBar % 2 === 0) tone(bf, six * 1.8, { ...o, type: "sawtooth", gain: 0.05, lp: 420, release: six });
  if (t.bass === "octaves" && inBar % 2 === 0) tone(inBar % 4 === 0 ? bf : bf * 2, six * 1.8, { ...o, type: "sawtooth", gain: 0.055, lp: 500, release: six });
  // drums
  const kick = (g = 0.22) => tone(140, 0.16, { ...o, type: "sine", gain: g, slide: 42 });
  const snare = (g = 0.08) => { noise(0.12, { ...o, filter: "bandpass", freq: 1900, gain: g }); tone(190, 0.08, { ...o, type: "triangle", gain: g * 0.6 }); };
  const hat = (g = 0.03) => noise(0.03, { ...o, filter: "highpass", freq: 7500, gain: g });
  if (t.drums === "soft") { if (inBar === 0) kick(0.1); if (inBar % 2 === 0) hat(0.014 + (inBar % 4 === 2 ? 0.01 : 0)); }
  if (t.drums === "heart" && (inBar === 0 || inBar === 3)) tone(70, 0.2, { ...o, type: "sine", gain: inBar === 0 ? 0.12 : 0.08, slide: 40 });
  if (t.drums === "battle") { if (inBar === 0 || inBar === 8 || inBar === 10) kick(); if (inBar === 4 || inBar === 12) snare(); if (inBar % 2 === 0) hat(); }
  if (t.drums === "boss") {
    if (inBar % 4 === 0 || inBar === 6 || inBar === 14) kick(0.26);
    if (inBar === 4 || inBar === 12) snare(0.1);
    if (inBar % 2 === 1) hat(0.025);
    if (inBar === 15) for (const [i, f] of [[0, 160], [1, 120]] as const) tone(f, 0.15, { ...o, at: rel + i * six * 0.5, type: "sine", gain: 0.14, slide: f * 0.6 });
  }
}

function tick() {
  const ctx = audioCtx();
  if (!ctx || !theme || ctx.state !== "running") return;
  const six = 60 / theme.bpm / 4;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.3) {
    schedule(theme, step, nextT);
    nextT += six;
    step++;
  }
}

/** Switches the background music to a theme ("title", "sanctuary", "dungeon:<family>", "battle", "boss"). */
export function playMusic(name: string) {
  if (name === current) return;
  current = name;
  onAudioReady(() => {
    if (current !== name) return;
    const ctx = audioCtx()!;
    const bus = buses().music;
    // fade the old tune out, then start the new one from its first bar
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    window.clearInterval(timer);
    window.setTimeout(() => {
      if (current !== name) return;
      theme = themeFor(name);
      phrase = makePhrase(theme);
      step = 0;
      nextT = ctx.currentTime + 0.08;
      applySettings();
      timer = window.setInterval(tick, 90);
      tick();
    }, 450);
  });
}

export const currentMusic = () => current;
export const musicOn = () => settings.music;
