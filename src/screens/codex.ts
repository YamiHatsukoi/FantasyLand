import { app } from "../app";
import { ELEMENTS } from "../combat/statuses";
import { enemyResist } from "../combat/factory";
import type { Element } from "../combat/types";
import { ENEMIES, type EnemyDef } from "../data/enemies";
import { BIOME_MATS, getItem } from "../data/items";
import { getSkill } from "../data/skills";
import { REGION_NAMES, dropChance } from "../data/uses";
import { spriteURL } from "../render/pixel";
import { h, openModal } from "../ui/dom";
import { itemImg } from "../ui/icon";
import { itemTip, setDexSource, skillTip } from "../ui/tooltip";
import { getFloor } from "../world/floors";
import { backfillBosses } from "../world/dex";

/**
 * Monster codex. Every kind the party has fought gets a page; the more of them you defeat,
 * the more the page tells you: drops after the first kill, resistances after five.
 */
setDexSource(() => app.game?.dex ?? {});

const TAG_NAMES: Record<string, string> = { beast: "Thú", plant: "Thực vật", undead: "Bất tử", spirit: "Linh hồn", flying: "Bay", construct: "Cơ giới", dragon: "Rồng", humanoid: "Nhân dạng", aquatic: "Thủy sinh", insect: "Côn trùng" };
const KNOW_RESIST = 5;

type Filter = "all" | "boss" | "floor";
let filter: Filter = "all";

/** Every kind living on the floors the player has reached (for the "x / y" counter). */
function reachableKinds(maxFloor: number) {
  const ids = new Set<string>();
  for (let n = 1; n <= Math.max(1, maxFloor); n++) { const f = getFloor(n); for (const id of [...f.enemies, ...f.boss]) if (ENEMIES[id]) ids.add(id); }
  return ids;
}

/** Same pools as the battle loot: beasts mostly leave hide, plants fibre and herbs. */
function regionPool(def: EnemyDef, m: { hide: string; fiber: string; herb: string }): [string, number][] {
  const pool = def.tags.includes("beast") ? [m.hide, m.hide, m.hide, m.fiber] : def.tags.includes("plant") ? [m.fiber, m.fiber, m.herb, m.hide] : [m.hide, m.fiber, m.herb];
  return [...new Set(pool)].map((id) => [id, (0.45 * pool.filter((x) => x === id).length) / pool.length]);
}

/** Own drops plus the region's materials, merged per item (independent rolls add up). */
function lootTable(def: EnemyDef, mats: { hide: string; fiber: string; herb: string; gem: string } | undefined, fam: string): [string, number, string | undefined][] {
  const rows = new Map<string, { ch: number; note?: string }>();
  const add = (id: string, ch: number, note?: string) => {
    const r = rows.get(id);
    if (r) { r.ch = 1 - (1 - r.ch) * (1 - ch); r.note ??= note; } else rows.set(id, { ch, note });
  };
  for (const d of def.drops) add(d.item, dropChance(def, d.ch), def.boss && (d.max ?? 1) > 1 ? `×${d.min ?? 1}–${d.max}` : undefined);
  if (mats) {
    if (def.boss) for (const id of [mats.hide, mats.fiber]) add(id, 1, "×3");
    else for (const [id, ch] of regionPool(def, mats)) add(id, ch, "vật liệu vùng");
    add(mats.gem, def.boss ? 1 : 0.05, `ngọc vùng ${REGION_NAMES[fam] ?? ""}`);
  }
  return [...rows.entries()].map(([id, r]) => [id, r.ch, r.note]);
}

