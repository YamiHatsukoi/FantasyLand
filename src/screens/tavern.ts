import { passiveText } from "../combat/describe";
import { app } from "../app";
import { CLASSES } from "../data/classes";
import { getPassive } from "../data/passives";
import { spriteImg } from "../render/pixel";
import { h, openModal, toast } from "../ui/dom";
import { hireOffer, tavernOffers } from "../world/people";
import { companionBeds, housing, noRoomReason, residents } from "../world/town";

/** Sanctuary tavern: wandering adventurers you can hire. New faces every day. */
export function openTavern(onChange?: () => void) {
  const g = app.game;
  const m = openModal("🍺 Quán Rượu Thánh Địa", { wide: true, onClose: () => onChange?.() });
  const render = () => {
    const offers = tavernOffers(g);
    const room = noRoomReason(g);
    const list = h("div", { class: "list" });
    for (const o of offers) {
      const cls = CLASSES[o.classId];
      list.append(h("div", { class: "item-row" },
        spriteImg(o.classId === "mage" || o.classId === "witch" ? "hero_mage" : "villager", o.pal, "sprite mini-portrait"),
        h("div", { class: "meta" },
          h("div", { class: "name" }, o.name, h("span", { class: "tag" }, `${cls.icon} ${cls.name}`), h("span", { class: "tag" }, `Cấp ${o.level}`)),
          h("div", { class: "desc" }, o.bio),
          o.passive ? h("div", { class: "desc" }, `✦ ${getPassive(o.passive).name}: ${passiveText(getPassive(o.passive).desc)}`) : null),
        h("button", {
          class: "btn small primary", disabled: g.gold < o.price || !!room, title: room ?? "",
          onclick: () => {
            const ch = hireOffer(g, o.id);
            if (!ch) return;
            toast(`${ch.name} gia nhập${g.party.includes(ch.id) ? " đội" : " (đợi ở Thánh Địa)"}!`, "good");
            app.checkpoint();
            render();
          },
        }, `Thuê 💰${o.price}`)));
    }
    if (!offers.length) list.append(h("p", { class: "muted" }, "Hôm nay quán vắng khách. Ngày mai sẽ có người mới ghé."));
    m.body.replaceChildren(
      h("p", { class: "muted small", style: "margin-top:0" }, `Mỗi ngày có những nhà thám hiểm mới ghé quán. Mỗi đồng đội cần một chỗ ngủ ở Thánh Địa; đội mang theo gồm bạn và 3 người, số còn lại ở nhà làm việc và luyện tập.`),
      h("div", { class: room ? "bad small" : "good small", style: "margin-bottom:6px" }, room ?? `🛏️ Còn ${companionBeds(g)} chỗ trống cho đồng đội (${residents(g) + 1}/${Math.max(1, housing(g))} giường).`),
      h("div", { class: "row between" }, h("span", null, "💰 ", h("b", { class: "gold" }, String(g.gold))), h("span", { class: "small muted" }, `Ngày ${g.day}`)),
      list);
  };
  render();
}
