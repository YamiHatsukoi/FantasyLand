import type { Battle, UnitStats } from "../combat/engine";
import type { Unit } from "../combat/types";
import { spriteURL } from "../render/pixel";
import { h, nn, openModal } from "./dom";

/**
 * After-battle report: who dealt and took the damage, who kept the party standing (healing
 * and barriers), with a ranking per measure and a full table, for each side.
 */
type Metric = "dealt" | "taken" | "healed" | "shielded";
const METRICS: { k: Metric; icon: string; label: string; cls: string }[] = [
  { k: "dealt", icon: "⚔️", label: "Gây sát thương", cls: "dmg" },
  { k: "taken", icon: "🩸", label: "Nhận sát thương", cls: "taken" },
  { k: "healed", icon: "💚", label: "Hồi máu", cls: "heal" },
  { k: "shielded", icon: "🛡️", label: "Tạo khiên", cls: "shield" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("vi-VN");

/** One number for "who carried the fight": damage, plus healing and protection, plus finishing blows. */
const impact = (s: UnitStats) => s.dealt + s.healed + 0.8 * s.shielded + 0.5 * s.absorbed + 0.3 * s.taken;

export function openBattleReport(battle: Battle, allies: Unit[], enemies: Unit[], rounds: number) {
  const m = openModal("📊 Thống Kê Trận", { wide: true, cls: "breport" });
  let side: "ally" | "enemy" = "ally";
  let metric: Metric = "dealt";

  const render = () => {
    const units = side === "ally" ? allies : enemies;
    const rows = units.map((u) => ({ u, s: battle.statsOf(u.uid) }));
    const total = (k: keyof UnitStats) => rows.reduce((a, r) => a + r.s[k], 0);
    const mvp = side === "ally" ? rows.reduce((best, r) => (impact(r.s) > impact(best.s) ? r : best), rows[0]) : null;

    const tab = (v: typeof side, label: string) => h("button", { class: `btn small ${side === v ? "primary" : ""}`, onclick: () => { side = v; render(); } }, label);
    const chip = (x: (typeof METRICS)[number]) => h("button", { class: `br-chip ${x.cls} ${metric === x.k ? "on" : ""}`, onclick: () => { metric = x.k; render(); } }, `${x.icon} ${x.label}`);

    const cur = METRICS.find((x) => x.k === metric)!;
    const sum = total(metric);
    const ranked = [...rows].sort((a, b) => b.s[metric] - a.s[metric]);
    const top = Math.max(1, ranked[0]?.s[metric] ?? 1);
    const face = (u: Unit) => h("img", { class: "pix br-face", src: spriteURL(u.sprite, u.palette, 3), alt: "" });

    const bars = h("div", { class: "br-bars" }, ranked.map((r, i) => h("div", { class: "br-row", style: `--i:${i}` },
      face(r.u),
      h("div", { class: "br-who" },
        h("div", { class: "br-name" }, r.u.name, mvp && r === mvp && impact(r.s) > 0 ? h("span", { class: "br-mvp", title: "Đóng góp nhiều nhất trận" }, "👑 MVP") : null, r.u.hp <= 0 ? h("span", { class: "br-ko" }, "gục") : null),
        h("div", { class: "br-track" }, h("div", { class: `br-fill ${cur.cls}`, style: `--w:${(r.s[metric] / top).toFixed(3)}` }))),
      h("div", { class: "br-val" }, h("b", null, fmt(r.s[metric])), h("small", null, sum ? `${Math.round((r.s[metric] / sum) * 100)}%` : "–")))));

    const th = (t: string, title?: string) => h("th", { title: title ?? "" }, t);
    const table = h("div", { class: "br-table-wrap" }, h("table", { class: "br-table" },
      h("thead", null, h("tr", null, th(""), th("⚔️", "Sát thương gây ra"), th("⚡/lượt", "Sát thương trung bình mỗi lượt"), th("💥", "Đòn mạnh nhất"), th("🎯", "Chí mạng"),
        th("☠️", "Hạ gục"), th("🔨", "Phá khiên"), th("🩸", "Sát thương nhận"), th("🛡️", "Khiên đã chặn cho bản thân"), th("💚", "Hồi máu"), th("🔰", "Khiên tạo cho đồng đội"),
        th("⬆️", "Buff cho đồng đội"), th("⬇️", "Debuff lên địch"), th("💨", "Né đòn"), th("⏱️", "Số lượt"))),
      h("tbody", null, rows.map((r) => h("tr", null,
        h("td", { class: "br-tname" }, face(r.u), r.u.name),
        h("td", null, fmt(r.s.dealt)), h("td", null, fmt(r.s.turns ? r.s.dealt / r.s.turns : 0)), h("td", null, fmt(r.s.biggest)), h("td", null, r.s.crits),
        h("td", null, r.s.kills), h("td", null, r.s.breaks), h("td", null, fmt(r.s.taken)), h("td", null, fmt(r.s.absorbed)), h("td", null, fmt(r.s.healed)),
        h("td", null, fmt(r.s.shielded)), h("td", null, r.s.buffs), h("td", null, r.s.debuffs), h("td", null, r.s.dodged), h("td", null, r.s.turns))))));

    m.body.replaceChildren(...nn(
      h("div", { class: "br-top" },
        h("div", { class: "row", style: "gap:6px" }, tab("ally", "👥 Đội ta"), tab("enemy", "👹 Kẻ địch")),
        h("div", { class: "br-sum muted small" }, `${rounds} lượt · ⚔️ ${fmt(total("dealt"))} · 💚 ${fmt(total("healed"))} · 🛡️ ${fmt(total("shielded"))}`)),
      h("div", { class: "br-chips" }, METRICS.map(chip)),
      sum ? bars : h("p", { class: "muted" }, side === "ally" ? `Không ai trong đội ${cur.label.toLowerCase()} trong trận này.` : `Kẻ địch không ${cur.label.toLowerCase()} trong trận này.`),
      h("div", { class: "section-title" }, "Chi tiết"),
      table,
      mvp && impact(mvp.s) > 0 ? h("p", { class: "muted small" }, `👑 MVP tính theo sát thương gây ra, hồi máu, khiên tạo cho đồng đội và sát thương đã gánh.`) : null,
    ));
  };
  render();
}
