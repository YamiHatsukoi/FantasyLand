import { app } from "../app";
import { sfx } from "../audio/sfx";
import type { Stats } from "../combat/types";
import { changeClass, classChangeBlocker, classChangeCost, type Character } from "../core/state";
import { CLASSES, classStats, type ClassDef } from "../data/classes";
import { TRAITS } from "../data/classTraits";
import { SCHOOL_NAMES, getSkill } from "../data/skills";
import { spriteImg } from "../render/pixel";
import { confirmBox, h, openModal, toast } from "../ui/dom";
import { skillTip } from "../ui/tooltip";

/**
 * The hero picks another class (for a hefty fee). Each class shows what it leans towards (its
 * stats at the hero's level next to the current class) and its road ahead (the skills it learns
 * level by level, and the schools it masters).
 */
const STAT_ROWS: [keyof Stats, string, string][] = [
  ["hp", "❤️", "Máu"], ["mp", "💧", "MP"], ["atk", "⚔️", "Công"], ["mag", "🔮", "Phép"],
  ["def", "🛡️", "Thủ"], ["res", "✨", "Kháng"], ["spd", "💨", "Tốc"], ["crit", "🎯", "Chí mạng"], ["eva", "🍃", "Né"],
];

/** A two-or-three word summary of what a class is built for. */
function leaning(c: ClassDef): string {
  const b = c.base;
  const tags: string[] = [];
  if (b.atk >= b.mag * 1.4) tags.push("Sát thương vật lý");
  else if (b.mag >= b.atk * 1.4) tags.push("Sát thương phép");
  else tags.push("Lai công – phép");
  if (b.hp >= 115 || b.def >= 15) tags.push("Trâu bò");
  if (b.spd >= 110) tags.push("Nhanh nhẹn");
  if (b.crit >= 12) tags.push("Chí mạng cao");
  if (b.eva >= 10) tags.push("Khó trúng");
  if (b.res >= 16 && !tags.includes("Trâu bò")) tags.push("Kháng phép tốt");
  if (c.startSkills.some((s) => getSkill(s).heal)) tags.push("Hồi máu");
  return tags.slice(0, 3).join(" · ");
}

