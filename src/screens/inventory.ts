import { app } from "../app";
import { charStats, removeItem } from "../core/state";
import { TYPE_NAMES, getItem, type ItemDef, type ItemType } from "../data/items";
import { getPassive } from "../data/passives";
import { spriteImg } from "../render/pixel";
import { h, openModal, toast, type ModalHandle } from "../ui/dom";
import { itemImg } from "../ui/icon";
import { statText } from "./party";

const GROUPS: { id: string; label: string; types: ItemType[] }[] = [
  { id: "all", label: "Tất cả", types: [] },
  { id: "use", label: "Thuốc & Bom", types: ["potion", "bomb", "scroll"] },
  { id: "food", label: "Đồ ăn", types: ["food", "herb"] },
  { id: "mat", label: "Nguyên liệu", types: ["material", "key"] },
  { id: "farm", label: "Nông trại", types: ["seed", "sapling", "crop", "animal", "fertilizer"] },
  { id: "equip", label: "Trang bị", types: ["equip"] },
  { id: "tome", label: "Sách", types: ["tome"] },
];

export function openInventory(opts: { canSell: boolean; onChange?: () => void }) {
  const m = openModal("Túi Đồ", { wide: true, onClose: () => opts.onChange?.() });
  let group = "all";
  let q = "";
  const render = () => renderInv(m, group, q, opts.canSell, (gid) => { group = gid; render(); }, (nq) => { q = nq; render(); }, render);
  render();
}

