import type { StatMods } from "../combat/types";
import { GEAR_KEYS, addItem, charStats, equipGear, fitsGear, isTwoHanded, removeItem, syncLook, type Character, type GameState } from "../core/state";
import { classStats } from "../data/classes";
import { getItem, type GearKey } from "../data/items";

/**
 * Small "smart" helpers for the UI: how good a piece of gear is for a given character,
 * whether something in the bag is an upgrade, and one-tap best-gear equipping.
 */

/** Stat weights, tilted towards the stat the character's class actually attacks with. */
function weights(ch: Character): Record<keyof StatMods, number> {
  const base = classStats(ch.classId, 10);
  const magic = base.mag > base.atk;
  return { hp: 0.22, mp: magic ? 0.25 : 0.08, atk: magic ? 0.25 : 1.3, mag: magic ? 1.3 : 0.25, def: 0.8, res: 0.8, spd: 1.4, crit: 1.3, eva: 1.1 } as Record<keyof StatMods, number>;
}

export function gearScore(ch: Character, id: string | undefined, key: GearKey): number {
  if (!id) return 0;
  const eq = getItem(id).equip;
  if (!eq) return 0;
  const w = weights(ch);
  const f = key === "offhand" && eq.slot === "weapon" ? 0.5 : 1;
  let s = 0;
  for (const [k, v] of Object.entries(eq.stats) as [keyof StatMods, number][]) s += (w[k] ?? 0.5) * v * f;
  if (eq.passive) s += 4 + (eq.floor ?? 0) * 0.15;
  return s;
}

/** Best item in the bag for one slot (and its score), if any. */
function bestInBag(g: GameState, ch: Character, key: GearKey, exclude: Record<string, number> = {}) {
  let best: { id: string; score: number } | null = null;
  for (const [id, n] of Object.entries(g.inventory)) {
    if (n - (exclude[id] ?? 0) <= 0 || !fitsGear(key, id)) continue;
    const sc = gearScore(ch, id, key);
    if (!best || sc > best.score) best = { id, score: sc };
  }
  return best;
}

export interface GearPlan { key: GearKey; id: string; gain: number }

/** What auto-equip would change for this character (without changing anything). */
export function planBestGear(g: GameState, ch: Character): GearPlan[] {
  const plan: GearPlan[] = [];
  const used: Record<string, number> = {};
  const take = (id: string) => { used[id] = (used[id] ?? 0) + 1; };
  const cur = { ...ch.gear };
  // main hand first: a two-hander has to beat weapon + off hand together
  const w = bestInBag(g, ch, "weapon");
  const now = gearScore(ch, cur.weapon, "weapon") + (isTwoHanded(cur.weapon) ? 0 : gearScore(ch, cur.offhand, "offhand"));
  if (w) {
    const cand = isTwoHanded(w.id) ? w.score : w.score + Math.max(gearScore(ch, cur.offhand, "offhand"), 0);
    if (cand > now + 0.5 && w.score > gearScore(ch, cur.weapon, "weapon") + 0.5) {
      plan.push({ key: "weapon", id: w.id, gain: cand - now });
      take(w.id);
      cur.weapon = w.id;
      if (isTwoHanded(w.id)) delete cur.offhand;
    }
  }
  for (const key of GEAR_KEYS) {
    if (key === "weapon") continue;
    if (key === "offhand" && isTwoHanded(cur.weapon)) continue;
    const b = bestInBag(g, ch, key, used);
    const have = gearScore(ch, cur[key], key);
    if (b && b.score > have + 0.5) { plan.push({ key, id: b.id, gain: b.score - have }); take(b.id); cur[key] = b.id; }
  }
  return plan;
}

/** Equips the best gear from the bag; returns how many slots changed. */
export function autoEquip(g: GameState, ch: Character): number {
  const plan = planBestGear(g, ch);
  for (const p of plan) {
    if (!removeItem(g, p.id, 1)) continue;
    for (const x of equipGear(ch, p.key, p.id)) addItem(g, x, 1);
  }
  if (plan.length) {
    syncLook(ch);
    const s = charStats(ch);
    ch.hp = Math.min(ch.hp, s.hp);
    ch.mp = Math.min(ch.mp, s.mp);
  }
  return plan.length;
}

/** Party members for whom this bag item would be an upgrade. */
export function upgradeFor(g: GameState, id: string): string[] {
  const eq = getItem(id).equip;
  if (!eq) return [];
  const out: string[] = [];
  for (const cid of g.party) {
    const ch = g.chars[cid];
    if (!ch) continue;
    const keys = GEAR_KEYS.filter((k) => fitsGear(k, id));
    if (keys.some((k) => gearScore(ch, id, k) > gearScore(ch, ch.gear[k], k) + 0.5 && !(k === "offhand" && isTwoHanded(ch.gear.weapon)))) out.push(ch.name.split(" ")[0]);
  }
  return out;
}

/** Lower-case, accent-free text so "nhan" finds "Nhẫn". */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
