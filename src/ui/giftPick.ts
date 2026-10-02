import type { GameState } from "../core/state";
import { getItem, type ItemDef, type ItemType } from "../data/items";
import { h } from "./dom";
import { itemImg } from "./icon";
import { fold } from "./smart";

/**
 * The bag, as a list to pick a present from (for residents and townsfolk): grouped like the
 * bag, searchable, and with the gear last - a bag full of swords must not bury the honey.
 */
const GROUPS: { id: string; label: string; types: ItemType[] }[] = [
  { id: "all", label: "Tất cả", types: [] },
  { id: "food", label: "Đồ ăn", types: ["food", "herb"] },
  { id: "farm", label: "Nông trại", types: ["seed", "sapling", "crop", "animal", "fertilizer"] },
  { id: "mat", label: "Nguyên liệu", types: ["material", "key"] },
  { id: "use", label: "Thuốc & Bom", types: ["potion", "bomb", "scroll"] },
  { id: "equip", label: "Trang bị", types: ["equip"] },
];
const SHOWN = 150;
let group = "all";

export function giftPicker(g: GameState, o: {
  allow: (it: ItemDef) => boolean;
  /** Higher comes first (wishes, loved things). */
  rank: (it: ItemDef) => number;
  tag: (it: ItemDef) => string | null;
  pick: (it: ItemDef) => void;
}): HTMLElement {
  const items = Object.keys(g.inventory).filter((id) => (g.inventory[id] ?? 0) > 0).map(getItem).filter(o.allow)
    .sort((a, b) => o.rank(b) - o.rank(a) || Number(a.type === "equip") - Number(b.type === "equip") || b.value - a.value);
  let q = "";
  const root = h("div", { class: "col no-search", style: "gap:6px" });
  const list = h("div", { class: "list" });
  const tabs = h("div", { class: "cat-list" });
  const draw = () => {
    const groups = GROUPS.filter((x) => !x.types.length || items.some((it) => x.types.includes(it.type)));
    const grp = groups.find((x) => x.id === group) ?? groups[0];
    tabs.replaceChildren(...groups.map((x) => h("button", { class: x.id === grp.id ? "on" : "", onclick: () => { group = x.id; draw(); } }, x.label)));
    const shown = items.filter((it) => (!grp.types.length || grp.types.includes(it.type)) && (!q || fold(it.name).includes(fold(q))));
    list.replaceChildren(...shown.slice(0, SHOWN).map((it) => {
      const tag = o.tag(it);
      return h("button", { class: "item-row", onclick: () => o.pick(it) },
        h("span", { class: "ico" }, itemImg(it.id)),
        h("div", { class: "meta" }, h("div", { class: "name" }, it.name, tag ? h("span", { class: "tag" }, tag) : null)),
        h("span", { class: "qty" }, `×${g.inventory[it.id]}`));
    }));
    if (!shown.length) list.append(h("p", { class: "muted" }, items.length ? "Không tìm thấy." : "Túi trống."));
    else if (shown.length > SHOWN) list.append(h("p", { class: "muted small" }, `Còn ${shown.length - SHOWN} món nữa - gõ tên để tìm.`));
  };
  const search = h("input", { type: "search", class: "input", style: "width:100%", placeholder: "Tìm vật phẩm…",
    oninput: (e: Event) => { q = (e.target as HTMLInputElement).value; draw(); } });
  root.append(tabs, search, list);
  draw();
  return root;
}
