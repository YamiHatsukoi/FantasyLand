import { app } from "../app";
import { ENH_MAX, GEAR_KEYS, chanceWith, enhanceChance, enhanceCost, tryEnhance, type Character } from "../core/state";
import { CATALYSTS } from "../data/uses";
import { enhLevel, enhancedId, getItem } from "../data/items";
import { statText } from "./party";
import { itemTip } from "../ui/tooltip";
import { spriteImg } from "../render/pixel";
import { h, openModal, toast } from "../ui/dom";
import { itemImg } from "../ui/icon";
import { GEAR_ICONS, GEAR_NAMES, rarityClass } from "../ui/gear";

/**
 * The forge's enhancement bench: gold in, +1..+10 on a worn item out. The level belongs to the
 * item ("Kiếm Sắt +4"), so it goes wherever the item goes.
 */
let current = "";
/** Catalyst gem placed on the bench (used up by the next roll that is not already certain). */
let catalyst = "";

export function openEnhance(onChange: () => void) {
  const g = app.game;
  const m = openModal("✨ Cường Hoá Trang Bị", { wide: true, onClose: onChange });
  const render = () => {
    const ids = [g.heroId, ...g.party.filter((id) => id !== g.heroId), ...Object.keys(g.chars).filter((id) => id !== g.heroId && !g.party.includes(id))];
    if (!g.chars[current]) current = g.heroId;
    const ch: Character = g.chars[current];
    const tabs = h("div", { class: "char-tabs" }, ids.map((id) => {
      const c = g.chars[id];
      const total = Object.values(c.gear).reduce((a, id) => a + (id ? enhLevel(id) : 0), 0);
      return h("button", { class: `char-tab ${id === ch.id ? "on" : ""}`, onclick: () => { current = id; render(); } },
        spriteImg(c.sprite, c.pal), h("div", null, c.name.split(" ")[0]), h("div", { class: "muted" }, total ? `✨ +${total}` : "—"));
    }));
    const list = h("div", { class: "list no-search" }, GEAR_KEYS.map((key) => {
      const id = ch.gear[key];
      const lvl = id ? enhLevel(id) : 0;
      const it = id ? getItem(id) : null;
      const next = id && lvl < ENH_MAX ? getItem(enhancedId(id, lvl + 1)) : null;
      const max = lvl >= ENH_MAX;
      const cost = enhanceCost(g, lvl);
      const base = enhanceChance(lvl);
      const cat = catalyst && (g.inventory[catalyst] ?? 0) > 0 && base < 1 ? catalyst : "";
      const chance = chanceWith(lvl, cat);
      if (!it) return h("div", { class: "item-row locked" }, h("span", { class: "ico" }, GEAR_ICONS[key]),
        h("div", { class: "meta" }, h("div", { class: "name" }, GEAR_NAMES[key], h("span", { class: "tag" }, "trống")), h("div", { class: "desc muted" }, "Mặc một món vào ô này để cường hoá.")));
      return itemTip(h("div", { class: "item-row" },
        h("span", { class: "ico" }, itemImg(it.id)),
        h("div", { class: "meta" },
          h("div", { class: "name" }, h("span", { class: rarityClass(it) }, it.name), h("span", { class: "tag" }, GEAR_NAMES[key])),
          h("div", { class: "desc good" }, statText(it.equip!.stats)),
          h("div", { class: "desc" }, max ? "Đã cường hoá tối đa." : `➜ +${lvl + 1}: ${statText(next!.equip!.stats)} · thành công ${Math.round(chance * 100)}%${cat ? ` (có ${CATALYSTS[cat].name})` : ""}${chance < 1 ? (cat === "soul_gem" ? " · thất bại được hoàn vàng" : " (thất bại chỉ mất vàng)") : ""}`)),
        h("button", {
          class: "btn small primary", disabled: max || g.gold < cost,
          onclick: () => {
            const r = tryEnhance(g, ch, key, Math.random(), cat || undefined);
            if (r === "ok") toast(`✨ ${getItem(ch.gear[key]!).name}!`, "good");
            else if (r === "fail") toast(cat === "soul_gem" ? "💥 Thất bại… Ngọc Hồn Đen đã hoàn lại vàng." : `💥 Thất bại… mất ${cost} vàng. Thử lại nhé.`, "bad");
            if (catalyst && !(g.inventory[catalyst] ?? 0)) catalyst = "";
            app.dirty();
            render();
          },
        }, max ? "Tối đa" : `💰${cost.toLocaleString("vi-VN")}`)), it.id, { slot: key });
    }));
    m.body.replaceChildren(
      h("p", { class: "muted small", style: "margin-top:0" }, `Thợ rèn gia cố món đồ đang mặc. Mỗi cấp +10% chỉ số (ít nhất +1). Cấp cường hoá đi theo món đồ: tháo ra, bán hay đưa người khác đều giữ nguyên. Giá tăng theo cấp và theo độ sâu bạn đã tới. 💰 `, h("b", { class: "gold" }, g.gold.toLocaleString("vi-VN"))),
      catalystBar(), tabs, list);
  };
  const catalystBar = () => h("div", { class: "catalysts" },
    h("span", { class: "muted small" }, "Xúc tác:"),
    Object.entries(CATALYSTS).map(([id, c]) => {
      const n = g.inventory[id] ?? 0;
      return itemTip(h("button", {
        class: `btn small ${catalyst === id ? "primary" : ""}`, disabled: !n,
        onclick: () => { catalyst = catalyst === id ? "" : id; render(); },
      }, itemImg(id), ` ${c.short} ×${n}`), id);
    }));
  render();
}