function renderInv(m: ModalHandle, group: string, q: string, canSell: boolean, setGroup: (g: string) => void, setQ: (q: string) => void, rerender: () => void) {
  const g = app.game;
  const grp = GROUPS.find((x) => x.id === group)!;
  const items = Object.keys(g.inventory)
    .map(getItem)
    .filter((it) => (g.inventory[it.id] ?? 0) > 0 && (!grp.types.length || grp.types.includes(it.type)) && (!q || it.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.type.localeCompare(b.type) || (b.tier ?? 0) - (a.tier ?? 0) || a.name.localeCompare(b.name));
  const tabs = h("div", { class: "cat-list" }, GROUPS.map((x) => h("button", { class: x.id === group ? "on" : "", onclick: () => setGroup(x.id) }, x.label)));
  const search = h("input", { class: "input", placeholder: "Tìm vật phẩm…", value: q, onchange: (e: Event) => setQ((e.target as HTMLInputElement).value) });
  const list = h("div", { class: "list" });
  for (const it of items.slice(0, 150)) list.append(itemRow(it, canSell, rerender));
  if (items.length > 150) list.append(h("p", { class: "muted small" }, `…và ${items.length - 150} loại nữa. Hãy lọc hoặc tìm kiếm.`));
  if (!items.length) list.append(h("p", { class: "muted" }, "Không có gì ở đây."));
  const ex = g.expedition;
  const bag = ex ? Object.entries(ex.bag).filter(([, n]) => n > 0) : [];
  m.body.replaceChildren(
    h("div", { class: "row between" }, h("div", null, "💰 ", h("b", { class: "gold" }, String(g.gold)), " vàng"),
      ex ? h("div", { class: "muted small" }, `Chiến lợi phẩm chuyến này: ${bag.length} loại, ${ex.bagGold} vàng (mất 50% nếu gục ngã)`) : null),
    tabs, h("div", { class: "searchbar" }, search, h("span", { class: "small muted" }, `${Object.keys(g.inventory).length} loại`)), list);
}

function itemRow(it: ItemDef, canSell: boolean, rerender: () => void) {
  const g = app.game;
  const n = g.inventory[it.id] ?? 0;
  const actions = h("div", { class: "row" });
  if (it.use?.field || it.meal || (it.use?.special && fieldSpecial)) actions.append(h("button", { class: "btn small good", onclick: () => useInField(it, rerender) }, it.meal && !it.use?.field ? "Ăn" : "Dùng"));
  if (canSell && it.value > 0 && it.type !== "key") {
    actions.append(h("button", {
      class: "btn small",
      onclick: () => { if (removeItem(g, it.id, 1)) { g.gold += it.value; app.dirty(); rerender(); } },
    }, `Bán ${it.value}💰`));
    if (n > 1) actions.append(h("button", {
      class: "btn small",
      onclick: () => { const k = g.inventory[it.id] ?? 0; if (removeItem(g, it.id, k)) { g.gold += it.value * k; app.dirty(); toast(`Đã bán ${k} ${it.name} (+${it.value * k} vàng)`, "good"); rerender(); } },
    }, "Bán hết"));
  }
  const desc = it.equip
    ? `${statText(it.equip.stats)}${it.equip.passive ? ` · ✦ ${getPassive(it.equip.passive).name}: ${getPassive(it.equip.passive).desc}` : ""}`
    : it.desc;
  return h("div", { class: "item-row" },
    h("span", { class: "ico" }, itemImg(it.id)),
    h("div", { class: "meta" },
      h("div", { class: "name" }, it.name, h("span", { class: "tag" }, TYPE_NAMES[it.type]), it.tier ? h("span", { class: "tag" }, `Bậc ${it.tier}`) : null),
      it.meal ? h("div", { class: "desc good" }, `Bữa ăn: ${it.meal.name} (${statText(it.meal.mods as Record<string, number>)}) tới khi về nhà`) : null,
      h("div", { class: "desc" }, desc)),
    h("span", { class: "qty" }, `×${n}`),
    actions);
}

/** Using a consumable outside of battle (heal, revive, cleanse...). */
let fieldSpecial: ((it: ItemDef) => boolean) | null = null;
/** The dungeon registers a handler for scroll specials (return home, reveal map, repel...). */
export function setFieldSpecial(fn: ((it: ItemDef) => boolean) | null) { fieldSpecial = fn; }

export function useInField(it: ItemDef, done: () => void) {
  const g = app.game;
  if (it.use?.special) {
    if (fieldSpecial && fieldSpecial(it)) { removeItem(g, it.id, 1); app.dirty(); done(); }
    else toast("Chỉ dùng được khi đang ở trong Vực Sâu.", "bad");
    return;
  }
  if (it.meal) {
    if (!removeItem(g, it.id, 1)) return;
    g.meal = it.meal;
    if (it.use) for (const id of g.party) {
      const ch = g.chars[id];
      const s = charStats(ch);
      if (ch.hp > 0 && it.use.healPct) ch.hp = Math.min(s.hp, ch.hp + Math.round(s.hp * it.use.healPct));
      if (ch.hp > 0 && it.use.mpPct) ch.mp = Math.min(s.mp, ch.mp + Math.round(s.mp * it.use.mpPct));
    }
    toast(`🍽️ Cả đội dùng ${it.name}: ${it.meal.name} — hiệu lực tới khi về Thánh Địa.`, "good", 4000);
    app.dirty();
    done();
    return;
  }
  const use = it.use!;
  const apply = (ids: string[]) => {
    if (!removeItem(g, it.id, 1)) return;
    for (const id of ids) {
      const ch = g.chars[id];
      const s = charStats(ch);
      if (use.revivePct && ch.hp <= 0) ch.hp = Math.round(s.hp * use.revivePct);
      if (ch.hp <= 0) continue;
      if (use.healPct) ch.hp = Math.min(s.hp, ch.hp + Math.round(s.hp * use.healPct));
      if (use.mpPct) ch.mp = Math.min(s.mp, ch.mp + Math.round(s.mp * use.mpPct));
    }
    toast(`Đã dùng ${it.name}.`, "good");
    app.dirty();
    done();
  };
  if (use.target === "allies") return apply([...g.party]);
  const m = openModal(`Dùng ${it.name} cho ai?`);
  for (const id of g.party) {
    const ch = g.chars[id];
    const s = charStats(ch);
    const ok = use.target === "deadAlly" ? ch.hp <= 0 : ch.hp > 0;
    m.body.append(h("button", { class: "item-row", disabled: !ok, onclick: () => { m.close(); apply([id]); } },
      spriteImg(ch.sprite, ch.pal, "sprite mini-portrait"),
      h("div", { class: "meta" }, h("div", { class: "name" }, ch.name), h("div", { class: "desc" }, `Máu ${ch.hp}/${s.hp} · MP ${ch.mp}/${s.mp}`))));
  }
}
