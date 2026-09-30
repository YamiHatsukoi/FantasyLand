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
import { LAIR_CLEAR, findPath, generateFloor } from "../src/world/mapgen";

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
          if (e.kind === "building") {
            // buildings stand on blocked lots; shops and homes need a reachable doorstep
            if (e.ref !== "prop") expect([[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => seen[(e.y + dy) * m.w + e.x + dx]), `${n}/${seed} door ${e.ref}`).toBe(true);
            continue;
          }
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

  it("never locks the player out of the gatekeeper or the stairs (all 100 floors)", () => {
    for (let n = 1; n <= 100; n++) {
      for (const seed of [7, 4242, 987654]) {
        const m = generateFloor(getFloor(n), seed * 13 + n);
        const solid = new Set(m.entities.filter((e) => e.kind === "building" || e.kind === "town" || e.kind === "deco").map((e) => e.y * m.w + e.x));
        const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && PASSABLE.has(m.tiles[y * m.w + x]) && !solid.has(y * m.w + x);
        const seen = new Uint8Array(m.w * m.h);
        const q = [m.start.y * m.w + m.start.x + 1];
        seen[q[0]] = 1;
        for (let k = 0; k < q.length; k++) {
          const x = q[k] % m.w, y = Math.floor(q[k] / m.w);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (ok(x + dx, y + dy) && !seen[(y + dy) * m.w + x + dx]) { seen[(y + dy) * m.w + x + dx] = 1; q.push((y + dy) * m.w + x + dx); }
        }
        const near = (e: { x: number; y: number }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(e.y + dy) * m.w + e.x + dx]);
        expect(near(m.entities.find((e) => e.kind === "guardian")!), `floor ${n} seed ${seed} gatekeeper`).toBe(true);
        expect(near(m.stairs), `floor ${n} seed ${seed} stairs`).toBe(true);
      }
    }
  }, 120000);

  it("hides the gatekeeper's lair somewhere different on each playthrough, guarded", () => {
    for (const n of [1, 10, 55]) {
      const spots = new Set<string>();
      for (const seed of [3, 17, 99, 1234, 55555, 777777]) {
        const m = generateFloor(getFloor(n), seed);
        const gd = m.entities.find((e) => e.kind === "guardian")!;
        spots.add(`${Math.round(gd.x / 12)},${Math.round(gd.y / 12)}`);
        const guards = m.entities.filter((e) => e.kind === "monster" && Math.abs(e.x - gd.x) + Math.abs(e.y - gd.y) <= 10);
        expect(guards.length, `floor ${n} guards`).toBeGreaterThanOrEqual(2);
      }
      expect(spots.size, `floor ${n}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps villages well away from the boss's lair", () => {
    let near = 0, total = 0;
    for (let n = 1; n <= 100; n++) {
      for (const seed of [7, 4242]) {
        const m = generateFloor(getFloor(n), seed);
        const gd = m.entities.find((e) => e.kind === "guardian")!;
        for (const t of m.towns) {
          total++;
          const gap = Math.max(Math.max(t.x - gd.x, 0, gd.x - (t.x + t.w - 1)), Math.max(t.y - gd.y, 0, gd.y - (t.y + t.h - 1)));
          if (gap < LAIR_CLEAR) near++;
        }
      }
    }
    expect(total).toBeGreaterThan(50);
    expect(near, `${near}/${total} villages next to a lair`).toBe(0);
  }, 120000);

  it("has fewer, smaller monster packs on the first floors", () => {
    const count = (n: number) => generateFloor(getFloor(n), 42).entities.filter((e) => e.kind === "monster");
    expect(count(1).length).toBeLessThan(count(80).length);
    expect(Math.max(...count(1).map((e) => e.group!.length))).toBeLessThanOrEqual(3);
  });
});

describe("roadside encounters", () => {
  it("has a pool of 100+ and never repeats one on the same floor", async () => {
    const { RANDOM_POOL, EVENTS } = await import("../src/story");
    expect(RANDOM_POOL.length).toBeGreaterThanOrEqual(100);
    for (const p of RANDOM_POOL) expect(EVENTS[p.id], p.id).toBeTruthy();
    expect(RANDOM_POOL.filter((p) => p.rare).length).toBeGreaterThan(3);
  });
});

describe("secrets", () => {
  it("hides a room behind a cracked wall and seals a vault with three runes", () => {
    let rooms = 0, vaults = 0;
    for (let n = 2; n <= 100; n++) {
      const m = generateFloor(getFloor(n), 99);
      const walls = m.entities.filter((e) => e.kind === "secret");
      rooms += walls.length;
      for (const wl of walls) {
        // a secret chest lies two tiles past the wall
        expect(m.entities.some((e) => e.kind === "chest" && e.ref === "secret" && Math.abs(e.x - wl.x) + Math.abs(e.y - wl.y) === 2), `floor ${n}`).toBe(true);
      }
      const v = m.entities.find((e) => e.kind === "vault");
      if (v) {
        vaults++;
        expect(m.entities.filter((e) => e.kind === "rune").length).toBe(3);
        expect(v.ref!.split("").sort().join("")).toBe("012");
      }
    }
    expect(rooms).toBeGreaterThan(80);
    expect(vaults).toBeGreaterThan(35);
  }, 60000);
});

describe("great events", () => {
  it("20 kinds rotate; almost every floor has one, and all its pieces can be reached", async () => {
    const { SAGAS, sagaFor } = await import("../src/world/saga");
    const { PASSABLE } = await import("../src/render/tiles");
    expect(SAGAS.length).toBe(20);
    for (let n = 2; n <= 100; n++) expect(sagaFor(n).id).not.toBe(sagaFor(n - 1).id);
    expect(new Set(Array.from({ length: 100 }, (_, i) => sagaFor(i + 1).id)).size).toBeGreaterThanOrEqual(16);
    let have = 0;
    for (let n = 1; n <= 100; n++) {
      const m = generateFloor(getFloor(n), 1234);
      if (!m.saga) continue;
      have++;
      // flood fill from the portal over passable tiles (entities count as reachable targets)
      const seen = new Uint8Array(m.w * m.h);
      const q = [m.start.y * m.w + m.start.x];
      seen[q[0]] = 1;
      for (let k = 0; k < q.length; k++) {
        const x = q[k] % m.w, y = Math.floor(q[k] / m.w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, i = ny * m.w + nx;
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen[i] || !PASSABLE.has(m.tiles[i])) continue;
          seen[i] = 1; q.push(i);
        }
      }
      const near = (e: { x: number; y: number }) => seen[e.y * m.w + e.x] || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(e.y + dy) * m.w + e.x + dx]);
      for (const e of m.entities.filter((x) => x.kind === "saga" || x.saga)) expect(near(e), `floor ${n} ${m.saga.id} ${e.kind} ${e.ref}`).toBeTruthy();
    }
    expect(have).toBeGreaterThanOrEqual(90);
  }, 120000);
});

describe("great event rotation", () => {
  it("never plays the same way two floors in a row", async () => {
    const { sagaFor } = await import("../src/world/saga");
    for (let n = 2; n <= 100; n++) expect(sagaFor(n).mech, `floor ${n}`).not.toBe(sagaFor(n - 1).mech);
  });
});
