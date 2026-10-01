import type { Piece } from "./score";

/**
 * The soundtrack. Each piece is written out: a chord progression, melodies and the parts
 * that accompany them, played by the recorded chamber orchestra (see sampler.ts).
 */

// ------------------------------------------------------------ title: "Khúc Dạo Đầu"
const TITLE: Piece = {
  bpm: 72, meter: 4,
  chords: "D A/C# Bm F#m/A G D/F# Em7 A | G A F#m Bm Em7 A7sus4 Dmaj7 A",
  parts: [
    { arp: "0 2 3 4 5 4 3 2", inst: "harp", step: 0.5, oct: 3, vel: 0.42, ring: 3 },
    { pad: ["cellos", "violas", "violins"], oct: 4, vel: 0.28 },
    { bass: "x", inst: "basses", step: 4, oct: 2, vel: 0.5 },
    {
      inst: "solovln", vel: 0.72,
      line: "F#5/1.5 E5/0.5 D5/1 A4/1 | B4/1 C#5/1 E5/2 | D5/1.5 C#5/0.5 B4/1 F#4/1 | A4/3 r/1 |"
        + " B4/1.5 C#5/0.5 D5/1 G5/1 | F#5/1.5 E5/0.5 D5/2 | E5/1 G5/1 F#5/1 E5/1 | E5/3 r/1 |"
        + " B4/1 D5/1 G5/1.5 F#5/0.5 | E5/1 C#5/1 A4/2 | C#5/1.5 D5/0.5 E5/1 F#5/1 | F#5/1 B5/2 A5/1 |"
        + " G5/1.5 F#5/0.5 E5/1 D5/1 | D5/1 E5/1 A4/2 | F#5/2 E5/1 C#5/1 | E5/2 r/2",
    },
    { inst: "flute", vel: 0.42, from: 32, line: "r/1 D6/3 | C#6/4 | A5/4 | B5/4 | B5/4 | A5/4 | A5/4 | A5/4" },
    { inst: "horn", vel: 0.5, from: 32, line: "D4/4 | C#4/4 | C#4/4 | D4/4 | B3/4 | A3/4 | A3/4 | A3/4" },
    { arp: "3 . 4 .", inst: "glock", step: 2, oct: 6, vel: 0.28 },
    { drums: { timp: "x..............." }, step: 1, vel: 0.4 },
    { drums: { swell: "x" }, step: 64, from: 27.5, vel: 0.45 },
  ],
};

// ------------------------------------------------------------ sanctuary: a waltz
const SANCTUARY: Piece = {
  bpm: 104, meter: 3,
  chords: "F:3 C/E:3 Dm:3 Bb:3 F/A:3 Gm7:3 C7:3 F:3 | F:3 C/E:3 Dm:3 Bb:3 Gm:3 C:3 F:3 C7:3 | Bb:3 C:3 Am:3 Dm:3 Gm7:3 C:3 F:3 C7:3",
  parts: [
    { bass: "x..", inst: "harp", step: 1, oct: 2, vel: 0.6 },
    { arp: ". 1 1", inst: "pizz", step: 1, oct: 4, vel: 0.5 },
    { arp: ". 2 2", inst: "pizz", step: 1, oct: 4, vel: 0.45 },
    { pad: ["cellos", "violas"], oct: 3, vel: 0.26 },
    {
      inst: "oboe", vel: 0.7, every: 72,
      line: "C5/1 F5/1 A5/1 | G5/2 E5/1 | F5/1 D5/1 A4/1 | Bb4/2 D5/1 | C5/1 A4/1 C5/1 | Bb4/1 D5/1 F5/1 | E5/1.5 D5/0.5 C5/1 | F4/3",
    },
    {
      inst: "flute", vel: 0.62, from: 24, every: 72,
      line: "C5/1 F5/1 A5/1 | G5/2 E5/1 | F5/1 D5/1 A4/1 | Bb4/2 D5/1 | Bb4/1 D5/1 G5/1 | E5/2 G5/1 | F5/3 | r/1 C5/1 E5/1",
    },
    {
      inst: "clarinet", vel: 0.66, from: 48, every: 72,
      line: "D5/1.5 C5/0.5 Bb4/1 | E5/1.5 D5/0.5 C5/1 | A4/1 C5/1 E5/1 | F5/2 D5/1 | Bb4/1 D5/1 F5/1 | E5/1 G5/1 E5/1 | F5/2 A4/1 | G4/1 Bb4/1 E5/1",
    },
    { inst: "violins", vel: 0.32, from: 48, every: 72, line: "D5/3 | E5/3 | E5/3 | F5/3 | F5/3 | E5/3 | F5/3 | E5/3" },
    { arp: ". . . . . . . . . . . 5", inst: "glock", step: 1, oct: 5, vel: 0.22 },
    { drums: { shaker: ".oo", tri: "x.. ... ... ... ... ... ... ..." }, step: 1, vel: 0.3 },
  ],
};

