import { BUILDINGS, RANK_NAMES, TERRITORY_SIZES, costFor } from "../data/buildings";
import { pay, type GameState, type PlacedBuilding } from "../core/state";
import { ensureSlots, rankOf } from "./town";

export const SZ_W = 136;
export const SZ_H = 136;
export const SZ_C = 68;
/** How far everything moved when the sanctuary world grew from 72×72 to 136×136 (save v6). */
export const SZ_SHIFT = 32;
export const SPROUT = { x: 64, y: 67 };

export function territory(level: number) {
  const s = TERRITORY_SIZES[Math.min(level, TERRITORY_SIZES.length - 1)];
  const x0 = SZ_C - s / 2;
  return { x0, y0: x0, x1: x0 + s, y1: x0 + s };
}

export function inTerritory(g: GameState, x: number, y: number) {
  const t = territory(g.territory);
  return x >= t.x0 && y >= t.y0 && x < t.x1 && y < t.y1;
}

/** A building that blocks movement at (x, y) (flat decor like paths does not). */
export function blockerAt(g: GameState, x: number, y: number): PlacedBuilding | undefined {
  const b = buildingAt(g, x, y);
  return b && !BUILDINGS[b.type].walkable ? b : undefined;
}

/**
 * Which building covers each tile. A paved sanctuary has thousands of pieces and path finding
 * asks about every tile it visits, so the answer comes from a grid, rebuilt when the list is
 * replaced, grows or shrinks, or `buildingsMoved` says something moved.
 */
let occ: { list: PlacedBuilding[]; n: number; ver: number; grid: Int32Array } | null = null;
let moved = 0;
export const buildingsMoved = () => { moved++; };
function occupancy(g: GameState): Int32Array {
  const list = g.buildings;
  if (occ && occ.list === list && occ.n === list.length && occ.ver === moved) return occ.grid;
  const grid = occ?.grid.fill(0) ?? new Int32Array(SZ_W * SZ_H);
  list.forEach((b, i) => {
    const [w, h] = BUILDINGS[b.type]?.size ?? [1, 1];
    for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) {
      if (x >= 0 && y >= 0 && x < SZ_W && y < SZ_H) grid[y * SZ_W + x] = i + 1;
    }
  });
  occ = { list, n: list.length, ver: moved, grid };
  layouts++;
  return grid;
}
let layouts = 0;
/** A number that changes whenever a building is added, removed or moved (cheap to ask every frame). */
export function layoutKey(g: GameState): number {
  occupancy(g);
  return layouts;
}

export function buildingAt(g: GameState, x: number, y: number): PlacedBuilding | undefined {
  if (x < 0 || y < 0 || x >= SZ_W || y >= SZ_H) return undefined;
  const i = occupancy(g)[y * SZ_W + x];
  return i ? g.buildings[i - 1] : undefined;
}

/** Where Sprout stands: wherever the player put her, else her old spot (or the nearest free tile to it). */
export function sproutAt(g: GameState): { x: number; y: number } {
  if (g.sprout) return g.sprout;
  if (!buildingAt(g, SPROUT.x, SPROUT.y)) return SPROUT;
  for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && inTerritory(g, SPROUT.x + dx, SPROUT.y + dy) && !buildingAt(g, SPROUT.x + dx, SPROUT.y + dy)) return { x: SPROUT.x + dx, y: SPROUT.y + dy };
  }
  return SPROUT;
}

/** `ignore`: the building (or group of buildings) being moved, which may overlap its own old spot. */
export function canPlace(g: GameState, type: string, x: number, y: number, ignore?: PlacedBuilding | Set<PlacedBuilding>): string | null {
  const [w, h] = BUILDINGS[type].size;
  const sp = sproutAt(g);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (!inTerritory(g, xx, yy)) return "Ngoài lãnh địa";
      if (xx === sp.x && yy === sp.y) return "Mầm đang đứng ở đây";
      const b = buildingAt(g, xx, yy);
      if (b && !(ignore instanceof Set ? ignore.has(b) : b === ignore)) return "Đã có công trình";
    }
  }
  return null;
}

export function buildLimitReason(g: GameState, type: string): string | null {
  const def = BUILDINGS[type];
  if (def.rank > rankOf(g)) return `Cần khu định cư hạng ${RANK_NAMES[def.rank]}`;
  if (def.unique && g.buildings.some((b) => b.type === type)) return "Đã xây";
  return null;
}

/** Why a building can't go up a level right now, apart from its cost (null: it can). */
export function upgradeBlock(g: GameState, b: PlacedBuilding): string | null {
  const def = BUILDINGS[b.type];
  if (b.level >= def.maxLevel) return "Đã đạt cấp tối đa";
  if (b.type === "house") return "Nhà Chính thăng hạng riêng"; // it has its own requirements
  if (def.rank + b.level > rankOf(g)) return `Cần khu định cư hạng ${RANK_NAMES[Math.min(6, def.rank + b.level)]}`;
  return null;
}

/**
 * Raises many buildings at once, one level per round, lowest level first, paying as it goes,
 * for up to `rounds` rounds (Infinity: as far as the bag allows). Returns the levels gained.
 */
export function bulkUpgrade(g: GameState, list: PlacedBuilding[], rounds: number): { levels: number; buildings: number } {
  let levels = 0;
  const raised = new Set<PlacedBuilding>();
  for (let r = 0; r < rounds; r++) {
    let any = false;
    for (const b of [...list].sort((x, y) => x.level - y.level)) {
      if (upgradeBlock(g, b) || !pay(g, costFor(b.type, b.level))) continue;
      b.level++;
      if (b.type === "greenhouse") ensureSlots(b);
      levels++; raised.add(b); any = true;
    }
    if (!any) break;
  }
  return { levels, buildings: raised.size };
}
