import { BUILDINGS, costFor } from "./buildings";
import { ENEMIES, type EnemyDef } from "./enemies";
import { BIOME_MATS, CROPS, ITEMS, baseItemId } from "./items";
import { RECIPES, STATION_NAMES } from "./recipes";

/**
 * "What is this for?" and "where do I get it?" for any item, built once from the recipe,
 * building and monster tables so it never goes out of date.
 */

export interface UseLine { icon: string; text: string }

/** Optional catalysts for the forge's enhancement bench (the three gems nothing else used). */
export const CATALYSTS: Record<string, { name: string; short: string; desc: string }> = {
  seal_gem: { name: "Ngọc Ấn Cổ", short: "Chắc chắn thành công", desc: "Đặt lên bàn cường hoá: lần cường hoá đó chắc chắn thành công." },
  tiger_eye: { name: "Ngọc Mắt Hổ", short: "+25% tỉ lệ thành công", desc: "Đặt lên bàn cường hoá: tăng 25% tỉ lệ thành công của lần đó." },
  soul_gem: { name: "Ngọc Hồn Đen", short: "Thất bại được hoàn vàng", desc: "Đặt lên bàn cường hoá: nếu thất bại, toàn bộ vàng được hoàn lại." },
};

let usesIdx: Map<string, UseLine[]> | null = null;
const push = (m: Map<string, UseLine[]>, id: string, line: UseLine) => {
  const l = m.get(id) ?? [];
  if (!l.some((x) => x.text === line.text)) l.push(line);
  m.set(id, l);
};
const nameOf = (id: string) => ITEMS[id]?.name ?? id;

function buildUses() {
  const m = new Map<string, UseLine[]>();
  for (const r of RECIPES) for (const k of Object.keys(r.cost)) {
    if (k === "gold") continue;
    push(m, k, { icon: "🔨", text: `${nameOf(r.out)} — ${STATION_NAMES[r.station]}` });
  }
  for (const b of Object.values(BUILDINGS)) {
    for (let lv = 0; lv < b.maxLevel; lv++) {
      let cost: Record<string, number>;
      try { cost = costFor(b.id, lv); } catch { continue; }
      for (const k of Object.keys(cost)) if (k !== "gold") push(m, k, { icon: "🏗️", text: lv === 0 ? `Xây ${b.name}` : `Nâng cấp ${b.name}` });
    }
  }
  for (const [id, c] of Object.entries(CATALYSTS)) push(m, id, { icon: "✨", text: `Cường hoá: ${c.short}` });
  for (const it of Object.values(ITEMS)) if ((it.type === "seed" || it.type === "sapling") && it.crop && CROPS[it.crop]) push(m, it.id, { icon: "🌱", text: `Gieo ra ${CROPS[it.crop].name}` });
  return m;
}

/** Things this item is an ingredient of (recipes, buildings, the forge...). */
export function usesOf(id: string): UseLine[] {
  usesIdx ??= buildUses();
  return usesIdx.get(baseItemId(id)) ?? [];
}

/** Effective drop chance in battle: ordinary monsters roll their table at 40%. */
export const dropChance = (def: EnemyDef, ch: number) => (def.boss ? ch : ch * 0.4);

/** Monsters that drop the item, split into ones the player has met and how many more exist. */
export function droppedBy(id: string, seen: Record<string, unknown>): { known: { def: EnemyDef; ch: number }[]; unknown: number } {
  const known: { def: EnemyDef; ch: number }[] = [];
  let unknown = 0;
  for (const def of Object.values(ENEMIES)) {
    const d = def.drops.find((x) => x.item === id);
    if (!d) continue;
    if (seen[def.id]) known.push({ def, ch: dropChance(def, d.ch) });
    else unknown++;
  }
  known.sort((a, b) => b.ch - a.ch);
  return { known, unknown };
}

/** Regions whose monsters leave this item behind (hides, fibres, herbs and gems of a biome). */
export function regionSource(id: string): string | null {
  for (const [biome, m] of Object.entries(BIOME_MATS)) {
    if (id === m.gem) return `Quái vùng ${REGION_NAMES[biome] ?? biome} (5% mỗi con, boss chắc chắn rơi)`;
    if (id === m.hide || id === m.fiber || id === m.herb) return `Quái vùng ${REGION_NAMES[biome] ?? biome} (45% rơi vật liệu vùng, thú hay rơi da, cây hay rơi sợi)`;
  }
  return null;
}

export const REGION_NAMES: Record<string, string> = {
  forest: "Rừng", desert: "Sa Mạc", swamp: "Đầm Lầy", tundra: "Lãnh Nguyên Tuyết", fungal: "Rừng Nấm", volcano: "Núi Lửa", reef: "Rạn San Hô",
  bamboo: "Rừng Trúc", crystal: "Hang Pha Lê", autumn: "Rừng Thu", ruins: "Phế Tích Cổ", sakura: "Vườn Anh Đào", bonewaste: "Hoang Mạc Xương",
  jungle: "Rừng Mưa", glacier: "Sông Băng",
};
