import { count, type GameState } from "../core/state";
import type { Cost } from "../data/buildings";
import { getItem } from "../data/items";
import { iconURL } from "../render/icons";
import { h } from "./dom";

/** Pixel icon <img> for an item id ("gold" gets a coin). */
export function itemImg(id: string, cls = "iicon"): HTMLImageElement {
  const it = id === "gold" ? null : getItem(id);
  const src = it ? iconURL(it.shape, it.col) : iconURL("coin", ["#f2c542", "#c8902a", "#fff4b0"]);
  return h("img", { class: `pix ${cls}`, src, alt: it?.name ?? "vàng", title: it?.name ?? "Vàng" });
}

/** Ingredient chips showing have/need with icons. */
export function costView(g: GameState, cost: Cost): HTMLElement {
  return h("div", { class: "cost" }, Object.entries(cost).map(([id, n]) => {
    const have = count(g, id);
    return h("span", { class: have >= n ? "ok" : "no" }, itemImg(id, "iicon xs"), id === "gold" ? ` ${n}` : ` ${getItem(id).name} ${have}/${n}`);
  }));
}

/** Compact "icon×n" chips for loot lists. */
export function lootChips(items: Record<string, number>): HTMLElement[] {
  return Object.entries(items).filter(([, n]) => n > 0).map(([id, n]) => h("span", { class: "loot-chip" }, itemImg(id, "iicon xs"), ` ${id === "gold" ? "Vàng" : getItem(id).name} ×${n}`));
}
