import { app } from "../app";
import { addItem, count, logMsg, removeItem } from "../core/state";
import { getItem, type ItemDef } from "../data/items";
import { claimGifts, errorText, giftBox, listPlayers, sendGift, type Gift, type GiftBox } from "../net/api";
import { confirmBox, h, openModal, toast } from "../ui/dom";
import { itemImg } from "../ui/icon";
import { rarityClass } from "../ui/gear";
import { fold } from "../ui/smart";
import { itemTip } from "../ui/tooltip";
import { ago } from "./players";

/**
 * Hòm Quà: players send each other items and gold. Everything is one small row per gift on the
 * server; the client only asks when a gift is sent, the box is opened, or (at most every few
 * minutes) to refresh the "new gifts" badge.
 */
export const GIFT_MAX_KINDS = 8;
const NOTE_MAX = 120;
const CHECK_EVERY = 3 * 60_000;

/** Items that can't leave their owner (quest keys and the like). */
export const giftable = (it: ItemDef) => it.type !== "key";

/** Null for ids this version of the game doesn't know (getItem would hand back a placeholder). */
const safeItem = (id: string): ItemDef | null => {
  try {
    const it = getItem(id);
    return it.value === 0 && it.desc === "Vật phẩm không xác định." ? null : it;
  } catch { return null; }
};

// ------------------------------------------------------------ unread badge (throttled)
let waiting = 0;
let lastCheck = 0;
let checking: Promise<number> | null = null;

/** Number of gifts waiting in the box; asks the server at most every few minutes. */
export function checkGifts(force = false): Promise<number> {
  const s = app.session;
  if (!s || s.offline) return Promise.resolve(0);
  if (!force && Date.now() - lastCheck < CHECK_EVERY) return Promise.resolve(waiting);
  if (checking) return checking;
  lastCheck = Date.now();
  checking = giftBox(s).then((b) => (waiting = b.inbox.length)).catch(() => waiting).finally(() => { checking = null; });
  return checking;
}
export const giftsWaiting = () => waiting;

// ------------------------------------------------------------ the box
let playerNames: string[] | null = null;

