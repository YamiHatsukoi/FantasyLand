/**
 * The 700 arena units, one per monster of the Abyss.
 *
 * Price: within each floor the six ordinary monsters are ranked by strength — the two weakest
 * cost 1, the next two 2, then one 3 and the strongest 4 — and the floor's boss costs 5. So
 * every floor brings a full range of prices, and a player who has only seen the first floors
 * still has units of every cost.
 *
 * Stats come from the price and the fighting role only (a floor-90 monster is no stronger than
 * a floor-1 one at the same price); the monster's own build only nudges them a little, so each
 * unit still feels like itself. The spell is the monster's signature skill, re-cut for the arena.
 */
import type { Element, Skill } from "../combat/types";
import { ENEMIES, type EnemyDef } from "../data/enemies";
import { SKILLS } from "../data/skills";
import { hashString } from "../core/rng";
import { getFloor } from "../world/floors";
import { CLASS_OF, KIND_OF, ORIGIN_OF } from "./traits";
import type { ArenaUnit, Cost, Debuff, Kind, Role, SpellBonus, SpellDef, SpellShape, UnitStats } from "./types";

// ------------------------------------------------------------ stats by price and role
const COST_HP = [0, 520, 620, 730, 850, 1000];
const COST_AD = [0, 46, 56, 66, 80, 96];
const COST_SPELL = [0, 200, 260, 330, 420, 560];

interface RoleTemplate { hp: number; ad: number; armor: number; mr: number; as: number; range: number; mana: number; start: number; crit: number }
const ROLE: Record<Role, RoleTemplate> = {
  tank: { hp: 1.3, ad: 0.8, armor: 45, mr: 45, as: 0.6, range: 1, mana: 100, start: 40, crit: 0.1 },
  brute: { hp: 1.15, ad: 1.05, armor: 35, mr: 35, as: 0.7, range: 1, mana: 80, start: 20, crit: 0.15 },
  assassin: { hp: 0.85, ad: 1.2, armor: 25, mr: 25, as: 0.8, range: 1, mana: 60, start: 10, crit: 0.25 },
  marksman: { hp: 0.75, ad: 1.15, armor: 20, mr: 20, as: 0.75, range: 4, mana: 70, start: 10, crit: 0.2 },
  mage: { hp: 0.75, ad: 0.7, armor: 20, mr: 25, as: 0.65, range: 4, mana: 70, start: 20, crit: 0.1 },
  support: { hp: 0.85, ad: 0.7, armor: 25, mr: 30, as: 0.65, range: 3, mana: 80, start: 30, crit: 0.1 },
};
export const RANGED: Role[] = ["marksman", "mage", "support"];

// ------------------------------------------------------------ what each monster is
const isHealer = (s: Skill) => (s.target === "ally" || s.target === "allies") && !!(s.heal || s.fx?.some((f) => ["regen", "shield", "barrier"].includes(f.s)));

function roleOf(def: EnemyDef): Role {
  const skills = def.skills.map((id) => SKILLS[id]).filter(Boolean);
  const b = def.base;
  if (skills.some(isHealer)) return "support";
  if (b.mag >= b.atk * 1.1) return "mage";
  if (def.tags.includes("flying") || def.tags.includes("spirit")) return "marksman";
  if (b.def + b.res >= (b.atk + b.mag) * 0.95 || skills.some((s) => ["shell_up", "r_volcano_harden", "r_glacier_shell"].includes(s.id))) return "tank";
  if (b.spd >= 104 || b.crit >= 8) return "assassin";
  return "brute";
}

function kindOf(def: EnemyDef): Kind {
  const t = def.tags;
  if (t.includes("flying")) return "flyer";
  if (t.includes("undead")) return "undead";
  if (t.includes("spirit")) return "spirit";
  if (t.includes("construct")) return "construct";
  if (t.includes("humanoid")) return "humanoid";
  if (t.includes("plant")) return "plant";
  return "beast";
}

/** One number for ranking the monsters of a floor against each other. */
const strength = (d: EnemyDef) => {
  const b = d.base;
  return b.hp / 8 + b.atk * 1.6 + b.mag * 1.6 + b.def + b.res + b.spd / 4 + b.crit + b.eva;
};