// ------------------------------------------------------------ the abyss, one mood per kind of region
const FOREST: Piece = {
  bpm: 84, meter: 4,
  chords: "Dm C Dm Am Dm C Bb C | Gm Am Bb C Dm Am Bb C",
  parts: [
    { arp: "0 2 3 4 3 2 1 2", inst: "harp", step: 0.5, oct: 3, vel: 0.45, ring: 3 },
    { pad: ["cellos", "violas"], oct: 3, vel: 0.26 },
    {
      inst: "flute", vel: 0.6, every: 64,
      line: "A4/1.5 D5/0.5 E5/1 F5/1 | E5/3 C5/1 | D5/1.5 E5/0.5 F5/1 A5/1 | G5/2 E5/2 | F5/1 E5/1 D5/1 A4/1 | G4/1 A4/1 C5/1 E5/1 | D5/2 F5/1 E5/1 | E5/3 r/1",
    },
    {
      inst: "clarinet", vel: 0.58, from: 32, every: 64,
      line: "Bb4/1.5 A4/0.5 G4/1 D5/1 | C5/2 E5/2 | D5/1.5 C5/0.5 Bb4/1 F5/1 | E5/2 G5/2 | A5/1.5 G5/0.5 F5/1 E5/1 | E5/2 C5/1 A4/1 | Bb4/2 D5/1 F5/1 | E5/2 r/2",
    },
    { arp: ". . . . 2 . . . . . . . . . 1 .", inst: "pizz", step: 0.5, oct: 4, vel: 0.35 },
    { drums: { tri: "x......." }, step: 4, vel: 0.25 },
  ],
};

const COLD: Piece = {
  bpm: 66, meter: 4,
  chords: "Em Cmaj7 Am7 B7sus4 Em Cmaj7 Am7 Bm | Cmaj7 D Bm Em Am7 D Cmaj7 B7sus4",
  parts: [
    { arp: "3 4 5 6 5 4", inst: "piano", step: 0.5, oct: 4, vel: 0.32, ring: 4 },
    { arp: "5 . . . . . . .", inst: "glock", step: 0.5, oct: 5, vel: 0.2 },
    { pad: ["cellos", "violas", "violins"], oct: 4, vel: 0.24 },
    {
      inst: "solovln", vel: 0.66,
      line: "B4/3 E5/1 | G5/2 F#5/1 E5/1 | E5/4 | r/2 E5/1 F#5/1 | G5/3 B5/1 | B5/2 A5/1 G5/1 | A5/2 E5/2 | F#5/3 r/1 |"
        + " E5/2 G5/2 | F#5/2 A5/2 | B5/3 A5/1 | G5/4 | C6/2 B5/1 A5/1 | A5/2 F#5/2 | G5/2 E5/1 D5/1 | E5/2 r/2",
    },
    { drums: { tri: "x......." }, step: 1, vel: 0.28 },
  ],
};

const DESERT: Piece = {
  bpm: 92, meter: 4,
  chords: "E F E Dm E F G E | Am G F E Am Dm F E",
  parts: [
    { arp: "0 . 2 1 . 2 0 .", inst: "marimba", step: 0.5, oct: 3, vel: 0.5 },
    { bass: "x.......", inst: "cellos", step: 0.5, oct: 2, vel: 0.45 },
    { drums: { log_lo: "x..x..x.", log_hi: "....x..x", tamb: "..o...o." }, step: 0.5, vel: 0.45 },
    {
      inst: "oboe", vel: 0.68, every: 64,
      line: "E5/1 F5/0.5 G#5/0.5 A5/1 G#5/1 | F5/1.5 E5/0.5 F5/2 | G#5/0.5 A5/0.5 B5/1 A5/0.5 G#5/0.5 F5/1 | E5/3 r/1 |"
        + " B4/1 E5/1 F5/1 G#5/1 | A5/2 G#5/0.5 F5/0.5 E5/1 | D5/1 F5/1 E5/0.5 D5/0.5 C5/1 | B4/3 r/1",
    },
    {
      inst: "clarinet", vel: 0.62, from: 32, every: 64,
      line: "A4/1.5 B4/0.5 C5/1 E5/1 | D5/2 B4/2 | C5/1 A4/1 F5/1 E5/1 | E5/3 r/1 | C5/1 E5/1 A5/1.5 G#5/0.5 | A5/1 F5/1 D5/2 | C5/1 D5/1 E5/0.5 F5/0.5 D5/1 | E5/3 r/1",
    },
    { pad: ["violas"], oct: 3, vel: 0.2, from: 32 },
  ],
};

