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
      // the doom is this turn's big blow: it spends any gathered power
      u.charged = false;
      u.chargeCd = 3;
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
  // ---------------------------------------------------------------- freaks of the deep: odd bodies and odd powers
  {
    id: "giant", name: "Khổng Lồ Bất Động", icon: "🏔️", desc: "Thân hình khổng lồ: thêm 60% máu, đòn nặng hơn 25%, nhưng chậm chạp.",
    start: (_b, u) => { u.base = { ...u.base, hp: Math.round(u.base.hp * 1.6), atk: Math.round(u.base.atk * 1.25), mag: Math.round(u.base.mag * 1.25), spd: Math.round(u.base.spd * 0.65) }; u.hp = u.base.hp; },
  },
  {
    id: "quicksilver", name: "Thân Thuỷ Ngân", icon: "💧", desc: "Nhanh hơn 40% và khó trúng (+18% né), đổi lại thân thể mềm yếu.",
    start: (_b, u) => { u.base = { ...u.base, spd: Math.round(u.base.spd * 1.4), eva: u.base.eva + 18, def: Math.round(u.base.def * 0.7), hp: Math.round(u.base.hp * 0.85) }; u.hp = u.base.hp; },
  },
  {
    id: "glass", name: "Pháo Thuỷ Tinh", icon: "💎", desc: "Đòn đánh mạnh gần gấp đôi nhưng máu chỉ còn 60%. Ai ra tay trước sẽ thắng.",
    start: (_b, u) => { u.base = { ...u.base, atk: Math.round(u.base.atk * 1.8), mag: Math.round(u.base.mag * 1.8), hp: Math.round(u.base.hp * 0.6) }; u.hp = u.base.hp; },
  },
  {
    id: "diamond", name: "Thân Kim Cương", icon: "🔷", desc: "Chỉ nhận 55% sát thương — trừ khi bị đánh trúng điểm yếu (khi đó +40%).",
  },
  {
    id: "vampire", name: "Huyết Quỷ", icon: "🦇", desc: "Luôn hút máu từ đòn đánh của mình.",
    start: (b, u) => b.addStatus(u, "lifesteal", 999, 1, 0, u),
  },
  {
    id: "enrage", name: "Phẫn Nộ Tích Tụ", icon: "😡", desc: "Mỗi lượt của boss, công và phép tăng thêm 5%. Đừng để trận đấu kéo dài.",
    turn: (b, u, n) => { u.base = { ...u.base, atk: Math.round(u.base.atk * 1.05), mag: Math.round(u.base.mag * 1.05) }; if (n % 4 === 0) b.announce(u, "Cơn Giận Dâng Cao"); },
  },
  {
    id: "gravity", name: "Trọng Lực Nghiền", icon: "🪨", desc: "Cứ 4 lượt lại nghiền cả đội mất 30% máu hiện có (không thể giết).",
    turn: (b, u, n) => { if (n % 4) return; b.announce(u, "Trọng Lực Nghiền Nát"); for (const t of allies(b, u)) b.damage(t, Math.max(1, Math.round(t.hp * 0.3)), "earth", { noKill: true }); },
  },
  {
    id: "silence", name: "Tiếng Thét Câm Lặng", icon: "🤐", desc: "Cứ 3 lượt lại làm câm người dùng phép mạnh nhất đội trong 2 lượt.",
    turn: (b, u, n) => {
      if (n % 3) return;
      const t = allies(b, u).sort((a, c) => b.stat(c, "mag") - b.stat(a, "mag"))[0];
      if (t) { b.addStatus(t, "silence", 2, 1, 0, u); b.announce(t, "Câm Lặng!"); }
    },
  },
  {
    id: "plague", name: "Dịch Bệnh Lan Tràn", icon: "☣️", desc: "Cứ 2 lượt lại rải độc lên cả đội.",
    turn: (b, u, n) => { if (n % 2) return; for (const t of allies(b, u)) b.addStatus(t, "poison", 3, 1, 0, u); },
  },
  {
    id: "nullheal", name: "Vùng Đất Chết", icon: "🥀", desc: "Cả đội bị nguyền suốt trận: hồi máu chỉ còn một nửa.",
    start: (b, u) => { for (const t of allies(b, u)) b.addStatus(t, "curse", 999, 1, 0, u); },
  },
  {
    id: "regen", name: "Thịt Tái Tạo", icon: "🧬", desc: "Mỗi lượt hồi 3% máu tối đa. Phá khiên để làm nó ngừng hồi.",
    turn: (b, u) => { if (!u.broken) b.heal(u, b.maxHp(u) * 0.03); },
  },
];
export const MECH = Object.fromEntries(MECHS.map((m) => [m.id, m]));