// ------------------------------------------------------------ spells
const DEBUFF: Record<string, Debuff> = {
  stun: "stun", frozen: "stun", sleep: "stun", rooted: "stun", confuse: "stun",
  burn: "burn", poison: "poison", bleed: "bleed", chill: "chill", slow: "chill", wet: "chill",
  armorBreak: "shred", resBreak: "shred", weaken: "weaken", curse: "weaken", doom: "weaken",
  blind: "blind", silence: "silence", vulnerable: "mark", mark: "mark",
};
const DEBUFF_DUR: Record<Debuff, number> = { stun: 1.5, burn: 3, poison: 4, bleed: 3, chill: 3, shred: 4, weaken: 4, blind: 3, silence: 2.5, mark: 4 };

/** How interesting a skill is as a signature (regional moves and area spells first). */
const flair = (s: Skill) => (s.id.startsWith("r_") ? 4 : 0) + (s.target === "enemies" ? 2 : 0) + (s.fx?.length ? 1 : 0) + (s.hits ? 1 : 0) + (s.power ?? 0);

/** The natural lingering effect of an element, given to spells that have none of their own. */
const EL_DEBUFF: Partial<Record<Element, Debuff>> = {
  fire: "burn", ice: "chill", poison: "poison", water: "chill", dark: "weaken", light: "blind", lightning: "stun", earth: "stun", wind: "shred", arcane: "silence",
};
/** Words that make each unit's spell name its own. */
const EPITHET: Record<Element, string[]> = {
  fire: ["Hỏa Ngục", "Than Hồng", "Lửa Đỏ", "Dung Nham", "Tro Tàn", "Liệt Diễm", "Hỏa Tinh", "Nham Thạch"],
  ice: ["Băng Giá", "Tuyết Lở", "Sương Muối", "Hàn Băng", "Vĩnh Đông", "Bạch Sương", "Băng Tinh", "Gió Bấc"],
  water: ["Thủy Triều", "Sóng Ngầm", "Mưa Rào", "Vực Thẳm", "Bọt Biển", "Lam Thủy", "Dòng Xoáy", "Thác Đổ"],
  earth: ["Đá Tảng", "Địa Chấn", "Rễ Cổ", "Cát Lún", "Núi Lở", "Hoàng Thổ", "Thạch Bì", "Đất Mẹ"],
  wind: ["Lốc Xoáy", "Cuồng Phong", "Gió Lộng", "Thiên Không", "Phong Nhận", "Mây Bay", "Vũ Phong", "Gió Nam"],
  poison: ["Kịch Độc", "Chướng Khí", "Nọc Đen", "Bào Tử", "Đầm Lầy", "Ô Uế", "Xà Độc", "Tử Khí"],
  lightning: ["Sấm Sét", "Lôi Đình", "Điện Xẹt", "Giông Bão", "Thiên Lôi", "Tia Chớp", "Lôi Quang", "Sét Hòn"],
  light: ["Thánh Quang", "Bình Minh", "Ánh Dương", "Hào Quang", "Thiên Sứ", "Kim Quang", "Rạng Đông", "Tinh Tú"],
  dark: ["Bóng Đêm", "U Minh", "Hắc Ám", "Vực Sâu", "Ác Mộng", "Hư Không", "Huyết Nguyệt", "Âm Hồn"],
  arcane: ["Huyền Bí", "Tinh Thể", "Ma Pháp", "Cổ Ngữ", "Ảo Ảnh", "Thiên Văn", "Linh Lực", "Phù Văn"],
  physical: ["Cuồng Nộ", "Sắt Thép", "Hoang Dã", "Thép Nguội", "Bạo Liệt", "Dã Thú", "Gân Guốc", "Xé Toạc"],
};
const BONUS_FOR: Record<string, SpellBonus[]> = {
  attack: ["selfShield", "selfHeal", "manaBack", "haste", "spread", "pierce", "stunChance", "critUp"],
  support: ["selfShield", "selfHeal", "manaBack", "haste", "armorUp"],
};