const MURKY: Piece = {
  bpm: 76, meter: 4,
  chords: "Gm Gm Eb D7 Gm Cm Eb D | Cm Gm/Bb Ab D7 Gm Eb Cm D7",
  parts: [
    { bass: "x.5.x.3.", inst: "pizz", step: 0.5, oct: 3, vel: 0.5, legato: 0.5 },
    { pad: ["cellos", "violas"], oct: 3, vel: 0.22 },
    {
      inst: "bassoon", vel: 0.7, legato: 0.75, every: 64,
      line: "G3/0.5 A3/0.5 Bb3/1 D4/1 r/1 | C4/0.5 Bb3/0.5 A3/1 G3/1 r/1 | Eb4/1 D4/0.5 C4/0.5 Bb3/1 G3/1 | F#3/2 A3/1 r/1 |"
        + " G3/0.5 A3/0.5 Bb3/1 D4/1 G4/1 | F4/0.5 Eb4/0.5 D4/1 C4/2 | Bb3/1 C4/1 Eb4/1 D4/1 | D4/3 r/1",
    },
    {
      inst: "clarinet", vel: 0.6, from: 32, every: 64,
      line: "Eb4/1.5 D4/0.5 C4/1 G4/1 | F4/2 D4/2 | Eb4/1 C4/1 Ab4/1.5 G4/0.5 | F#4/3 r/1 | Bb4/1.5 A4/0.5 G4/1 D4/1 | Eb4/1 G4/1 Bb4/2 | A4/1 G4/0.5 F#4/0.5 G4/1 Eb4/1 | D4/3 r/1",
    },
    { drums: { timp: "x..............." }, step: 0.5, vel: 0.35 },
  ],
};

const RUINS: Piece = {
  bpm: 70, meter: 4,
  chords: "Cm Ab Fm G Cm Ab Bb G | Ab Eb Fm Cm Ab Bb G7sus4 G",
  parts: [
    { arp: "0 2 3 4", inst: "piano", step: 1, oct: 3, vel: 0.34, ring: 3 },
    { pad: ["basses", "cellos", "violas"], oct: 3, vel: 0.28 },
    {
      inst: "horn", vel: 0.7, every: 64,
      line: "G3/2 C4/1.5 D4/0.5 | Eb4/3 C4/1 | F4/1.5 Eb4/0.5 C4/1 Ab3/1 | B3/3 r/1 | G3/1 C4/1 Eb4/1 G4/1 | Ab4/2 G4/1 Eb4/1 | F4/1.5 Eb4/0.5 D4/1 Bb3/1 | D4/3 r/1",
    },
    {
      inst: "violins", vel: 0.55, from: 32, every: 64,
      line: "C5/2 Eb5/2 | G5/3 F5/0.5 Eb5/0.5 | F5/2 Ab5/1 G5/1 | Eb5/3 r/1 | Eb5/1 F5/1 G5/1 Ab5/1 | F5/2 D5/2 | C5/2 D5/1 F5/1 | D5/3 r/1",
    },
    { arp: "0", inst: "bells", step: 16, oct: 4, vel: 0.4 },
    { drums: { gong: "x" }, step: 64, vel: 0.3 },
  ],
};

const WATER: Piece = {
  bpm: 80, meter: 4,
  chords: "Dmaj7 E/D Dmaj7 E/D Bm7 C#m7 Dmaj7 E | Gmaj7 A F#m7 Bm7 Gmaj7 A Dmaj7 E/D",
  parts: [
    { arp: "0 2 4 5 4 2", inst: "harp", step: 0.5, oct: 3, vel: 0.45, ring: 3 },
    { arp: "5 . . 4 . . 3 .", inst: "marimba", step: 0.5, oct: 4, vel: 0.28 },
    { pad: ["violas", "violins"], oct: 4, vel: 0.2 },
    {
      inst: "flute", vel: 0.6,
      line: "F#5/2 A5/1 C#6/1 | B5/3 G#5/1 | A5/1.5 F#5/0.5 E5/1 C#5/1 | D5/1 E5/1 G#5/2 | F#5/2 D5/1 A5/1 | G#5/2 E5/2 | F#5/1 E5/1 C#5/1 A4/1 | B4/3 r/1 |"
        + " B5/2 A5/1 F#5/1 | E5/2 C#5/2 | E5/1.5 F#5/0.5 A5/1 C#6/1 | B5/3 A5/1 | G5/1 F#5/1 D5/1 B4/1 | C#5/2 E5/2 | F#5/3 E5/1 | E5/2 r/2",
    },
    { drums: { tri: "x......." }, step: 2, vel: 0.22 },
  ],
};

