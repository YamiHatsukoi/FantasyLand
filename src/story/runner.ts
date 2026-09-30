import { makeRoom } from "../world/town";
import { MARK_BONUS, isMilestone } from "../core/state";
import { Rng } from "../core/rng";
import { XP_RATE, addItem, charStats, giveXp, logMsg, makeCharacter, recruit, removeItem, syncLook, type GameState } from "../core/state";
import { CLASSES, COMPANIONS } from "../data/classes";
import { gearForFloor, getItem } from "../data/items";
import { SKILLS } from "../data/skills";
import { BIOMES } from "../world/biomes";
import { getFloor, levelBase } from "../world/floors";
import type { Attr, Cond, Effect } from "./types";

export interface StoryCtx {
  g: GameState;
  floor: number; // 0 = safe zone
  vars: Record<string, string>;
  rng: Rng;
}

export function fillText(text: string, ctx: StoryCtx): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === "hero") return ctx.g.chars[ctx.g.heroId]?.name ?? "Người Chuyển Sinh";
    return ctx.vars[k] ?? `{${k}}`;
  });
}

export function evalCond(c: Cond | undefined, ctx: StoryCtx): boolean {
  if (!c) return true;
  const g = ctx.g;
  if ("flag" in c) {
    const flag = fillText(c.flag, ctx);
    return c.eq === undefined ? Boolean(g.flags[flag]) : g.flags[flag] === c.eq;
  }
  if ("notFlag" in c) return !g.flags[fillText(c.notFlag, ctx)];
  if ("has" in c) return (g.inventory[c.has] ?? 0) >= (c.n ?? 1);
  if ("party" in c) return g.party.includes(c.party);
  if ("recruited" in c) return Boolean(g.chars[c.recruited]);
  if ("gold" in c) return g.gold >= c.gold;
  if ("rank" in c) return (g.buildings.find((b) => b.type === "house")?.level ?? 1) >= c.rank;
  if ("all" in c) return c.all.every((x) => evalCond(x, ctx));
  if ("any" in c) return c.any.some((x) => evalCond(x, ctx));
  if ("not" in c) return !evalCond(c.not, ctx);
  return true;
}

export function condText(c: Cond | undefined): string {
  if (!c) return "";
  if ("has" in c) return `Cần ${c.n ?? 1} ${getItem(c.has).name}`;
  if ("party" in c) return `Cần ${COMPANIONS[c.party]?.name ?? c.party} trong đội`;
  if ("gold" in c) return `Cần ${c.gold} vàng`;
  if ("rank" in c) return `Thánh Địa cần đạt hạng ${["", "Trại", "Xóm", "Làng", "Thị Trấn", "Thành Phố", "Kinh Đô"][c.rank]}`;
  if ("all" in c) return c.all.map(condText).filter(Boolean).join(", ");
  return "Chưa đủ điều kiện";
}

export const ATTR_NAMES: Record<Attr, string> = { str: "Sức mạnh", int: "Trí tuệ", agi: "Nhanh nhẹn", wil: "Ý chí", luck: "May mắn" };

/** Best party member for an attribute check and their bonus. */
export function attrBonus(attr: Attr, g: GameState): { bonus: number; who: string } {
  if (attr === "luck") return { bonus: 0, who: g.chars[g.heroId].name };
  let best = { bonus: -99, who: "" };
  for (const id of g.party) {
    const ch = g.chars[id];
    if (!ch) continue;
    const s = charStats(ch);
    const b = attr === "str" ? Math.floor(s.atk / 6) : attr === "int" ? Math.floor(s.mag / 6) : attr === "wil" ? Math.floor(s.res / 5) : Math.floor((s.spd - 90) / 4) + Math.floor(s.eva / 5);
    if (b > best.bonus) best = { bonus: b, who: ch.name };
  }
  return best;
}

export interface CheckResult {
  roll: number;
  bonus: number;
  total: number;
  dc: number;
  pass: boolean;
  who: string;
}

export function rollCheck(attr: Attr, dc: number, ctx: StoryCtx): CheckResult {
  const { bonus, who } = attrBonus(attr, ctx.g);
  const roll = ctx.rng.int(1, 20);
  const total = roll + bonus;
  return { roll, bonus, total, dc, pass: roll === 20 || (roll !== 1 && total >= dc), who };
}

/** Random floor materials for loot effects and chests. */
export function randomLoot(ctx: StoryCtx, n: number): Record<string, number> {
  const out: Record<string, number> = {};
  const biome = BIOMES[getFloor(Math.max(1, ctx.floor)).biome];
  for (let i = 0; i < n; i++) {
    const node = ctx.rng.weighted(biome.nodes, (x) => x.w);
    out[node.item] = (out[node.item] ?? 0) + ctx.rng.int(1, 2);
  }
  if (n >= 3 && ctx.rng.chance(0.3)) {
    const id = gearForFloor(Math.max(1, ctx.floor), (xs) => ctx.rng.pick(xs)).id;
    out[id] = (out[id] ?? 0) + 1;
  }
  if (ctx.rng.chance(0.25)) {
    const potion = ctx.rng.pick(["potion_hp", "potion_mp", "bread", "antidote"]);
    out[potion] = (out[potion] ?? 0) + 1;
  }
  return out;
}

export function giveToGame(g: GameState, items: Record<string, number>): string[] {
  const lines: string[] = [];
  for (const [id, n] of Object.entries(items)) {
    if (n === 0) continue;
    addItem(g, id, n);
    if (g.expedition && n > 0) g.expedition.bag[id] = (g.expedition.bag[id] ?? 0) + n;
    const it = getItem(id);
    lines.push(`${it.icon} ${it.name} ×${n}`);
  }
  return lines;
}

