import { describe, expect, it } from "vitest";
import { migrate, newGame, packSave } from "../src/core/state";
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
