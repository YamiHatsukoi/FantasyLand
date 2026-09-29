import { app } from "../app";
import { addItem, charStats, removeItem } from "../core/state";
import { TYPE_NAMES, getItem } from "../data/items";
import { JOBS, PERSONAS } from "../data/npcText";
import { spriteImg } from "../render/pixel";
import { h, openModal, toast } from "../ui/dom";
import { itemImg } from "../ui/icon";
import {
  SHOP_NAMES, SIZE_NAMES, activeQuest, bought, buyPrice, getNpc, hearts, markBought, memOf, questGoal, questProgress, sellPrice, shopStock,
  type Settlement, type ShopKind,
} from "../world/people";
import { statText } from "./party";
import { openNpc } from "./npcTalk";

let tab: "shops" | "people" | "inn" | "quests" = "shops";

/** Hub for a village / town / city inside the dungeon. */
export function openSettlement(s: Settlement, onChange: () => void) {
  const g = app.game;
  const icon = s.size === "village" ? "🏘️" : s.size === "town" ? "🏙️" : "🏰";
  const m = openModal(`${icon} ${s.name}`, { wide: true, onClose: onChange });
  const render = () => {
    const tabs = h("div", { class: "tabs" },
      ([["shops", `🏪 Cửa hàng (${s.shops.length})`], ["people", `👥 Cư dân (${s.npcs.length})`], ["inn", "🛏️ Quán trọ"], ["quests", "📋 Việc nhờ"]] as const).map(([id, label]) =>
        h("button", { class: tab === id ? "on" : "", onclick: () => { tab = id; render(); } }, label)));
    const body = h("div", null);
    if (tab === "shops") {
      const list = h("div", { class: "list" });
      s.shops.forEach((kind, i) => {
        const owner = getNpc(s.npcs[i]);
        list.append(h("button", { class: "item-row", onclick: () => openShop(s, kind, s.npcs[i], render) },
          h("span", { class: "ico" }, SHOP_NAMES[kind].icon),
          h("div", { class: "meta" }, h("div", { class: "name" }, SHOP_NAMES[kind].name), h("div", { class: "desc" }, `Chủ tiệm: ${owner.name} ${hearts(memOf(g, owner.id).aff)} — càng thân càng được giảm giá.`)),
          h("span", { class: "btn small" }, "Vào")));
      });
      body.append(list);
    } else if (tab === "people") {
      const grid = h("div", { class: "npc-grid" });
      for (const id of s.npcs) {
        const npc = getNpc(id);
        const mem = g.npcs[id];
        const q = activeQuest(g, id);
        const joined = !!g.chars[`npc_${id}`];
        grid.append(h("button", { class: "npc-card", onclick: () => openNpc(npc, render) },
          spriteImg(npc.sprite, npc.pal, "sprite"),
          h("div", null,
            h("div", { class: "nm" }, npc.name, q ? " 📋" : "", joined ? " 🤝" : ""),
            h("div", { class: "muted" }, `${JOBS[npc.job].icon} ${JOBS[npc.job].name} · ${PERSONAS[npc.persona].icon}`),
            h("div", null, mem ? hearts(mem.aff) : "Chưa gặp"))));
      }
      body.append(h("p", { class: "muted small", style: "margin-top:0" }, "Mỗi người có tính cách, sở thích và trí nhớ riêng. Họ nhớ những gì bạn nói, món quà bạn tặng và việc bạn đã giúp. Người có 🤝 đã theo bạn; nhiều người khác có thể được chiêu mộ khi đủ thân thiết."), grid);
    } else if (tab === "inn") {
      const price = 10 + s.floor * 8;
      const hurt = g.party.some((id) => { const c = g.chars[id]; const st = charStats(c); return c.hp < st.hp || c.mp < st.mp; });
      body.append(
        h("p", null, `Chủ quán mời bạn một bát súp nóng. "Nghỉ một đêm chỉ ${price} vàng thôi, giường êm lắm!"`),
        h("button", {
          class: "btn primary", disabled: g.gold < price || !hurt,
          onclick: () => {
            g.gold -= price;
            for (const id of g.party) { const c = g.chars[id]; const st = charStats(c); c.hp = st.hp; c.mp = st.mp; }
            toast("🛏️ Cả đội đã nghỉ ngơi và hồi phục hoàn toàn.", "good");
            app.dirty();
            render();
          },
        }, hurt ? `Nghỉ trọ (💰${price})` : "Cả đội đang khoẻ mạnh"),
        h("p", { class: "muted small" }, s.desc));
    } else {
      const list = h("div", { class: "list" });
      for (const id of s.npcs) {
        const q = activeQuest(g, id);
        if (!q) continue;
        const npc = getNpc(id);
        const pr = questProgress(g, q, npc);
        list.append(h("button", { class: "item-row", onclick: () => openNpc(npc, render) },
          spriteImg(npc.sprite, npc.pal, "sprite mini-portrait"),
          h("div", { class: "meta" }, h("div", { class: "name" }, npc.name), h("div", { class: `desc ${pr.ok ? "good" : ""}` }, `${questGoal(q, npc)} — ${pr.have}/${pr.need}${pr.ok ? " ✅ Hãy báo cáo!" : ""}`))));
      }
      if (!list.children.length) list.append(h("p", { class: "muted" }, "Chưa nhận việc nào ở đây. Hãy trò chuyện với cư dân — khi đã quen biết, họ sẽ nhờ bạn giúp."));
      body.append(list);
    }
    m.body.replaceChildren(h("p", { class: "muted small", style: "margin-top:0" }, `${SIZE_NAMES[s.size]} · Tầng ${s.floor} · 💰 ${g.gold}`), tabs, body);
  };
  render();
}

