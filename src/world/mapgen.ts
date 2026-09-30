import { Rng, makeNoise } from "../core/rng";
import { PASSABLE, T, VARIANTS } from "../render/tiles";
import { BIOMES } from "./biomes";
import { BUILDINGS } from "../data/buildings";
import { settlementCount, type FloorDef } from "./floors";
import { getSettlement } from "./people";

export type EntityKind = "monster" | "node" | "event" | "random" | "chest" | "camp" | "stairs" | "portal" | "guardian" | "town" | "building" | "npc" | "deco";

export interface MapEntity {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  hx: number; // home position (monsters wander around it)
  hy: number;
  sprite: string;
  ref?: string; // event id / item id
  group?: string[];
  level?: number;
  tint?: Record<string, string>;
  foot?: [x: number, y: number, w: number, h: number]; // building footprint
}

export interface FloorMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  variant: Uint8Array;
  region: Uint8Array;
  regionCenters: { x: number; y: number }[];
  entities: MapEntity[];
  start: { x: number; y: number };
  stairs: { x: number; y: number };
  towns: TownRect[];
}

export const MAP_W = 144;
/** Minimum distance (tiles) between a village and the boss's lair. */
export const LAIR_CLEAR = 18;
export const MAP_H = 112;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function generateFloor(def: FloorDef, seed: number): FloorMap {
  const biome = BIOMES[def.biome];
  const rng = new Rng(seed);
  const w = MAP_W, h = MAP_H;
  const elev = makeNoise(seed ^ 0x1234);
  const moist = makeNoise(seed ^ 0x5678);
  const clump = makeNoise(seed ^ 0x9abc);
  const tiles = new Uint8Array(w * h);
  const variant = new Uint8Array(w * h);
  const idx = (x: number, y: number) => y * w + x;

  // Sample noise fields, then threshold by quantiles so every biome gets predictable proportions.
  const E = new Float32Array(w * h), M = new Float32Array(w * h), C = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = idx(x, y);
    E[i] = elev(x / 20, y / 20) * 0.8 + elev(x / 7 + 90, y / 7) * 0.2;
    M[i] = moist(x / 12, y / 12);
    C[i] = clump(x / 4, y / 4) * 0.75 + elev(x / 7 + 40, y / 7) * 0.25;
  }
  const quant = (arr: Float32Array, q: number) => {
    const sorted = Float32Array.from(arr).sort();
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];
  };
  const waterT = quant(E, biome.waterLevel * 0.5);
  const shallowT = quant(E, biome.waterLevel * 0.5 + 0.035);
  const obsT = quant(C, 1 - biome.obstacleLevel * 1.15);
  const altT = quant(M, 0.2);
  const wallT = quant(C, 0.62);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      let t: number = T.GROUND;
      if (edge < 2 || (edge < 4 && C[i] > wallT)) t = T.WALL;
      else if (E[i] < waterT) t = T.WATER;
      else if (E[i] < shallowT) t = T.SHALLOW;
      else if (C[i] > obsT) t = T.OBSTACLE;
      else if (M[i] < altT) t = T.ALT;
      else if (rng.chance(0.1)) t = T.DECOR;
      tiles[i] = t;
      variant[i] = rng.int(0, VARIANTS - 1);
    }
  }

  const passable = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && PASSABLE.has(tiles[idx(x, y)]);

  // Key points: start on the west side, region centres spread across the map.
  const start = { x: 5, y: Math.floor(h / 2) + rng.int(-8, 8) };
  const centers: { x: number; y: number }[] = [];
  const nReg = def.regions.length;
  const cols = nReg > 6 ? 4 : 3;
  for (let i = 0; i < nReg; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = Math.round(((col + 0.5) / cols) * (w - 20)) + 10 + rng.int(-6, 6);
    const cy = Math.round(((row + 0.5) / Math.ceil(nReg / cols)) * (h - 18)) + 9 + rng.int(-5, 5);
    centers.push({ x: cx, y: cy });
  }
  // The gatekeeper's lair (and the stairs behind it) sits near one of the far regions, a
  // different one on every floor and every playthrough.
  const far = centers.map((c, i) => ({ i, d: Math.hypot(c.x - start.x, c.y - start.y) })).sort((a, b) => b.d - a.d);
  const lairAt = centers[far[rng.int(0, Math.max(0, Math.ceil(far.length * 0.6) - 1))].i];
  const stairs = {
    x: Math.max(6, Math.min(w - 7, lairAt.x + rng.int(-5, 5))),
    y: Math.max(6, Math.min(h - 7, lairAt.y + rng.int(-4, 4))),
  };

  // Carve winding roads so everything important is connected.
  const carve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    let x = a.x, y = a.y;
    for (let guard = 0; guard < 1600 && (x !== b.x || y !== b.y); guard++) {
      const dx = Math.sign(b.x - x), dy = Math.sign(b.y - y);
      if (dx && (!dy || rng.chance(0.55))) x += dx; else y += dy;
      if (rng.chance(0.18)) { const [jx, jy] = rng.pick(DIRS); x = Math.max(3, Math.min(w - 4, x + jx)); y = Math.max(3, Math.min(h - 4, y + jy)); }
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) {
        const i = idx(Math.min(w - 3, x + ox), Math.min(h - 3, y + oy));
        const t = tiles[i];
        if (t === T.WATER) tiles[i] = T.SHALLOW;
        else if (t === T.OBSTACLE || t === T.WALL) tiles[i] = T.ALT;
        else if (t === T.GROUND && rng.chance(0.5)) tiles[i] = T.ALT;
      }
    }
  };
  const order = [start, ...centers.slice().sort((a, b) => a.x - b.x)];
  for (let i = 0; i < order.length - 1; i++) carve(order[i], order[i + 1]);
  carve(lairAt, stairs);
  for (let i = 0; i < centers.length; i++) carve(centers[i], centers[(i + cols) % centers.length]);
  for (let i = 0; i < centers.length; i += 2) carve(centers[i], centers[(i + 1) % centers.length]);
  // clear a small plaza around key points
  for (const p of [start, stairs, ...centers]) {
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const i = idx(p.x + x, p.y + y);
      if (!PASSABLE.has(tiles[i])) tiles[i] = T.GROUND;
    }
  }

  // Reachability + distance from start.
  const dist = new Int32Array(w * h).fill(-1);
  const queue = [idx(start.x, start.y)];
  dist[queue[0]] = 0;
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    const cx = cur % w, cy = Math.floor(cur / w);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!passable(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (dist[ni] >= 0) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }
  // Unreachable passable pockets become obstacles so the player never sees unreachable loot.
  for (let i = 0; i < w * h; i++) if (dist[i] < 0 && PASSABLE.has(tiles[i])) tiles[i] = T.OBSTACLE;
  let maxDist = 1;
  for (let i = 0; i < dist.length; i++) if (dist[i] > maxDist) maxDist = dist[i];

  // Regions (Voronoi on centres).
  const region = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = 0, bd = Infinity;
    centers.forEach((c, i) => {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    region[idx(x, y)] = best;
  }

  const occupied = new Set<number>();
  const entities: MapEntity[] = [];
  let counter = 0;
  const free = (x: number, y: number, spacing = 2) => {
    if (!passable(x, y) || dist[idx(x, y)] < 0) return false;
    for (let oy = -spacing; oy <= spacing; oy++) for (let ox = -spacing; ox <= spacing; ox++) if (occupied.has(idx(x + ox, y + oy))) return false;
    return true;
  };
  const place = (e: Omit<MapEntity, "id" | "hx" | "hy">) => {
    const ent: MapEntity = { ...e, id: `${e.kind}_${counter++}`, hx: e.x, hy: e.y };
    entities.push(ent);
    occupied.add(idx(e.x, e.y));
    return ent;
  };
  const near = (cx: number, cy: number, r: number, spacing = 2): { x: number; y: number } | null => {
    for (let tries = 0; tries < 300; tries++) {
      const rr = Math.min(r + Math.floor(tries / 20), 40);
      const x = cx + rng.int(-rr, rr), y = cy + rng.int(-rr, rr);
      if (free(x, y, spacing)) return { x, y };
    }
    return null;
  };
  const randomSpot = (minDist = 0, spacing = 2) => {
    for (let tries = 0; tries < 1500; tries++) {
      const x = rng.int(3, w - 4), y = rng.int(3, h - 4);
      if (free(x, y, spacing) && dist[idx(x, y)] >= minDist) return { x, y };
    }
    return null;
  };
  const levelAt = (x: number, y: number) => def.levelBase + Math.floor((4.2 * dist[idx(x, y)]) / Math.max(1, maxDist));

  place({ kind: "portal", x: start.x, y: start.y, sprite: "portal" });
  occupied.add(idx(start.x + 1, start.y));
  place({ kind: "stairs", x: stairs.x, y: stairs.y, sprite: "stairs" });
  const side = rng.pick([[-2, 0], [2, 0], [0, 2], [0, -2]]);
  const gpos = near(stairs.x + side[0], stairs.y + side[1], 1, 1) ?? { x: stairs.x - 1, y: stairs.y };
  place({ kind: "guardian", x: gpos.x, y: gpos.y, sprite: "marker", ref: def.guardian, group: def.boss, level: def.levelBase + 4 });
  // the lair: braziers, bones and a banner, watched over by a few strong groups
  for (const deco of ["brazier", "brazier", "bone_pile", "banner", "bone_pile"]) {
    const p = near(gpos.x, gpos.y, 2, 1);
    if (p) place({ kind: "deco", x: p.x, y: p.y, sprite: deco });
  }
  const lairGuards = 2 + Math.min(3, Math.floor(def.n / 15)) + rng.int(0, 1);
  for (let i = 0; i < lairGuards; i++) {
    const p = near(gpos.x, gpos.y, 4, 1);
    if (!p) continue;
    const g = rng.pick(def.groups);
    place({ kind: "monster", x: p.x, y: p.y, sprite: "", group: [...g, rng.pick(def.enemies)].slice(0, 4), level: def.levelBase + 3 });
  }

  // Floor 1 teaches the basics: right past the portal lie a gathering spot, a chest, a lone
  // weak monster, a campfire, and the first companion waiting to be met.
  if (def.n === 1) {
    const tut: [EntityKind, string, number, number][] = [["node", "herb_node", 3, -2], ["chest", "chest", 5, 2], ["camp", "campfire", 7, -3]];
    for (const [kind, sprite, dx, dy] of tut) {
      const p = near(start.x + dx, start.y + dy, 1, 1);
      if (p) place({ kind, x: p.x, y: p.y, sprite, ref: kind === "node" ? biome.nodes.find((n) => n.node === sprite)?.item ?? biome.nodes[0].item : undefined });
    }
    const m = near(start.x + 14, start.y + 3, 1, 1);
    if (m) place({ kind: "monster", x: m.x, y: m.y, sprite: "", group: [def.enemies[0]], level: 1 });
  }
  const NEAR_START = new Set(def.n === 1 ? ["f1_lyra", "f1_whisper"] : []);
  for (const ev of def.events) {
    // Lyra waits a short walk from the portal (twice as far as she first stood)
    const c = NEAR_START.has(ev.id) ? { x: start.x + (ev.id === "f1_lyra" ? 10 : 11), y: start.y + (ev.id === "f1_lyra" ? -2 : 4) } : centers[ev.region % centers.length];
    const p = (NEAR_START.has(ev.id) ? near(c.x, c.y, 1, 1) : near(c.x, c.y, 3)) ?? randomSpot(6);
    if (p) place({ kind: "event", x: p.x, y: p.y, sprite: "marker", ref: ev.id });
  }
  for (let i = 0; i < def.randomEvents; i++) {
    const p = randomSpot(8, 3);
    if (p) place({ kind: "random", x: p.x, y: p.y, sprite: "question" });
  }
  for (const c of centers.filter((_, i) => i % 3 === 1)) {
    const p = near(c.x, c.y, 5);
    if (p) place({ kind: "camp", x: p.x, y: p.y, sprite: "campfire" });
  }
  for (let i = 0; i < 12; i++) {
    const p = randomSpot(10, 2);
    if (p) place({ kind: "chest", x: p.x, y: p.y, sprite: "chest" });
  }
  for (let i = 0; i < 80; i++) {
    const p = randomSpot(3, 1);
    if (!p) continue;
    const n = rng.weighted(biome.nodes, (nd) => nd.w);
    place({ kind: "node", x: p.x, y: p.y, sprite: n.node, ref: n.item });
  }
  const nMon = Math.round(28 + Math.min(70, def.n * 0.75));
  const maxPack = def.n <= 3 ? 2 : def.n <= 12 ? 3 : 4;
  for (let i = 0; i < nMon; i++) {
    const p = randomSpot(9, 2);
    if (!p) continue;
    const group = rng.pick(def.groups).slice(0, maxPack);
    place({ kind: "monster", x: p.x, y: p.y, sprite: "", group, level: levelAt(p.x, p.y) });
  }

  // Settlements are placed last (with their own RNG) so older saves keep the same entity ids.
  // Each one is laid out as a real town: paved streets, a plaza, shops, an inn and homes.
  const trng = new Rng(seed ^ 0x70a7);
  const towns: TownRect[] = [];
  const nTown = settlementCount(def.n);
  const important = entities.filter((e) => e.kind === "portal" || e.kind === "stairs" || e.kind === "guardian" || e.kind === "event");
  // villages keep well away from the boss's lair (and its guards)
  const lair = entities.find((e) => e.kind === "guardian")!;
  const lairGap = (x0: number, y0: number, tw: number, th: number) =>
    Math.max(Math.max(x0 - lair.x, 0, lair.x - (x0 + tw - 1)), Math.max(y0 - lair.y, 0, lair.y - (y0 + th - 1)));
  for (let i = 0; i < nTown; i++) {
    const s = getSettlement(def.n, i);
    const rows = s.size === "village" ? 1 : s.size === "town" ? 2 : 3;
    const TW = s.size === "village" ? 19 : s.size === "town" ? 23 : 29, TH = 3 + rows * 4;
    let best: { x: number; y: number; cost: number } | null = null;
    // keep looking in other regions while the best spot so far is crowding the lair
    for (let tries = 0; tries < 160 * centers.length && !(best && best.cost < 40 && tries >= 160); tries++) {
      // floor 1's first village sits a short walk from the portal
      const c = def.n === 1 && i === 0 && tries < 160 ? { x: start.x + 24, y: start.y } : centers[(i * 2 + 1 + Math.floor(tries / 160)) % centers.length];
      const r = 2 + Math.floor((tries % 160) / 8);
      const x0 = c.x - (TW >> 1) + trng.int(-r, r), y0 = c.y - (TH >> 1) + trng.int(-r, r);
      if (x0 < 5 || y0 < 5 || x0 + TW > w - 5 || y0 + TH > h - 5) continue;
      if (towns.some((t) => x0 < t.x + t.w + 4 && t.x < x0 + TW + 4 && y0 < t.y + t.h + 4 && t.y < y0 + TH + 4)) continue;
      if (important.some((e) => e.x >= x0 - 2 && e.x < x0 + TW + 2 && e.y >= y0 - 2 && e.y < y0 + TH + 2)) continue;
      let cost = 0, reach = 0;
      for (let y = y0; y < y0 + TH; y++) for (let x = x0; x < x0 + TW; x++) {
        const t = tiles[idx(x, y)];
        if (t === T.WATER || t === T.WALL) cost += 2; else if (t === T.OBSTACLE) cost += 0.3;
        if (dist[idx(x, y)] >= 0) reach++;
      }
      if (reach < TW * TH * 0.4) continue;
      // too close to the lair: allowed only as a last resort on cramped floors
      const gap = lairGap(x0, y0, TW, TH);
      if (gap < LAIR_CLEAR) cost += 40 + (LAIR_CLEAR - gap) * 25;
      if (!best || cost < best.cost) best = { x: x0, y: y0, cost };
      if (cost === 0) break;
    }
    if (!best) continue;
    const rect: TownRect = { i, x: best.x, y: best.y, w: TW, h: TH };
    towns.push(rect);
    layoutTown(rect, s.size, s.shops, s.npcs, def.family, trng);
  }

  // Safety net: the gatekeeper and the stairs must always be reachable, whatever the terrain,
  // towns or permanent props did. If not, dig a road to them.
  const solid = new Set(entities.filter((e) => e.kind === "building" || e.kind === "town" || e.kind === "deco").map((e) => idx(e.x, e.y)));
  const reachFrom = () => {
    const seen = new Uint8Array(w * h);
    const q = [idx(start.x + 1, start.y)];
    seen[q[0]] = 1;
    for (let k = 0; k < q.length; k++) {
      const x = q[k] % w, y = Math.floor(q[k] / w);
      for (const [dx, dy] of DIRS) {
        const ni = idx(x + dx, y + dy);
        if (!seen[ni] && passable(x + dx, y + dy) && !solid.has(ni)) { seen[ni] = 1; q.push(ni); }
      }
    }
    return seen;
  };
  const guard = entities.find((e) => e.kind === "guardian")!;
  for (const goal of [guard, stairs]) {
    const seen = reachFrom();
    if (DIRS.some(([dx, dy]) => seen[idx(goal.x + dx, goal.y + dy)])) continue;
    let x = goal.x - 1, y = goal.y;
    for (let guardN = 0; guardN < 800 && !seen[idx(x, y)]; guardN++) {
      const i = idx(x, y);
      if (!passable(x, y) || solid.has(i)) { tiles[i] = tiles[i] === T.WATER ? T.SHALLOW : T.ALT; solid.delete(i); }
      if (x !== start.x + 1) x += Math.sign(start.x + 1 - x); else y += Math.sign(start.y - y);
    }
  }

  return { w, h, tiles, variant, region, regionCenters: centers, entities, start, stairs, towns };

  function layoutTown(r: TownRect, size: string, shops: string[], npcs: string[], fam: string, tr: Rng) {
    const { x: x0, y: y0, w: TW, h: TH } = r;
    const inside = (x: number, y: number) => x >= x0 && x < x0 + TW && y >= y0 && y < y0 + TH;
    // clear the ground and drop whatever was generated here
    for (let i = entities.length - 1; i >= 0; i--) if (inside(entities[i].x, entities[i].y)) { occupied.delete(idx(entities[i].x, entities[i].y)); entities.splice(i, 1); }
    for (let y = y0 - 1; y <= y0 + TH; y++) for (let x = x0 - 1; x <= x0 + TW; x++) {
      const i = idx(x, y);
      if (inside(x, y) || !PASSABLE.has(tiles[i])) tiles[i] = T.GROUND;
    }
    const rows = (TH - 3) / 4;
    const streets = Array.from({ length: rows }, (_, k) => y0 + 4 + k * 4);
    const mid = x0 + (TW >> 1);
    const pave = (x: number, y: number) => { if (inside(x, y)) tiles[idx(x, y)] = T.PAVE; };
    for (const sy of streets) for (let x = x0; x < x0 + TW; x++) pave(x, sy);
    for (let y = y0 + 1; y <= streets[rows - 1]; y++) { pave(x0, y); pave(x0 + TW - 1, y); pave(mid, y); }
    // plaza below the middle street
    const ps = streets[rows >> 1];
    for (let y = ps; y <= ps + 2; y++) for (let x = mid - 3; x <= mid + 3; x++) pave(x, y);
    // roads out of town: extend the first street both ways until it meets the reachable map
    for (const [sx, dx] of [[x0 - 1, -1], [x0 + TW, 1]] as const) {
      const sy = streets[0];
      for (let k = 0, x = sx; k < 14 && x > 2 && x < w - 3; k++, x += dx) {
        const i = idx(x, sy);
        if (dist[i] >= 0 && PASSABLE.has(tiles[i]) && k > 1) break;
        if (!PASSABLE.has(tiles[i])) tiles[i] = tiles[i] === T.WATER ? T.SHALLOW : T.ALT;
      }
    }
    // the town hall / notice board sits in the plaza
    const hall = { kind: "town" as const, x: mid, y: ps + 2, sprite: size === "village" ? "well" : "fountain", ref: String(r.i) };
    tiles[idx(hall.x, hall.y)] = T.PAVE;
    place(hall);

    const homes = HOMES[fam] ?? HOMES.forest;
    const queue: { type: string; ref: string }[] = [
      ...shops.map((k) => ({ type: SHOP_BUILDING[k] ?? "stonehouse", ref: `shop:${k}` })),
      { type: size === "city" ? "tavern" : "inn", ref: "inn" },
    ];
    let homeIdx = 0;
    const nextHome = () => {
      const pool = size === "city" ? [...homes, "manor", "apartment", "stonehouse"] : size === "town" ? [...homes, "stonehouse"] : homes;
      return { type: pool[tr.int(0, pool.length - 1)], ref: `home:${npcs[(shops.length + homeIdx++) % npcs.length]}` };
    };
    const underPlaza = streets[(rows >> 1) + 1];
    for (const sy of streets) {
      const blocked = (x: number) => x === mid || x === x0 || x === x0 + TW - 1 || (sy === underPlaza && Math.abs(x - mid) <= 3);
      let x = x0 + 1;
      while (x < x0 + TW - 1) {
        const b = queue[0] ?? nextHome();
        const [bw, bh] = BUILDING_SIZE[b.type] ?? [2, 2];
        let fits = x + bw <= x0 + TW - 1;
        for (let k = 0; k < bw && fits; k++) if (blocked(x + k)) fits = false;
        if (!fits) { x++; continue; }
        if (queue.length) queue.shift();
        const fy = sy - bh;
        for (let yy = fy; yy < sy; yy++) for (let xx = x; xx < x + bw; xx++) tiles[idx(xx, yy)] = T.LOT;
        place({ kind: "building", x: x + (bw >> 1), y: sy - 1, sprite: b.type, ref: b.ref, foot: [x, fy, bw, bh] });
        x += bw;
        // a lamp, tree or flower bed between some houses
        if (x < x0 + TW - 1 && !blocked(x) && tr.chance(0.45)) {
          const prop = tr.pick(["lamp", "tree", "flowers"]);
          tiles[idx(x, sy - 1)] = T.LOT;
          place({ kind: "building", x, y: sy - 1, sprite: prop, ref: "prop", foot: [x, sy - 1, 1, 1] });
        }
        x++;
      }
    }
    // yard south of the last street: fields, trees and lamps
    const ly = streets[rows - 1] + 2;
    for (let x = x0 + 1; x < x0 + TW - 1; x += 2) {
      if (Math.abs(x - mid) <= 3 || !tr.chance(0.4)) continue;
      tiles[idx(x, ly)] = T.LOT;
      place({ kind: "building", x, y: ly, sprite: tr.pick(["tree", "flowers", "farm", "lamp"]), ref: "prop", foot: [x, ly, 1, 1] });
    }
    // townsfolk wander the streets
    const walkers = npcs.slice(0, size === "village" ? 3 : size === "town" ? 5 : 7);
    walkers.forEach((id, k) => {
      for (let tries = 0; tries < 40; tries++) {
        const x = x0 + tr.int(0, TW - 1), y = streets[k % rows] + (tries > 20 ? 0 : tr.int(0, 1));
        if (tiles[idx(x, y)] !== T.PAVE || occupied.has(idx(x, y))) continue;
        place({ kind: "npc", x, y, sprite: "", ref: id });
        break;
      }
    });
  }
}