/** The 20 ultimates; each boss gets one, in its own element, no two bosses alike. */
export const ULTS: { shape: SpellShape; name: string; power: number; radius: number; hits: number }[] = [
  { shape: "meteor", name: "Mưa Thiên Thạch", power: 1.3, radius: 1, hits: 4 },
  { shape: "cataclysm", name: "Đại Tận Thế", power: 1.1, radius: 9, hits: 1 },
  { shape: "devour", name: "Nuốt Chửng", power: 2.6, radius: 1, hits: 1 },
  { shape: "summon", name: "Triệu Hồi Bầy Đàn", power: 1, radius: 1, hits: 2 },
  { shape: "blackhole", name: "Hố Đen Nuốt Trời", power: 1.4, radius: 2, hits: 1 },
  { shape: "chain", name: "Xích Lôi Liên Hoàn", power: 0.9, radius: 2, hits: 8 },
  { shape: "revive", name: "Hồi Sinh Đồng Loại", power: 0.6, radius: 9, hits: 1 },
  { shape: "timestop", name: "Ngưng Đọng Thời Gian", power: 0.6, radius: 9, hits: 1 },
  { shape: "frenzy", name: "Hóa Cuồng Thú", power: 1, radius: 0, hits: 1 },
  { shape: "prison", name: "Ngục Tù Vĩnh Cửu", power: 1.2, radius: 2, hits: 1 },
  { shape: "miasma", name: "Mây Tử Thần", power: 0.45, radius: 2, hits: 6 },
  { shape: "drainall", name: "Hút Cạn Sinh Khí", power: 1, radius: 9, hits: 1 },
  { shape: "aegis", name: "Thánh Thuẫn Bất Diệt", power: 1.6, radius: 9, hits: 1 },
  { shape: "rampage", name: "Cuồng Bạo Xung Phong", power: 1.8, radius: 1, hits: 1 },
  { shape: "mirror", name: "Gương Phản Chiếu", power: 0.8, radius: 0, hits: 1 },
  { shape: "volley", name: "Mưa Tên Hủy Diệt", power: 0.7, radius: 2, hits: 3 },
  { shape: "manaburn", name: "Thiêu Rụi Ma Lực", power: 1.2, radius: 9, hits: 1 },
  { shape: "quake", name: "Động Đất Diệt Thế", power: 1.6, radius: 2, hits: 1 },
  { shape: "swap", name: "Hoán Đổi Linh Hồn", power: 2.2, radius: 1, hits: 1 },
  { shape: "blizzard", name: "Bão Tố Tận Diệt", power: 0.5, radius: 9, hits: 5 },
];

function baseSpell(def: EnemyDef, role: Role): SpellDef {
  const skills = def.skills.map((id) => SKILLS[id]).filter(Boolean);
  const sk = [...skills].sort((a, b) => flair(b) - flair(a) || a.id.localeCompare(b.id))[0] ?? SKILLS.bite;
  const fx = sk.fx?.map((f) => DEBUFF[f.s]).find(Boolean);
  let shape: SpellShape;
  if (isHealer(sk)) shape = sk.heal ? "heal" : "shield";
  else if (sk.target === "allies") shape = "rally";
  else if (sk.target === "self") shape = sk.id === "regenerate" ? "heal" : ["rage", "r_bamboo_step"].includes(sk.id) ? "rally" : "fortify";
  else if (sk.target === "enemies") shape = sk.kind === "physical" ? "line" : "nova";
  else if ((sk.hits ?? 1) > 1 || sk.target === "random") shape = "multi";
  else if (role === "assassin") shape = "dash";
  else shape = sk.kind === "physical" ? "strike" : "bolt";
  const physical = sk.kind === "physical";
  const el: Element = sk.el === "physical" ? (physical ? "physical" : "arcane") : sk.el;
  return {
    id: sk.id, name: sk.name, icon: sk.icon, shape, el, physical,
    radius: shape === "nova" ? 1 : shape === "heal" || shape === "shield" || shape === "rally" ? 2 : 1,
    power: Math.max(0.5, sk.power ?? 1),
    hits: shape === "multi" ? Math.max(3, sk.hits ?? 3) : 1,
    debuff: fx ? { id: fx, dur: DEBUFF_DUR[fx] } : undefined,
    lifesteal: sk.sp?.some((s) => s.k === "lifesteal") ? 0.5 : undefined,
    execute: sk.sp?.some((s) => s.k === "execute") || undefined,
    bonus: "none",
    desc: "",
  };
}

/**
 * Gives every unit a spell of its own: a name, a second effect, and small differences in
 * power, reach and hits, so no two of the 600 ordinary units are alike. Bosses each get one of
 * the twenty ultimates, in their element, never the same pair twice.
 */
