import { describe, expect, it } from "vitest";
import { ARC } from "../src/data/world/arc";
import "../src/data/world";
import { ITEMS } from "../src/data/items";
import { EVENTS } from "../src/story";
import { FINALE } from "../src/story/finale";
import type { Cond } from "../src/story/types";
import { getFloor } from "../src/world/floors";

const flagsIn = (c: Cond | undefined, out: string[] = []): string[] => {
  if (!c) return out;
  if ("flag" in c) out.push(c.flag);
  if ("all" in c) c.all.forEach((x) => flagsIn(x, out));
  if ("any" in c) c.any.forEach((x) => flagsIn(x, out));
  return out;
};

describe("the hundred-floor story", () => {
  it("has a main-story beat on every floor from 4 to 99", () => {
    for (let n = 4; n <= 99; n++) expect(ARC[n], `floor ${n}`).toBeTruthy();
  });

  it("wires the finale as the gatekeeper of floor 100", () => {
    expect(getFloor(100).guardian).toBe("guard100");
    expect(EVENTS.guard100).toBe(FINALE);
    for (const [id, sc] of Object.entries(FINALE.scenes)) {
      if (sc.next) expect(FINALE.scenes[sc.next], `${id} -> ${sc.next}`).toBeTruthy();
      for (const r of sc.route ?? []) expect(FINALE.scenes[r.to]).toBeTruthy();
      for (const ch of sc.choices ?? []) if (ch.next) expect(FINALE.scenes[ch.next], `${id} -> ${ch.next}`).toBeTruthy();
    }
  });

  it("every flag an ending needs can be earned somewhere on the way down", () => {
    const earned = new Set<string>();
    for (const [n, b] of Object.entries(ARC)) {
      earned.add(`arc_${n}`);
      for (const c of b.choices ?? []) if (c.flag) earned.add(c.flag);
    }
    const needed = Object.values(FINALE.scenes).flatMap((sc) => (sc.choices ?? []).flatMap((c) => flagsIn(c.cond)));
    expect(needed.length).toBeGreaterThan(3);
    for (const f of needed) expect(earned.has(f), f).toBe(true);
  });

  it("gives only items that exist", () => {
    for (const b of Object.values(ARC)) {
      for (const k of Object.keys(b.give ?? {})) expect(ITEMS[k], k).toBeTruthy();
      for (const c of b.choices ?? []) for (const k of Object.keys(c.give ?? {})) expect(ITEMS[k], k).toBeTruthy();
    }
  });
});
