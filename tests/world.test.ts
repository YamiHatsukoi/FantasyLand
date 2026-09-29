import { describe, expect, it } from "vitest";
import { newGame } from "../src/core/state";
import { COMPANIONS } from "../src/data/classes";
import { ENEMIES } from "../src/data/enemies";
import { ITEMS, getItem } from "../src/data/items";
import { SKILLS } from "../src/data/skills";
import { PASSABLE } from "../src/render/tiles";
import { EVENTS } from "../src/story";
import type { Cond, Effect } from "../src/story/types";
import { MAX_FLOOR, getFloor } from "../src/world/floors";
import { findPath, generateFloor } from "../src/world/mapgen";

describe("floors", () => {
  it("defines all 100 floors with valid enemies", () => {
    for (let n = 1; n <= MAX_FLOOR; n++) {
      const f = getFloor(n);
      expect(f.name.length, `floor ${n}`).toBeGreaterThan(3);
      for (const id of [...f.enemies, ...f.boss, ...f.groups.flat()]) expect(ENEMIES[id], `floor ${n}: ${id}`).toBeTruthy();
      expect(f.boss.some((id) => ENEMIES[id].boss), `floor ${n} boss`).toBe(true);
      for (const e of f.events) expect(EVENTS[e.id], `floor ${n}: ${e.id}`).toBeTruthy();
      expect(EVENTS[f.guardian]).toBeTruthy();
    }
  });

  it("generates maps where every entity is reachable from the start", () => {
    for (const n of [1, 2, 3, 4, 7, 12, 25, 50, 99]) {
      for (const seed of [1, 99, 12345]) {
        const m = generateFloor(getFloor(n), seed * 31 + n);
        const passable = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && PASSABLE.has(m.tiles[y * m.w + x]);
        const startX = m.start.x + 1;
        expect(passable(startX, m.start.y), `start floor ${n}`).toBe(true);
        // flood fill once from the start instead of a path per entity
        const seen = new Uint8Array(m.w * m.h);
        const q = [m.start.y * m.w + startX];
        seen[q[0]] = 1;
        for (let k = 0; k < q.length; k++) {
          const x = q[k] % m.w, y = Math.floor(q[k] / m.w);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, ni = ny * m.w + nx;
            if (passable(nx, ny) && !seen[ni]) { seen[ni] = 1; q.push(ni); }
          }
        }
        for (const e of m.entities) {
          if (e.kind === "portal") continue;
          expect(passable(e.x, e.y), `${n}/${seed} ${e.kind} on passable tile`).toBe(true);
          expect(seen[e.y * m.w + e.x], `${n}/${seed} ${e.kind} ${e.id} reachable`).toBe(1);
        }
        const far = m.entities.find((e) => e.kind === "stairs")!;
        expect(findPath(m, passable, startX, m.start.y, far.x, far.y, 40000), `${n}/${seed} stairs path`).not.toBeNull();
        expect(m.entities.filter((e) => e.kind === "event").length).toBe(getFloor(n).events.length);
      }
    }
  }, 60000);
});

describe("story graph", () => {
  const itemOk = (id: string) => Boolean(ITEMS[id]) || getItem(id).name !== id;
  const checkCond = (c: Cond | undefined, where: string) => {
    if (!c) return;
    if ("has" in c) expect(itemOk(c.has), `${where}: item ${c.has}`).toBe(true);
    if ("party" in c) expect(COMPANIONS[c.party], `${where}: ${c.party}`).toBeTruthy();
    if ("recruited" in c) expect(COMPANIONS[c.recruited], `${where}: ${c.recruited}`).toBeTruthy();
    if ("all" in c) c.all.forEach((x) => checkCond(x, where));
    if ("any" in c) c.any.forEach((x) => checkCond(x, where));
    if ("not" in c) checkCond(c.not, where);
  };
  const checkFx = (fx: Effect[] | undefined, scenes: Record<string, unknown>, where: string) => {
    for (const e of fx ?? []) {
      if ("give" in e || "take" in e) for (const id of Object.keys("give" in e ? e.give : e.take)) expect(itemOk(id), `${where}: item ${id}`).toBe(true);
      if ("recruit" in e) expect(COMPANIONS[e.recruit], `${where}`).toBeTruthy();
      if ("learn" in e) expect(SKILLS[e.learn], `${where}: skill ${e.learn}`).toBeTruthy();
      if ("battle" in e) {
        expect(scenes[e.battle.win], `${where}: win ${e.battle.win}`).toBeTruthy();
        if (e.battle.lose) expect(scenes[e.battle.lose]).toBeTruthy();
        for (const id of e.battle.group ?? []) expect(ENEMIES[id], `${where}: enemy ${id}`).toBeTruthy();
      }
    }
  };

  it("every link points at an existing scene and references valid data", () => {
    for (const ev of Object.values(EVENTS)) {
      const s = ev.scenes;
      expect(s[ev.start], `${ev.id} start`).toBeTruthy();
      for (const [sid, sc] of Object.entries(s)) {
        const where = `${ev.id}.${sid}`;
        if (sc.next) expect(s[sc.next], `${where} next ${sc.next}`).toBeTruthy();
        for (const r of sc.route ?? []) { expect(s[r.to], `${where} route ${r.to}`).toBeTruthy(); checkCond(r.cond, where); }
        checkFx(sc.fx, s, where);
        for (const c of sc.choices ?? []) {
          if (c.next) expect(s[c.next], `${where} choice→${c.next}`).toBeTruthy();
          if (c.check) { expect(s[c.check.pass], `${where} pass`).toBeTruthy(); expect(s[c.check.fail], `${where} fail`).toBeTruthy(); }
          checkCond(c.cond, where);
          checkFx(c.fx, s, where);
        }
      }
    }
  });
});

describe("save data", () => {
  it("round-trips through JSON", () => {
    const g = newGame("A", "mage", 1);
    const copy = JSON.parse(JSON.stringify(g));
    expect(copy).toEqual(g);
  });
});