function personalise(units: { def: EnemyDef; role: Role; cost: Cost; el: Element; floor: number }[]): SpellDef[] {
  const usedNames = new Set<string>();
  const usedSig = new Set<string>();
  const usedUlt = new Set<string>();
  return units.map(({ def, role, cost, el, floor }) => {
    const h = hashString(`spell:${def.id}`);
    if (cost === 5) {
      // an ultimate: walk the list from a per-boss start until the (ultimate, element) pair is new
      const spellEl: Element = el;
      let i = (floor * 7 + h) % ULTS.length;
      for (let k = 0; k < ULTS.length && usedUlt.has(`${ULTS[i].shape}|${spellEl}`); k++) i = (i + 1) % ULTS.length;
      usedUlt.add(`${ULTS[i].shape}|${spellEl}`);
      const u = ULTS[i];
      const deb = EL_DEBUFF[spellEl];
      const names = EPITHET[spellEl];
      let name = `${u.name} ${names[h % names.length]}`;
      for (let k = 1; usedNames.has(name) && k < names.length; k++) name = `${u.name} ${names[(h + k) % names.length]}`;
      usedNames.add(name);
      const sp: SpellDef = {
        id: `ult_${u.shape}`, name, icon: "🌟", shape: u.shape, el: spellEl, physical: role !== "mage" && (u.shape === "rampage" || u.shape === "devour" || u.shape === "frenzy" || u.shape === "swap"),
        power: u.power * (0.95 + ((h >>> 8) % 11) / 100), radius: u.radius, hits: u.hits,
        debuff: deb ? { id: deb, dur: DEBUFF_DUR[deb] * 1.2 } : undefined, ult: true, bonus: "none", desc: "",
      };
      sp.desc = spellText(sp);
      return sp;
    }
    const sp = baseSpell(def, role);
    // a little variety in strength, reach and hits
    sp.power = Math.round(sp.power * (0.9 + ((h >>> 3) % 26) / 100) * 100) / 100;
    if (sp.shape === "nova" && cost >= 3 && (h & 1)) sp.radius = 2;
    if (sp.shape === "multi") sp.hits = 3 + ((h >>> 5) % 3) + (cost >= 3 ? 1 : 0);
    if (!sp.debuff && (h >>> 7) % 3 !== 0) { const d = EL_DEBUFF[sp.el === "physical" ? el : sp.el]; if (d) sp.debuff = { id: d, dur: DEBUFF_DUR[d] * 0.8 }; }
    // a second effect, chosen so that no two units share the same make-up
    const pool = ["heal", "shield", "rally", "fortify"].includes(sp.shape) ? BONUS_FOR.support : BONUS_FOR.attack;
    let bi = (h >>> 11) % pool.length;
    const sig = () => `${sp.shape}|${sp.el}|${sp.debuff?.id ?? "-"}|${pool[bi]}|${sp.hits}|${sp.radius}|${sp.physical}`;
    for (let k = 0; k < pool.length && usedSig.has(sig()); k++) bi = (bi + 1) % pool.length;
    usedSig.add(sig());
    sp.bonus = pool[bi];
    // its own name: the skill plus a word of the unit's element
    const words = EPITHET[sp.el === "physical" ? "physical" : el];
    let name = `${sp.name} ${words[h % words.length]}`;
    for (let k = 1; usedNames.has(name) && k < words.length * 2; k++) name = k < words.length ? `${sp.name} ${words[(h + k) % words.length]}` : `${sp.name} ${EPITHET[sp.el][(h + k) % 8]} ${words[(h + k * 3) % 8]}`;
    usedNames.add(name);
    sp.name = name;
    sp.desc = spellText(sp);
    return sp;
  });
}

