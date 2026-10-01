import { describe, expect, it } from "vitest";
import { banksOf, chordsLength, compile, lineLength, parseChord } from "../src/audio/score";
import { ALL_PIECES, REGION_FAMILIES, pieceFor } from "../src/audio/themes";
import bankJson from "../public/audio/banks.json";

const banks = bankJson as Record<string, { k: number | string }[]>;

describe("soundtrack", () => {
  const regions = Object.fromEntries(REGION_FAMILIES.map((f) => [`dungeon:${f}`, pieceFor(`dungeon:${f}`)]));
  for (const [name, p] of Object.entries({ ...ALL_PIECES, ...regions })) {
    it(`${name}: lines fit the bars, every chord parses, every note is playable`, () => {
      const len = chordsLength(p.chords);
      expect(len % p.meter).toBe(0);
      for (const part of p.parts) {
        if (!("line" in part)) continue;
        const l = lineLength(part.line);
        // a line either fills the piece from where it starts, or loops evenly inside it
        const room = len - (part.from ?? 0);
        expect(Math.abs(l - room) < 0.01 || (part.every ?? 0) >= l - 0.01 || Math.abs(len / l - Math.round(len / l)) < 0.01, `${name} line of ${l} beats in ${room}`).toBe(true);
      }
      const { events } = compile(p);
      expect(events.length).toBeGreaterThan(10);
      for (const b of banksOf(p)) expect(banks[b], b).toBeTruthy();
      for (const e of events) {
        if (e.inst === "perc") { expect(banks.perc.some((x) => x.k === e.hit), e.hit).toBe(true); continue; }
        const keys = banks[e.inst].map((x) => x.k as number);
        const nearest = Math.min(...keys.map((k) => Math.abs(k - e.midi)));
        // re-pitching a recording more than a fifth sounds wrong
        expect(nearest, `${name}: ${e.inst} note ${e.midi} (recorded ${Math.min(...keys)}..${Math.max(...keys)})`).toBeLessThanOrEqual(7);
      }
    });
  }

  it("every region of the abyss has music, in its own key", () => {
    for (const fam of REGION_FAMILIES) expect(compile(pieceFor(`dungeon:${fam}`)).events.length).toBeGreaterThan(10);
    expect(pieceFor("dungeon:forest").transpose).not.toBe(pieceFor("dungeon:bamboo").transpose);
  });

  it("chord symbols", () => {
    expect(parseChord("F#m7/A")).toEqual({ root: 6, tones: [0, 3, 7, 10], bass: 9 });
    expect(parseChord("Bb").root).toBe(10);
    expect(parseChord("A7sus4").tones).toEqual([0, 5, 7, 10]);
  });
});
