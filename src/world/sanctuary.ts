import { BUILDINGS, TERRITORY_SIZES, farmLimitFor } from "../data/buildings";
import type { GameState, PlacedBuilding } from "../core/state";

export const SZ_W = 36;
export const SZ_H = 36;
export const SZ_C = 18;
export const SPROUT = { x: 14, y: 17 };

export function territory(level: number) {
  const s = TERRITORY_SIZES[Math.min(level, TERRITORY_SIZES.length - 1)];
  const x0 = SZ_C - s / 2;
  return { x0, y0: x0, x1: x0 + s, y1: x0 + s };
}

export function inTerritory(g: GameState, x: number, y: number) {
  const t = territory(g.territory);
  return x >= t.x0 && y >= t.y0 && x < t.x1 && y < t.y1;
}

export function buildingAt(g: GameState, x: number, y: number): PlacedBuilding | undefined {
  return g.buildings.find((b) => {
    const [w, h] = BUILDINGS[b.type].size;
    return x >= b.x && y >= b.y && x < b.x + w && y < b.y + h;
  });
}

export function canPlace(g: GameState, type: string, x: number, y: number, ignore?: PlacedBuilding): string | null {
  const [w, h] = BUILDINGS[type].size;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (!inTerritory(g, xx, yy)) return "Ngoài lãnh địa";
      if (xx === SPROUT.x && yy === SPROUT.y) return "Mầm đang đứng ở đây";
      const b = buildingAt(g, xx, yy);
      if (b && b !== ignore) return "Đã có công trình";
    }
  }
  return null;
}

export function buildLimitReason(g: GameState, type: string): string | null {
  const def = BUILDINGS[type];
  const n = g.buildings.filter((b) => b.type === type).length;
  if (def.unique && n > 0) return "Đã xây";
  if (type === "farm" && n >= farmLimitFor(g.territory)) return `Tối đa ${farmLimitFor(g.territory)} ô ruộng (mở rộng lãnh địa để thêm)`;
  return null;
}
