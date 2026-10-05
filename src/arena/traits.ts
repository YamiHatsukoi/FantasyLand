/**
 * Arena traits. Every unit has an origin (its home floor's element), a class (its fighting
 * role) and a kind (what sort of creature it is); bosses also carry their own one-unit trait.
 * Each trait lights up at its breakpoints; `vals[i]` is the strength at breakpoint i, read by
 * the combat engine (src/arena/combat.ts). Descriptions show `{0}` as the value per tier.
 */
import type { Element } from "../combat/types";
import type { Kind, Role } from "./types";

export interface TraitDef {
  id: string;
  name: string;
  icon: string;
  group: "origin" | "class" | "kind" | "unique";
  breaks: number[];
  vals: number[];
  /** Whole team, or only the units carrying the trait. */
  team?: boolean;
  desc: string; // "{v}" is replaced by the values, e.g. "20/45/80"
  color: string;
}

const T = (d: TraitDef) => d;

export const TRAITS: Record<string, TraitDef> = Object.fromEntries([
  // ---------------------------------------------------------------- origins (elements)
  T({ id: "o_fire", name: "Hỏa", icon: "🔥", group: "origin", breaks: [2, 4, 6], vals: [0.015, 0.03, 0.05], color: "#ff7a3d",
    desc: "Đòn đánh và chiêu của tướng Hỏa thiêu đốt mục tiêu, mất {v} máu tối đa mỗi giây trong 3 giây." }),
  T({ id: "o_ice", name: "Băng", icon: "❄️", group: "origin", breaks: [2, 4, 6], vals: [0.15, 0.25, 0.4], color: "#8fd8ff",
    desc: "Đòn của tướng Băng làm kẻ địch Tê cóng: giảm {v} tốc đánh trong 2 giây." }),
  T({ id: "o_water", name: "Thủy", icon: "💧", group: "origin", breaks: [2, 4, 6], vals: [0.04, 0.08, 0.14], color: "#4aa8ff",
    desc: "Mỗi 3 giây, tướng Thủy hồi {v} máu tối đa." }),
  T({ id: "o_earth", name: "Thổ", icon: "🪨", group: "origin", breaks: [2, 4, 6], vals: [20, 45, 80], color: "#c8a060",
    desc: "Tướng Thổ được thêm {v} giáp và kháng phép." }),
  T({ id: "o_wind", name: "Phong", icon: "🌪️", group: "origin", breaks: [2, 4, 6], vals: [0.15, 0.3, 0.5], color: "#9ae8c0",
    desc: "Tướng Phong được thêm {v} tốc đánh." }),
  T({ id: "o_poison", name: "Độc", icon: "☠️", group: "origin", breaks: [2, 4, 6], vals: [0.01, 0.02, 0.035], color: "#9ad84a",
    desc: "Đòn của tướng Độc gây trúng độc ({v} máu tối đa mỗi giây) và giảm 33% hồi máu của mục tiêu." }),
  T({ id: "o_lightning", name: "Lôi", icon: "⚡", group: "origin", breaks: [2, 3, 4], vals: [70, 140, 240], color: "#ffe14a",
    desc: "Cứ đòn đánh thứ 3, tướng Lôi phóng sét lan sang 3 kẻ địch, gây {v} sát thương phép." }),
  T({ id: "o_light", name: "Quang", icon: "☀️", group: "origin", breaks: [2, 4, 6, 8], vals: [120, 240, 400, 650], team: true, color: "#fff3a0",
    desc: "Đầu trận cả đội được khiên {v}; tướng Quang được gấp đôi." }),
  T({ id: "o_dark", name: "Ám", icon: "🌑", group: "origin", breaks: [2, 4, 6], vals: [0.15, 0.25, 0.4], color: "#a070e0",
    desc: "Tướng Ám hồi máu bằng {v} sát thương gây ra." }),
  T({ id: "o_arcane", name: "Huyền", icon: "🔮", group: "origin", breaks: [2, 4, 6], vals: [15, 35, 60], team: true, color: "#c88aff",
    desc: "Cả đội được thêm {v} sức mạnh phép; tướng Huyền được gấp đôi." }),
  // ---------------------------------------------------------------- classes (roles)
  T({ id: "c_tank", name: "Hộ Vệ", icon: "🛡️", group: "class", breaks: [2, 4, 6], vals: [30, 60, 100], color: "#a8b8c8",
    desc: "Hộ Vệ được thêm {v} giáp và kháng phép; mốc 6 thêm 15% máu." }),
  T({ id: "c_brute", name: "Đấu Sĩ", icon: "💪", group: "class", breaks: [2, 4, 6], vals: [0.2, 0.4, 0.7], color: "#e8905a",
    desc: "Đấu Sĩ được thêm {v} máu tối đa." }),
  T({ id: "c_assassin", name: "Sát Thủ", icon: "🗡️", group: "class", breaks: [2, 4, 6], vals: [0.15, 0.3, 0.45], color: "#d04a6a",
    desc: "Đầu trận Sát Thủ nhảy ra sau lưng địch. Được thêm {v} tỉ lệ và sát thương chí mạng." }),
  T({ id: "c_marksman", name: "Xạ Thủ", icon: "🏹", group: "class", breaks: [2, 4, 6], vals: [0.15, 0.35, 0.6], color: "#8ac860",
    desc: "Xạ Thủ được thêm {v} sát thương vật lý." }),
  T({ id: "c_mage", name: "Pháp Sư", icon: "📘", group: "class", breaks: [2, 4, 6], vals: [25, 50, 90], color: "#6a8aff",
    desc: "Pháp Sư được thêm {v} sức mạnh phép." }),
  T({ id: "c_support", name: "Hỗ Trợ", icon: "🤲", group: "class", breaks: [2, 4, 6], vals: [2, 4, 7], team: true, color: "#7ae0b0",
    desc: "Cả đội hồi {v} năng lượng mỗi giây; hồi máu và khiên mạnh hơn 20%." }),
  // ---------------------------------------------------------------- kinds
  T({ id: "k_beast", name: "Thú", icon: "🐾", group: "kind", breaks: [3, 6, 9], vals: [0.12, 0.28, 0.5], color: "#c8a070",
    desc: "Thú được thêm {v} sát thương đòn đánh." }),
  T({ id: "k_flyer", name: "Phi Cầm", icon: "🪶", group: "kind", breaks: [2, 4, 6], vals: [0.15, 0.25, 0.4], color: "#a0d8ff",
    desc: "Phi Cầm có {v} tỉ lệ né đòn đánh." }),
  T({ id: "k_spirit", name: "Linh Hồn", icon: "👻", group: "kind", breaks: [2, 4, 6], vals: [0.12, 0.22, 0.35], color: "#b8c8ff",
    desc: "Linh Hồn nhận ít hơn {v} sát thương." }),
  T({ id: "k_undead", name: "Bất Tử", icon: "💀", group: "kind", breaks: [2, 4, 6], vals: [0.25, 0.4, 0.6], color: "#8ae0a0",
    desc: "Lần đầu gục ngã, tướng Bất Tử sống lại với {v} máu." }),
  T({ id: "k_construct", name: "Cơ Giới", icon: "⚙️", group: "kind", breaks: [2, 4, 6], vals: [0.15, 0.3, 0.5], color: "#c0c0d0",
    desc: "Cơ Giới vào trận với khiên bằng {v} máu tối đa." }),
  T({ id: "k_humanoid", name: "Nhân Hình", icon: "🧍", group: "kind", breaks: [2, 4, 6], vals: [15, 30, 50], color: "#f0c890",
    desc: "Nhân Hình vào trận với thêm {v} năng lượng và hồi thêm năng lượng khi đánh." }),
  T({ id: "k_plant", name: "Thảo Mộc", icon: "🌿", group: "kind", breaks: [2, 3, 4], vals: [0.02, 0.035, 0.05], color: "#6ac850",
    desc: "Mỗi giây, Thảo Mộc hồi {v} máu tối đa." }),
  // ---------------------------------------------------------------- bosses
  T({ id: "u_overlord", name: "Bá Chủ", icon: "👑", group: "unique", breaks: [1], vals: [0.2], color: "#ffd84a",
    desc: "Boss của Vực Sâu: +{v} máu, sát thương và sức mạnh phép; miễn khống chế 4 giây đầu trận; chiêu là phiên bản tối thượng." }),
].map((t) => [t.id, t]));

