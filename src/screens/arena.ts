/**
 * Monster Arena screens: the lobby (rank, deck, start), the deck builder, a match (board,
 * bench, shop, items, traits, players, augments, carousels, fights) and the end-of-match
 * summary. Rank and deck live in the save; a match in progress is kept on this device only.
 */
import type { Screen } from "../app";
import { app } from "../app";
import { playMusic } from "../audio/music";
import { sfx } from "../audio/sfx";
import { AUGMENT_BY_ID, AUGMENTS } from "../arena/augments";
import { DT, type ArenaBattle, type Fighter } from "../arena/combat";
import { mirror } from "../arena/hex";
import { ITEMS, combine, isComponent, isTool, itemStatText } from "../arena/items";
import * as M from "../arena/match";
import { starValues } from "../arena/spells";
import { DIVS, POINTS_PER_DIV, TIERS, applyResult, lpDelta, matchReward, newRank, rankIcon, rankName, tierOf, tierReward } from "../arena/rank";
import { TRAITS, traitDesc, traitTier } from "../arena/traits";
import type { ArenaUnit, Star } from "../arena/types";
import { arenaUnit, arenaUnits } from "../arena/units";
import { addItem } from "../core/state";
import { hashString as hashStr } from "../core/rng";
import { getFloor } from "../world/floors";
import { getItem } from "../data/items";
import { ArenaView, COST_COL, STAR_COL } from "../render/arenaView";
import { arenaItemURL } from "../render/arenaIcons";
import { spriteURL } from "../render/pixel";
import { confirmBox, h, nn, openModal, toast, type ModalHandle } from "../ui/dom";

export const ARENA_UNLOCK = 40;

/** How many monster kinds the player has met (the arena needs 40). */
export function dexCount(): number {
  const dex = app.game.dex ?? {};
  return arenaUnits().filter((u) => dex[u.id]).length;
}

/** The dock button's action: opens the arena, or explains the lock. */
export function arenaGate(open: () => void) {
  const n = dexCount();
  if (n >= ARENA_UNLOCK) return open();
  const m = openModal("🏟️ Đấu Trường Quái Vật");
  m.body.append(
    h("p", null, "Đấu Trường đang khóa."),
    h("p", null, `Cần ghi nhận ít nhất ${ARENA_UNLOCK} loài quái vật trong Sổ tay quái vật để mở. Mỗi loài bạn từng chạm mặt ở Vực Sâu sẽ thành một tướng bạn dùng được trong Đấu Trường.`),
    h("div", { class: "ar-lockbar" }, h("div", { style: `width:${Math.min(100, (n / ARENA_UNLOCK) * 100)}%` }), h("span", null, `${n} / ${ARENA_UNLOCK} loài`)),
    h("p", { class: "muted" }, "Mẹo: xuống những tầng mới để gặp nhiều loài khác nhau; mỗi tầng có 6 loài thường và 1 trùm."),
    h("div", { class: "row end" }, h("button", { class: "btn primary", onclick: () => m.close() }, "Đã hiểu")),
  );
}

// ------------------------------------------------------------ save helpers
function arenaSave() {
  const g = app.game;
  g.arena ??= { rank: newRank(), played: 0, top1: 0, top4: 0 };
  return g.arena;
}
const matchKey = () => `fl.arena.${app.game.created}`;
function loadMatch(): M.MatchState | null {
  try { const s = localStorage.getItem(matchKey()); return s ? (JSON.parse(s) as M.MatchState) : null; } catch { return null; }
}
function saveMatch(m: M.MatchState | null) {
  try { if (m && m.phase !== "end") localStorage.setItem(matchKey(), JSON.stringify(m)); else localStorage.removeItem(matchKey()); } catch { /* storage full or blocked: the match just won't resume */ }
}

const unlockedUnits = () => { const dex = app.game.dex ?? {}; return arenaUnits().filter((u) => dex[u.id]); };

const ROLE_NAMES: Record<string, string> = { tank: "Đỡ đòn", brute: "Đấu sĩ", assassin: "Sát thủ", marksman: "Xạ thủ", mage: "Pháp sư", support: "Hỗ trợ" };
const KIND_ICON: Record<string, string> = { carousel: "🎠", pve: "👾", pvp: "⚔️" };
const KIND_NAME: Record<string, string> = { carousel: "Chợ Tướng", pve: "Đánh Quái", pvp: "Giao Đấu" };
const TIER_COL = ["", "#c0c8d0", "#ffd84a", "#ff8af0"];

function unitImg(u: ArenaUnit, scale = 4, cls = "pix") {
  return h("img", { class: cls, src: spriteURL(u.sprite, u.palette, scale), alt: "", draggable: false });
}
const stars = (n: number) => h("span", { class: "ar-stars", style: `color:${STAR_COL[n]}` }, "★".repeat(n));

/** A floating card on mouse hover (desktop); taps still open the full card. */
let tipEl: HTMLElement | null = null;
export function attachTip(el: HTMLElement, make: () => Node | string) {
  el.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    tipEl?.remove();
    tipEl = h("div", { class: "ar-tip" }, make());
    document.body.append(tipEl);
    const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
    const x = Math.max(6, Math.min(window.innerWidth - t.width - 6, r.left + r.width / 2 - t.width / 2));
    const y = r.top - t.height - 8 > 6 ? r.top - t.height - 8 : r.bottom + 8;
    tipEl.style.left = `${x}px`;
    tipEl.style.top = `${y}px`;
    // the element can be redrawn away under the mouse (shop refresh, modal closed): drop its card too
    const mine = tipEl;
    const watch = window.setInterval(() => { if (tipEl !== mine) clearInterval(watch); else if (!el.isConnected) { hide(); clearInterval(watch); } }, 250);
  });
  const hide = () => { tipEl?.remove(); tipEl = null; };
  el.addEventListener("pointerleave", hide);
  el.addEventListener("pointerdown", hide);
}

/** Spell text with every star's numbers (current star lit), like TFT: "120 / 180 / 290 / 480". */
export function spellText(desc: string, star: number): Node {
  const out = h("span");
  for (const part of starValues(desc)) {
    if (typeof part === "string") { out.append(part); continue; }
    const s = h("span", { class: "ar-sv" });
    part.forEach((v, i) => { if (i) s.append("/"); s.append(h("span", { class: i + 1 === star ? "now" : "" }, v.toLocaleString("vi-VN"))); });
    out.append(s);
  }
  return out;
}

/** A trait's card: what it does at each breakpoint. */
export function traitCard(id: string, n?: number): HTMLElement {
  const d = TRAITS[id];
  return h("div", { class: "ar-tcard" },
    h("b", { style: `color:${d.color}` }, `${d.icon} ${d.name}`),
    h("div", { class: "muted small" }, `Mốc: ${d.breaks.map((b) => (n !== undefined && n >= b ? `✓${b}` : String(b))).join(" / ")}${n !== undefined ? ` · đang có ${n}` : ""}`),
    h("p", null, traitDesc(d)));
}
export function openTraitInfo(id: string, n?: number) {
  const m = openModal(`${TRAITS[id].icon} ${TRAITS[id].name}`);
  m.body.append(traitCard(id, n));
}

/** A small hover card for a unit (shop, carousel). */
export function unitTip(unitId: string, star: Star = 1): HTMLElement {
  const u = arenaUnit(unitId)!;
  return h("div", { class: "ar-utip" },
    h("div", { class: "row" }, unitImg(u, 2), h("b", null, u.name), h("span", { class: "ar-cost", style: `background:${COST_COL[u.cost]}` }, `${u.cost}💰`)),
    h("div", { class: "muted small" }, `${ROLE_NAMES[u.role]} · ${u.stats.range > 1 ? `đánh xa ${u.stats.range} ô` : "cận chiến"} · ${u.traits.map((t) => `${TRAITS[t].icon} ${TRAITS[t].name}`).join(" ")}`),
    h("div", { class: "small" }, h("b", null, `${u.spell.icon} ${u.spell.name}`), u.spell.passive ? " (nội tại)" : ""),
    h("div", { class: "small" }, spellText(u.spell.desc, star)));
}

/** A small pixel icon of an arena item. */
export function itemIcon(id: string, cls = "ar-iimg"): HTMLImageElement {
  return h("img", { class: `pix ${cls}`, src: arenaItemURL(id, 2), alt: ITEMS[id]?.name ?? "", draggable: false });
}
/** An item's name, stats and effect, for tooltips and cards. */
export function itemCard(id: string): HTMLElement {
  const it = ITEMS[id];
  const st = itemStatText(id);
  return h("div", { class: "ar-icard" },
    h("div", { class: "row" }, itemIcon(id, "ar-iimg big"), h("b", null, it.name)),
    st ? h("div", { class: "ar-istat" }, st) : null,
    it.component && st ? null : h("div", { class: "small" }, it.desc)); // a component's text is just its stats
}

/**
 * A unit's card: health and mana bars, the stats it has now (items, traits, augments and
 * earned stats counted, with what they add shown in green), traits (tap for details), the
 * spell at every star, items. `now` is the unit as it stands (a live fighter during a fight);
 * `base` the bare unit to compare with.
 */