export function spellText(s: SpellDef): string {
  const dmg = s.physical ? "sát thương vật lý" : "sát thương phép";
  const deb = s.debuff ? ` và ${DEBUFF_NAMES[s.debuff.id]} ${s.debuff.dur.toFixed(1).replace(".0", "")}s` : "";
  const base: Record<SpellShape, string> = {
    strike: `Giáng một đòn cực mạnh vào mục tiêu, gây ${dmg}${deb}.`,
    bolt: `Phóng phép vào mục tiêu, gây ${dmg}${deb}.`,
    multi: `Tung ${s.hits} đòn vào các kẻ địch ngẫu nhiên, mỗi đòn gây ${dmg}${deb}.`,
    nova: `Nổ tung quanh mục tiêu (bán kính ${s.radius} ô), gây ${dmg} cho mọi kẻ địch trong vùng${deb}.`,
    line: `Quét một đường thẳng, gây ${dmg} cho mọi kẻ địch trên đường${deb}.`,
    dash: `Lướt tới kẻ địch xa nhất và tấn công, gây ${dmg}${deb}.`,
    heal: `Hồi máu cho bản thân và đồng minh yếu nhất trong ${s.radius} ô.`,
    shield: `Tạo khiên cho bản thân và đồng minh trong ${s.radius} ô.`,
    rally: `Cổ vũ đồng minh trong ${s.radius} ô: tăng tốc đánh và sát thương trong 4 giây.`,
    fortify: `Tạo khiên lớn cho bản thân, tăng giáp và kháng phép, khiêu khích kẻ địch xung quanh.`,
    meteor: `Gọi ${s.hits} thiên thạch rơi xuống những kẻ địch ngẫu nhiên, mỗi viên nổ trong ${s.radius} ô, gây ${dmg}${deb}.`,
    cataclysm: `Giáng tai họa lên toàn bộ kẻ địch, gây ${dmg}${deb}.`,
    devour: `Nuốt chửng kẻ địch yếu máu nhất: gây ${dmg} cực lớn, nếu hạ gục được thì hồi 40% máu.`,
    summon: `Triệu hồi ${s.hits} thuộc hạ cùng tầng ra trận chiến đấu bên cạnh.`,
    blackhole: `Mở hố đen tại nơi đông kẻ địch nhất, hút chúng lại, gây ${dmg} và làm choáng 2 giây.`,
    chain: `Phóng sét nảy qua ${s.hits} kẻ địch, mỗi lần gây ${dmg}${deb}.`,
    revive: `Hồi sinh đồng minh đã gục gần nhất với 60% máu, rồi hồi máu cho cả đội.`,
    timestop: `Ngưng đọng thời gian: mọi kẻ địch bị choáng 1,5 giây và nhận ${dmg}.`,
    frenzy: `Hóa cuồng trong 6 giây: tăng mạnh tốc đánh và sát thương, hồi máu liên tục.`,
    prison: `Đóng băng mọi kẻ địch trong ${s.radius} ô quanh mục tiêu suốt 2,5 giây, gây ${dmg}.`,
    miasma: `Thả màn mây trong ${s.radius} ô quanh mục tiêu, tồn tại ${s.hits} giây, mỗi giây gây ${dmg}${deb}.`,
    drainall: `Hút sinh khí của mọi kẻ địch, gây ${dmg} và hồi máu bằng tổng sát thương gây ra.`,
    aegis: `Tạo khiên lớn cho toàn đội và giải mọi hiệu ứng xấu.`,
    rampage: `Lao thẳng qua đội hình địch, hất tung và gây ${dmg} cho mọi kẻ trên đường.`,
    mirror: `Trong 5 giây phản lại 60% sát thương nhận vào, đồng thời tăng giáp và kháng phép.`,
    volley: `Gọi ${s.hits} đợt mưa tên phủ ${s.radius} ô quanh mục tiêu, mỗi đợt gây ${dmg}${deb}.`,
    manaburn: `Đốt năng lượng mọi kẻ địch, gây ${dmg} cộng thêm theo năng lượng bị đốt.`,
    quake: `Dậm đất quanh mình ${s.radius} ô, gây ${dmg} và làm choáng 2 giây.`,
    swap: `Đổi chỗ với kẻ địch xa nhất, kéo nó vào giữa vòng vây, gây ${dmg} và làm choáng 2 giây.`,
    blizzard: `Gọi bão phủ toàn bàn trong ${s.hits} giây: mọi kẻ địch bị chậm và mỗi giây nhận ${dmg}.`,
  };
  const bonus: Record<SpellBonus, string> = {
    selfShield: " Bản thân nhận khiên nhỏ.", selfHeal: " Bản thân hồi một ít máu.", manaBack: " Hoàn lại 20 năng lượng.", haste: " Bản thân +30% tốc đánh trong 4 giây.",
    spread: " Hiệu ứng lan sang kẻ địch kế bên.", pierce: " Bỏ qua 40% giáp và kháng phép.", armorUp: " Tăng giáp và kháng phép cho người được giúp.", stunChance: " 30% làm choáng 1 giây.",
    critUp: " Bản thân +25% chí mạng trong 4 giây.", none: "",
  };
  return base[s.shape] + bonus[s.bonus] + (s.lifesteal ? " Hồi máu bằng một nửa sát thương gây ra." : "") + (s.execute ? " Gây thêm sát thương lên mục tiêu yếu máu." : "") + (s.ult ? " (Tối thượng)" : "");
}