export function openCodex() {
  const g = app.game;
  const dex = (g.dex ??= {});
  backfillBosses(g);
  const m = openModal("📖 Sổ Tay Quái Vật", { wide: true, cls: "codex" });

  const list = () => {
    const all = reachableKinds(g.maxFloor);
    const seen = Object.keys(dex).filter((id) => ENEMIES[id]);
    let rows = seen.map((id) => ({ def: ENEMIES[id], e: dex[id] }));
    if (filter === "boss") rows = rows.filter((r) => r.def.boss);
    rows.sort((a, b) => a.e.f - b.e.f || Number(!!a.def.boss) - Number(!!b.def.boss) || a.def.name.localeCompare(b.def.name));
    const kills = Object.values(dex).reduce((s, d) => s + d.k, 0);
    const chip = (f: Filter, label: string) => h("button", { class: `btn small ${filter === f ? "primary" : ""}`, onclick: () => { filter = f; list(); } }, label);
    const card = (def: EnemyDef, e: { k: number; f: number }) => h("button", { class: `dex-card ${def.boss ? "boss" : ""}`, onclick: () => page(def.id) },
      h("img", { class: "pix", src: spriteURL(def.sprite, def.palette, 4), alt: "" }),
      h("div", { class: "dex-name" }, def.name),
      h("div", { class: "muted small" }, `Tầng ${e.f} · ⚔️ ${e.k}`));
    let body: HTMLElement;
    if (filter === "floor") {
      const byFloor = new Map<number, typeof rows>();
      for (const r of rows) byFloor.set(r.e.f, [...(byFloor.get(r.e.f) ?? []), r]);
      body = h("div", { class: "col" }, [...byFloor.entries()].map(([n, rs]) => h("div", null,
        h("div", { class: "section-title" }, `Tầng ${n} · ${getFloor(n).name}`),
        h("div", { class: "dex-grid" }, rs.map((r) => card(r.def, r.e))))));
    } else body = h("div", { class: "dex-grid" }, rows.map((r) => card(r.def, r.e)));
    m.body.replaceChildren(
      h("div", { class: "dex-top" },
        h("div", null, h("b", null, `${seen.length}`), h("span", { class: "muted" }, ` / ${all.size} loài đã gặp · ${kills.toLocaleString("vi-VN")} lần hạ gục`)),
        h("div", { class: "row", style: "gap:6px" }, chip("all", "Tất cả"), chip("floor", "Theo tầng"), chip("boss", "👑 Boss"))),
      h("div", { class: "dex-bar" }, h("div", { style: `width:${all.size ? Math.round((seen.length / all.size) * 100) : 0}%` })),
      rows.length ? body : h("p", { class: "muted" }, "Chưa gặp loài nào. Mỗi trận đánh sẽ ghi quái vào sổ tay."));
  };

  const page = (id: string) => {
    const def = ENEMIES[id];
    const e = dex[id];
    const known = g.scan?.[id] ?? [];
    const res = enemyResist(def);
    const weak = (Object.entries(res) as [Element, number][]).filter(([, v]) => v > 1);
    const strong = (Object.entries(res) as [Element, number][]).filter(([, v]) => v < 1);
    const fam = getFloor(e.f).family;
    const mats = BIOME_MATS[fam];
    const el = (k: Element, v: number) => h("span", { class: "dex-el", style: `--c:${ELEMENTS[k].color}` }, `${ELEMENTS[k].icon} ${ELEMENTS[k].name}`, h("small", null, v === 0 ? " miễn" : ` ×${v}`));
    const drop = (item: string, ch: number, note?: string) => itemTip(h("div", { class: "dex-drop" }, itemImg(item),
      h("div", { class: "dex-drop-name" }, h("span", null, getItem(item).name), note ? h("small", { class: "muted" }, note) : null),
      h("b", null, e.k ? `${Math.max(1, Math.round(ch * 100))}%` : "??")), item);
    m.body.replaceChildren(
      h("button", { class: "btn small", onclick: list }, "← Danh sách"),
      h("div", { class: "dex-page" },
        h("div", { class: "dex-portrait" + (def.boss ? " boss" : "") }, h("img", { class: "pix", src: spriteURL(def.sprite, def.palette, 10), alt: def.name })),
        h("div", { class: "col", style: "gap:6px;min-width:0" },
          h("h3", { style: "margin:0" }, def.boss ? "👑 " : "", def.name),
          h("div", { class: "row", style: "gap:4px;flex-wrap:wrap" }, def.tags.map((t) => h("span", { class: "tag" }, TAG_NAMES[t] ?? t))),
          h("div", { class: "muted small" }, `Gặp lần đầu ở tầng ${e.f} · ${getFloor(e.f).name} · đã hạ ${e.k} lần`),
          h("div", { class: "section-title" }, "Điểm yếu"),
          h("div", { class: "row", style: "gap:6px;flex-wrap:wrap" },
            weak.map(([k, v]) => known.includes(k) ? el(k, v) : h("span", { class: "dex-el unknown" }, "❔ chưa rõ")),
          ),
          h("div", { class: "muted small" }, "Đánh trúng điểm yếu trong trận để ghi nó vào sổ."),
          h("div", { class: "section-title" }, "Kháng"),
          e.k >= KNOW_RESIST
            ? (strong.length ? h("div", { class: "row", style: "gap:6px;flex-wrap:wrap" }, strong.map(([k, v]) => el(k, v))) : h("div", { class: "muted small" }, "Không kháng gì đặc biệt."))
            : h("div", { class: "muted small" }, `Hạ ${KNOW_RESIST - e.k} lần nữa để hiểu rõ sức kháng của nó.`),
        )),
      h("div", { class: "section-title" }, "Chiến lợi phẩm"),
      e.k ? "" : h("p", { class: "muted small" }, "Hạ gục nó một lần để biết tỉ lệ rơi."),
      h("div", { class: "dex-drops" }, lootTable(def, mats, fam).map(([item, ch, note]) => drop(item, ch, note))),
      h("div", { class: "section-title" }, "Chiêu thức"),
      h("div", { class: "row", style: "gap:6px;flex-wrap:wrap" }, def.skills.map((s) => { const sk = getSkill(s); return skillTip(h("span", { class: "tag" }, `${sk.icon} ${sk.name}`), s); })),
    );
    m.body.scrollTop = 0;
  };

  list();
}
