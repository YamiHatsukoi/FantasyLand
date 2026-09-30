import { app } from "../app";
import { getItem } from "../data/items";
import { PERSONAS } from "../data/npcText";
import { spriteImg } from "../render/pixel";
import { h, openModal, toast } from "../ui/dom";
import {
  MOOD_ICONS, ROMANCE_PRICES, STAGE_NAMES, bondOf, buyRomanceItem, friendTitle, heartsOf, isBirthday, moodOf, partnerOf, profileOf, residents, sceneReady,
} from "../world/residents";
import { heartRow, openResident } from "./residentTalk";

let sortBy: "hearts" | "name" | "mood" = "hearts";
let query = "";

/** List of everyone living in the sanctuary. */
export function openResidentList(hooks: { find?: (id: string) => void; onClose?: () => void } = {}) {
  const g = app.game;
  const m = openModal("💞 Cư Dân Thánh Địa", { wide: true, onClose: hooks.onClose });
  const render = () => {
    const q = query.trim().toLowerCase();
    const list = residents(g).filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({ c, b: bondOf(g, c.id), p: profileOf(c), mood: moodOf(g, c) }))
      .sort((a, b) => sortBy === "name" ? a.c.name.localeCompare(b.c.name) : sortBy === "mood" ? b.mood - a.mood : b.b.fp + b.b.rp - (a.b.fp + a.b.rp));
    const partner = partnerOf(g);
    const rows = h("div", { class: "list" });
    for (const { c, b, p, mood } of list.slice(0, 200)) {
      const ready = sceneReady(g, c);
      rows.append(h("div", { class: "item-row" },
        h("span", { class: "ico" }, spriteImg(c.sprite, c.pal)),
        h("div", { class: "meta" },
          h("div", { class: "name" }, c.name, ready ? h("span", { class: "tag", style: "color:var(--gold)" }, "❗ có chuyện muốn kể") : null, isBirthday(g, p) ? h("span", { class: "tag" }, "🎂") : null,
            b.stage !== "none" ? h("span", { class: "tag" }, `💞 ${STAGE_NAMES[b.stage]}`) : null),
          h("div", { class: "desc" }, heartRow(b.fp), ` ${friendTitle(b.fp)} · ${PERSONAS[p.persona].icon} ${PERSONAS[p.persona].name} · ${MOOD_ICONS[mood + 2]}`),
          p.romanceable && !b.closed && b.rp > 0 ? h("div", { class: "desc" }, heartRow(b.rp, "💗")) : null),
        h("div", { class: "col", style: "gap:4px" },
          h("button", { class: "btn small primary", onclick: () => { m.close(); openResident(c, () => undefined); } }, "Trò chuyện"),
          hooks.find ? h("button", { class: "btn small", onclick: () => { m.close(); hooks.find!(c.id); } }, "📍 Tìm") : null)));
    }
    if (!list.length) rows.append(h("p", { class: "muted" }, residents(g).length ? "Không tìm thấy ai." : "Chưa có ai sống ở Thánh Địa. Hãy chiêu mộ đồng đội ở Quán Rượu hoặc các làng dưới Vực Sâu — họ sẽ về đây sinh sống."));
    const shop = h("div", { class: "row", style: "gap:8px;flex-wrap:wrap;margin:6px 0" },
      h("span", { class: "small muted" }, "🌱 Quầy quà của Mầm:"),
      ...(["bouquet", "promise_ring"] as const).map((id) => h("button", {
        class: "btn small",
        onclick: () => { const err = buyRomanceItem(g, id); if (err) toast(err, "bad"); else { toast(`Đã mua ${getItem(id).name}`, "good"); app.dirty(); render(); } },
      }, `${getItem(id).icon} ${getItem(id).name} · ${ROMANCE_PRICES[id]}💰 (có ${g.inventory[id] ?? 0})`)));
    const search = h("input", { class: "input", placeholder: "Tìm cư dân…", value: query, oninput: (e: Event) => { query = (e.target as HTMLInputElement).value; render(); } });
    const sorts = h("div", { class: "cat-list" }, ([["hearts", "Thân thiết"], ["name", "Tên"], ["mood", "Tâm trạng"]] as const).map(([k, l]) =>
      h("button", { class: sortBy === k ? "on" : "", onclick: () => { sortBy = k; render(); } }, l)));
    const total = residents(g).length;
    const bestFriends = residents(g).filter((c) => heartsOf(bondOf(g, c.id).fp) >= 8).length;
    m.body.replaceChildren(
      h("div", { class: "small muted" }, `${total} cư dân · ${bestFriends} bạn thân${partner ? ` · 💞 ${partner.name} (${STAGE_NAMES[bondOf(g, partner.id).stage]})` : ""}`),
      shop, h("div", { class: "searchbar" }, search), sorts, rows,
    );
    const inp = m.body.querySelector("input");
    if (inp && document.activeElement !== inp && query) { inp.focus(); inp.setSelectionRange(query.length, query.length); }
  };
  render();
}