/**
 * Applies a non-battle effect. Returns short display strings ("+2 Gỗ", "Lyra gia nhập", ...).
 */
export function applyEffect(e: Effect, ctx: StoryCtx): string[] {
  const g = ctx.g;
  const lb = levelBase(Math.max(1, ctx.floor));
  if ("give" in e) return giveToGame(g, e.give);
  if ("take" in e) {
    const out: string[] = [];
    for (const [id, n] of Object.entries(e.take)) if (removeItem(g, id, n)) out.push(`-${n} ${getItem(id).name}`);
    return out;
  }
  if ("gold" in e) {
    g.gold = Math.max(0, g.gold + e.gold);
    if (g.expedition && e.gold > 0) g.expedition.bagGold += e.gold;
    return [`${e.gold > 0 ? "+" : ""}${e.gold} vàng`];
  }
  if ("goldF" in e) return applyEffect({ gold: Math.round(e.goldF * (1 + (ctx.floor - 1) * 0.5)) }, ctx);
  if ("loot" in e) return giveToGame(g, randomLoot(ctx, e.loot));
  if ("xp" in e || "xpF" in e) {
    const amount = Math.max(1, Math.round(("xp" in e ? e.xp : e.xpF * lb * 3) * XP_RATE));
    const out = [`+${amount} kinh nghiệm`];
    for (const id of g.party) {
      const ch = g.chars[id];
      if (ch) out.push(...giveXp(ch, amount));
    }
    return out;
  }
  if ("flag" in e) {
    g.flags[fillText(e.flag, ctx)] = e.v ?? true;
    return [];
  }
  if ("recruit" in e) {
    if (g.chars[e.recruit]) return [];
    const ch = recruit(g, e.recruit);
    logMsg(g, `${ch.name} gia nhập.`);
    // story companions always come along; ordinary settlers make way if the beds are full
    const moved = makeRoom(g);
    return [`🤝 ${ch.name} gia nhập${g.party.includes(e.recruit) ? " đội" : " (đợi ở Thánh Địa)"}`, ...(moved ? [moved] : [])];
  }
  if ("learn" in e) {
    const ch = g.chars[e.to ?? g.heroId];
    const sk = SKILLS[e.learn];
    if (!ch || !sk || ch.skills.includes(sk.id)) return [];
    ch.skills.push(sk.id);
    if (ch.equipped.length < 5) ch.equipped.push(sk.id);
    return [`📘 ${ch.name} học ${sk.name}`];
  }
  if ("heal" in e || "hurt" in e || "mp" in e) {
    for (const id of g.party) {
      const ch = g.chars[id];
      if (!ch) continue;
      const s = charStats(ch);
      if ("heal" in e) ch.hp = Math.min(s.hp, ch.hp + Math.round(s.hp * e.heal));
      if ("hurt" in e) ch.hp = Math.max(1, ch.hp - Math.round(s.hp * e.hurt));
      if ("mp" in e) ch.mp = Math.min(s.mp, ch.mp + Math.round(s.mp * e.mp));
    }
    if ("heal" in e) return [`💚 Hồi ${Math.round(e.heal * 100)}% máu`];
    if ("hurt" in e) return [`💔 Mất ${Math.round(e.hurt * 100)}% máu`];
    return [`🔹 Hồi ${Math.round(e.mp * 100)}% MP`];
  }
  if ("clearFloor" in e) {
    const fs = g.floors[ctx.floor];
    if (fs) fs.cleared = true;
    g.flags[`f${ctx.floor}_cleared`] = true;
    g.maxFloor = Math.max(g.maxFloor, Math.min(100, ctx.floor + 1));
    logMsg(g, `Đánh bại Boss Canh Cửa tầng ${ctx.floor}.`);
    const out = [`🔓 Mở đường xuống tầng ${ctx.floor + 1}`];
    // every tenth floor is a milestone: a trophy chest and a lasting mark for the whole party
    if (isMilestone(ctx.floor) && !g.flags[`mile_${ctx.floor}`]) {
      g.flags[`mile_${ctx.floor}`] = true;
      g.flags.marks = Number(g.flags.marks ?? 0) + 1;
      out.push(`⭐ Tầng Mốc ${ctx.floor}! Dấu Ấn thứ ${g.flags.marks}: cả đội vĩnh viễn +${MARK_BONUS * 100}% mọi chỉ số (tổng +${Math.round(Number(g.flags.marks) * MARK_BONUS * 100)}%).`);
      out.push(...giveToGame(g, { ...randomLoot(ctx, 8), mana_crystal: 5, monster_core: 3 }));
      const gold = 400 * (ctx.floor / 10);
      g.gold += gold;
      if (g.expedition) g.expedition.bagGold += gold;
      out.push(`+${gold} vàng từ rương báu của Tầng Mốc`);
      logMsg(g, `Chinh phục Tầng Mốc ${ctx.floor}.`);
    }
    return out;
  }
  if ("setClass" in e) {
    const hero = g.chars[g.heroId];
    const fresh = makeCharacter(hero.id, hero.name, e.setClass, `hero_${e.setClass}`, hero.level);
    fresh.pal = hero.pal;
    fresh.points = hero.points;
    fresh.alloc = hero.alloc;
    syncLook(fresh);
    g.chars[g.heroId] = fresh;
    return [`${CLASSES[e.setClass].icon} ${CLASSES[e.setClass].name}`];
  }
  return [];
}
