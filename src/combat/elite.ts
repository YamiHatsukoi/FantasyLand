import { hashString } from "../core/rng";
import type { Battle } from "./engine";
import type { Unit } from "./types";

/**
 * Elite monsters: a glowing aura on the map, a gold name in battle, much more health and one or
 * two affixes that change how the fight goes. They pay out far better than ordinary packs.
 */
export interface Affix {
  id: string;
  name: string;
  icon: string;
  desc: string;
  apply: (b: Battle, u: Unit) => void;
}

export const AFFIXES: Affix[] = [
  { id: "thorns", name: "Gai Độc", icon: "🌵", desc: "Phản 30% sát thương vật lý nhận vào.", apply: (b, u) => b.addStatus(u, "thorns", 99, 1, 0, u) },
  { id: "regen", name: "Tái Sinh", icon: "🧬", desc: "Hồi 5% máu mỗi lượt.", apply: (_b, u) => { u.passives.push("e_regen"); } },
  { id: "vampire", name: "Hút Máu", icon: "🩸", desc: "Hồi máu bằng 25% sát thương gây ra.", apply: (b, u) => b.addStatus(u, "lifesteal", 99, 1, 0, u) },
  { id: "swift", name: "Thần Tốc", icon: "💨", desc: "Luôn được Tăng Tốc.", apply: (b, u) => b.addStatus(u, "haste", 99, 1, 0, u) },
  { id: "fury", name: "Cuồng Nộ", icon: "💢", desc: "Dưới 40% máu thì đánh mạnh và nhanh hơn hẳn.", apply: (_b, u) => { u.passives.push("e_enrage"); } },
  { id: "bulwark", name: "Khiên Kép", icon: "🛡️", desc: "Khiên dày gấp đôi, khó phá hơn.", apply: (_b, u) => { u.shieldMax = (u.shieldMax ?? 2) * 2; u.shield = u.shieldMax; } },
  { id: "volatile", name: "Nổ Khi Chết", icon: "💣", desc: "Khi gục, phát nổ gây sát thương lửa lên cả đội bạn.", apply: () => undefined },
  { id: "mirror", name: "Gương Ma", icon: "🪞", desc: "Phản lại phép đơn mục tiêu đầu tiên.", apply: (b, u) => b.addStatus(u, "reflect", 99, 1, 0, u) },
  { id: "warded", name: "Bất Khả Xâm", icon: "✨", desc: "Miễn nhiễm hiệu ứng xấu trong 3 lượt đầu.", apply: (b, u) => b.addStatus(u, "immune", 3, 1, 0, u) },
  { id: "brutal", name: "Tàn Bạo", icon: "🔨", desc: "Luôn được tăng Công và Phép.", apply: (b, u) => { b.addStatus(u, "atkUp", 99, 1, 0, u); b.addStatus(u, "magUp", 99, 1, 0, u); } },
];
export const AFFIX = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

/** Chance (0..1) that a monster pack on floor n is led by an elite. None on the first floors. */
export const eliteChance = (floor: number) => (floor < 3 ? 0 : Math.min(0.2, 0.05 + floor * 0.0016));

/** Deterministic per map entity, so an elite stays elite across visits. */
export function isElitePack(seed: number, entityId: string, floor: number): boolean {
  return (hashString(`${seed}:${entityId}:elite`) % 1000) / 1000 < eliteChance(floor);
}

/** Turns a unit into an elite in place: tougher, a gold star, and its affixes. */
export function makeElite(b: Battle, u: Unit, floor: number, seed: number) {
  const n = floor >= 25 ? 2 : 1;
  const picks: Affix[] = [];
  let h = hashString(`${seed}:${u.uid}:affix`);
  while (picks.length < n) {
    const a = AFFIXES[h % AFFIXES.length];
    if (!picks.includes(a)) picks.push(a);
    h = Math.floor(h / 7) + 31;
  }
  u.elite = picks.map((a) => a.id);
  u.name = `★ ${u.name}`;
  u.level += 2;
  u.base = { ...u.base, hp: Math.round(u.base.hp * 2.4), atk: Math.round(u.base.atk * 1.2), mag: Math.round(u.base.mag * 1.2), def: Math.round(u.base.def * 1.1) };
  u.hp = u.base.hp;
  u.shieldMax = (u.shieldMax ?? 2) + 1;
  u.shield = u.shieldMax;
  for (const a of picks) a.apply(b, u);
  b.plan(u);
}
