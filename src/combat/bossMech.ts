import { hashString } from "../core/rng";
import type { Battle } from "./engine";
import type { Element, Unit } from "./types";

/**
 * Every floor boss has one signature trick. It is shown on its name plate from the start, so the
 * fight is about answering it: kill the adds, save up for the countdown, burst through the rebirth...
 */
export interface BossMech {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Once, when the fight starts. */
  start?: (b: Battle, u: Unit) => void;
  /** At the start of each of the boss's turns (n counts from 1). */
  turn?: (b: Battle, u: Unit, n: number) => void;
  /** Once per threshold the first time its health drops below it. */
  low?: Partial<Record<"60" | "50" | "30", (b: Battle, u: Unit) => void>>;
}

const ELS: Element[] = ["fire", "ice", "lightning", "water", "earth", "wind", "light", "dark", "poison"];

const allies = (b: Battle, u: Unit) => b.opponents(u);

export const MECHS: BossMech[] = [
  {
    id: "summon", name: "Triệu Hồi Tay Sai", icon: "📯", desc: "Khi còn 60% và 30% máu sẽ gọi thêm tay sai vào trận.",
    low: { "60": (b, u) => b.spawnMinion(u), "30": (b, u) => b.spawnMinion(u) },
  },
  {
    id: "rally", name: "Hiệu Lệnh Bầy Đàn", icon: "🚩", desc: "Mở đầu trận với 2 tay sai. Còn tay sai đứng thì boss chỉ nhận một nửa sát thương.",
    start: (b, u) => { b.spawnMinion(u); b.spawnMinion(u); },
  },
  {
    id: "countdown", name: "Đồng Hồ Diệt Vong", icon: "⏳", desc: "Đếm ngược 5 lượt rồi giáng đòn cực mạnh lên cả đội. Mỗi lần bị phá khiên, đồng hồ lùi thêm 2 lượt.",
    start: (_b, u) => { u.mechCount = 5; },
    turn: (b, u) => {
      u.mechCount = (u.mechCount ?? 5) - 1;
      if (u.mechCount > 0) return;
      b.announce(u, "Diệt Vong Giáng Xuống!");
      for (const t of allies(b, u)) b.damage(t, Math.round(b.maxHp(t) * (b.has(t, "guard") ? 0.25 : 0.55)), "dark", { noKill: true });
      u.mechCount = 5;
    },
  },
  {
    id: "shift", name: "Giáp Vạn Hoá", icon: "🔄", desc: "Cứ 2 lượt lại đổi sang một điểm yếu khác.",
    turn: (b, u, n) => {
      if (n % 2) return;
      for (const [k, v] of Object.entries(u.resist)) if ((v ?? 1) > 1) delete u.resist[k as Element];
      const pool = ELS.filter((e) => (u.resist[e] ?? 1) >= 1);
      u.resist[pool[(n * 7 + u.level) % pool.length]] = 1.5;
      b.announce(u, "Đổi Điểm Yếu");
    },
  },
  {
    id: "mirror", name: "Gương Phản Chiếu", icon: "🪞", desc: "Cứ 3 lượt lại dựng gương phản lại phép đơn mục tiêu kế tiếp.",
    turn: (b, u, n) => { if (n % 3 === 1) b.addStatus(u, "reflect", 3, 1, 0, u); },
  },
  {
    id: "rebirth", name: "Tái Sinh Một Lần", icon: "🔥", desc: "Lần đầu gục ngã sẽ sống lại với 40% máu.",
  },
  {
    id: "frenzy", name: "Càng Đau Càng Nhanh", icon: "⚡", desc: "Dưới 50% máu được Tăng Tốc, dưới 30% thì nổi điên.",
    low: { "50": (b, u) => { b.addStatus(u, "haste", 99, 1, 0, u); b.announce(u, "Tăng Tốc!"); }, "30": (b, u) => { b.addStatus(u, "berserk", 99, 1, 0, u); b.announce(u, "Điên Loạn!"); } },
  },
  {
    id: "curse", name: "Nguyền Rủa Lan Truyền", icon: "🪬", desc: "Cứ 3 lượt lại nguyền rủa và làm suy yếu cả đội.",
    turn: (b, u, n) => { if (n % 3) return; b.announce(u, "Lời Nguyền Lan Ra"); for (const t of allies(b, u)) { b.addStatus(t, "curse", 3, 1, 0, u); b.addStatus(t, "weaken", 2, 1, 0, u); } },
  },
  {
    id: "drain", name: "Hút Cạn Ma Lực", icon: "🌀", desc: "Mỗi lượt hút 12% MP của cả đội.",
    turn: (b, u) => { for (const t of allies(b, u)) t.mp = Math.max(0, t.mp - Math.round(b.maxMp(t) * 0.12)); },
  },
  {
    id: "dispel", name: "Xoá Phép", icon: "🚫", desc: "Cứ 3 lượt lại xoá mọi hiệu ứng tốt trên cả đội.",
    turn: (b, u, n) => { if (n % 3) return; b.announce(u, "Xoá Sạch Phép"); for (const t of allies(b, u)) b.removeBuffs(t); },
  },
  {
    id: "split", name: "Phân Thân", icon: "👥", desc: "Khi còn 50% máu tách ra một bản sao.",
    low: { "50": (b, u) => b.spawnClone(u) },
  },
  {
    id: "storm", name: "Bão Nguyên Tố", icon: "🌪️", desc: "Mỗi lượt quất bão nhỏ lên cả đội (5% máu).",
    turn: (b, u) => { const el = (Object.entries(u.resist).find(([, v]) => (v ?? 1) < 1)?.[0] as Element) ?? "arcane"; for (const t of allies(b, u)) b.damage(t, Math.max(1, Math.round(b.maxHp(t) * 0.05)), el, { dot: true, noKill: true }); },
  },
  {
    id: "petrify", name: "Ánh Nhìn Hoá Đá", icon: "🗿", desc: "Cứ 4 lượt lại hoá đá người mạnh nhất đội trong 1 lượt.",
    turn: (b, u, n) => {
      if (n % 4) return;
      const t = allies(b, u).sort((a, c) => b.stat(c, "atk") + b.stat(c, "mag") - b.stat(a, "atk") - b.stat(a, "mag"))[0];
      if (t) { b.addStatus(t, "petrify", 1, 1, 0, u); b.announce(t, "Hoá Đá!"); }
    },
  },
  {
    id: "thorns", name: "Da Gai Ngược", icon: "🌵", desc: "Luôn có Gai phản; cứ 3 lượt lại vào thế Phản Đòn.",
    start: (b, u) => b.addStatus(u, "thorns", 99, 1, 0, u),
    turn: (b, u, n) => { if (n % 3 === 0) b.addStatus(u, "counter", 2, 1, 0, u); },
  },
  {
    id: "timer", name: "Cơn Thịnh Nộ Muộn", icon: "💢", desc: "Sau 10 lượt của boss, sức mạnh tăng gấp bội. Đánh nhanh thắng nhanh!",
    turn: (b, u, n) => { if (n === 10) { b.addStatus(u, "empower", 99, 1, 0, u); b.addStatus(u, "atkUp", 99, 2, 0, u); b.addStatus(u, "magUp", 99, 2, 0, u); b.announce(u, "Thịnh Nộ Bùng Phát!"); } },
  },
  {
    id: "absorb", name: "Nuốt Nguyên Tố", icon: "🫗", desc: "Đòn cùng hệ với boss sẽ hồi máu cho nó thay vì gây sát thương.",
    start: (_b, u) => { const el = Object.entries(u.resist).find(([, v]) => (v ?? 1) < 1)?.[0] as Element | undefined; if (el) u.resist[el] = -0.5; },
  },
];
export const MECH = Object.fromEntries(MECHS.map((m) => [m.id, m]));

/** Hand-picked for the first bosses; the rest vary floor by floor (never twice in a row). */
const FIXED: Record<number, string> = { 1: "summon", 2: "countdown", 3: "drain" };
export function mechForFloor(n: number): BossMech {
  if (FIXED[n]) return MECH[FIXED[n]];
  const pick = (k: number) => MECHS[hashString(`boss-mech:${k}`) % MECHS.length];
  const m = pick(n);
  return n > 1 && pick(n - 1).id === m.id ? MECHS[(MECHS.indexOf(m) + 1) % MECHS.length] : m;
}