export function openUnitInfo(unitId: string, star: Star = 1, o: { items?: string[]; bonus?: Record<string, number>; sell?: () => void; now?: Fighter; base?: Fighter; battle?: ArenaBattle; enemy?: boolean; pick?: { label: string; fn: () => void } } = {}) {
  const u = arenaUnit(unitId);
  if (!u) return;
  const base = o.base ?? M.bareFighter(unitId, star);
  const f = o.now ?? M.bareFighter(unitId, star, o.items ?? []) ?? base;
  if (!f || !base) return;
  const live = !!o.battle;
  const asNow = o.battle ? o.battle.attackSpeed(f) : f.as;
  const vampNow = f.omnivamp + (o.battle && f.vampT > o.battle.time ? f.vampV : 0);
  const m = openModal(`${o.enemy ? "⚔️ " : ""}${u.name}`);
  const fmt = (v: number) => Math.round(v).toLocaleString("vi-VN");
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  /** A stat with what items, traits and augments add on top of the bare unit. */
  const row = (k: string, v: string, add?: string, tip?: string) => h("div", { class: "ar-stat", title: tip ?? "" }, h("span", null, k), h("b", null, v, add ? h("small", { class: "ar-add" }, ` ${add}`) : null));
  const plus = (now: number, was: number, f2: (x: number) => string) => (Math.abs(now - was) >= 0.005 ? `${now > was ? "+" : "−"}${f2(Math.abs(now - was))}` : undefined);
  const bar = (cls: string, v: number, max: number, label: string) => h("div", { class: `ar-sbar ${cls}` }, h("i", { style: `width:${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%` }), h("span", null, label));
  const hp = live ? f.hp : f.maxHp;
  const mana = f.mana;
  const items = o.items ?? f.items;
  m.body.append(...nn(
    h("div", { class: "ar-info-head" },
      h("div", { class: "ar-info-pic", style: `border-color:${COST_COL[u.cost]}` }, unitImg(u, 6)),
      h("div", { class: "grow" },
        h("div", null, stars(star), " ", h("span", { class: "ar-cost", style: `background:${COST_COL[u.cost]}` }, `${u.cost} 💰`), u.boss ? " 👑 Trùm" : ""),
        h("div", { class: "muted small" }, `${ROLE_NAMES[u.role]} · ${f.range > 1 ? `Đánh xa ${f.range} ô` : "Cận chiến"} · Tầng ${u.floor}`),
        bar("hp", hp, f.maxHp, `❤ ${fmt(hp)} / ${fmt(f.maxHp)}${f.maxHp !== base.maxHp ? ` (gốc ${fmt(base.maxHp)})` : ""}`),
        u.spell.passive ? bar("passive", 1, 1, "Nội tại — không cần năng lượng") : bar("mp", mana, f.maxMana, `💧 ${fmt(mana)} / ${f.maxMana}`),
        h("div", { class: "ar-trait-list" }, u.traits.map((t) => {
          const chip = h("button", { class: "ar-chip", style: `border-color:${TRAITS[t].color}`, onclick: () => openTraitInfo(t) }, `${TRAITS[t].icon} ${TRAITS[t].name}`);
          attachTip(chip, () => traitCard(t));
          return chip;
        })))),
    h("div", { class: "ar-stats" },
      row("⚔ Sát thương", fmt(f.ad), plus(f.ad, base.ad, fmt)),
      row("🔮 Sức mạnh phép", fmt(f.ap), plus(f.ap, base.ap, fmt)),
      row("🛡 Giáp", fmt(f.armor), plus(f.armor, base.armor, fmt)),
      row("🧿 Kháng phép", fmt(f.mr), plus(f.mr, base.mr, fmt)),
      row("⚡ Tốc đánh", asNow.toFixed(2), asNow > base.as + 0.005 ? `+${Math.round((asNow / base.as - 1) * 100)}%` : undefined, live ? "Tốc đánh lúc này, tính cả mọi cộng dồn trong trận" : "Tốc đánh khi vào trận (đã tính trang bị, tộc hệ, Lõi)"),
      row("💥 Chí mạng", pct(f.crit), plus(f.crit, base.crit, pct)),
      row("💢 ST chí mạng", pct(f.critDmg), plus(f.critDmg, base.critDmg, pct)),
      row("🩸 Hút máu", pct(vampNow), plus(vampNow, base.omnivamp, pct), "Hồi máu theo sát thương gây ra (từ trang bị, Lõi, tộc hệ)"),
      f.dodge > 0 ? row("💨 Né tránh", pct(f.dodge), plus(f.dodge, base.dodge, pct)) : null,
      f.amp > 1.001 ? row("✨ Tăng sát thương", `+${pct(f.amp - 1)}`) : null,
      f.reduce > 0 ? row("🪨 Giảm sát thương nhận", pct(f.reduce)) : null,
      live && f.stacks > 0 && f.fxs.has("guinsoo") ? row("🌀 Cộng dồn", `${f.stacks} lần`) : null),
    h("div", { class: "ar-spell" },
      h("div", null, h("b", null, `${u.spell.icon} ${u.spell.name}`), u.spell.passive ? h("span", { class: "ar-tag" }, "Nội tại") : null, u.spell.ult ? h("span", { class: "ar-tag gold" }, "Tối thượng") : null),
      h("p", null, spellText(u.spell.desc, star)),
      h("p", { class: "muted small" }, `Số theo ★1 / ★2 / ★3 / ★4 (đang ★${star}), ${u.spell.physical ? "tăng theo sát thương" : "tăng theo sức mạnh phép"}.`)),
    o.bonus && Object.keys(o.bonus).length ? h("p", { class: "ar-bonus" }, "Đã tích lũy: ", Object.entries(o.bonus).map(([k, v]) => `${k === "ap" ? `+${v} sức mạnh phép` : k === "ad" ? `+${Math.round(v * 100)}% sát thương` : k === "hp" ? `+${Math.round(v * 100)}% máu` : `+${v} ${k}`}`).join(", ")) : null,
    items.length ? h("div", { class: "ar-items-info" }, items.map((i) => itemCard(i))) : null,
    h("div", { class: "row end" },
      o.sell ? h("button", { class: "btn danger", onclick: () => { m.close(); o.sell!(); } }, "Bán") : null,
      o.pick ? h("button", { class: "btn primary", onclick: () => { m.close(); o.pick!.fn(); } }, o.pick.label) : null,
      h("button", { class: "btn", onclick: () => m.close() }, "Đóng")),
  ));
}

