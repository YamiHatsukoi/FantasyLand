import type { LevelUp } from "../core/state";
import { sfx } from "../audio/sfx";
import { getSkill } from "../data/skills";
import { spriteImg } from "../render/pixel";
import { h } from "./dom";

/**
 * "LEVEL UP!" celebration: rotating golden rays, the title with a shine sweep, and one row
 * per character with the old and new level, every stat gained, new skills and stat points.
 * Only transforms and opacity are animated.
 */
const STAT_NAMES: Record<string, string> = { hp: "Máu", mp: "MP", atk: "Công", mag: "Phép", def: "Thủ", res: "Kháng", spd: "Tốc", crit: "Chí mạng", eva: "Né" };
const STAT_ICONS: Record<string, string> = { hp: "❤️", mp: "💧", atk: "⚔️", mag: "🔮", def: "🛡️", res: "✨", spd: "💨", crit: "🎯", eva: "🍃" };

let showing: Promise<void> = Promise.resolve();

export function showLevelUps(list: LevelUp[]): Promise<void> {
  if (!list.length) return Promise.resolve();
  // celebrations never overlap: a second one waits for the first
  showing = showing.then(() => play(list));
  return showing;
}

function play(list: LevelUp[]): Promise<void> {
  return new Promise((resolve) => {
    const rows = list.map((l, i) => {
      const gains = (Object.keys(STAT_NAMES) as (keyof typeof l.after)[])
        .map((k) => [k, (l.after[k] ?? 0) - (l.before[k] ?? 0)] as const)
        .filter(([, d]) => d > 0);
      return h("div", { class: "lv-row", style: `--i:${i}` },
        h("div", { class: "lv-face" }, spriteImg(l.sprite, l.pal, "sprite")),
        h("div", { class: "lv-info" },
          h("div", { class: "lv-name" }, l.name,
            h("span", { class: "lv-levels" }, h("span", { class: "lv-from" }, `Lv ${l.from}`), h("span", { class: "lv-arrow" }, "➜"), h("b", { class: "lv-to" }, `Lv ${l.to}`))),
          h("div", { class: "lv-stats" }, gains.map(([k, d], j) => h("span", { class: "lv-stat", style: `--j:${j}` }, `${STAT_ICONS[k as string]} +${d} ${STAT_NAMES[k as string]}`))),
          l.skills.length ? h("div", { class: "lv-skill" }, "✨ Học được: ", l.skills.map((s) => { const sk = getSkill(s); return h("b", null, `${sk.icon} ${sk.name}`); })) : null,
          l.points ? h("div", { class: "lv-points" }, `⭐ +${l.points} điểm chỉ số · phân bổ trong Đội hình`) : null));
    });
    const sparks = Array.from({ length: 18 }, (_, i) => h("span", { class: "lv-spark", style: `--x:${(i * 37) % 100}%;--d:${(i * 0.17) % 2.4}s;--s:${0.6 + ((i * 7) % 5) / 6}` }));
    const btn = h("button", { class: "btn primary lv-ok" }, "Tuyệt vời!");
    const root = h("div", { class: "lvup" },
      h("div", { class: "lv-rays" }), ...sparks,
      h("div", { class: "lv-card" },
        h("div", { class: "lv-title" }, "LEVEL UP!"),
        h("div", { class: "lv-sub" }, list.length > 1 ? `${list.length} người lên cấp` : "Sức mạnh mới đang chảy trong huyết quản"),
        h("div", { class: "lv-rows" }, rows),
        btn));
    document.body.append(root);
    sfx("levelup");
    requestAnimationFrame(() => root.classList.add("in"));
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey);
      root.classList.add("out");
      setTimeout(() => { root.remove(); resolve(); }, 260);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); close(); } };
    btn.addEventListener("click", close);
    // a stray tap right as it opens should not dismiss it unseen
    setTimeout(() => { root.addEventListener("click", (e) => { if (e.target === root) close(); }); window.addEventListener("keydown", onKey); }, 700);
  });
}