/** Hand-picked for the first bosses; the rest vary floor by floor (never twice in a row). */
const FIXED: Record<number, string> = { 1: "summon", 2: "countdown", 3: "drain" };
export function mechForFloor(n: number): BossMech {
  if (FIXED[n]) return MECH[FIXED[n]];
  const pool = poolFor(n);
  const pick = (k: number) => pool[hashString(`boss-mech:${k}`) % pool.length];
  const m = pick(n);
  return n > 1 && pick(n - 1).id === m.id ? pool[(pool.indexOf(m) + 1) % pool.length] : m;
}

/** The odd bodies and odd powers only show up past floor 20. */
const DEEP = new Set(["giant", "quicksilver", "glass", "diamond", "vampire", "enrage", "gravity", "silence", "plague", "nullheal", "regen"]);
const SHALLOW = MECHS.filter((m) => !DEEP.has(m.id));
const poolFor = (n: number) => (n <= 20 ? SHALLOW : MECHS);

/**
 * How dangerous each trick is. A boss stacks tricks until it reaches its floor's danger budget,
 * so deeper guardians are stranger and harder without a random combination turning into a wall.
 */
const THREAT: Record<string, number> = {
  summon: 1, rally: 1.5, countdown: 1.4, shift: 0.5, mirror: 0.7, rebirth: 1.2, frenzy: 1.2, curse: 1, drain: 0.6, dispel: 0.8,
  split: 1.2, storm: 1, petrify: 1, thorns: 0.8, timer: 1, absorb: 0.6, giant: 1.2, quicksilver: 1.4, glass: 1, diamond: 1.1,
  vampire: 0.9, enrage: 1.3, gravity: 1.3, silence: 0.8, plague: 0.9, nullheal: 1, regen: 1.1,
};
const threat = (id: string) => THREAT[id] ?? 1;

/** Danger budget of a floor's guardian: one trick at the top, about three and a half at the bottom. */
export const threatBudget = (n: number) => 1 + (2.6 * (Math.min(100, Math.max(1, n)) - 1)) / 99;

/** Never stacked together (one would cancel the other, or the fight turns unwinnable). */
const CLASH: [string, string][] = [
  ["giant", "glass"], ["giant", "quicksilver"], ["glass", "quicksilver"], ["diamond", "absorb"], ["rebirth", "split"], ["regen", "rebirth"],
  ["enrage", "timer"], ["mirror", "diamond"], ["countdown", "petrify"], ["countdown", "silence"],
  // minions that keep the boss at half damage forever
  ["rally", "summon"], ["rally", "split"], ["quicksilver", "frenzy"],
  // a weakness that keeps moving can't stop the healing
  ["regen", "shift"], ["regen", "countdown"],
];
const clashes = (a: string, b: string) => CLASH.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** The boss's full set of tricks: its signature first, then extra ones picked per floor within the budget. */
export function mechsForFloor(n: number): BossMech[] {
  const out = [mechForFloor(n)];
  let total = threat(out[0].id);
  const budget = threatBudget(n);
  const pool = poolFor(n);
  for (let k = 0; k < 60 && out.length < 4; k++) {
    const m = pool[hashString(`boss-mech:${n}:${k}`) % pool.length];
    if (out.includes(m) || out.some((o) => clashes(o.id, m.id))) continue;
    if (total + threat(m.id) > budget + 0.25) continue;
    out.push(m);
    total += threat(m.id);
  }
  return out;
}