export interface TownRect { i: number; x: number; y: number; w: number; h: number }

const SHOP_BUILDING: Record<string, string> = {
  general: "stonehouse", smith: "forge", apothecary: "alchemy", seeds: "cottage", tailor: "tailor", arcane: "library", jeweler: "workshop", market: "market",
};
const HOMES: Record<string, string[]> = {
  forest: ["cottage", "treehouse"], jungle: ["treehouse", "cottage"], bamboo: ["bamboohouse"], sakura: ["bamboohouse", "cottage"],
  desert: ["tent", "stonehouse"], tundra: ["stonehouse", "cottage"], glacier: ["stonehouse"], volcano: ["stonehouse"], ruins: ["stonehouse"],
  bonewaste: ["tent", "stonehouse"], swamp: ["cottage", "fisherhut"], reef: ["fisherhut", "cottage"], fungal: ["cottage"], crystal: ["stonehouse"], autumn: ["cottage"],
};
const BUILDING_SIZE: Record<string, [number, number]> = Object.fromEntries(Object.values(BUILDINGS).map((b) => [b.id, b.size]));


// ------------------------------------------------------------ fog of war bitset helpers
export { decodeFog, encodeFog } from "./fog";

/** A* over passable tiles (binary heap); returns the path excluding the start tile. */
export function findPath(
  map: { w: number; h: number },
  canWalk: (x: number, y: number) => boolean,
  sx: number, sy: number, tx: number, ty: number, limit = 4000,
): { x: number; y: number }[] | null {
  const w = map.w;
  const key = (x: number, y: number) => y * w + x;
  const heapK: number[] = [], heapF: number[] = [];
  const push = (k: number, f: number) => {
    heapK.push(k); heapF.push(f);
    let i = heapK.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= heapF[i]) break;
      [heapK[p], heapK[i]] = [heapK[i], heapK[p]];
      [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
      i = p;
    }
  };
  const pop = () => {
    const k = heapK[0];
    const lk = heapK.pop()!, lf = heapF.pop()!;
    if (heapK.length) {
      heapK[0] = lk; heapF[0] = lf;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heapK.length && heapF[l] < heapF[m]) m = l;
        if (r < heapK.length && heapF[r] < heapF[m]) m = r;
        if (m === i) break;
        [heapK[m], heapK[i]] = [heapK[i], heapK[m]];
        [heapF[m], heapF[i]] = [heapF[i], heapF[m]];
        i = m;
      }
    }
    return k;
  };
  const g = new Map<number, number>([[key(sx, sy), 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const goal = key(tx, ty);
  push(key(sx, sy), 0);
  let steps = 0;
  while (heapK.length && steps++ < limit) {
    const cur = pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (cur === goal) {
      const path: { x: number; y: number }[] = [];
      let c = cur;
      while (c !== key(sx, sy)) {
        path.push({ x: c % w, y: Math.floor(c / w) });
        c = came.get(c)!;
      }
      return path.reverse();
    }
    const cx = cur % w, cy = Math.floor(cur / w);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      if (nk !== goal && !canWalk(nx, ny)) continue;
      const ng = g.get(cur)! + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, cur);
        push(nk, ng + Math.abs(nx - tx) + Math.abs(ny - ty));
      }
    }
  }
  return null;
}
