import { app } from "../app";
import { ENH_BONUS, ENH_MAX, GEAR_KEYS, enhanceChance, enhanceCost, tryEnhance, type Character } from "../core/state";
import { getItem } from "../data/items";
import { spriteImg } from "../render/pixel";
import { h, openModal, toast } from "../ui/dom";
import { itemImg } from "../ui/icon";
import { GEAR_ICONS, GEAR_NAMES, rarityClass } from "../ui/gear";

/**
 * The forge's enhancement bench: gold in, +1..+10 per gear slot out. Each level makes whatever
 * sits in that slot 6% stronger, and it stays with the slot when the gear is swapped.
 */
let current = "";

export function openEnhance(onChange: () => void) {
  const g = app.game;
  const m = openModal("✨ Cường Hoá Trang Bị", { wide: true, onClose: onChange });
  const render = () => {
    const ids = [g.heroId, ...g.party.filter((id) => id !== g.heroId), ...Object.keys(g.chars).filter((id) => id !== g.heroId && !g.party.includes(id))];
    if (!g.chars[current]) current = g.heroId;
    const ch: Character = g.chars[current];
    const tabs = h("div", { class: "char-tabs" }, ids.map((id) => {
      const c = g.chars[id];
      const total = Object.values(c.enh ?? {}).reduce((a, b) => a + (b ?? 0), 0);
      return h("button", { class: `char-tab ${id === ch.id ? "on" : ""}`, onclick: () => { current = id; render(); } },
        spriteImg(c.sprite, c.pal), h("div", null, c.name.split(" ")[0]), h("div", { class: "muted" }, total ? `✨ +${total}` : "—"));
    }));
    const list = h("div", { class: "list no-search" }, GEAR_KEYS.map((key) => {
      const lvl = ch.enh?.[key] ?? 0;
      const id = ch.gear[key];
      const it = id ? getItem(id) : null;
      const max = lvl >= ENH_MAX;
      const cost = enhanceCost(g, lvl);
      const chance = enhanceChance(lvl);
      return h("div", { class: "item-row" },
        h("span", { class: "ico" }, it ? itemImg(it.id) : GEAR_ICONS[key]),
        h("div", { class: "meta" },
          h("div", { class: "name" }, `${GEAR_NAMES[key]} `, h("span", { class: "gold" }, lvl ? `+${lvl}` : "+0"), it ? h("span", { class: `tag ${rarityClass(it)}` }, it.name) : h("span", { class: "tag" }, "trống")),
          h("div", { class: "desc" }, max ? "Đã cường hoá tối đa." : `Lên +${lvl + 1}: chỉ số của món ở ô này +${Math.round(ENH_BONUS * 100 * (lvl + 1))}% · tỉ lệ thành công ${Math.round(chance * 100)}%${chance < 1 ? " (thất bại chỉ mất vàng)" : ""}`)),
        h("button", {
          class: "btn small primary", disabled: max || g.gold < cost,
          onclick: () => {
            const r = tryEnhance(g, ch, key, Math.random());
            if (r === "ok") toast(`✨ ${GEAR_NAMES[key]} của ${ch.name.split(" ")[0]} lên +${lvl + 1}!`, "good");
            else if (r === "fail") toast(`💥 Thất bại… mất ${cost} vàng. Thử lại nhé.`, "bad");
            app.dirty();
            render();
          },
        }, max ? "Tối đa" : `💰${cost.toLocaleString("vi-VN")}`));
    }));
    m.body.replaceChildren(
      h("p", { class: "muted small", style: "margin-top:0" }, `Thợ rèn gia cố từng ô trang bị. Cấp cường hoá gắn với ô, không mất khi đổi đồ. Giá tăng theo cấp và theo độ sâu bạn đã tới. 💰 `, h("b", { class: "gold" }, g.gold.toLocaleString("vi-VN"))),
      tabs, list);
  };
  render();
}
