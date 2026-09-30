import { ELEMENTS, STATUSES } from "./statuses";
import type { Eff, Skill, Special, StatusId, TargetType } from "./types";

const TARGET: Record<TargetType, string> = {
  enemy: "1 kẻ địch",
  enemies: "toàn bộ kẻ địch",
  ally: "1 đồng đội",
  allies: "toàn đội",
  self: "bản thân",
  random: "kẻ địch ngẫu nhiên",
  deadAlly: "1 đồng đội đã gục",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

function effText(e: Eff, defaultTo: string): string {
  const s = STATUSES[e.s];
  const chance = e.ch !== undefined && e.ch < 1 ? `${pct(e.ch)} ` : "";
  const stacks = e.st && e.st > 1 ? ` ×${e.st}` : "";
  const to = e.to === "self" ? " cho bản thân" : e.to === "allies" ? " cho toàn đội" : e.to === "enemies" ? " lên toàn bộ kẻ địch" : defaultTo;
  return `${chance}${s.icon} ${s.name}${stacks} (${e.t ?? 2} lượt)${to}`;
}

function specialText(s: Special): string {
  switch (s.k) {
    case "execute": return `Gây x${s.mult} sát thương nếu mục tiêu dưới ${pct(s.below)} máu.`;
    case "consume": return `Kích nổ toàn bộ ${STATUSES[s.s].icon} ${STATUSES[s.s].name} trên mục tiêu: +${pct(s.perStack)} mỗi tầng.`;
    case "bonusIf": return `x${s.mult} sát thương nếu mục tiêu đang ${STATUSES[s.s].icon} ${STATUSES[s.s].name}.`;
    case "bonusVsTag": return `x${s.mult} sát thương lên ${s.tag === "undead" ? "undead" : s.tag}.`;
    case "cleanse": return s.n ? `Xoá ${s.n} hiệu ứng bất lợi.` : "Xoá mọi hiệu ứng bất lợi.";
    case "dispel": return s.n ? `Xoá ${s.n} hiệu ứng có lợi của mục tiêu.` : "Xoá mọi hiệu ứng có lợi của mục tiêu.";
    case "revive": return `Hồi sinh với ${pct(s.pct)} máu.`;
    case "drainMp": return `Hút ${pct(s.pct)} MP của mục tiêu.`;
    case "lifesteal": return `Hồi máu bằng ${pct(s.pct)} sát thương gây ra.`;
    case "missingHp": return "Càng mất nhiều máu, sát thương càng cao (tối đa x2).";
    case "extraTurn": return "Được hành động thêm một lượt ngay lập tức.";
    case "delay": return `Đẩy lùi lượt của mục tiêu ${Math.round(s.amount / 100)}%.`;
    case "advance": return `Kéo lượt của đồng đội lên ${Math.round(s.amount / 100)}%.`;
    case "spread": return "Lây toàn bộ hiệu ứng bất lợi của mục tiêu sang kẻ địch khác.";
    case "transfer": return "Chuyển mọi hiệu ứng bất lợi của bản thân sang mục tiêu.";
    case "resetCd": return "Làm mới hồi chiêu các kỹ năng khác.";
    case "mpRestore": return `Hồi ${pct(s.pct)} MP.`;
    case "randomElement": return "Mỗi đòn mang một nguyên tố ngẫu nhiên.";
    case "scaleDebuffs": return `+${pct(s.per)} sát thương cho mỗi hiệu ứng bất lợi trên mục tiêu.`;
    case "selfDamage": return `Tự mất ${pct(s.pct)} máu.`;
    case "hpSwap": return "Hoán đổi tỉ lệ máu với mục tiêu.";
    case "useDef": return "Sức mạnh tính theo Phòng thủ.";
    case "useSpd": return "Sức mạnh tính theo Tốc độ.";
  }
}

export function describeSkill(sk: Skill): string[] {
  const lines: string[] = [];
  const el = ELEMENTS[sk.el];
  const stat = sk.sp?.some((s) => s.k === "useDef") ? "phòng thủ" : sk.kind === "physical" ? "công" : "phép";
  if (sk.power) {
    const hits = sk.hits && sk.hits > 1 ? ` × ${sk.hits} đòn` : "";
    lines.push(`Gây ${pct(sk.power)} ${stat} sát thương ${el.icon} ${el.name}${hits} lên ${TARGET[sk.target]}.`);
  }
  if (sk.heal) lines.push(`Hồi máu bằng ${pct(sk.heal)} phép cho ${TARGET[sk.target]}.`);
  const defaultTo = sk.power ? "" : sk.target === "self" ? "" : ` cho ${TARGET[sk.target]}`;
  const fx = (sk.fx ?? []).map((e) => effText(e, defaultTo));
  if (fx.length) lines.push(`${sk.power ? "Trúng đòn: " : "Áp dụng "}${fx.join(", ")}.`);
  const self = (sk.self ?? []).map((e) => effText(e, ""));
  if (self.length) lines.push(`Bản thân nhận: ${self.join(", ")}.`);
  for (const s of sk.sp ?? []) if (s.k !== "useDef" || sk.power) lines.push(specialText(s));
  if (sk.hpCost) lines.push(`Tiêu hao ${pct(sk.hpCost)} máu.`);
  if (sk.flavor) lines.push(sk.flavor);
  lines.push(...statusNotes(skillStatuses(sk)));
  return lines;
}

/** Every status a skill applies or cares about. */
export function skillStatuses(sk: Skill): StatusId[] {
  const ids = [...(sk.fx ?? []), ...(sk.self ?? [])].map((e) => e.s);
  for (const s of sk.sp ?? []) if (s.k === "bonusIf" || s.k === "consume") ids.push(s.s);
  return [...new Set(ids)];
}

/** "(❌ Bị đánh dấu: every hit on it is a critical)" — what each named effect actually does. */
export function statusNotes(ids: Iterable<StatusId>): string[] {
  return [...new Set(ids)].filter((id) => STATUSES[id]).map((id) => `(${STATUSES[id].icon} ${STATUSES[id].name}: ${STATUSES[id].desc})`);
}

/**
 * Effects mentioned by name in free text (passive descriptions). Names are matched with their
 * capital letter so the stats "phòng thủ" / "né tránh" don't read as the statuses of that name.
 */
export function statusNotesInText(text: string): string[] {
  return statusNotes(Object.values(STATUSES).filter((d) => new RegExp(`(^|[^\\p{L}])${d.name}($|[^\\p{L}])`, "u").test(text)).map((d) => d.id));
}

/** A passive's description followed by what the effects it names do. */
export const passiveText = (desc: string) => [desc, ...statusNotesInText(desc)].join(" ");

export function skillCostText(sk: Skill): string {
  const parts: string[] = [];
  if (sk.mp) parts.push(`${sk.mp} MP`);
  if (sk.cd) parts.push(`hồi ${sk.cd} lượt`);
  return parts.join(" · ") || "Miễn phí";
}