let shopTab: "buy" | "sell" = "buy";

function openShop(s: Settlement, kind: ShopKind, ownerId: string, refresh: () => void) {
  const g = app.game;
  const owner = getNpc(ownerId);
  const m = openModal(`${SHOP_NAMES[kind].icon} ${SHOP_NAMES[kind].name} — ${s.name}`, { wide: true, onClose: refresh });
  const render = () => {
    const tabs = h("div", { class: "tabs" },
      h("button", { class: shopTab === "buy" ? "on" : "", onclick: () => { shopTab = "buy"; render(); } }, "Mua"),
      h("button", { class: shopTab === "sell" ? "on" : "", onclick: () => { shopTab = "sell"; render(); } }, "Bán"));
    const list = h("div", { class: "list" });
    if (shopTab === "buy") {
      const got = bought(g, s, kind);
      for (const e of shopStock(g, s, kind)) {
        const it = getItem(e.id);
        const left = e.qty - (got[e.id] ?? 0);
        const price = buyPrice(g, ownerId, e.price);
        const desc = it.equip ? statText(it.equip.stats) : it.desc;
        list.append(h("div", { class: `item-row ${left <= 0 ? "locked" : ""}` },
          h("span", { class: "ico" }, itemImg(it.id)),
          h("div", { class: "meta" },
            h("div", { class: "name" }, it.name, h("span", { class: "tag" }, TYPE_NAMES[it.type]), it.tier ? h("span", { class: "tag" }, `Bậc ${it.tier}`) : null, g.inventory[it.id] ? h("span", { class: "tag" }, `có ${g.inventory[it.id]}`) : null),
            h("div", { class: "desc" }, desc)),
          h("span", { class: "qty" }, left > 0 ? `×${left}` : "hết"),
          h("button", {
            class: "btn small primary", disabled: left <= 0 || g.gold < price,
            onclick: () => {
              if (g.gold < price) return;
              g.gold -= price;
              addItem(g, it.id, 1);
              markBought(g, s, kind, it.id, 1);
              app.dirty();
              render();
            },
          }, `💰${price}`)));
      }
    } else {
      const items = Object.keys(g.inventory).map(getItem).filter((it) => it.value > 0 && it.type !== "key" && (g.inventory[it.id] ?? 0) > 0)
        .sort((a, b) => b.value - a.value);
      for (const it of items) {
        const p = sellPrice(g, ownerId, it.value);
        const n = g.inventory[it.id] ?? 0;
        list.append(h("div", { class: "item-row" },
          h("span", { class: "ico" }, itemImg(it.id)),
          h("div", { class: "meta" }, h("div", { class: "name" }, it.name), h("div", { class: "desc" }, `${p} vàng mỗi cái`)),
          h("span", { class: "qty" }, `×${n}`),
          h("button", { class: "btn small", onclick: () => { if (removeItem(g, it.id, 1)) { g.gold += p; app.dirty(); render(); } } }, "Bán 1"),
          n > 1 ? h("button", { class: "btn small", onclick: () => { if (removeItem(g, it.id, n)) { g.gold += p * n; toast(`+${p * n} vàng`, "good"); app.dirty(); render(); } } }, "Bán hết") : null));
      }
    }
    m.body.replaceChildren(
      h("div", { class: "row", style: "gap:10px;flex-wrap:nowrap" }, spriteImg(owner.sprite, owner.pal, "sprite mini-portrait"),
        h("div", { class: "grow small" }, h("b", null, owner.name), ` ${hearts(memOf(g, owner.id).aff)} · 💰 `, h("b", { class: "gold" }, String(g.gold))),
        h("button", { class: "btn small", onclick: () => openNpc(owner, render) }, "💬 Nói chuyện")),
      tabs, list);
  };
  render();
}