/** Every region has a mood, and its own key so neighbouring regions do not sound the same. */
const REGION: Record<string, [Piece, number]> = {
  forest: [FOREST, 0], bamboo: [FOREST, 2], autumn: [FOREST, -2], jungle: [DESERT, 2], sakura: [WATER, 1],
  tundra: [COLD, 0], glacier: [COLD, 2], crystal: [COLD, 5],
  desert: [DESERT, 0], volcano: [RUINS, -3],
  swamp: [MURKY, 0], fungal: [MURKY, 3], bonewaste: [RUINS, -1],
  ruins: [RUINS, 1], reef: [WATER, -2],
};

// ------------------------------------------------------------ battle
const BATTLE: Piece = {
  bpm: 148, meter: 4,
  chords: "Am F G Am Am F G E | F G Em Am Dm E F E",
  parts: [
    { arp: "0 3 2 3 0 3 2 3", inst: "spic", step: 0.25, oct: 4, vel: 0.5, ring: 1 },
    { bass: "xxxxxxxx", inst: "cellospic", step: 0.5, oct: 2, vel: 0.55, legato: 0.6 },
    { bass: "x", inst: "basses", step: 4, oct: 1, vel: 0.55 },
    { bass: "x...........x...", inst: "trombone", step: 0.25, oct: 2, vel: 0.5, legato: 0.35 },
    { pad: ["violas"], oct: 3, vel: 0.26 },
    {
      inst: "trumpet", vel: 0.72, every: 64,
      line: "E5/1.5 A4/0.5 C5/1 E5/1 | F5/1.5 E5/0.5 C5/2 | D5/1 B4/1 G4/1 D5/1 | E5/3 r/1 | A5/1.5 G5/0.5 E5/1 C5/1 | C5/1 F5/1 A5/2 | G5/1 F5/0.5 E5/0.5 D5/1 B4/1 | G#4/3 r/1",
    },
    {
      inst: "violins", vel: 0.66, from: 32, every: 64,
      line: "C5/1.5 D5/0.5 F5/2 | D5/1.5 E5/0.5 G5/2 | B5/2 G5/1 E5/1 | A5/3 r/1 | F5/1.5 E5/0.5 D5/1 A5/1 | G#5/2 B5/2 | C6/1.5 B5/0.5 A5/1 F5/1 | E5/2 G#5/2",
    },
    { inst: "horn", vel: 0.55, line: "A3/4 | A3/4 | B3/4 | C4/4 | C4/4 | C4/4 | B3/4 | B3/4 | A3/4 | B3/4 | B3/4 | C4/4 | A3/4 | G#3/4 | A3/4 | G#3/4" },
    { drums: { kick: "X.....x...x.....", snare: "....X.......X...", timp: "x.......x......." }, step: 0.25, vel: 0.7 },
    { drums: { crash: "X" }, step: 32, vel: 0.6 },
    { drums: { snare_roll: "x" }, step: 64, from: 61, vel: 0.5 },
  ],
};

// ------------------------------------------------------------ guardians
const BOSS: Piece = {
  bpm: 156, meter: 4,
  chords: "Dm Bb Gm A Dm Bb Eb A7 | Gm Dm Bb A Gm Bb C A",
  parts: [
    { arp: "0 1 2 1 0 1 2 1", inst: "spic", step: 0.25, oct: 4, vel: 0.5, ring: 1 },
    { bass: "xxxxxxxx", inst: "cellospic", step: 0.5, oct: 2, vel: 0.6, legato: 0.6 },
    { bass: "x", inst: "basses", step: 4, oct: 1, vel: 0.6 },
    { bass: "x..x..x..x..x...", inst: "trombone", step: 0.25, oct: 2, vel: 0.5, legato: 0.3 },
    { pad: ["cellos", "violas", "violins"], oct: 4, vel: 0.3 },
    {
      inst: "horn", vel: 0.8, every: 64,
      line: "D3/1.5 F3/0.5 A3/1 D4/1 | F4/2 D4/1 Bb3/1 | G3/1 Bb3/1 D4/1 G4/1 | C#4/3 r/1 | A3/1 D4/1 E4/1 F4/1 | D4/2 F4/1 D4/1 | Eb4/1.5 D4/0.5 Bb3/1 G3/1 | A3/2 C#4/1 E4/1",
    },
    {
      inst: "trumpet", vel: 0.72, from: 32, every: 64,
      line: "D5/1.5 Bb4/0.5 G4/1 D5/1 | F5/2 E5/1 D5/1 | F5/1.5 G5/0.5 F5/1 D5/1 | E5/3 C#5/1 | G5/1.5 F5/0.5 D5/1 Bb4/1 | D5/1 F5/1 Bb5/2 | G5/1.5 F5/0.5 E5/1 C5/1 | A5/2 E5/1 C#5/1",
    },
    { drums: { kick: "X..x..x...x.x...", snare: "....X.......X..x", timp: "x.....x...x....." }, step: 0.25, vel: 0.75 },
    { drums: { crash: "X" }, step: 32, vel: 0.65 },
    { drums: { gong: "x" }, step: 64, vel: 0.55 },
    { drums: { swell: "x" }, step: 64, from: 59.5, vel: 0.5 },
    { arp: "0", inst: "bells", step: 32, oct: 4, vel: 0.45 },
  ],
};

