import { audioCtx, noise, settings, tone } from "./engine";

/**
 * The game's sound effects, each a few synthesised voices. `sfx(name)` is safe to call from
 * anywhere: it does nothing before the first tap, while muted, or in a hidden tab.
 */
type El = "physical" | "fire" | "ice" | "lightning" | "water" | "earth" | "wind" | "light" | "dark" | "poison" | "arcane" | string;
const r = (a: number, b: number) => a + Math.random() * (b - a);

const LIB: Record<string, (arg?: string) => void> = {
  // ---------------------------------------------------------------- interface
  click: () => tone(r(1500, 1650), 0.035, { type: "triangle", gain: 0.06, slide: 1100 }),
  open: () => { tone(520, 0.07, { type: "sine", gain: 0.07 }); tone(780, 0.1, { type: "sine", gain: 0.06, at: 0.05 }); },
  close: () => tone(700, 0.09, { type: "sine", gain: 0.06, slide: 380 }),
  notify: () => { tone(880, 0.12, { type: "sine", gain: 0.08 }); tone(1320, 0.18, { type: "sine", gain: 0.07, at: 0.08 }); },
  good: () => { tone(784, 0.1, { type: "triangle", gain: 0.08 }); tone(1046, 0.16, { type: "triangle", gain: 0.08, at: 0.07 }); },
  error: () => { tone(180, 0.12, { type: "square", gain: 0.05, lp: 900 }); tone(140, 0.16, { type: "square", gain: 0.05, lp: 900, at: 0.09 }); },
  blip: (base) => tone((Number(base) || 420) * r(0.94, 1.08), 0.035, { type: "square", gain: 0.022, lp: 2200 }),
  // ---------------------------------------------------------------- world
  step: () => noise(0.05, { filter: "lowpass", freq: r(500, 800), gain: 0.05 }),
  coin: () => { tone(988, 0.06, { type: "square", gain: 0.05, lp: 4000 }); tone(1319, 0.22, { type: "square", gain: 0.05, lp: 4000, at: 0.06 }); },
  pickup: () => { tone(660, 0.07, { type: "triangle", gain: 0.08 }); tone(990, 0.12, { type: "triangle", gain: 0.08, at: 0.06 }); },
  chest: () => {
    noise(0.12, { filter: "lowpass", freq: 400, gain: 0.18 });
    tone(90, 0.15, { type: "sine", gain: 0.15, slide: 50 });
    [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.25, { type: "triangle", gain: 0.06, at: 0.12 + i * 0.06 }));
  },
  stairs: () => { noise(0.6, { filter: "lowpass", freq: 2400, to: 200, gain: 0.16, attack: 0.08 }); tone(110, 0.6, { type: "sine", gain: 0.12, slide: 55, at: 0.1 }); },
  transition: () => {
    noise(0.55, { filter: "lowpass", freq: 3200, to: 180, gain: 0.18, attack: 0.1 });
    tone(220, 0.5, { type: "sine", gain: 0.1, slide: 70, at: 0.05 });
    [523, 659, 784].forEach((f, i) => tone(f * 2, 0.9, { type: "sine", gain: 0.025, at: 0.5 + i * 0.09 }));
  },
  encounter: (kind) => {
    const boss = kind === "boss";
    noise(0.25, { filter: "highpass", freq: 2500, gain: 0.12 });
    const root = boss ? 73 : 110;
    for (const m of boss ? [1, 1.06, 1.5] : [1, 1.19, 1.5]) tone(root * m, boss ? 0.9 : 0.55, { type: "sawtooth", gain: 0.06, lp: 1800, at: 0.05 });
    tone(boss ? 55 : 82, 0.5, { type: "sine", gain: 0.2, slide: 35, at: 0.05 });
    if (!boss) tone(880, 0.25, { type: "square", gain: 0.035, at: 0.2, lp: 3000, slide: 1320 });
  },
  // ---------------------------------------------------------------- combat
  whoosh: () => noise(0.16, { filter: "bandpass", freq: 700, to: 2600, gain: 0.08, q: 1.2, attack: 0.04 }),
  slash: () => { noise(0.12, { filter: "bandpass", freq: 3000, to: 700, gain: 0.16, q: 0.9 }); tone(140, 0.12, { type: "sine", gain: 0.16, slide: 55 }); },
  hit: () => { noise(0.07, { filter: "lowpass", freq: 1800, gain: 0.16 }); tone(r(150, 180), 0.12, { type: "sine", gain: 0.18, slide: 50 }); },
  crit: () => {
    noise(0.1, { filter: "highpass", freq: 1500, gain: 0.2 });
    tone(120, 0.22, { type: "sine", gain: 0.26, slide: 40 });
    tone(1500, 0.3, { type: "square", gain: 0.05, slide: 900, lp: 5000 });
  },
  miss: () => noise(0.18, { filter: "bandpass", freq: 900, to: 2200, gain: 0.06, attack: 0.05 }),
  bow: () => { tone(260, 0.12, { type: "triangle", gain: 0.1, slide: 180 }); noise(0.18, { filter: "bandpass", freq: 2400, to: 4000, gain: 0.05, at: 0.03 }); },
  cast: (el) => castSound(el),
  impact: (el) => impactSound(el),
  heal: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: "triangle", gain: 0.06, at: i * 0.06 })),
  mana: () => [659, 880, 1175].forEach((f, i) => tone(f, 0.28, { type: "sine", gain: 0.06, at: i * 0.05 })),
  buff: () => tone(440, 0.3, { type: "triangle", gain: 0.07, slide: 880 }),
  debuff: () => tone(520, 0.32, { type: "sawtooth", gain: 0.04, slide: 200, lp: 1600 }),
  shield: () => tone(1200, 0.12, { type: "triangle", gain: 0.05, slide: 1600 }),
  break: () => {
    noise(0.35, { filter: "highpass", freq: 3000, gain: 0.2 });
    for (let i = 0; i < 6; i++) tone(r(2000, 5000), r(0.08, 0.2), { type: "square", gain: 0.025, at: r(0, 0.12), lp: 7000 });
    tone(90, 0.3, { type: "sine", gain: 0.2, slide: 40 });
  },
  charge: () => { tone(110, 0.8, { type: "sawtooth", gain: 0.05, slide: 330, lp: 1400, vibrato: 12 }); noise(0.8, { filter: "bandpass", freq: 300, to: 1800, gain: 0.05, attack: 0.3 }); },
  death: () => { tone(320, 0.45, { type: "sawtooth", gain: 0.06, slide: 55, lp: 1200 }); noise(0.4, { filter: "lowpass", freq: 900, to: 200, gain: 0.1 }); },
  spawn: () => { tone(60, 0.5, { type: "sine", gain: 0.2, slide: 90 }); noise(0.4, { filter: "lowpass", freq: 300, gain: 0.12 }); },
  revive: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, { type: "sine", gain: 0.06, at: i * 0.07 })),
  victory: () => {
    const seq: [number, number, number][] = [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1046, 0.36, 0.5]];
    for (const [f, at, d] of seq) { tone(f, d, { type: "square", gain: 0.05, at, lp: 3500 }); tone(f / 2, d, { type: "triangle", gain: 0.06, at }); }
    tone(131, 0.9, { type: "triangle", gain: 0.08, at: 0.36 });
  },
  defeat: () => [440, 415, 349, 262].forEach((f, i) => tone(f, 0.45, { type: "triangle", gain: 0.07, at: i * 0.22, lp: 1800 })),
  levelup: () => {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.28, { type: "square", gain: 0.04, at: i * 0.07, lp: 4000 }));
    [2093, 2637, 3136].forEach((f, i) => tone(f, 0.6, { type: "sine", gain: 0.03, at: 0.45 + i * 0.05 }));
    tone(262, 0.8, { type: "triangle", gain: 0.08, at: 0.35 });
  },
  // ---------------------------------------------------------------- sanctuary
  build: () => { for (const at of [0, 0.16, 0.3]) { noise(0.06, { filter: "lowpass", freq: 900, gain: 0.2, at }); tone(r(170, 200), 0.08, { type: "sine", gain: 0.12, slide: 90, at }); } },
  demolish: () => { noise(0.5, { filter: "lowpass", freq: 700, to: 150, gain: 0.22 }); tone(70, 0.4, { type: "sine", gain: 0.15, slide: 40 }); },
  harvest: () => { tone(500, 0.08, { type: "sine", gain: 0.1, slide: 900 }); tone(1100, 0.12, { type: "triangle", gain: 0.05, at: 0.06 }); },
  plant: () => { noise(0.1, { filter: "lowpass", freq: 600, gain: 0.08 }); tone(330, 0.1, { type: "sine", gain: 0.06, at: 0.04 }); },
  water: () => { noise(0.3, { filter: "bandpass", freq: 1800, to: 900, gain: 0.08, q: 2 }); for (let i = 0; i < 3; i++) tone(r(700, 1200), 0.06, { type: "sine", gain: 0.04, at: 0.05 + i * 0.06, slide: r(1300, 1800) }); },
  craft: () => {
    for (const at of [0, 0.18]) for (const m of [1, 2.76, 5.4]) tone(620 * m, 0.4, { type: "sine", gain: 0.05 / m, at });
    noise(0.05, { filter: "highpass", freq: 2000, gain: 0.08 });
  },
  enhance: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, { type: "triangle", gain: 0.06, at: i * 0.05 })); noise(0.3, { filter: "highpass", freq: 5000, gain: 0.05, at: 0.2 }); },
  fail: () => { tone(300, 0.35, { type: "sawtooth", gain: 0.06, slide: 90, lp: 1200 }); noise(0.2, { filter: "lowpass", freq: 600, gain: 0.1 }); },
  gift: () => [1046, 1318, 1568].forEach((f, i) => tone(f, 0.3, { type: "sine", gain: 0.05, at: i * 0.08 })),
  sleep: () => [784, 659, 523, 392].forEach((f, i) => tone(f, 0.6, { type: "sine", gain: 0.05, at: i * 0.28 })),
};