export function openGifts(opts: { to?: string; onChange?: () => void } = {}) {
  const s = app.session;
  const m = openModal("🎁 Hòm Quà", { wide: true, cls: "no-autosearch", onClose: () => opts.onChange?.() });
  if (!s || s.offline) {
    m.body.append(h("p", { class: "muted" }, "Bạn đang chơi ngoại tuyến. Tặng quà cần đăng nhập vào máy chủ."));
    return;
  }
  let tab: "inbox" | "send" | "sent" = opts.to ? "send" : "inbox";
  let box: GiftBox | null = null;
  let loading = false;
  let error = "";
  // the parcel being packed
  let to = opts.to ?? "";
  const pack = new Map<string, number>();
  let gold = 0;
  let note = "";
  let q = "";
  let busy = false;

  const refresh = async () => {
    loading = true; error = ""; render();
    try {
      box = await giftBox(s);
      waiting = box.inbox.length;
      lastCheck = Date.now();
    } catch (e) { error = errorText(e); }
    loading = false; render();
  };

  const tabs = () => h("div", { class: "tabs" },
    ([["inbox", `📥 Hòm thư${box?.inbox.length ? ` (${box.inbox.length})` : ""}`], ["send", "📤 Gửi quà"], ["sent", "🗂️ Đã gửi"]] as const)
      .map(([id, label]) => h("button", { class: tab === id ? "on" : "", onclick: () => { tab = id; render(); } }, label)));

  const parcel = (items: Record<string, number>, g: number) => h("div", { class: "gift-items" },
    Object.entries(items).map(([id, n]) => {
      const it = safeItem(id);
      const chip = h("span", { class: `gift-chip ${it ? rarityClass(it) : ""}` }, it ? itemImg(id) : "❔", `${it?.name ?? id} ×${n}`);
      return it ? itemTip(chip, id, { qty: n }) : chip;
    }),
    g > 0 ? h("span", { class: "gift-chip" }, itemImg("gold"), `${g.toLocaleString("vi")} vàng`) : null);

  // ---------------------------------------------------------- receive
  const take = async (id: number | null) => {
    if (busy) return;
    busy = true;
    try {
      const got = await claimGifts(s, id);
      const g = app.game;
      const lines: string[] = [];
      for (const gift of got) {
        for (const [item, n] of Object.entries(gift.items ?? {})) {
          const it = safeItem(item);
          if (!it || !(n > 0)) continue; // an item this version of the game doesn't know
          addItem(g, item, Math.floor(n));
          lines.push(`${it.icon} ${it.name} ×${n}`);
        }
        if (gift.gold > 0) { g.gold += gift.gold; lines.push(`🪙 ${gift.gold} vàng`); }
      }
      if (got.length) {
        const from = new Set(got.map((x) => box?.inbox.find((b) => b.id === x.id)?.sender).filter(Boolean));
        logMsg(g, `🎁 Nhận quà từ ${[...from].map((n) => `@${n}`).join(", ") || "người chơi khác"}.`);
        app.dirty(true);
        toast(`Đã nhận: ${lines.slice(0, 4).join(", ")}${lines.length > 4 ? "…" : ""}`, "good");
      }
      if (box) box.inbox = box.inbox.filter((b) => !got.some((x) => x.id === b.id));
      waiting = box?.inbox.length ?? 0;
    } catch (e) { toast(errorText(e), "bad"); }
    busy = false;
    render();
    opts.onChange?.();
  };

  const giftCard = (gf: Gift) => h("div", { class: "gift-card" },
    h("div", { class: "row between" },
      h("b", null, `🎁 Từ @${gf.sender}`),
      h("span", { class: "muted small" }, ago(gf.created_at))),
    gf.note ? h("div", { class: "gift-note" }, `“${gf.note}”`) : null,
    parcel(gf.items, gf.gold),
    h("div", { class: "row end" }, h("button", { class: "btn small primary", onclick: () => take(gf.id) }, "Nhận")));

  const inboxView = () => {
    if (!box) return [];
    if (!box.inbox.length) return [h("p", { class: "muted" }, "Hòm thư trống. Khi có ai gửi quà, nó sẽ nằm ở đây chờ bạn.")];
    return [
      box.inbox.length > 1 ? h("div", { class: "row end", style: "margin-bottom:8px" }, h("button", { class: "btn primary", onclick: () => take(null) }, `Nhận tất cả (${box.inbox.length})`)) : null,
      h("div", { class: "list" }, box.inbox.map(giftCard)),
    ];
  };

  // ---------------------------------------------------------- send
  const pickFromList = async () => {
    if (!playerNames) {
      try { playerNames = (await listPlayers(s)).map((p) => p.username); } catch (e) { toast(errorText(e), "bad"); return; }
    }
    const pm = openModal("Chọn người nhận");
    pm.body.append(playerNames.length
      ? h("div", { class: "list" }, playerNames.map((n) => h("button", { class: "item-row", onclick: () => { to = n; pm.close(); render(); } }, h("span", { class: "ico" }, "🙂"), h("div", { class: "meta name" }, `@${n}`))))
      : h("p", { class: "muted" }, "Chưa có ai khác trên máy chủ."));
  };

  const send = async () => {
    const g = app.game;
    const target = to.trim();
    if (!target) return toast("Hãy nhập tên người nhận.", "bad");
    if (target.toLowerCase() === s.username.toLowerCase()) return toast("Không thể tự gửi quà cho chính mình.", "bad");
    const items: Record<string, number> = {};
    for (const [id, n] of pack) if (n > 0) items[id] = Math.min(n, count(g, id));
    const amount = Math.max(0, Math.min(Math.floor(gold) || 0, g.gold));
    if (!Object.keys(items).length && !amount) return toast("Gói quà đang trống.", "bad");
    const list = Object.entries(items).map(([id, n]) => `${getItem(id).name} ×${n}`);
    if (amount) list.push(`${amount} vàng`);
    if (!(await confirmBox("Gửi quà", `Gửi cho @${target}: ${list.join(", ")}? Gửi đi rồi thì không lấy lại được.`, "Gửi"))) return;
    if (busy) return;
    busy = true;
    // take the goods out first (and save), put them back if the server says no
    for (const [id, n] of Object.entries(items)) removeItem(g, id, n);
    g.gold -= amount;
    app.dirty(true);
    try {
      await sendGift(s, target, items, amount, note.trim().slice(0, NOTE_MAX));
      logMsg(g, `🎁 Đã gửi quà cho @${target}.`);
      app.dirty(true);
      toast(`Đã gửi quà cho @${target}!`, "good");
      pack.clear(); gold = 0; note = "";
      box = null; void refresh();
      tab = "sent";
    } catch (e) {
      for (const [id, n] of Object.entries(items)) addItem(g, id, n);
      g.gold += amount;
      app.dirty(true);
      toast(errorText(e), "bad");
    }
    busy = false;
    render();
    opts.onChange?.();
  };

  const sendView = () => {
    const g = app.game;
    const inv = Object.keys(g.inventory)
      .map(safeItem)
      .filter((it): it is ItemDef => !!it && (g.inventory[it.id] ?? 0) > 0 && giftable(it) && !pack.has(it.id) && (!q || fold(it.name).includes(fold(q))))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, "vi"));
    const full = pack.size >= GIFT_MAX_KINDS;
    const toInput = h("input", { type: "text", class: "input grow", value: to, placeholder: "Tên đăng nhập người nhận", maxlength: 32, oninput: (e: Event) => { to = (e.target as HTMLInputElement).value; } });
    const packed = [...pack].map(([id, n]) => {
      const it = getItem(id);
      const have = count(g, id);
      const qty = h("input", { type: "number", class: "input gift-qty", min: 1, max: have, value: String(n),
        onchange: (e: Event) => { const v = Math.floor(Number((e.target as HTMLInputElement).value)) || 1; pack.set(id, Math.max(1, Math.min(have, v))); render(); } });
      return h("div", { class: `item-row gift-packed ${rarityClass(it)}` },
        itemTip(h("span", { class: "ico" }, itemImg(id)), id),
        h("div", { class: "meta" }, h("div", { class: "name" }, it.name), h("div", { class: "desc" }, `Đang có ${have}`)),
        h("button", { class: "btn small", onclick: () => { pack.set(id, Math.max(1, n - 1)); render(); } }, "−"),
        qty,
        h("button", { class: "btn small", onclick: () => { pack.set(id, Math.min(have, n + 1)); render(); } }, "+"),
        h("button", { class: "btn small", onclick: () => { pack.set(id, have); render(); } }, "Hết"),
        h("button", { class: "icon-btn", "aria-label": "Bỏ ra", onclick: () => { pack.delete(id); render(); } }, "✕"));
    });
    const search = h("input", { type: "search", class: "input", style: "width:100%;margin-bottom:6px", value: q, placeholder: "Tìm vật phẩm…", oninput: (e: Event) => { q = (e.target as HTMLInputElement).value; renderSoon(); } });
    return [
      h("div", { class: "section-title" }, "Người nhận"),
      h("div", { class: "row", style: "gap:6px" }, toInput, h("button", { class: "btn small", onclick: pickFromList }, "📋 Chọn")),
      h("div", { class: "section-title" }, `Gói quà (${pack.size}/${GIFT_MAX_KINDS} loại)`),
      packed.length ? h("div", { class: "list" }, packed) : h("p", { class: "muted small" }, "Chọn vật phẩm từ túi đồ bên dưới."),
      h("div", { class: "row", style: "gap:6px;margin-top:8px;align-items:center" },
        itemImg("gold"), h("span", null, "Vàng"),
        h("input", { type: "number", class: "input gift-qty", min: 0, max: g.gold, value: String(gold), onchange: (e: Event) => { gold = Math.max(0, Math.min(g.gold, Math.floor(Number((e.target as HTMLInputElement).value)) || 0)); render(); } }),
        h("span", { class: "muted small" }, `/ ${g.gold.toLocaleString("vi")}`)),
      h("input", { type: "text", class: "input", value: note, maxlength: NOTE_MAX, placeholder: "Lời nhắn kèm theo (không bắt buộc)", style: "margin-top:8px;width:100%", oninput: (e: Event) => { note = (e.target as HTMLInputElement).value; } }),
      h("div", { class: "row end", style: "margin-top:8px" }, h("button", { class: "btn primary", disabled: busy || (!pack.size && !gold), onclick: send }, "🎁 Gửi quà")),
      h("div", { class: "section-title" }, "Túi đồ"),
      search,
      full ? h("p", { class: "muted small" }, `Mỗi gói tối đa ${GIFT_MAX_KINDS} loại vật phẩm.`) : null,
      h("div", { class: "list gift-inv" }, inv.map((it) => h("button", { class: `item-row ${rarityClass(it)} ${full ? "locked" : ""}`, disabled: full, onclick: () => { pack.set(it.id, 1); render(); } },
        itemTip(h("span", { class: "ico" }, itemImg(it.id)), it.id),
        h("div", { class: "meta" }, h("div", { class: "name" }, it.name), h("div", { class: "desc" }, it.desc)),
        h("span", { class: "qty" }, `×${g.inventory[it.id]}`)))),
      !inv.length ? h("p", { class: "muted small" }, q ? "Không tìm thấy." : "Không còn gì để gửi.") : null,
      h("p", { class: "muted small" }, "Vật phẩm cốt truyện (chìa khoá…) không gửi được. Quà nằm trong hòm của người nhận cho tới khi họ bấm nhận."),
    ];
  };

  const sentView = () => {
    if (!box) return [];
    if (!box.sent.length) return [h("p", { class: "muted" }, "Bạn chưa gửi món quà nào.")];
    return [h("div", { class: "list" }, box.sent.map((gf) => h("div", { class: "gift-card" },
      h("div", { class: "row between" },
        h("b", null, `📤 Gửi @${gf.recipient}`),
        h("span", { class: "muted small" }, `${ago(gf.created_at)} · ${gf.claimed_at ? "✅ đã nhận" : "⏳ chưa nhận"}`)),
      gf.note ? h("div", { class: "gift-note" }, `“${gf.note}”`) : null,
      parcel(gf.items, gf.gold))))];
  };

  let raf = 0;
  const renderSoon = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const focus = document.activeElement as HTMLInputElement | null;
      const wasSearch = focus?.type === "search";
      const pos = focus?.selectionStart ?? null;
      render();
      if (wasSearch) {
        const el = m.body.querySelector<HTMLInputElement>("input[type=search]");
        el?.focus();
        if (el && pos !== null) el.setSelectionRange(pos, pos);
      }
    });
  };

  let rendering = false;
  function render() {
    // replacing the body blurs a focused number box, whose "change" would re-enter here
    if (rendering) return;
    rendering = true;
    const body = tab === "send" ? sendView()
      : loading && !box ? [h("p", { class: "muted" }, "Đang tải…")]
      : error && !box ? [h("p", { class: "bad" }, error)]
      : tab === "inbox" ? inboxView() : sentView();
    try { m.body.replaceChildren(tabs(), ...body.filter(Boolean) as Node[]); } finally { rendering = false; }
  }

  render();
  void refresh();
}