// ------------------------------------------------------------ the screen
export function mountArena(root: HTMLElement, hooks: { leave: () => void }): Screen {
  playMusic("title");
  const el = h("div", { class: "screen ar-screen" });
  root.append(el);
  let stopMatch: (() => void) | null = null;

  // ---------------------------------------------------------- lobby
  function lobby() {
    stopMatch?.();
    stopMatch = null;
    playMusic("title");
    const ar = arenaSave();
    const r = ar.rank;
    const saved = loadMatch();
    const unlocked = unlockedUnits();
    const byCost = [1, 2, 3, 4, 5].map((c) => unlocked.filter((u) => u.cost === c).length);
    const nextTier = tierOf(r.best) + 1;
    el.replaceChildren(h("div", { class: "ar-lobby" },
      h("div", { class: "ar-lobby-head" },
        h("button", { class: "icon-btn", onclick: () => hooks.leave(), title: "Về Thánh Địa" }, "←"),
        h("h1", null, "🏟️ Đấu Trường Quái Vật")),
      h("div", { class: "ar-card ar-rank" },
        h("div", { class: "ar-rank-icon" }, rankIcon(r.step)),
        h("div", { class: "grow" },
          h("div", { class: "ar-rank-name" }, rankName(r.step)),
          h("div", { class: "ar-lp" }, h("div", { style: `width:${Math.min(100, r.lp)}%` }), h("span", null, `${r.lp} / ${POINTS_PER_DIV} điểm hạng`)),
          h("div", { class: "muted small" }, `Bậc ${tierOf(r.step) + 1}/${TIERS} · cao nhất: ${rankName(r.best)} · đã đấu ${ar.played} trận · top 1: ${ar.top1} · top 4: ${ar.top4}`),
          h("button", { class: "btn small", onclick: openJourney }, "🗺️ Hành trình rank"))),
      h("div", { class: "ar-card" },
        h("div", { class: "row between" }, h("b", null, "🃏 Bể tướng"), h("span", null, `Đã mở ${unlocked.length}/700 tướng`)),
        h("div", { class: "ar-quota" }, [1, 2, 3, 4, 5].map((c) => h("div", { style: `border-color:${COST_COL[c]}` }, h("b", null, `${c}💰`), h("span", null, `${Math.min(byCost[c - 1], M.DECK_QUOTA[c])}/${M.DECK_QUOTA[c]}`), h("small", null, `có ${byCost[c - 1]}`)))),
        h("p", { class: "muted small" }, `Mỗi trận tự bốc ngẫu nhiên ${M.DECK_SIZE} tướng từ những tướng bạn đã mở: 12 tướng 1 vàng, 11 tướng 2 vàng, 10 tướng 3 vàng, 9 tướng 4 vàng, 8 tướng 5 vàng. Thiếu giá nào thì bù bằng tướng giá khác. Gặp thêm quái ở Vực Sâu để mở thêm tướng.`),
        h("button", { class: "btn small", onclick: openCollection }, "Xem bộ sưu tập tướng")),
      saved
        ? h("div", { class: "ar-card" },
          h("b", null, `Trận đang dở: vòng ${saved.stage}-${saved.round}, ❤ ${M.human(saved).hp}`),
          h("div", { class: "row" },
            h("button", { class: "btn primary grow", onclick: () => runMatch(saved) }, "▶ Tiếp tục trận"),
            h("button", { class: "btn danger", onclick: async () => { if (await confirmBox("Bỏ trận", "Bỏ trận đang dở sẽ tính là hạng 8. Chắc chứ?", "Bỏ trận")) { finishMatch(saved, 8); } } }, "Bỏ trận")))
        : h("button", { class: "btn primary block big", onclick: () => startMatch() }, "⚔️ Vào trận (8 người)"),
      h("div", { class: "ar-card" },
        h("b", null, "🎁 Phần thưởng"),
        h("div", { class: "ar-rewards" }, [1, 2, 3, 4, 5, 6, 7, 8].map((p) => h("div", null, h("span", null, `Hạng ${p}`), h("b", null, `${matchReward(r.step, p)} 💰`)))),
        nextTier < TIERS ? h("p", { class: "muted small" }, `Lần đầu lên bậc ${rankIcon(nextTier * DIVS)} ${rankName(nextTier * DIVS).replace(/ III$/, "")}: ${rewardText(tierReward(nextTier))}`) : null),
      h("button", { class: "btn small", onclick: openRules }, "📖 Cách chơi"),
    ));
  }

  /** Every tier from the bottom to the top: where you are, the best you reached, rewards. */
  function openJourney() {
    const r = arenaSave().rank;
    const cur = tierOf(r.step), best = tierOf(r.best);
    const mm = openModal("🗺️ Hành trình rank", { wide: true });
    mm.body.append(
      h("p", { class: "muted small" }, `${TIERS} bậc, mỗi bậc 3 hạng (III → II → I), mỗi hạng ${POINTS_PER_DIV} điểm. Top 4 được cộng điểm, hạng 5–8 bị trừ; bậc càng cao cộng càng ít, trừ càng nhiều. Lần đầu lên một bậc nhận thưởng.`),
      h("div", { class: "ar-journey" }, Array.from({ length: TIERS }, (_, i) => TIERS - 1 - i).map((t) => {
        const here = t === cur;
        const state = here ? "now" : t <= best ? "done" : "lock";
        const rw = tierReward(t);
        return h("div", { class: `ar-jt ${state}` },
          h("div", { class: "ic" }, rankIcon(t * DIVS)),
          h("div", { class: "grow" },
            h("b", null, `${t + 1}. ${rankName(t * DIVS).replace(/ III$/, "")}`),
            here ? h("span", { class: "ar-tag gold" }, `Bạn: ${rankName(r.step)} · ${r.lp}/${POINTS_PER_DIV}`) : t === best && best !== cur ? h("span", { class: "ar-tag" }, "Cao nhất") : null,
            h("div", { class: "muted small" }, t === 0 ? "Bậc khởi đầu" : `Thưởng lần đầu: ${rewardText(rw)}`),
            h("div", { class: "muted small" }, `Top 1: +${lpDelta(t * DIVS, 1)} · top 4: +${lpDelta(t * DIVS, 4)} · hạng 8: ${lpDelta(t * DIVS, 8)} điểm`)),
          h("div", { class: "st" }, state === "done" && !here ? "✓" : state === "lock" ? "🔒" : "▶"));
      })),
    );
    requestAnimationFrame(() => mm.body.querySelector(".ar-jt.now")?.scrollIntoView({ block: "center" }));
  }

  function rewardText(r: { gold: number; items: Record<string, number> }) {
    return [`${r.gold} 💰`, ...Object.entries(r.items).map(([id, n]) => `${getItem(id).name} ×${n}`)].join(", ");
  }

  function openRules() {
    const m = openModal("📖 Cách chơi Đấu Trường", { wide: true });
    m.body.append(...[
      "8 người chơi (bạn và 7 đối thủ) cùng mua tướng, xếp đội hình và để tướng tự đánh. Mỗi lần thua bạn mất máu; còn trụ lại cuối cùng là thắng.",
      "Mỗi giai đoạn gồm các vòng: ⚔️ giao đấu với người khác, 👾 đánh quái (rơi trang bị, vàng), 🎠 Chợ Tướng (chọn 1 tướng kèm trang bị). Ở vòng 2-1, 3-2 và 4-2 bạn chọn 1 Lõi tăng sức mạnh.",
      "Kinh tế: mỗi vòng nhận 5 vàng + lãi (1 vàng mỗi 10 vàng đang có, tối đa 5) + thưởng chuỗi thắng hoặc thua liên tiếp (2–3 trận +1, 4 trận +2, từ 5 trận +3); mỗi trận thắng thêm 1 vàng. Chạm 💰 để xem chi tiết. Đổi cửa hàng 2 vàng, mua 4 kinh nghiệm 4 vàng. Cấp càng cao càng ra nhiều tướng đắt và được đặt nhiều tướng hơn.",
      "Ghép 3 tướng giống nhau cùng sao thành 1 tướng sao cao hơn (tối đa ★4). Tướng 4–5 vàng ở ★3 cực kỳ mạnh.",
      "Trang bị: 2 mảnh ghép thành 1 món hoàn chỉnh. Ấn Trắng + 1 mảnh = Ấn tộc hệ. Mỗi tướng mang tối đa 3 món. Kéo trang bị vào tướng, hoặc chạm trang bị rồi chạm tướng.",
      "Tộc hệ: đủ số tướng khác nhau cùng tộc/hệ thì kích hoạt sức mạnh. Chạm vào dải tộc hệ để xem chi tiết.",
      "Đồ dùng: Nam Châm tháo hết trang bị của một tướng. Máy Sao Chép (rơi khi đánh quái hoặc ở Chợ Tướng) tạo thêm 1 bản sao ★1 của tướng giá 1–3 vàng; Máy Sao Chép Thượng Hạng chép được mọi tướng, kể cả 4–5 vàng. Kéo thả vào tướng để dùng.",
      "Thẻ trong cửa hàng sáng lên khi bạn đã có tướng đó, và hiện ★★ / ★★★ khi mua là tướng lên sao.",
      "Kéo tướng để đặt lên sân (nửa dưới) hoặc hàng chờ; kéo tướng vào cửa hàng để bán. Chạm vào tướng để xem chỉ số và chiêu.",
    ].map((t) => h("p", null, t)));
  }

  // ---------------------------------------------------------- collection (read only)
  function openCollection() {
    const all = arenaUnits();
    const open = new Set(unlockedUnits().map((u) => u.id));
    let cost = 0;
    let q = "";
    let onlyOpen = false;
    const m = openModal("🃏 Bộ sưu tập tướng", { wide: true });
    const render = () => {
      const list = all.filter((u) => (!cost || u.cost === cost) && (!onlyOpen || open.has(u.id)) && (!q || (open.has(u.id) && (u.name.toLowerCase().includes(q) || u.spell.name.toLowerCase().includes(q)))));
      list.sort((a, b) => Number(open.has(b.id)) - Number(open.has(a.id)) || a.cost - b.cost || a.floor - b.floor);
      m.body.replaceChildren(...nn(
        h("div", { class: "ar-deck-bar" }, h("b", null, `Đã mở ${open.size}/700`), " · chạm tướng để xem chiêu"),
        h("div", { class: "ar-filters" },
          [0, 1, 2, 3, 4, 5].map((c) => h("button", { class: `btn small ${cost === c ? "primary" : ""}`, onclick: () => { cost = c; render(); } }, c ? `${c}💰` : "Tất cả")),
          h("button", { class: `btn small ${onlyOpen ? "primary" : ""}`, onclick: () => { onlyOpen = !onlyOpen; render(); } }, "Đã mở"),
          h("input", { class: "ar-search", placeholder: "Tìm tên…", value: q, oninput: (e: Event) => { q = (e.target as HTMLInputElement).value.toLowerCase(); render(); requestAnimationFrame(() => { const i = m.body.querySelector(".ar-search") as HTMLInputElement | null; i?.focus(); i?.setSelectionRange(q.length, q.length); }); } })),
        h("div", { class: "ar-deck-grid" }, list.slice(0, 240).map((u) => {
          const isOpen = open.has(u.id);
          return h("div", { class: `ar-dcard on ${isOpen ? "" : "locked"}`, style: `border-color:${COST_COL[u.cost]}`, onclick: () => (isOpen ? openUnitInfo(u.id) : toast(`Chưa mở: gặp loài này ở Vực Sâu tầng ${u.floor} để mở.`)) },
            unitImg(u, 3), h("div", { class: "nm" }, isOpen ? u.name : "???"), h("div", { class: "cs" }, `${u.cost}💰 · tầng ${u.floor}`));
        })),
        list.length > 240 ? h("p", { class: "muted small" }, `Đang hiện 240/${list.length}; lọc theo giá hoặc tìm tên để xem thêm.`) : null,
      ));
    };
    render();
  }

  // ---------------------------------------------------------- match start / end
  function startMatch() {
    const unlocked = unlockedUnits();
    if (unlocked.length < ARENA_UNLOCK) { toast(`Cần mở ít nhất ${ARENA_UNLOCK} tướng.`, "bad"); return; }
    const deck = M.deckFrom(unlocked.map((u) => u.id), Math.random);
    const hero = app.game.chars[app.game.heroId];
    const m = M.newMatch({ deck, name: hero?.name ?? "Bạn", rankStep: arenaSave().rank.step, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
    saveMatch(m);
    runMatch(m);
  }

  /** Applies the result once: rank points, gold, first-time tier rewards, counters. */
  function finishMatch(m: M.MatchState, forcePlace?: number) {
    if (forcePlace) M.human(m).place = forcePlace;
    if (m.phase !== "end") M.finishWithoutHuman(m);
    const place = M.human(m).place || 1;
    const ar = arenaSave();
    const change = applyResult(ar.rank, place);
    ar.rank = change.after;
    ar.played++;
    if (place === 1) ar.top1++;
    if (place <= 4) ar.top4++;
    const g = app.game;
    const gold = matchReward(change.before.step, place);
    g.gold += gold;
    const tiers = change.newTiers.map((t) => ({ t, r: tierReward(t) }));
    for (const { r } of tiers) { g.gold += r.gold; for (const [id, n] of Object.entries(r.items)) addItem(g, id, n); }
    saveMatch(null);
    app.checkpoint("Đấu Trường");
    showEnd(m, change, gold, tiers);
  }

  function showEnd(m: M.MatchState, change: ReturnType<typeof applyResult>, gold: number, tiers: { t: number; r: { gold: number; items: Record<string, number> } }[]) {
    stopMatch?.();
    stopMatch = null;
    const s = M.summary(m);
    sfx(s.place <= 4 ? "victory" : "defeat");
    const st = s.stats;
    el.replaceChildren(h("div", { class: "ar-end" },
      h("div", { class: `ar-place p${s.place}` }, `Hạng ${s.place}`),
      h("div", { class: "ar-end-sub" }, s.place === 1 ? "Bá chủ đấu trường!" : s.place <= 4 ? "Lọt top 4!" : "Lần sau sẽ tốt hơn."),
      h("div", { class: "ar-card ar-rank" },
        h("div", { class: "ar-rank-icon" }, rankIcon(change.after.step)),
        h("div", { class: "grow" },
          h("div", { class: "ar-rank-name" }, rankName(change.after.step), h("span", { class: change.delta >= 0 ? "good" : "bad" }, ` ${change.delta >= 0 ? "+" : ""}${change.delta} điểm`)),
          change.promoted ? h("div", { class: "good" }, `⬆ Thăng hạng từ ${rankName(change.before.step)}!`) : change.demoted ? h("div", { class: "bad" }, `⬇ Rớt hạng từ ${rankName(change.before.step)}`) : null,
          h("div", { class: "ar-lp" }, h("div", { style: `width:${Math.min(100, change.after.lp)}%` }), h("span", null, `${change.after.lp} / ${POINTS_PER_DIV}`)))),
      h("div", { class: "ar-card" }, h("b", null, "🎁 Phần thưởng"), h("div", null, `${gold} 💰`),
        tiers.map(({ t, r }) => h("div", { class: "good" }, `Lần đầu lên bậc ${rankIcon(t * DIVS)} ${rankName(t * DIVS).replace(/ III$/, "")}: ${rewardText(r)}`))),
      h("div", { class: "ar-card" }, h("b", null, "📊 Thống kê"),
        h("div", { class: "ar-stats" },
          ...([["Trụ tới vòng", s.rounds], ["Thắng / thua", `${st.wins} / ${st.losses}`], ["Chuỗi thắng dài nhất", st.bestStreak], ["Sát thương lên người chơi", st.dealt], ["Máu đã mất", st.taken],
            ["Vàng kiếm được", st.goldEarned], ["Lượt đổi cửa hàng", st.rolls], ["Tướng đã mua", st.bought], ["Lần mua kinh nghiệm", st.xpBought]] as [string, string | number][])
            .map(([k, v]) => h("div", { class: "ar-stat" }, h("span", null, k), h("b", null, String(v)))))),
      s.topUnits.length ? h("div", { class: "ar-card" }, h("b", null, "🏅 Tướng gây sát thương nhiều nhất"),
        h("div", { class: "ar-top-units" }, s.topUnits.map((t) => { const u = arenaUnit(t.unitId)!; return h("div", null, unitImg(u, 3), h("div", null, u.name), h("b", null, t.dmg.toLocaleString("vi-VN"))); }))) : null,
      s.board.length ? h("div", { class: "ar-card" }, h("b", null, "Đội hình cuối"),
        h("div", { class: "ar-final" }, s.board.map((o) => { const u = arenaUnit(o.unitId)!; return h("div", null, unitImg(u, 3), stars(o.star)); }))) : null,
      h("div", { class: "ar-card" }, h("b", null, "Bảng xếp hạng"),
        h("ol", { class: "ar-standings" }, s.standings.map((p) => h("li", { class: p.cpu ? "" : "me" }, `${p.icon} ${p.name}`)))),
      h("button", { class: "btn primary block", onclick: lobby }, "Về sảnh"),
    ));
  }

  // ---------------------------------------------------------- a match
  function runMatch(m: M.MatchState) {
    stopMatch?.();
    playMusic("battle");
    const me = () => M.human(m);
    el.replaceChildren();
    const wrap = h("div", { class: "ar-match" });
    const topBar = h("div", { class: "ar-top" });
    const mid = h("div", { class: "ar-mid" });
    const traitsCol = h("div", { class: "ar-traits" });
    const stage = h("div", { class: "ar-stage" });
    const playersCol = h("div", { class: "ar-players" });
    const dmgPanel = h("div", { class: "ar-dmg hidden" });
    const banner = h("div", { class: "ar-banner hidden" });
    mid.append(stage, traitsCol, playersCol, dmgPanel, banner);
    const hint = h("div", { class: "ar-hint" });
    const itemsRow = h("div", { class: "ar-items" });
    const shopInfo = h("div", { class: "ar-shopinfo" });
    const shopRow = h("div", { class: "ar-shop" });
    const shopBar = h("div", { class: "ar-shopbar" }, shopInfo, shopRow);
    wrap.append(topBar, mid, hint, itemsRow, shopBar);
    el.append(wrap);
    const view = new ArenaView(stage);
    let battle: ArenaBattle | null = null;
    let lastBattle: ArenaBattle | null = null;
    let opponent = "";
    let oppId = -1;
    let finishing = false;
    let modal: ModalHandle | null = null;
    let alive = true;
    let dmgTab: "dealt" | "blocked" | "healed" | "shielded" = "dealt";
    let dmgSide: 0 | 1 = 0;
    let dmgT = 0;

    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__arena = { m, M, refresh: () => changed() };
    const fit = () => view.resize(stage.clientWidth, stage.clientHeight);
    const ro = new ResizeObserver(fit);
    ro.observe(stage);

    /** Which dungeon biome the arena looks like: your deepest floor at home, the host's when visiting. */
    const homeBiome = (id: number) => {
      if (id === 0) return getFloor(Math.max(1, app.game.maxFloor)).biome;
      return getFloor(1 + (hashStr(`${m.seed}:${id}`) % Math.max(10, Math.min(100, M.cpuMaxFloor(m.rankStep))))).biome;
    };
    const themeNow = () => {
      if (battle && oppId >= 0) return homeBiome(oppId);
      if (M.currentKind(m) === "pve") return getFloor(Math.min(100, m.stage * 12 + m.round)).biome;
      return homeBiome(0);
    };

    // ------------------------------------------------ loop
    let last = performance.now(), acc = 0, shownSec = -1;
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (battle && battle.winner === null && view.introT <= 0) { // the fight starts once the enemy team has dropped in
        acc += dt;
        while (acc >= DT && battle.winner === null) { battle.step(); acc -= DT; view.takeEvents(); }
        view.alpha = acc / DT;
        const sec = Math.floor(battle.time);
        if (sec !== shownSec) { shownSec = sec; shopInfo.querySelector(".ar-timer")?.replaceChildren(`⏱ ${sec}s`); } // touch the DOM once a second only
      }
      if (battle && battle.winner !== null && !finishing) { finishing = true; view.takeEvents(); setTimeout(endFight, 1300); }
      dmgT += dt;
      if (dmgT > 0.4 && !dmgPanel.classList.contains("hidden")) { dmgT = 0; renderDmg(); }
      view.frame(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    stopMatch = () => { alive = false; ro.disconnect(); modal?.close(); };

    // ------------------------------------------------ the damage chart (like TFT's)
    function toggleDmg() { dmgPanel.classList.toggle("hidden"); renderDmg(); }
    function renderDmg() {
      const b = battle ?? lastBattle;
      if (!b) { dmgPanel.replaceChildren(h("div", { class: "muted small" }, "Chưa có trận nào.")); return; }
      const TABS: [typeof dmgTab, string, string][] = [["dealt", "⚔", "Sát thương"], ["blocked", "🛡", "Đã chặn"], ["healed", "💚", "Hồi máu"], ["shielded", "🔰", "Khiên & giáp"]];
      const val = (f: (typeof b.fighters)[number]) => (dmgTab === "shielded" ? f.shielded + f.guarded * 10 : f[dmgTab]);
      const list = b.fighters.filter((f) => f.side === dmgSide && !f.decoy).sort((a, c) => val(c) - val(a));
      const max = Math.max(1, ...list.map(val));
      const col = { dealt: "#ff9a4a", blocked: "#8ab8ff", healed: "#6fd46a", shielded: "#e8f0ff" }[dmgTab];
      dmgPanel.replaceChildren(
        h("div", { class: "ar-dmg-head" },
          h("b", null, battle ? "📊 Trận đang đấu" : "📊 Trận vừa rồi"),
          h("button", { class: "x", onclick: toggleDmg }, "✕")),
        h("div", { class: "ar-dmg-tabs" }, TABS.map(([k, ic, nm]) => h("button", { class: dmgTab === k ? "on" : "", title: nm, onclick: () => { dmgTab = k; renderDmg(); } }, ic, h("span", null, nm)))),
        h("div", { class: "ar-dmg-side" },
          h("button", { class: dmgSide === 0 ? "on" : "", onclick: () => { dmgSide = 0; renderDmg(); } }, "Đội bạn"),
          h("button", { class: dmgSide === 1 ? "on" : "", onclick: () => { dmgSide = 1; renderDmg(); } }, "Đối thủ")),
        ...list.map((f) => {
          const v = val(f);
          const sub = dmgTab === "blocked" ? `nhận ${f.taken.toLocaleString("vi-VN")}` : dmgTab === "shielded" && f.guarded ? `+${f.guarded} giáp` : "";
          return h("div", { class: `ar-dmg-row ${f.alive ? "" : "dead"}` },
            h("img", { class: "pix", src: spriteURL(f.unit.sprite, f.unit.palette, 2), alt: "" }),
            h("div", { class: "bar" }, h("i", { style: `width:${(v / max) * 100}%;background:${col}` }), h("span", null, `${f.unit.name}`), sub ? h("small", null, sub) : null),
            h("b", null, Math.round(dmgTab === "shielded" ? f.shielded : v).toLocaleString("vi-VN")));
        }),
      );
    }

    // ------------------------------------------------ rendering
    const act = (err: string | null, ok?: string) => { if (err) { toast(err, "bad"); sfx("error"); } else { if (ok) sfx(ok); } changed(); };
    function changed() { saveMatch(m); refresh(); }

    /** Stars each owned unit had at the last refresh, to celebrate star-ups. */
    const starsSeen = new Map<number, number>();
    let starsReady = false;
    function celebrateStars() {
      const ups: M.Owned[] = [];
      for (const u of me().units) {
        const was = starsSeen.get(u.uid);
        if (starsReady && was !== undefined && u.star > was) ups.push(u);
        starsSeen.set(u.uid, u.star);
      }
      starsReady = true;
      if (!ups.length) return;
      sfx("levelup");
      for (const u of ups) view.starUp(u.uid, u.star);
      const best = ups.sort((a, b) => b.star - a.star)[0];
      const un = arenaUnit(best.unitId)!;
      const card = h("div", { class: "ar-starup" },
        h("div", { class: "rays" }),
        h("div", { class: "pic" }, unitImg(un, 6)),
        h("div", { class: "title", style: `color:${STAR_COL[best.star]}` }, `LÊN ${"★".repeat(best.star)}!`),
        h("div", { class: "nm" }, un.name));
      mid.append(card);
      setTimeout(() => card.remove(), 1900);
    }

    function refresh() {
      const p = me();
      const kind = M.currentKind(m);
      const planning = (m.phase === "plan" || m.phase === "augment") && !battle;
      view.setTheme(themeNow());
      // top: the stage tracker (each round of the stage, like TFT)
      const n = M.roundsIn(m.stage);
      topBar.replaceChildren(
        h("button", { class: "icon-btn", onclick: openMenu, title: "Menu" }, "≡"),
        h("div", { class: "ar-tracker" },
          h("b", { class: "st" }, `${m.stage}-${m.round}`),
          ...Array.from({ length: n }, (_, i) => h("span", { class: `rd ${i + 1 < m.round ? "done" : i + 1 === m.round ? "now" : ""}`, title: KIND_NAME[M.roundKind(m.stage, i + 1)] }, KIND_ICON[M.roundKind(m.stage, i + 1)])),
          h("small", null, battle ? `vs ${opponent}` : KIND_NAME[kind])),
        h("button", { class: "icon-btn", onclick: toggleDmg, title: "Thống kê trận" }, "📊"),
      );
      // left: traits (TFT's trait tracker)
      const counts = M.boardTraits(p);
      const tl = Object.entries(counts).filter(([t]) => TRAITS[t]).map(([t, c]) => ({ t, c, tier: traitTier(t, c) })).sort((a, b) => b.tier - a.tier || b.c - a.c);
      const TIER_BG = ["#3a3226", "#7a5a3a", "#9aa6b4", "#d4a82a", "#c070e0"];
      traitsCol.replaceChildren(...tl.map(({ t, c, tier }) => {
        const d = TRAITS[t];
        const next = d.breaks.find((b) => b > c);
        const rank = tier < 0 ? 0 : Math.min(4, tier + 1 + (d.breaks.length < 3 ? 1 : 0));
        const chip = h("button", { class: `ar-trait ${tier >= 0 ? "on" : ""}`, onclick: () => openTraits(t) },
          h("span", { class: "badge", style: `background:${tier >= 0 ? TIER_BG[rank] : "#2a2a2a"}` }, d.icon),
          h("span", { class: "tx" }, h("span", { class: "nm" }, d.name), h("span", { class: "ct" }, h("b", null, String(c)), next ? ` / ${next}` : " ✓")));
        attachTip(chip, () => traitCard(t, c));
        return chip;
      }));
      // right: players, by health (TFT's player list)
      playersCol.replaceChildren(...[...m.players].sort((a, b) => (a.place ? 1 : 0) - (b.place ? 1 : 0) || b.hp - a.hp).map((q) =>
        h("button", { class: `ar-pl ${q.cpu ? "" : "me"} ${q.place ? "out" : ""} ${battle && q.id === oppId ? "vs" : ""}`, onclick: () => openPlayer(q), title: q.name },
          h("span", { class: "ic" }, q.icon),
          h("span", { class: "hp" }, q.place ? `#${q.place}` : String(Math.max(0, q.hp))),
          h("span", { class: "nm" }, q.cpu ? q.name : "Bạn"),
          h("span", { class: "hpb" }, h("i", { style: `width:${Math.max(0, q.hp)}%` })))));
      // board
      view.plan.mine = p.units.map((u) => ({ uid: u.uid, unitId: u.unitId, star: u.star, items: u.items, x: u.x, y: u.y, bench: u.bench }));
      celebrateStars();
      view.plan.enemy = m.pve && !battle ? m.pve.units.map((e) => ({ ...e, ...mirror({ x: e.x, y: e.y }) })) : [];
      // items (left of the bench in TFT; a row here)
      // tools (magnets, copiers) stack into one slot each with a count
      const slots: { it: string; i: number; n: number }[] = [];
      p.items.forEach((it, i) => {
        const same = isTool(it) ? slots.find((x) => x.it === it) : undefined;
        if (same) same.n++; else slots.push({ it, i, n: 1 });
      });
      slots.sort((a, b) => Number(isTool(a.it)) - Number(isTool(b.it)));
      itemsRow.replaceChildren(h("span", { class: "lbl" }, "🎒"), ...(slots.length ? slots.map(({ it, i, n }) => {
        const b = h("button", { class: `ar-item ${isComponent(it) ? "" : isTool(it) ? "tool" : "done"}` }, itemIcon(it), n > 1 ? h("span", { class: "n" }, `×${n}`) : null);
        bindItem(b, i);
        attachTip(b, () => itemCard(it));
        return b;
      }) : [h("span", { class: "muted small" }, "Trang bị rơi từ quái và Chợ Tướng")]));
      // hint
      if (battle) hint.replaceChildren(`⚔️ Đang giao đấu với ${opponent} · bấm 📊 để xem thống kê`);
      else if (planning) hint.replaceChildren(kind === "pve" ? "👾 Đánh quái: thắng để nhặt trang bị · " : "", "Kéo tướng lên sân · kéo vào cửa hàng để bán · chạm để xem");
      else hint.replaceChildren("");
      // shop bar, TFT style: level + odds | gold (+interest) | lock, ready; then XP | 5 cards | reroll
      const need = M.XP_NEXT[p.level] || 0;
      const odds = M.ODDS[p.level];
      const interest = M.interestOf(p);
      const sGold = M.streakGold(p.streak);
      const streak = p.streak >= 1 ? h("span", { class: "ar-streak win", title: `Chuỗi ${p.streak} trận thắng` }, `🔥${p.streak}`, sGold ? h("small", null, `+${sGold}💰`) : null)
        : p.streak <= -1 ? h("span", { class: "ar-streak lose", title: `Chuỗi ${-p.streak} trận thua` }, `❄️${-p.streak}`, sGold ? h("small", null, `+${sGold}💰`) : null) : null;
      const onB = M.onBoard(p).length, cap = M.boardSize(p);
      shopInfo.replaceChildren(...nn(
        h("div", { class: "lvl" }, h("b", null, `Cấp ${p.level}`), need ? h("span", { class: "xpb" }, h("i", { style: `width:${(p.xp / need) * 100}%` }), h("small", null, `${p.xp}/${need}`)) : h("small", null, " tối đa"),
          h("span", { class: `cap ${onB < cap && planning ? "warn" : ""}`, title: onB < cap ? `Sân còn trống ${cap - onB} ô` : "" }, `${onB < cap && planning ? "⚠ " : "👥 "}${onB}/${cap}`)),
        h("div", { class: "odds", title: "Tỉ lệ ra tướng theo giá ở cấp hiện tại" }, odds.map((o, i) => h("span", { style: `color:${COST_COL[i + 1]}` }, `${o}%`))),
        h("button", { class: "gold", title: "Xem thu nhập mỗi vòng", onclick: openIncome }, `💰 ${p.gold}`, h("small", null, ` +${interest} lãi`), streak),
        h("div", { class: "hpme" }, `❤ ${Math.max(0, p.hp)}`),
        battle ? h("div", { class: "ar-timer" }, "⏱ 0s")
          : h("button", { class: `lock ${p.locked ? "on" : ""}`, disabled: !planning, title: "Khóa cửa hàng", onclick: () => { M.toggleLock(m, p); changed(); } }, p.locked ? "🔒" : "🔓"),
        battle ? null : h("button", { class: "btn primary ready", disabled: !planning, onclick: tryStartFight }, "▶ Đấu"),
      ));
      const cards = p.shop.map((id, s) => {
        if (!id) return h("div", { class: "ar-scard empty" });
        const u = arenaUnit(id)!;
        const have = p.units.some((o) => o.unitId === id);
        // buying every copy on offer: the star it would reach (★2, ★3...), if any
        const up = M.starAfterBuying(p, id, p.shop.filter((x) => x === id).length);
        const card = h("button", { class: `ar-scard ${up ? "up" : have ? "have" : ""}`, style: `border-color:${COST_COL[u.cost]}`, disabled: !planning },
          unitImg(u, 3),
          h("div", { class: "nm" }, u.name),
          h("div", { class: "tr" }, u.traits.map((t) => TRAITS[t].icon).join("")),
          h("div", { class: "cs", style: `background:${COST_COL[u.cost]}` }, `${u.cost}`),
          up ? h("div", { class: "own up", style: `color:${STAR_COL[up]}` }, "★".repeat(up)) : have ? h("div", { class: "own" }, `có ${p.units.filter((o) => o.unitId === id).length}`) : null);
        card.addEventListener("click", () => { act(M.buy(m, p, s), "coin"); });
        card.addEventListener("contextmenu", (e) => { e.preventDefault(); openUnitInfo(id); });
        card.append(h("span", { class: "info", onclick: (e: Event) => { e.stopPropagation(); openUnitInfo(id); } }, "i"));
        attachTip(card, () => unitTip(id));
        return card;
      });
      shopRow.replaceChildren(
        h("button", { class: "ar-side xp", disabled: !planning || p.level >= M.MAX_LEVEL, onclick: () => act(M.buyXp(m, p), "levelup") }, h("b", null, "⬆"), h("span", null, "Mua KN"), h("small", null, `${M.XP_COST}💰`)),
        ...cards,
        h("button", { class: "ar-side roll", disabled: !planning, onclick: () => act(M.reroll(m, p), "click") }, h("b", null, "🔄"), h("span", null, "Đổi"), h("small", null, p.freeRollsLeft > 0 ? `miễn phí ×${p.freeRollsLeft}` : `${M.REROLL_COST}💰`)),
      );
      if (!dmgPanel.classList.contains("hidden")) renderDmg();
    }

    // ------------------------------------------------ phases
    let incomeShown = M.roundLabel(m);
    function afterChange() {
      saveMatch(m);
      refresh();
      // a new round: what it paid, streak bonus included
      const inc = me().lastIncome;
      if ((m.phase === "plan" || m.phase === "augment") && incomeShown !== M.roundLabel(m) && inc) {
        incomeShown = M.roundLabel(m);
        const st = me().streak;
        toast(`+${inc.total} 💰 (${inc.base} cơ bản + ${inc.interest} lãi${inc.streak ? ` + ${inc.streak} chuỗi ${st > 0 ? "thắng 🔥" : "thua ❄️"}` : ""}${inc.extra ? ` + ${inc.extra} Lõi` : ""})`, "good");
      }
      modal?.close();
      modal = null;
      if (m.phase === "augment") openAugments();
      else if (m.phase === "carousel") openCarousel();
      else if (m.phase === "end") finishMatch(m);
      else if (m.phase === "result") { M.nextRound(m); afterChange(); }
      else if (m.phase === "combat" && !battle) beginFight();
      else if (m.phase === "plan") maybeTutorial();
    }

    /** "▶ Đấu": warns first when the board has empty places. */
    async function tryStartFight() {
      if (m.phase !== "plan") return;
      const p = me();
      const free = M.boardSize(p) - M.onBoard(p).length;
      if (free > 0) {
        const bench = M.onBench(p).length;
        const ok = await confirmBox("⚠ Sân còn trống",
          `Sân còn trống ${free} ô (đang có ${M.onBoard(p).length}/${M.boardSize(p)} tướng).` + (bench ? ` Tướng ở hàng chờ sẽ tự lên sân lấp chỗ trống.` : " Hàng chờ không còn tướng: mua thêm tướng ở cửa hàng để lấp chỗ."),
          "Vẫn đấu");
        if (!ok) return;
      }
      startFight();
    }

    /** What each round pays: base, interest, the streak bonus. */
    function openIncome() {
      const p = me();
      const now = M.roundIncome(m, p);
      const mm = openModal("💰 Thu nhập mỗi vòng");
      const line = (k: string, v: number, sub = "") => h("div", { class: "ar-stat" }, h("span", null, k, sub ? h("small", { class: "muted" }, ` ${sub}`) : null), h("b", null, `+${v}`));
      const st = p.streak;
      mm.body.append(...nn(
        h("p", { class: "muted small" }, "Đầu mỗi vòng bạn nhận:"),
        h("div", { class: "ar-stats one" },
          line("Cơ bản", now.base),
          line("Lãi", now.interest, `(1 vàng mỗi 10 vàng đang có, tối đa ${p.interestCap})`),
          line(st > 0 ? `Chuỗi thắng 🔥${st}` : st < 0 ? `Chuỗi thua ❄️${-st}` : "Chuỗi thắng / thua", now.streak, "(2–3 trận: +1 · 4: +2 · 5+: +3)"),
          now.extra ? line("Lõi", now.extra) : null,
          h("div", { class: "ar-stat total" }, h("span", null, "Vòng sau nhận"), h("b", null, `+${now.total} 💰`))),
        p.lastIncome ? h("p", { class: "muted small" }, `Vòng này đã nhận: ${p.lastIncome.base} cơ bản + ${p.lastIncome.interest} lãi + ${p.lastIncome.streak} chuỗi${p.lastIncome.extra ? ` + ${p.lastIncome.extra} Lõi` : ""} = ${p.lastIncome.total} 💰`) : null,
        h("p", { class: "muted small" }, "Thắng còn được thêm 1 vàng mỗi trận. Thắng hay thua liên tiếp đều được thưởng chuỗi; hòa thì mất chuỗi."),
      ));
    }

    function startFight() {
      if (m.phase !== "plan") return;
      M.ready(m);
      saveMatch(m);
      beginFight();
    }

    function beginFight() {
      const f = m.fights.find((x) => x.a === 0 || x.b === 0);
      if (!f) { M.resolveCombat(m); afterChange(); return; }
      battle = M.makeBattle(m, f);
      opponent = f.pve ? "👾 Quái vật" : `${m.players[f.b].icon} ${m.players[f.b].name}${f.ghost ? " (bóng)" : ""}`;
      oppId = f.pve ? -1 : f.b;
      finishing = false;
      acc = 0;
      view.setBattle(battle);
      refresh();
      showBanner(M.currentKind(m) === "pve" ? "👾 Đánh quái!" : `⚔️ ${opponent}`, "");
    }

    function endFight() {
      if (!alive) return;
      const hpBefore = me().hp;
      const goldBefore = me().gold;
      const itemsBefore = me().items.length;
      const f = m.fights.find((x) => x.a === 0);
      M.resolveCombat(m);
      const r = f?.result;
      const lost = hpBefore - me().hp;
      lastBattle = battle;
      battle = null;
      view.setBattle(null);
      if (r) {
        const won = r.winner === 0;
        showBanner(won ? "THẮNG!" : r.winner === -1 ? "HÒA" : "THUA", lost > 0 ? `−${lost} ❤` : won ? "" : "");
        sfx(won ? "good" : "fail");
      }
      const gotGold = me().gold - goldBefore, gotItems = me().items.length - itemsBefore;
      if (gotGold > 0 || gotItems > 0) toast(`Nhặt được ${[gotGold > 0 ? `${gotGold} 💰` : "", gotItems > 0 ? `${gotItems} trang bị` : ""].filter(Boolean).join(" và ")}`, "good");
      saveMatch(m);
      refresh();
      setTimeout(() => {
        if (!alive) return;
        if (m.phase === "end") { finishMatch(m); return; }
        if (me().place) {
          showBanner(`Bị loại — hạng ${me().place}`, "");
          setTimeout(() => alive && finishMatch(m), 1600);
          return;
        }
        M.nextRound(m);
        afterChange();
        const label = M.roundLabel(m);
        showBanner(`Vòng ${label}`, KIND_NAME[M.currentKind(m)]);
      }, 1500);
    }

    function showBanner(text: string, sub: string) {
      banner.replaceChildren(text, sub ? h("small", null, sub) : "");
      banner.classList.remove("hidden");
      banner.style.animation = "none";
      void banner.offsetWidth;
      banner.style.animation = "";
      clearTimeout((banner as unknown as { _t?: number })._t);
      (banner as unknown as { _t?: number })._t = window.setTimeout(() => banner.classList.add("hidden"), 1400);
    }

    function openAugments() {
      const p = me();
      if (!p.augmentOffer) { m.phase = "plan"; refresh(); return; }
      modal = openModal("✨ Chọn Lõi", { noClose: true });
      const render = () => {
        const offer = p.augmentOffer ?? [];
        modal!.body.replaceChildren(
          h("p", { class: "muted small" }, `Vòng ${M.roundLabel(m)} · Lõi ${["", "Bạc", "Vàng", "Kim Cương"][m.augTier]}`),
          h("div", { class: "ar-augs" }, offer.map((id, slot) => {
            const a = AUGMENT_BY_ID[id];
            const used = Array.isArray(p.augmentRerolled) && p.augmentRerolled[slot];
            return h("div", { class: "ar-aug-slot" },
              h("button", { class: "ar-aug", style: `border-color:${TIER_COL[a.tier]}`, onclick: () => { M.pickAugment(m, p, id); sfx("good"); modal?.close(); modal = null; changed(); } },
                h("div", { class: "ic" }, a.icon), h("b", null, a.name), h("p", null, a.desc)),
              h("button", { class: "btn small ar-aug-roll", disabled: used, title: "Đổi riêng Lõi này (1 lần)", onclick: () => { const err = M.rerollAugment(m, p, slot); if (err) toast(err, "bad"); else sfx("click"); saveMatch(m); render(); } }, used ? "Đã đổi" : "🔄 Đổi"));
          })),
        );
      };
      render();
    }

    function openCarousel() {
      modal = openModal("🎠 Chợ Tướng — chọn 1", { noClose: true });
      const c = m.carousel!;
      const ahead = M.carouselAhead(m);
      modal.body.append(
        h("p", { class: "muted small" }, ahead.length ? `Đã chọn trước bạn (máu thấp chọn trước): ${ahead.map((id) => m.players[id].name).join(", ")}` : "Bạn được chọn trước."),
        h("div", { class: "ar-carousel" }, c.map((slot, i) => {
          const u = arenaUnit(slot.unitId)!;
          const it = ITEMS[slot.item];
          const taken = slot.takenBy !== null;
          const take = () => {
            const err = M.pickCarousel(m, i);
            if (err) { toast(err, "bad"); return; }
            sfx("pickup");
            modal?.close();
            modal = null;
            toast(`Bạn nhận ${u.name} và ${it.name}`, "good");
            afterChange();
            showBanner(`Vòng ${M.roundLabel(m)}`, KIND_NAME[M.currentKind(m)]);
          };
          // tap: the unit's full card, with a button to take it (no picking by mistake)
          const card = h("button", { class: `ar-cslot ${taken ? "taken" : ""}`, style: `border-color:${COST_COL[u.cost]}`, disabled: taken, onclick: () => openUnitInfo(u.id, 1, { items: [slot.item], now: isTool(slot.item) ? undefined : M.bareFighter(u.id, 1, [slot.item]), pick: { label: `Chọn ${u.name} + ${it.name}`, fn: take } }) },
            h("span", { class: "cs", style: `background:${COST_COL[u.cost]}` }, `${u.cost}💰`),
            unitImg(u, 3),
            h("div", { class: "nm" }, u.name),
            h("div", { class: "tr" }, u.traits.map((t) => TRAITS[t].icon).join(" ")),
            h("div", { class: "it" }, itemIcon(slot.item, "ar-iimg sm"), ` ${it.name}`),
            taken ? h("div", { class: "by" }, m.players[slot.takenBy!].name) : null);
          attachTip(card, () => h("div", null, unitTip(u.id), h("div", { style: "margin-top:6px" }, itemCard(slot.item))));
          return card;
        })),
      );
    }

    function openMenu() {
      const mm = openModal("Menu");
      mm.body.append(
        h("button", { class: "btn block", onclick: () => { mm.close(); openRules(); } }, "📖 Cách chơi"),
        h("button", { class: "btn block", onclick: () => { mm.close(); openTraits(); } }, "🧬 Tộc hệ trên sân"),
        h("button", { class: "btn block", onclick: () => { mm.close(); openAugList(); } }, "✨ Lõi đã chọn"),
        h("button", { class: "btn block", onclick: () => { mm.close(); saveMatch(m); lobby(); } }, "⏸ Tạm rời (lưu trận)"),
        h("button", { class: "btn block danger", onclick: async () => { mm.close(); if (await confirmBox("Đầu hàng", "Đầu hàng sẽ tính là hạng hiện tại thấp nhất có thể (bạn bị loại ngay). Chắc chứ?", "Đầu hàng")) { const left = M.alivePlayers(m).length; finishMatch(m, left); } } }, "🏳 Đầu hàng"),
      );
    }

    function openAugList() {
      const mm = openModal("✨ Lõi đã chọn");
      const list = me().augments.map((id) => AUGMENTS.find((a) => a.id === id)!);
      mm.body.append(...(list.length ? list.map((a) => h("p", null, h("b", null, `${a.icon} ${a.name}`), ` — ${a.desc}`)) : [h("p", { class: "muted" }, "Chưa có Lõi nào (nhận ở vòng 2-1, 3-2, 4-2).")]));
    }

    function openTraits(focus?: string) {
      const p = me();
      const counts = M.boardTraits(p);
      const mm = openModal(focus ? `${TRAITS[focus].icon} ${TRAITS[focus].name}` : "🧬 Tộc hệ", { wide: !focus });
      if (focus) {
        // one trait: what it does, and every unit of your deck that carries it (owned ones lit)
        const d = TRAITS[focus];
        const n = counts[focus] ?? 0;
        const have = new Set(p.units.map((u) => u.unitId));
        const deckUnits = p.deck.map((id) => arenaUnit(id)!).filter((u) => u.traits.includes(focus)).sort((a, b) => a.cost - b.cost);
        mm.body.append(...nn(
          h("p", null, h("b", null, `${n} tướng`), ` · mốc ${d.breaks.map((b) => (n >= b ? `✓${b}` : b)).join(" / ")}`),
          h("p", null, traitDesc(d)),
          h("p", { class: "muted small" }, "Tướng mang tộc hệ này trong bể của bạn trận này:"),
          h("div", { class: "ar-final" }, deckUnits.map((u) => h("button", { class: `ar-mini ${have.has(u.id) ? "own" : ""}`, style: `border:1px solid ${COST_COL[u.cost]}`, onclick: () => openUnitInfo(u.id) }, unitImg(u, 3), h("small", null, `${u.cost}💰 ${u.name}`)))),
          h("div", { class: "row end" }, h("button", { class: "btn small", onclick: () => { mm.close(); openTraits(); } }, "Mọi tộc hệ")),
        ));
        return;
      }
      const ids = Object.keys(TRAITS).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
      mm.body.append(...ids.map((t) => {
        const d = TRAITS[t];
        const n = counts[t] ?? 0;
        const tier = traitTier(t, n);
        const who = [...new Set(M.onBoard(p).filter((o) => arenaUnit(o.unitId)!.traits.includes(t)).map((o) => arenaUnit(o.unitId)!.name))];
        return h("div", { class: `ar-tinfo ${tier >= 0 ? "on" : ""}`, style: `border-left-color:${d.color}` },
          h("b", null, `${d.icon} ${d.name} `), h("span", { class: "muted" }, `${n} · mốc ${d.breaks.join("/")}`),
          h("p", null, traitDesc(d)), who.length ? h("p", { class: "muted small" }, who.join(", ")) : null);
      }));
    }

    /** A short guided tour the first time someone plays. */
    function maybeTutorial() {
      try { if (localStorage.getItem("fl.arena.tut")) return; localStorage.setItem("fl.arena.tut", "1"); } catch { return; }
      const steps: [string, string][] = [
        ["🛒 Cửa hàng", "Dải dưới cùng là cửa hàng: chạm thẻ tướng để mua. Nút ⬆ bên trái mua kinh nghiệm (lên cấp được đặt thêm tướng và ra tướng đắt hơn), nút 🔄 bên phải đổi hàng. 🔒 giữ nguyên cửa hàng sang vòng sau."],
        ["♟️ Xếp đội hình", "Kéo tướng từ hàng chờ lên nửa dưới bàn cờ. Tướng cận chiến đứng trước, đánh xa đứng sau. Kéo tướng vào cửa hàng để bán. Chạm vào tướng để xem chỉ số và chiêu."],
        ["⭐ Nâng sao", "Có 3 tướng giống nhau cùng sao sẽ tự ghép lên sao cao hơn (tối đa ★4). Thẻ trong cửa hàng sáng vàng khi mua thêm là lên ★2."],
        ["🎒 Trang bị", "Trang bị rơi từ quái và Chợ Tướng. Chạm trang bị rồi chạm tướng (hoặc kéo thả) để gắn. 2 mảnh ghép thành 1 món mạnh; chạm lại trang bị đang chọn để xem công thức."],
        ["🧬 Tộc hệ & người chơi", "Cột trái là tộc hệ đang có: đủ mốc thì kích hoạt sức mạnh, chạm để xem tướng cùng tộc. Cột phải là 7 đối thủ và máu của họ, chạm để xem đội hình."],
        ["⚔️ Vào trận", "Bấm ▶ Sẵn sàng để đánh. Thua sẽ mất máu; người cuối cùng còn trụ là vô địch. Bấm 📊 để xem sát thương, sát thương chặn được, hồi máu và khiên của từng tướng."],
      ];
      let i = 0;
      const mm = openModal("📖 Hướng dẫn nhanh");
      const render = () => {
        const [t, d] = steps[i];
        mm.body.replaceChildren(h("h3", null, t), h("p", null, d), h("div", { class: "row between" },
          h("span", { class: "muted small" }, `${i + 1}/${steps.length}`),
          h("div", { class: "row" },
            h("button", { class: "btn small", onclick: () => mm.close() }, "Bỏ qua"),
            h("button", { class: "btn small primary", onclick: () => { if (++i >= steps.length) mm.close(); else render(); } }, i + 1 < steps.length ? "Tiếp" : "Bắt đầu"))));
      };
      render();
    }

    /** An item: what it does, what it makes with each component, and craft buttons for the ones you have. */
    function openItem(index: number) {
      const p = me();
      const id = p.items[index];
      if (!id) return;
      const it = ITEMS[id];
      const mm = openModal(it.name);
      const comps = ["sword", "bow", "rod", "tear", "vest", "cloak", "belt", "glove", "seal"];
      const planning = (m.phase === "plan" || m.phase === "augment") && !battle;
      mm.body.append(...nn(
        itemCard(id),
        h("p", { class: "muted small" }, isTool(id) ? "Kéo thả vào tướng để dùng." : "Kéo trang bị thả vào tướng để gắn; kéo thả lên mảnh khác để ghép."),
        isComponent(id) ? h("div", { class: "ar-recipes" }, comps.map((c) => {
          const made = combine(id, c);
          if (!made) return null;
          const r = ITEMS[made];
          const j = p.items.findIndex((x, k) => x === c && k !== index);
          return h("div", { class: j >= 0 ? "have" : "" },
            h("span", { class: "ar-rec" }, "+ ", itemIcon(c, "ar-iimg sm"), " = ", itemIcon(made, "ar-iimg sm")), h("b", null, r.name),
            j >= 0 && planning ? h("button", { class: "btn small good", onclick: () => { mm.close(); act(M.craft(m, p, index, j), "craft"); } }, "Ghép") : null,
            h("small", null, [itemStatText(made), r.desc].filter(Boolean).join(" · ")));
        })) : null,
        it.parts ? h("p", { class: "muted small ar-rec" }, "Ghép từ ", itemIcon(it.parts[0], "ar-iimg sm"), ` ${ITEMS[it.parts[0]].name} + `, itemIcon(it.parts[1], "ar-iimg sm"), ` ${ITEMS[it.parts[1]].name}`) : null,
        h("div", { class: "row end" }, h("button", { class: "btn small", onclick: () => mm.close() }, "Đóng")),
      ));
    }

    function openPlayer(q: M.Player) {
      const mm = openModal(`${q.icon} ${q.cpu ? q.name : "Bạn"}`);
      const counts = M.boardTraits(q);
      mm.body.append(...nn(
        h("p", null, `❤ ${Math.max(0, q.hp)} · Cấp ${q.level} · 💰 ${q.cpu ? "?" : q.gold} · chuỗi ${q.streak > 0 ? `${q.streak} thắng` : q.streak < 0 ? `${-q.streak} thua` : "—"}${q.place ? ` · hạng ${q.place}` : ""}`),
        q.cpu && q.grade && q.style ? h("p", { class: "muted small" }, `🧠 ${M.GRADE_NAMES[q.grade]} · lối chơi: ${M.STYLE_NAMES[q.style]}`) : null,
        h("div", { class: "ar-final" }, M.onBoard(q).map((o) => { const u = arenaUnit(o.unitId)!; return h("button", { class: "ar-mini", onclick: () => { const pv = M.unitPreview(q, o.uid); openUnitInfo(o.unitId, o.star, { items: o.items, now: pv?.now, base: pv?.base, enemy: q.cpu }); } }, unitImg(u, 3), stars(o.star), h("span", { class: "ar-mini-items" }, o.items.map((i) => itemIcon(i, "ar-iimg xs")))); })),
        h("div", { class: "ar-trait-list" }, Object.entries(counts).filter(([t, n]) => traitTier(t, n) >= 0).map(([t, n]) => h("span", { class: "ar-chip", style: `border-color:${TRAITS[t].color}` }, `${TRAITS[t].icon} ${TRAITS[t].name} ${n}`))),
        q.augments.length ? h("p", { class: "muted small" }, `Lõi: ${q.augments.map((a) => AUGMENT_BY_ID[a].name).join(", ")}`) : null,
      ));
    }

    // ------------------------------------------------ dragging units
    const local = (e: PointerEvent) => { const r = view.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const overShop = (e: PointerEvent) => { const r = shopRow.getBoundingClientRect(); return e.clientY >= r.top - 4 && e.clientY <= r.bottom + 4; };
    let drag: { uid: number; sx: number; sy: number; moved: boolean } | null = null;
    view.cv.addEventListener("pointerdown", (e) => {
      const pt = local(e);
      // during a fight: any unit on the board (yours or the enemy's) shows its live card
      if (battle && view.benchAt(pt.x, pt.y) < 0) {
        const f = view.fighterAt(pt.x, pt.y);
        if (f) openUnitInfo(f.unit.id, f.star, { items: f.items, enemy: f.side === 1, now: f, battle });
        return;
      }
      const u = view.unitAt(pt.x, pt.y);
      if (!u) {
        const e2 = view.enemyAt(pt.x, pt.y); // monsters shown before a monster round
        if (e2) openUnitInfo(e2.unitId, e2.star, { items: e2.items, enemy: true });
        return;
      }
      drag = { uid: u.uid, sx: e.clientX, sy: e.clientY, moved: false };
      view.cv.setPointerCapture(e.pointerId);
    });
    view.cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 7) return;
      const planning = (m.phase === "plan" || m.phase === "augment") && !battle;
      const own = me().units.find((u) => u.uid === drag!.uid);
      if (!own || (!planning && own.bench < 0)) return; // during a fight only the bench can be rearranged
      drag.moved = true;
      const pt = local(e);
      view.drag = { uid: drag.uid, px: pt.x, py: pt.y };
      const hx = planning ? view.hexAt(pt.x, pt.y) : null;
      view.dropHex = hx && hx.y >= 4 ? hx : null;
      view.dropBench = view.benchAt(pt.x, pt.y);
      const sell = planning && overShop(e);
      shopRow.classList.toggle("sell", sell);
      if (sell) shopRow.dataset.sell = `Bán +${M.sellValue(own)} 💰`;
    });
    const endDrag = (e: PointerEvent) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      const hx = view.dropHex, bench = view.dropBench;
      view.drag = null; view.dropHex = null; view.dropBench = -1;
      shopRow.classList.remove("sell");
      const own = me().units.find((u) => u.uid === d.uid);
      if (!own) return;
      if (!d.moved) { const pv = M.unitPreview(me(), own.uid); openUnitInfo(own.unitId, own.star, { items: own.items, bonus: own.bonus, now: pv?.now, base: pv?.base, sell: (m.phase === "plan" || m.phase === "augment") && !battle ? () => act(M.sell(m, me(), own.uid), "coin") : undefined }); return; }
      const planning = (m.phase === "plan" || m.phase === "augment") && !battle;
      if (planning && overShop(e)) act(M.sell(m, me(), own.uid), "coin");
      else if (hx) act(M.moveUnit(m, me(), own.uid, hx), "click");
      else if (bench >= 0) act(M.moveUnit(m, me(), own.uid, { bench }), "click");
      else refresh();
    };
    view.cv.addEventListener("pointerup", endDrag);
    view.cv.addEventListener("pointercancel", () => { drag = null; view.drag = null; view.dropHex = null; view.dropBench = -1; shopRow.classList.remove("sell"); });

    // ------------------------------------------------ items: drag onto a unit to equip (or onto another item to craft); tap for details
    function bindItem(b: HTMLElement, i: number) {
      let start: { x: number; y: number } | null = null;
      let ghost: HTMLElement | null = null;
      b.dataset.i = String(i);
      b.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY }; b.setPointerCapture(e.pointerId); });
      b.addEventListener("pointermove", (e) => {
        if (!start) return;
        if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
        if (!ghost) { ghost = h("div", { class: "ar-ghost" }, itemIcon(me().items[i] ?? "", "ar-iimg big")); document.body.append(ghost); }
        ghost.style.left = `${e.clientX}px`; ghost.style.top = `${e.clientY}px`;
        const r = view.cv.getBoundingClientRect();
        const u = view.unitAt(e.clientX - r.left, e.clientY - r.top);
        view.itemTarget = u?.uid ?? -1;
      });
      b.addEventListener("pointerup", (e) => {
        const wasDrag = !!ghost;
        ghost?.remove(); ghost = null; start = null;
        view.itemTarget = -1;
        const p = me();
        const planning = (m.phase === "plan" || m.phase === "augment") && !battle;
        if (!wasDrag) { openItem(i); return; }
        if (!planning) { toast("Chỉ gắn trang bị lúc chuẩn bị.", "bad"); return; }
        const r = view.cv.getBoundingClientRect();
        const u = view.unitAt(e.clientX - r.left, e.clientY - r.top);
        if (u) {
          const it = p.items[i];
          const err = M.giveItem(m, p, i, u.uid);
          if (!err && ITEMS[it]?.fx === "dup") toast(`🖨️ Đã sao chép ${arenaUnit(u.unitId)!.name}!`, "good");
          act(err, "craft");
          return;
        }
        // dropped on another item: craft
        const other = (document.elementsFromPoint(e.clientX, e.clientY).find((x) => (x as HTMLElement).dataset?.i !== undefined && x !== b) as HTMLElement | undefined)?.dataset.i;
        if (other !== undefined) act(M.craft(m, p, i, Number(other)), "craft");
      });
    }

    afterChange();
    if (m.phase === "plan") showBanner(`Vòng ${M.roundLabel(m)}`, KIND_NAME[M.currentKind(m)]);
  }

  lobby();
  return { destroy() { stopMatch?.(); } };
}
