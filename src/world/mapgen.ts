import { Rng, makeNoise } from "../core/rng";
import { PASSABLE, T, VARIANTS } from "../render/tiles";
import { BIOMES } from "./biomes";
import { settlementCount, type FloorDef } from "./floors";

export type EntityKind = "monster" | "node" | "event" | "random" | "chest" | "camp" | "stairs" | "portal" | "guardian" | "town";

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
}

export const MAP_W = 144;
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
  const stairs = { x: w - 6, y: Math.floor(h / 2) + rng.int(-10, 10) };

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
  const order = [start, ...centers.slice().sort((a, b) => a.x - b.x), stairs];
  for (let i = 0; i < order.length - 1; i++) carve(order[i], order[i + 1]);
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
  const gpos = near(stairs.x - 2, stairs.y, 1, 1) ?? { x: stairs.x - 1, y: stairs.y };
  place({ kind: "guardian", x: gpos.x, y: gpos.y, sprite: "marker", ref: def.guardian, group: def.boss, level: def.levelBase + 4 });

  for (const ev of def.events) {
    const c = centers[ev.region % centers.length];
    const p = near(c.x, c.y, 3) ?? randomSpot(6);
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
  for (let i = 0; i < 22; i++) {
    const p = randomSpot(10, 2);
    if (p) place({ kind: "chest", x: p.x, y: p.y, sprite: "chest" });
  }
  for (let i = 0; i < 130; i++) {
    const p = randomSpot(3, 1);
    if (!p) continue;
    const n = rng.weighted(biome.nodes, (nd) => nd.w);
    place({ kind: "node", x: p.x, y: p.y, sprite: n.node, ref: n.item });
  }
  for (let i = 0; i < 95; i++) {
    const p = randomSpot(9, 2);
    if (!p) continue;
    const group = rng.pick(def.groups);
    place({ kind: "monster", x: p.x, y: p.y, sprite: "", group, level: levelAt(p.x, p.y) });
  }

  // Settlements are placed last (with their own RNG) so older saves keep the same entity ids.
  const trng = new Rng(seed ^ 0x70a7);
  const nTown = settlementCount(def.n);
  for (let i = 0; i < nTown; i++) {
    const c = centers[(i * 2 + 1) % centers.length];
    let spot: { x: number; y: number } | null = null;
    for (let tries = 0; tries < 300 && !spot; tries++) {
      const r = 2 + Math.floor(tries / 25);
      const x = c.x + trng.int(-r, r), y = c.y + trng.int(-r, r);
      if (x > 4 && y > 4 && x < w - 5 && y < h - 5 && free(x, y, 2) && free(x, y + 1, 0)) spot = { x, y };
    }
    if (!spot) continue;
    place({ kind: "town", x: spot.x, y: spot.y, sprite: "town", ref: String(i) });
    occupied.add(idx(spot.x, spot.y + 1));
  }

  return { w, h, tiles, variant, region, regionCenters: centers, entities, start, stairs };
}

// ------------------------------------------------------------ fog of war bitset helpers
export function decodeFog(s: string, size: number): Uint8Array {
  const out = new Uint8Array(size);
  if (!s) return out;
  const bin = atob(s);
  for (let i = 0; i < size; i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

export function encodeFog(fog: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(fog.length / 8));
  for (let i = 0; i < fog.length; i++) if (fog[i]) bytes[i >> 3] |= 1 << (i & 7);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

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