export const DEBUFF_NAMES: Record<Debuff, string> = {
  stun: "làm choáng", burn: "thiêu đốt", poison: "gây độc", bleed: "gây chảy máu", chill: "làm tê cóng", shred: "phá giáp",
  weaken: "làm suy yếu", blind: "làm mù", silence: "câm lặng", mark: "đánh dấu",
};

// ------------------------------------------------------------ build
function build(def: EnemyDef, floor: number, cost: Cost, el: Element): ArenaUnit {
  const boss = cost === 5;
  const role = boss ? bossRole(def) : roleOf(def);
  const r = ROLE[role];
  // a little personality from the monster's own build, steady per monster
  const h = hashString(def.id);
  const tilt = (k: number) => 0.92 + ((h >>> k) % 17) / 100;
  const b = def.base;
  const tough = Math.min(1.12, Math.max(0.9, (b.def + b.res) / Math.max(1, b.atk + b.mag)));
  const stats: UnitStats = {
    hp: Math.round(COST_HP[cost] * r.hp * tilt(0) * (tough > 1 ? 1.04 : 1) / 10) * 10,
    ad: Math.round(COST_AD[cost] * r.ad * tilt(5)),
    ap: 100,
    armor: Math.round(r.armor * tough),
    mr: Math.round(r.mr * tough),
    as: Math.round(r.as * tilt(10) * 100) / 100,
    range: r.range,
    mana: r.mana + (boss ? 20 : 0),
    startMana: r.start,
    crit: r.crit,
  };
  const kind = kindOf(def);
  const traits = [ORIGIN_OF[el], CLASS_OF[role], KIND_OF[kind], ...(boss ? ["u_overlord"] : [])];
  return { id: def.id, name: def.name, sprite: def.sprite, palette: def.palette, floor, cost, role, origin: el, kind, traits, stats, spell: undefined as unknown as SpellDef, boss };
}

/** Bosses keep their nature but are front-liners or casters, never support. */
function bossRole(def: EnemyDef): Role {
  const r = roleOf(def);
  return r === "support" ? "mage" : r;
}

let cache: { list: ArenaUnit[]; byId: Record<string, ArenaUnit> } | null = null;
function all() {
  if (cache) return cache;
  const list: ArenaUnit[] = [];
  const defs: EnemyDef[] = [];
  for (let n = 1; n <= 100; n++) {
    const f = getFloor(n);
    const el: Element = f.el === "physical" ? "earth" : f.el; // the one physical floor joins the Earth origin
    const mobs = f.enemies.map((id) => ENEMIES[id]).filter(Boolean).sort((a, b) => strength(a) - strength(b) || a.id.localeCompare(b.id));
    const costs: Cost[] = [1, 1, 2, 2, 3, 4];
    mobs.forEach((d, i) => { list.push(build(d, n, costs[i] ?? 1, el)); defs.push(d); });
    const boss = f.boss.map((id) => ENEMIES[id]).find((d) => d?.boss);
    if (boss) { list.push(build(boss, n, 5, el)); defs.push(boss); }
  }
  const spells = personalise(list.map((u, i) => ({ def: defs[i], role: u.role, cost: u.cost, el: u.origin, floor: u.floor })));
  list.forEach((u, i) => { u.spell = spells[i]; });
  cache = { list, byId: Object.fromEntries(list.map((u) => [u.id, u])) };
  return cache;
}

export const arenaUnits = () => all().list;
export const arenaUnit = (id: string): ArenaUnit | undefined => all().byId[id];

// ------------------------------------------------------------ stars
/** Health and attack damage multiplier per star (1..4). */
export const STAR_MULT = [0, 1, 1.8, 3.24, 5.5];
/** Spell multiplier per star; at three and four stars spells grow faster than bodies. */
export const STAR_SPELL = [0, 1, 1.5, 2.4, 4];
/**
 * Extra power of dear units at three and four stars, as in TFT: a 4-gold ★3 is very strong
 * and a 5-gold ★3 is close to winning the fight alone. [cost][star] → health, attack, spell.
 */
const BOOST: Record<number, Record<number, [number, number, number]>> = {
  4: { 3: [1.35, 1.4, 1.8], 4: [1.6, 1.7, 2.5] },
  5: { 3: [2, 2.2, 4], 4: [2.6, 3, 6] },
};
export const starBoost = (cost: number, star: number): [number, number, number] => BOOST[cost]?.[star] ?? [1, 1, 1];
/** Spell value at one star for a unit (before AP and star). */
export const spellBase = (u: ArenaUnit) => COST_SPELL[u.cost] * u.spell.power;
