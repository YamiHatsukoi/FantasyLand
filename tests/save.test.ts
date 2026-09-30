import { describe, expect, it } from "vitest";
import { ensureFloorState, migrate, newGame, packSave, sharedFloorSeed } from "../src/core/state";
import { decodeFog, encodeFog } from "../src/world/fog";

describe("compact saves", () => {
  it("fog run-length codec round-trips, and reads the old bitset format", () => {
    const size = 144 * 112;
    for (const density of [0, 0.02, 0.5, 1]) {
      const fog = new Uint8Array(size);
      for (let i = 0; i < size; i++) fog[i] = Math.random() < density ? 1 : 0;
      // plus a big explored blob, like real exploration
      if (density) fog.fill(1, 3000, 9000);
      expect(Array.from(decodeFog(encodeFog(fog), size))).toEqual(Array.from(fog));
    }
    const fog = new Uint8Array(size);
    fog.fill(1, 1000, 5000);
    const bytes = new Uint8Array(Math.ceil(size / 8));
    for (let i = 0; i < size; i++) if (fog[i]) bytes[i >> 3] |= 1 << (i & 7);
    const legacy = btoa(String.fromCharCode(...bytes));
    expect(Array.from(decodeFog(legacy, size))).toEqual(Array.from(fog));
    expect(encodeFog(fog).length).toBeLessThan(legacy.length / 20);
  });

  it("packing then migrating keeps NPC memories and the bag", () => {
    const g = newGame("An", "warrior", 1);
    g.npcs.a = { aff: 12, talks: 3, lastDay: 2, giftDay: 0, seen: ["g1", "chat4"], mem: [], questsDone: ["q1"] };
    g.npcs.b = { aff: 0, talks: 0, lastDay: 0, giftDay: 0, seen: [], mem: [], questsDone: [] };
    g.inventory.herb = 0;
    g.inventory.wood = 5;
    const packed = JSON.parse(JSON.stringify(packSave(g)));
    expect(packed.npcs.a.seen).toBe("g1,chat4");
    expect(packed.npcs.b).toEqual({});
    expect(packed.inventory.herb).toBeUndefined();
    const back = migrate(packed);
    expect(back.npcs.a).toEqual(g.npcs.a);
    expect(back.npcs.b).toEqual(g.npcs.b);
    expect(back.inventory.wood).toBe(5);
    // packing never touches the live game
    expect(Array.isArray(g.npcs.a.seen)).toBe(true);
  });
});

describe("compact floors", () => {
  it("cleared lists survive packing", () => {
    const g = newGame("An", "warrior", 1);
    g.floors[3] = { seed: 1, done: ["event_1", "chest_9"], fog: "", cleared: false };
    g.floors[4] = { seed: 2, done: [], fog: "", cleared: false };
    const back = migrate(JSON.parse(JSON.stringify(packSave(g))));
    expect(back.floors[3].done).toEqual(["event_1", "chest_9"]);
    expect(back.floors[4].done).toEqual([]);
    expect(g.floors[3].done).toEqual(["event_1", "chest_9"]);
  });
});

describe("shared floor maps", () => {
  it("gives every player the same seed on a new floor, and keeps floors already visited", () => {
    const a = newGame("A", "warrior", 111), b = newGame("B", "mage", 999);
    // an old floor from before maps became shared keeps its own seed and progress
    a.floors[1] = { seed: 424242, done: ["e3"], fog: "", cleared: false };
    expect(ensureFloorState(a, 1).fs.seed).toBe(424242);
    expect(ensureFloorState(a, 1).fs.shared).toBeUndefined();
    expect(ensureFloorState(b, 1).fs.seed).toBe(sharedFloorSeed(1));
    for (const n of [2, 5, 37]) {
      const fa = ensureFloorState(a, n), fb = ensureFloorState(b, n);
      expect(fa.fresh && fb.fresh).toBe(true);
      expect(fa.fs.seed).toBe(fb.fs.seed);
      expect(fa.fs.shared).toBe(true);
    }
    expect(sharedFloorSeed(2)).not.toBe(sharedFloorSeed(3));
    // the flag survives a save round trip
    expect(migrate(JSON.parse(JSON.stringify(packSave(a)))).floors[2].shared).toBe(true);
  });
});
