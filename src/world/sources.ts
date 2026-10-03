import { CROPS, CROP_LIST, SEASON_NAMES, getItem } from "../data/items";
import { RECIPES, STATION_NAMES } from "../data/recipes";
import { dropChance, regionSource } from "../data/uses";
import { ENEMIES } from "../data/enemies";

/**
 * Where an item can be had, in a few short lines a quest or a tooltip can show: grown from a
 * seed (and where that seed is sold, and when), made at a station, dropped by monsters. A seed
 * shop's stock follows the season, so a crop out of season says so plainly.
 */
export function howToGet(id: string): string[] {
  const out: string[] = [];
  const it = getItem(id);
  const crop = CROPS[id] ?? (it.crop ? CROPS[it.crop] : undefined);
  const seasons = (c: { seasons: number[] }) => c.seasons.map((s) => SEASON_NAMES[s]).join(", ");
  // the deepest-floor rule of the seed shops: tier t appears from floor 2(t - 1)
  const fromFloor = (tier: number) => Math.max(1, 2 * (tier - 1));
  if (crop && CROPS[id]) {
    const seed = getItem(crop.seed);
    if (crop.hybrid) {
      out.push(`🌱 Lai giống: trồng ${getItem(crop.hybrid[0]).name} cạnh ${getItem(crop.hybrid[1]).name}, thỉnh thoảng nảy ra ${seed.name}`);
    } else {
      out.push(`🌱 Trồng ${seed.name} ở Ô Ruộng (mùa ${seasons(crop)}) hoặc trong Nhà Kính (mọi mùa)`);
      out.push(`🛒 ${seed.name}: Tiệm Hạt Giống ở các làng từ tầng ${fromFloor(crop.tier)} và quầy hạt giống ở Chợ Thánh Địa, chỉ bán vào mùa ${seasons(crop)}`);
    }
  } else if (crop && (it.type === "seed" || it.type === "sapling")) {
    if (crop.hybrid) out.push(`🌱 Chỉ có từ lai giống: trồng ${getItem(crop.hybrid[0]).name} cạnh ${getItem(crop.hybrid[1]).name}`);
    else out.push(`🛒 Tiệm Hạt Giống ở các làng từ tầng ${fromFloor(crop.tier)} và Chợ Thánh Địa, vào mùa ${it.type === "sapling" ? "nào cũng có" : seasons(crop)}`);
  }
  const made = RECIPES.filter((r) => r.out === id).sort((a, b) => a.level - b.level)[0];
  if (made) out.push(`⚒️ Chế ở ${STATION_NAMES[made.station]} (cấp ${made.level})`);
  const drops = Object.values(ENEMIES).map((def) => ({ def, d: def.drops.find((x) => x.item === id) })).filter((x) => x.d)
    .sort((a, b) => dropChance(b.def, b.d!.ch) - dropChance(a.def, a.d!.ch));
  if (drops.length) out.push(`⚔️ Quái rơi: ${drops.slice(0, 3).map((x) => x.def.name).join(", ")}${drops.length > 3 ? ` và ${drops.length - 3} loài khác` : ""}`);
  const region = regionSource(id);
  if (region) out.push(`🗺️ ${region}`);
  return out;
}

/** Crops with no seed on sale this season (to warn on a quest). */
export const outOfSeason = (id: string, season: number) => {
  const c = CROPS[id];
  return !!c && !c.hybrid && !c.seasons.includes(season as never) && CROP_LIST.includes(c);
};