// ------------------------------------------------------------ jingles (played once)
const VICTORY: Piece = {
  bpm: 120, meter: 4, once: true,
  chords: "C:3 F:1 G:1 C:3",
  parts: [
    { inst: "trumpet", vel: 0.85, line: "G4/0.333 G4/0.333 G4/0.334 C5/1 D5/0.5 E5/0.5 F5/1 G5/4" },
    { inst: "horn", vel: 0.7, line: "E3/0.333 E3/0.333 E3/0.334 G3/2 A3/1 B3/1 C4/3" },
    { bass: "x.......", inst: "trombone", step: 0.5, oct: 2, vel: 0.6 },
    { pad: ["cellos", "violas", "violins"], oct: 4, vel: 0.55 },
    { inst: "timp", vel: 0.75, line: "C3/0.333 C3/0.333 C3/0.334 r/3 G2/1 C3/3" },
    { inst: "harp", vel: 0.6, from: 4, line: "C4/0.1 E4/0.1 G4/0.1 C5/0.1 E5/0.1 G5/0.1 C6/0.1 E6/0.1 G6/3.2" },
    { drums: { crash: "X" }, step: 8, from: 5, vel: 0.7 },
  ],
};

const LEVELUP: Piece = {
  bpm: 100, meter: 3, once: true,
  chords: "D:2 G/D:1 D:3",
  parts: [
    { inst: "harp", vel: 0.62, line: "D4/0.1 F#4/0.1 A4/0.1 D5/0.1 F#5/0.1 A5/0.1 D6/0.1 F#6/0.1 A6/5.2" },
    { inst: "bells", vel: 0.55, line: "r/0.8 A4/1 D5/4.2" },
    { inst: "glock", vel: 0.32, line: "r/0.8 D6/0.2 F#6/0.2 A6/0.2 D7/4.6" },
    { pad: ["horn"], oct: 3, vel: 0.55 },
    { pad: ["cellos", "violas", "violins"], oct: 4, vel: 0.45 },
    { inst: "timp", vel: 0.6, line: "D3/6" },
    { drums: { cymbal: "x" }, step: 6, vel: 0.45 },
  ],
};

const DEFEAT: Piece = {
  bpm: 60, meter: 4, once: true,
  chords: "Dm:2 Bb:1 A:1 Dm:4",
  parts: [
    { inst: "oboe", vel: 0.62, line: "A4/1 G4/1 F4/1 E4/1 D4/4" },
    { pad: ["cellos", "violas"], oct: 3, vel: 0.36 },
    { inst: "harp", vel: 0.45, from: 4, line: "D3/0.25 A3/0.25 D4/0.25 F4/3.25" },
    { inst: "timp", vel: 0.4, line: "r/4 D3/4" },
  ],
};

export const THEMES: Record<string, Piece> = { title: TITLE, sanctuary: SANCTUARY, battle: BATTLE, boss: BOSS };
export const JINGLES: Record<string, Piece> = { victory: VICTORY, levelup: LEVELUP, defeat: DEFEAT };

/** "title", "sanctuary", "battle", "boss" or "dungeon:<region family>". */
export function pieceFor(name: string): Piece {
  if (THEMES[name]) return THEMES[name];
  if (name.startsWith("dungeon:")) {
    const [p, tr] = REGION[name.slice(8)] ?? [FOREST, 0];
    return { ...p, transpose: tr };
  }
  return SANCTUARY;
}

export const ALL_PIECES: Record<string, Piece> = { ...THEMES, forest: FOREST, cold: COLD, desert: DESERT, murky: MURKY, ruins: RUINS, water: WATER, ...JINGLES };
export const REGION_FAMILIES = Object.keys(REGION);