export function openClassChange(ch: Character, onDone: () => void) {
  const g = app.game;
  const cost = classChangeCost(ch);
  const cur = CLASSES[ch.classId];
  const all = Object.values(CLASSES);
  const m = openModal("🔄 Chuyển Nghề", { wide: true });
  let pick = all.find((c) => c.id !== ch.classId)!.id;
  // the scale of each bar: the best of all classes at this level
  const best = Object.fromEntries(STAT_ROWS.map(([k]) => [k, Math.max(...all.map((c) => classStats(c.id, ch.level)[k]))])) as Record<keyof Stats, number>;
  const mine = classStats(ch.classId, ch.level);

  const detail = (c: ClassDef) => {
    const st = classStats(c.id, ch.level);
    const why = classChangeBlocker(g, ch, c.id);
    const road = [
      ...c.startSkills.map((s) => [1, s] as const),
      ...Object.entries(c.learnset).map(([l, s]) => [Number(l), s] as const),
    ].sort((a, b) => a[0] - b[0]);
    return h("div", { class: "cc-detail" },
      h("div", { class: "cc-head" },
        spriteImg(`hero_${c.id}`, ch.pal, "sprite cc-portrait"),
        h("div", { class: "col", style: "gap:2px;min-width:0" },
          h("b", { style: "font-size:18px" }, `${c.icon} ${c.name}`),
          h("div", { class: "gold small" }, leaning(c)),
          h("div", { class: "muted small" }, c.desc))),
      TRAITS[c.id] ? h("div", { class: "trait-box" }, h("b", null, `${TRAITS[c.id].icon} Năng lực riêng: ${TRAITS[c.id].name}`), h("div", { class: "small" }, TRAITS[c.id].desc)) : null,
      h("div", { class: "section-title" }, `Chỉ số ở cấp ${ch.level} (so với ${cur.name} hiện tại)`),
      h("div", { class: "cc-stats" }, STAT_ROWS.map(([k, icon, name]) => {
        const d = st[k] - mine[k];
        return h("div", { class: "cc-stat" },
          h("span", { class: "cc-sname" }, `${icon} ${name}`),
          h("div", { class: "cc-track" }, h("div", { class: "cc-fill", style: `--w:${(st[k] / Math.max(1, best[k])).toFixed(3)}` })),
          h("b", { class: "cc-sval" }, String(st[k])),
          h("span", { class: `cc-diff ${d > 0 ? "up" : d < 0 ? "down" : ""}` }, d ? `${d > 0 ? "+" : ""}${d}` : "="));
      })),
      h("div", { class: "muted small" }, "Chưa tính trang bị và điểm chỉ số (điểm sẽ được hoàn lại để phân bổ theo nghề mới)."),
      h("div", { class: "section-title" }, "Hành trình phát triển"),
      h("div", { class: "cc-road" }, road.map(([lvl, s]) => {
        const sk = getSkill(s);
        const have = lvl <= ch.level;
        return skillTip(h("div", { class: `cc-step ${have ? "have" : ""}` },
          h("span", { class: "cc-lvl" }, lvl === 1 ? "Khởi đầu" : `Cấp ${lvl}`),
          h("span", { class: "cc-sk" }, `${sk.icon} ${sk.name}`),
          h("span", { class: "cc-when" }, have ? "✓ nhận ngay" : `mở ở cấp ${lvl}`)), s);
      })),
      h("div", { class: "section-title" }, "Sở trường ở Thư Viện"),
      h("div", { class: "row", style: "gap:4px;flex-wrap:wrap" }, c.schools.map((s) => h("span", { class: "tag" }, SCHOOL_NAMES[s]))),
      h("div", { class: "muted small", style: "margin-top:4px" }, "Học kỹ năng thuộc sở trường ở Thư Viện rẻ hơn một nửa."),
      h("button", { class: "btn primary block", style: "margin-top:10px", disabled: !!why, title: why ?? "", onclick: () => void choose(c.id) },
        why && c.id !== ch.classId ? why : `🔄 Chuyển sang ${c.name} · ${cost.toLocaleString("vi-VN")}💰`));
  };

  const render = () => {
    m.body.replaceChildren(
      h("div", { class: "row between", style: "margin-bottom:8px;gap:8px" },
        h("span", { class: "small" }, `Hiện là ${cur.icon} ${cur.name} · cấp ${ch.level}`),
        h("span", { class: "small" }, "Phí: ", h("b", { class: "gold" }, `${cost.toLocaleString("vi-VN")}💰`), h("span", { class: g.gold >= cost ? "muted" : "bad" }, ` (có ${g.gold.toLocaleString("vi-VN")})`))),
      h("div", { class: "cc-grid no-search" }, all.map((c) => h("button", {
        class: `cc-pick ${c.id === pick ? "on" : ""} ${c.id === ch.classId ? "cur" : ""}`,
        // show the chosen class's details right away (on a phone they sit below the grid)
        onclick: () => { pick = c.id; render(); requestAnimationFrame(() => m.body.querySelector(".cc-detail")?.scrollIntoView({ behavior: "smooth", block: "start" })); },
      }, h("span", { class: "cc-ico" }, c.icon), h("span", null, c.name), c.id === ch.classId ? h("small", null, "hiện tại") : null))),
      detail(CLASSES[pick]),
      h("p", { class: "muted small" }, "Giữ nguyên cấp, kinh nghiệm, trang bị và mọi kỹ năng, nội tại học từ Thư Viện hay sách. Chỉ kỹ năng và nội tại khởi đầu riêng của nghề cũ được thay."));
  };

  const choose = async (to: string) => {
    const c = CLASSES[to];
    const ok = await confirmBox("Chuyển nghề",
      `Đổi ${ch.name} từ ${cur.icon} ${cur.name} sang ${c.icon} ${c.name} với giá ${cost.toLocaleString("vi-VN")} vàng?\n\n` +
      `• Kỹ năng riêng của ${cur.name} sẽ mất, nhận kỹ năng của ${c.name} tới cấp ${ch.level}.\n` +
      `• Giữ cấp, trang bị và kỹ năng/nội tại học thêm.\n• Điểm chỉ số được hoàn lại.`, "Chuyển nghề");
    if (!ok) return;
    const why = changeClass(g, ch, to);
    if (why) return toast(why, "bad");
    sfx("enhance");
    toast(`${ch.name} giờ là ${c.icon} ${c.name}! Nhớ phân bổ lại điểm chỉ số.`, "good", 4000);
    app.checkpoint(`Chuyển nghề: ${c.name}`);
    m.close();
    onDone();
  };
  render();
}