const ELC: Record<string, number> = { fire: 180, ice: 1600, lightning: 900, water: 500, earth: 90, wind: 700, light: 880, dark: 110, poison: 300, arcane: 520, physical: 300 };

function castSound(el: El = "arcane") {
  const f = ELC[el] ?? 520;
  switch (el) {
    case "fire": noise(0.4, { filter: "lowpass", freq: 600, to: 2400, gain: 0.14, attack: 0.08 }); tone(f, 0.35, { type: "sawtooth", gain: 0.04, slide: 420, lp: 1500 }); break;
    case "ice": for (let i = 0; i < 4; i++) tone(f * r(0.9, 1.3), 0.25, { type: "sine", gain: 0.04, at: i * 0.05 }); noise(0.3, { filter: "highpass", freq: 6000, gain: 0.05 }); break;
    case "lightning": for (let i = 0; i < 5; i++) noise(0.04, { filter: "highpass", freq: 2500, gain: 0.14, at: i * 0.045 }); tone(f, 0.2, { type: "square", gain: 0.04, slide: 1800, lp: 4000 }); break;
    case "water": for (let i = 0; i < 4; i++) tone(r(300, 700), 0.1, { type: "sine", gain: 0.06, at: i * 0.06, slide: r(800, 1300) }); break;
    case "earth": tone(f, 0.4, { type: "sine", gain: 0.2, slide: 50 }); noise(0.35, { filter: "lowpass", freq: 400, gain: 0.15 }); break;
    case "wind": noise(0.45, { filter: "bandpass", freq: 500, to: 2500, gain: 0.12, q: 2, attack: 0.12 }); break;
    case "light": [880, 1108, 1318].forEach((x, i) => tone(x, 0.4, { type: "triangle", gain: 0.05, at: i * 0.04, slide: x * 1.5 })); break;
    case "dark": tone(f, 0.5, { type: "sawtooth", gain: 0.06, slide: 55, lp: 700, detune: 15 }); tone(f * 1.5, 0.5, { type: "sawtooth", gain: 0.04, slide: 70, lp: 700, detune: -15 }); break;
    case "poison": for (let i = 0; i < 4; i++) tone(r(200, 380), 0.12, { type: "sine", gain: 0.06, at: i * 0.07, slide: r(400, 600) }); break;
    default: tone(400, 0.35, { type: "sine", gain: 0.07, slide: 1200, vibrato: 20 }); tone(800, 0.3, { type: "triangle", gain: 0.03, slide: 1600, at: 0.05 });
  }
}

