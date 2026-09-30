import type { StatMods } from "../combat/types";
import { KIND_NAMES, type GearKey, type ItemDef } from "../data/items";

export const GEAR_NAMES: Record<GearKey, string> = {
  weapon: "Vũ khí", offhand: "Tay phụ", head: "Mũ", armor: "Giáp", hands: "Găng tay", legs: "Giáp chân",
  feet: "Giày", neck: "Vòng cổ", ring: "Nhẫn 1", ring2: "Nhẫn 2", earring: "Hoa tai",
};
export const GEAR_ICONS: Record<GearKey, string> = {
  weapon: "⚔️", offhand: "🛡️", head: "⛑️", armor: "🦺", hands: "🧤", legs: "👖", feet: "🥾", neck: "📿", ring: "💍", ring2: "💍", earring: "💎",
};
export const RARITY_NAMES = { common: "Thường", rare: "Hiếm", epic: "Sử thi", legendary: "Huyền thoại" } as const;

/** "Trường Kiếm · Một tay · Hiếm · Tầng 12" */
export function gearTags(it: ItemDef): string[] {
  const eq = it.equip;
  if (!eq) return [];
  const out = [KIND_NAMES[eq.kind ?? ""] ?? GEAR_NAMES[eq.slot as GearKey]];
  if (eq.slot === "weapon") out.push(eq.hands === 2 ? "Hai tay" : "Một tay");
  if (eq.slot === "offhand") out.push("Tay phụ");
  if (eq.rarity && eq.rarity !== "common") out.push(RARITY_NAMES[eq.rarity]);
  if (eq.floor) out.push(`Tầng ${eq.floor}`);
  return out;
}
export const rarityClass = (it: ItemDef) => `r-${it.equip?.rarity ?? "common"}`;

export function scaleStats(s: StatMods, f: number): StatMods {
  const out: StatMods = {};
  for (const [k, v] of Object.entries(s) as [keyof StatMods, number][]) out[k] = Math.round(v * f);
  return out;
}
/** b - a, only the keys that differ. */
export function statDiff(a: StatMods, b: StatMods): StatMods {
  const out: StatMods = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof StatMods>) {
    const d = (b[k] ?? 0) - (a[k] ?? 0);
    if (d) out[k] = d;
  }
  return out;
}