export const ORIGIN_OF: Record<Element, string> = {
  fire: "o_fire", ice: "o_ice", water: "o_water", earth: "o_earth", wind: "o_wind", poison: "o_poison", lightning: "o_lightning",
  light: "o_light", dark: "o_dark", arcane: "o_arcane", physical: "o_earth",
};
export const CLASS_OF: Record<Role, string> = {
  tank: "c_tank", brute: "c_brute", assassin: "c_assassin", marksman: "c_marksman", mage: "c_mage", support: "c_support",
};
export const KIND_OF: Record<Kind, string> = {
  beast: "k_beast", flyer: "k_flyer", spirit: "k_spirit", undead: "k_undead", construct: "k_construct", humanoid: "k_humanoid", plant: "k_plant",
};

/** "20/45/80" style text of a trait's values. */
export function traitValues(t: TraitDef): string {
  return t.vals.map((v) => (v < 1 ? `${Math.round(v * 1000) / 10}%` : String(v))).join("/");
}
export const traitDesc = (t: TraitDef) => t.desc.replace("{v}", traitValues(t));

/** Which breakpoint (0-based) a trait reaches with `n` distinct units, or -1. */
export function traitTier(id: string, n: number): number {
  const t = TRAITS[id];
  let tier = -1;
  for (let i = 0; i < t.breaks.length; i++) if (n >= t.breaks[i]) tier = i;
  return tier;
}