function impactSound(el: El = "physical") {
  if (el === "physical" || !ELC[el]) return LIB.hit();
  const f = ELC[el];
  noise(0.14, { filter: el === "earth" || el === "dark" ? "lowpass" : "bandpass", freq: f * 2, gain: 0.14 });
  tone(f, 0.16, { type: el === "ice" || el === "light" ? "triangle" : "sine", gain: 0.12, slide: f * 0.5 });
}

const last = new Map<string, number>();
let lastAny = 0;
/** True if an effect played in the last `ms` (so a generic notification can stay quiet). */
export const recentSfx = (ms: number) => performance.now() - lastAny < ms;
const MIN_GAP: Record<string, number> = { click: 40, step: 120, blip: 45, hit: 30, coin: 60, shield: 80, whoosh: 60 };

/** Plays a named effect (optionally with an element / kind / pitch argument). */
export function sfx(name: string, arg?: string) {
  if (!settings.sfx || !audioCtx() || document.hidden) return;
  const now = performance.now();
  const gap = MIN_GAP[name] ?? 0;
  if (gap && now - (last.get(name) ?? 0) < gap) return;
  last.set(name, now);
  if (name !== "click" && name !== "blip" && name !== "step") lastAny = now;
  try { LIB[name]?.(arg); } catch { /* audio is never worth a crash */ }
}
