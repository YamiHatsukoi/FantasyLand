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
import { DT, type ArenaBattle } from "../arena/combat";
import { mirror } from "../arena/hex";
import { ITEMS, combine, isComponent } from "../arena/items";
import * as M from "../arena/match";
import { DIVS, POINTS_PER_DIV, TIERS, applyResult, matchReward, newRank, rankIcon, rankName, tierOf, tierReward } from "../arena/rank";
import { TRAITS, traitDesc, traitTier } from "../arena/traits";
import type { ArenaUnit, Star } from "../arena/types";
import { STAR_MULT, arenaUnit, arenaUnits, starBoost } from "../arena/units";
import { addItem } from "../core/state";
import { getItem } from "../data/items";
import { ArenaView, COST_COL, STAR_COL } from "../render/arenaView";
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

/** A unit's card: stats at a star, traits, spell, items and earned stats. */
export function openUnitInfo(unitId: string, star: Star = 1, o: { items?: string[]; bonus?: Record<string, number>; sell?: () => void } = {}) {
  const u = arenaUnit(unitId);
  if (!u) return;
  const s = u.stats;
  const boost = starBoost(u.cost, star);
  const ad = [0, 1, 1.5, 2.25, 3.4][star];
  const m = openModal(`${u.name}`);
  const row = (k: string, v: string | number) => h("div", { class: "ar-stat" }, h("span", null, k), h("b", null, String(v)));
  m.body.append(...nn(
    h("div", { class: "ar-info-head" },
      h("div", { class: "ar-info-pic", style: `border-color:${COST_COL[u.cost]}` }, unitImg(u, 6)),
      h("div", null,
        h("div", null, stars(star), " ", h("span", { class: "ar-cost", style: `background:${COST_COL[u.cost]}` }, `${u.cost} 💰`), u.boss ? " 👑 Trùm" : ""),
        h("div", { class: "muted" }, `${ROLE_NAMES[u.role]} · ${s.range > 1 ? `Đánh xa ${s.range} ô` : "Cận chiến"} · Tầng ${u.floor}`),
        h("div", { class: "ar-trait-list" }, u.traits.map((t) => h("span", { class: "ar-chip", style: `border-color:${TRAITS[t].color}` }, `${TRAITS[t].icon} ${TRAITS[t].name}`))))),
    h("div", { class: "ar-stats" },
      row("❤ Máu", Math.round(s.hp * STAR_MULT[star] * boost[0])), row("⚔ Sát thương", Math.round(s.ad * ad * boost[1])), row("🛡 Giáp", s.armor), row("🔮 Kháng phép", s.mr),
      row("⚡ Tốc đánh", s.as.toFixed(2)), row("💧 Năng lượng", u.spell.passive ? "—" : `${s.startMana}/${s.mana}`)),
    h("div", { class: "ar-spell" },
      h("div", null, h("b", null, `${u.spell.icon} ${u.spell.name}`), u.spell.passive ? h("span", { class: "ar-tag" }, "Nội tại") : null, u.spell.ult ? h("span", { class: "ar-tag gold" }, "Tối thượng") : null),
      h("p", null, u.spell.desc),
      h("p", { class: "muted small" }, star > 1 ? `Số liệu chiêu ghi ở 1 sao; ở ${star} sao chiêu mạnh hơn nhiều.` : "Chiêu mạnh lên theo số sao.")),
    o.bonus && Object.keys(o.bonus).length ? h("p", { class: "ar-bonus" }, "Đã tích lũy: ", Object.entries(o.bonus).map(([k, v]) => `${k === "ap" ? `+${v} sức mạnh phép` : k === "ad" ? `+${Math.round(v * 100)}% sát thương` : k === "hp" ? `+${Math.round(v * 100)}% máu` : `+${v} ${k}`}`).join(", ")) : null,
    o.items?.length ? h("div", { class: "ar-items-info" }, o.items.map((i) => h("div", null, h("b", null, `${ITEMS[i].icon} ${ITEMS[i].name}`), " — ", ITEMS[i].desc))) : null,
    h("div", { class: "row end" },
      o.sell ? h("button", { class: "btn danger", onclick: () => { m.close(); o.sell!(); } }, "Bán") : null,
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
          h("div", { class: "muted small" }, `Bậc ${tierOf(r.step) + 1}/${TIERS} · cao nhất: ${rankName(r.best)} · đã đấu ${ar.played} trận · top 1: ${ar.top1} · top 4: ${ar.top4}`))),
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

  function rewardText(r: { gold: number; items: Record<string, number> }) {
    return [`${r.gold} 💰`, ...Object.entries(r.items).map(([id, n]) => `${getItem(id).name} ×${n}`)].join(", ");
  }

  function openRules() {
    const m = openModal("📖 Cách chơi Đấu Trường", { wide: true });
    m.body.append(...[
      "8 người chơi (bạn và 7 đối thủ) cùng mua tướng, xếp đội hình và để tướng tự đánh. Mỗi lần thua bạn mất máu; còn trụ lại cuối cùng là thắng.",
      "Mỗi giai đoạn gồm các vòng: ⚔️ giao đấu với người khác, 👾 đánh quái (rơi trang bị, vàng), 🎠 Chợ Tướng (chọn 1 tướng kèm trang bị). Ở vòng 2-1, 3-2 và 4-2 bạn chọn 1 Lõi tăng sức mạnh.",
      "Kinh tế: mỗi vòng nhận 5 vàng + lãi (1 vàng mỗi 10 vàng đang có, tối đa 5) + thưởng chuỗi thắng/thua. Đổi cửa hàng 2 vàng, mua 4 kinh nghiệm 4 vàng. Cấp càng cao càng ra nhiều tướng đắt và được đặt nhiều tướng hơn.",
      "Ghép 3 tướng giống nhau cùng sao thành 1 tướng sao cao hơn (tối đa ★4). Tướng 4–5 vàng ở ★3 cực kỳ mạnh.",
      "Trang bị: 2 mảnh ghép thành 1 món hoàn chỉnh. Ấn Trắng + 1 mảnh = Ấn tộc hệ. Mỗi tướng mang tối đa 3 món. Kéo trang bị vào tướng, hoặc chạm trang bị rồi chạm tướng.",
      "Tộc hệ: đủ số tướng khác nhau cùng tộc/hệ thì kích hoạt sức mạnh. Chạm vào dải tộc hệ để xem chi tiết.",
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
    const playersRow = h("div", { class: "ar-players" });
    const traitsRow = h("div", { class: "ar-traits" });
    const stage = h("div", { class: "ar-stage" });
    const hint = h("div", { class: "ar-hint" });
    const itemsRow = h("div", { class: "ar-items" });
    const shopRow = h("div", { class: "ar-shop" });
    const actions = h("div", { class: "ar-actions" });
    const banner = h("div", { class: "ar-banner hidden" });
    wrap.append(topBar, playersRow, traitsRow, stage, hint, itemsRow, shopRow, actions, banner);
    el.append(wrap);
    const view = new ArenaView(stage);
    let battle: ArenaBattle | null = null;
    let opponent = "";
    let finishing = false;
    let selItem = -1;
    let modal: ModalHandle | null = null;
    let alive = true;

    const fit = () => view.resize(stage.clientWidth, stage.clientHeight);
    const ro = new ResizeObserver(fit);
    ro.observe(stage);

    // ------------------------------------------------ loop
    let last = performance.now(), acc = 0;
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (battle && battle.winner === null) {
        acc += dt;
        while (acc >= DT && battle.winner === null) { battle.step(); acc -= DT; view.takeEvents(); }
        actions.querySelector(".ar-timer")?.replaceChildren(`⏱ ${Math.floor(battle.time)}s`);
      }
      if (battle && battle.winner !== null && !finishing) { finishing = true; view.takeEvents(); setTimeout(endFight, 1300); }
      view.frame(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    stopMatch = () => { alive = false; ro.disconnect(); modal?.close(); };

    // ------------------------------------------------ rendering
    const act = (err: string | null, ok?: string) => { if (err) { toast(err, "bad"); sfx("error"); } else { if (ok) sfx(ok); } changed(); };
    function changed() { saveMatch(m); refresh(); }

    function refresh() {
      const p = me();
      const kind = M.currentKind(m);
      const planning = m.phase === "plan" || m.phase === "augment";
      // top bar
      const need = M.XP_NEXT[p.level] || 0;
      topBar.replaceChildren(
        h("button", { class: "icon-btn", onclick: openMenu }, "≡"),
        h("div", { class: "ar-round" }, `${KIND_ICON[kind]} ${M.roundLabel(m)}`, h("small", null, KIND_NAME[kind])),
        h("div", { class: "ar-res" }, h("span", { class: "hp" }, `❤ ${Math.max(0, p.hp)}`), h("span", { class: "gold" }, `💰 ${p.gold}`),
          h("span", { class: "lv" }, `Cấp ${p.level}`, need ? h("small", null, ` ${p.xp}/${need}`) : null),
          h("span", { class: "cap" }, `👥 ${M.onBoard(p).length}/${M.boardSize(p)}`)),
      );
      // players
      playersRow.replaceChildren(...[...m.players].sort((a, b) => (a.place ? 1 : 0) - (b.place ? 1 : 0) || b.hp - a.hp).map((q) =>
        h("button", { class: `ar-pl ${q.cpu ? "" : "me"} ${q.place ? "out" : ""}`, onclick: () => openPlayer(q) },
          h("span", { class: "ic" }, q.icon), h("span", { class: "nm" }, q.cpu ? q.name.split(" ").slice(-1)[0] : "Bạn"),
          h("span", { class: "hpb" }, h("i", { style: `width:${Math.max(0, q.hp)}%` })),
          h("span", { class: "hpn" }, q.place ? `#${q.place}` : String(q.hp)))));
      // traits
      const counts = M.boardTraits(p);
      const tl = Object.entries(counts).filter(([t]) => TRAITS[t]).map(([t, n]) => ({ t, n, tier: traitTier(t, n) })).sort((a, b) => b.tier - a.tier || b.n - a.n);
      traitsRow.replaceChildren(...(tl.length ? tl.map(({ t, n, tier }) => {
        const d = TRAITS[t];
        const next = d.breaks.find((b) => b > n);
        return h("button", { class: `ar-trait ${tier >= 0 ? "on" : ""}`, style: tier >= 0 ? `border-color:${d.color};box-shadow:0 0 6px ${d.color}66` : "", onclick: () => openTraits() },
          `${d.icon} ${d.name} `, h("b", null, String(n)), next ? h("small", null, `/${next}`) : null);
      }) : [h("span", { class: "muted small" }, "Đặt tướng lên sân để kích hoạt tộc hệ")]));
      // board
      view.plan.mine = p.units.map((u) => ({ uid: u.uid, unitId: u.unitId, star: u.star, items: u.items, x: u.x, y: u.y, bench: u.bench }));
      view.plan.enemy = m.pve && !battle ? m.pve.units.map((e) => ({ ...e, ...mirror({ x: e.x, y: e.y }) })) : [];
      // items
      itemsRow.replaceChildren(...(p.items.length ? p.items.map((it, i) => {
        const b = h("button", { class: `ar-item ${selItem === i ? "sel" : ""} ${isComponent(it) ? "" : "done"}`, title: ITEMS[it].name }, ITEMS[it].icon);
        bindItem(b, i);
        return b;
      }) : [h("span", { class: "muted small" }, "Trang bị rơi từ quái và Chợ Tướng sẽ nằm ở đây")]));
      // hint line
      if (selItem >= 0 && p.items[selItem]) {
        const it = ITEMS[p.items[selItem]];
        hint.replaceChildren(h("b", null, `${it.icon} ${it.name}`), `: ${it.desc}${isComponent(it.id) ? " · chạm mảnh khác để ghép" : ""} · chạm tướng để trang bị`);
      } else if (battle) hint.replaceChildren(`⚔️ Đang giao đấu với ${opponent}`);
      else if (planning) hint.replaceChildren(kind === "pve" ? "👾 Vòng đánh quái: thắng để nhặt trang bị. " : "", "Kéo tướng lên sân · kéo vào cửa hàng để bán · chạm để xem");
      else hint.replaceChildren("");
      // shop
      const owned = (id: string) => p.units.filter((u) => u.unitId === id && u.star === 1).length;
      shopRow.replaceChildren(...p.shop.map((id, s) => {
        if (!id) return h("div", { class: "ar-scard empty" });
        const u = arenaUnit(id)!;
        const n = owned(id);
        const card = h("button", { class: `ar-scard ${n >= 2 ? "up" : n ? "have" : ""}`, style: `border-color:${COST_COL[u.cost]}`, disabled: !planning },
          unitImg(u, 3),
          h("div", { class: "nm" }, u.name),
          h("div", { class: "tr" }, u.traits.map((t) => TRAITS[t].icon).join("")),
          h("div", { class: "cs", style: `background:${COST_COL[u.cost]}` }, `${u.cost}`),
          n ? h("div", { class: "own" }, n >= 2 ? "★2!" : `×${n}`) : null);
        card.addEventListener("click", () => { act(M.buy(m, p, s), "coin"); });
        card.addEventListener("contextmenu", (e) => { e.preventDefault(); openUnitInfo(id); });
        const info = h("span", { class: "info", onclick: (e: Event) => { e.stopPropagation(); openUnitInfo(id); } }, "i");
        card.append(info);
        return card;
      }));
      // actions
      if (battle) actions.replaceChildren(h("div", { class: "ar-timer" }, "⏱ 0s"), h("div", { class: "muted small grow" }, `Đối thủ: ${opponent}`));
      else actions.replaceChildren(
        h("button", { class: "btn small", disabled: !planning, onclick: () => act(M.reroll(m, p), "click") }, p.freeRollsLeft > 0 ? `🔄 Miễn phí ×${p.freeRollsLeft}` : `🔄 Đổi ${M.REROLL_COST}💰`),
        h("button", { class: "btn small", disabled: !planning || p.level >= M.MAX_LEVEL, onclick: () => act(M.buyXp(m, p), "levelup") }, `⬆ KN ${M.XP_COST}💰`),
        h("button", { class: `btn small ${p.locked ? "blue" : ""}`, disabled: !planning, onclick: () => { M.toggleLock(m, p); changed(); } }, p.locked ? "🔒" : "🔓"),
        h("button", { class: "btn primary grow", disabled: !planning, onclick: startFight }, "▶ Sẵn sàng"),
      );
    }

    // ------------------------------------------------ phases
    function afterChange() {
      saveMatch(m);
      refresh();
      modal?.close();
      modal = null;
      if (m.phase === "augment") openAugments();
      else if (m.phase === "carousel") openCarousel();
      else if (m.phase === "end") finishMatch(m);
      else if (m.phase === "result") { M.nextRound(m); afterChange(); }
      else if (m.phase === "combat" && !battle) beginFight();
    }

    function startFight() {
      if (m.phase !== "plan") return;
      selItem = -1;
      M.ready(m);
      saveMatch(m);
      beginFight();
    }

    function beginFight() {
      const f = m.fights.find((x) => x.a === 0 || x.b === 0);
      if (!f) { M.resolveCombat(m); afterChange(); return; }
      battle = M.makeBattle(m, f);
      opponent = f.pve ? "👾 Quái vật" : `${m.players[f.b].icon} ${m.players[f.b].name}${f.ghost ? " (bóng)" : ""}`;
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
          h("div", { class: "ar-augs" }, offer.map((id) => {
            const a = AUGMENT_BY_ID[id];
            return h("button", { class: "ar-aug", style: `border-color:${TIER_COL[a.tier]}`, onclick: () => { M.pickAugment(m, p, id); sfx("good"); modal?.close(); modal = null; changed(); } },
              h("div", { class: "ic" }, a.icon), h("b", null, a.name), h("p", null, a.desc));
          })),
          h("div", { class: "row end" }, h("button", { class: "btn small", disabled: p.augmentRerolled, onclick: () => { M.rerollAugments(m, p); render(); } }, p.augmentRerolled ? "Đã đổi" : "🔄 Đổi bộ Lõi (1 lần)")),
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
          return h("button", { class: `ar-cslot ${taken ? "taken" : ""}`, style: `border-color:${COST_COL[u.cost]}`, disabled: taken, onclick: () => {
            const err = M.pickCarousel(m, i);
            if (err) { toast(err, "bad"); return; }
            sfx("pickup");
            modal?.close();
            modal = null;
            toast(`Bạn nhận ${u.name} và ${it.icon} ${it.name}`, "good");
            afterChange();
            showBanner(`Vòng ${M.roundLabel(m)}`, KIND_NAME[M.currentKind(m)]);
          } },
            unitImg(u, 3), h("div", { class: "nm" }, u.name), h("div", { class: "it" }, `${it.icon} ${it.name}`),
            taken ? h("div", { class: "by" }, m.players[slot.takenBy!].name) : null);
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

    function openTraits() {
      const p = me();
      const counts = M.boardTraits(p);
      const mm = openModal("🧬 Tộc hệ", { wide: true });
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

    function openPlayer(q: M.Player) {
      const mm = openModal(`${q.icon} ${q.cpu ? q.name : "Bạn"}`);
      const counts = M.boardTraits(q);
      mm.body.append(...nn(
        h("p", null, `❤ ${Math.max(0, q.hp)} · Cấp ${q.level} · 💰 ${q.cpu ? "?" : q.gold} · chuỗi ${q.streak > 0 ? `${q.streak} thắng` : q.streak < 0 ? `${-q.streak} thua` : "—"}${q.place ? ` · hạng ${q.place}` : ""}`),
        h("div", { class: "ar-final" }, M.onBoard(q).map((o) => { const u = arenaUnit(o.unitId)!; return h("button", { class: "ar-mini", onclick: () => openUnitInfo(o.unitId, o.star, { items: o.items }) }, unitImg(u, 3), stars(o.star), h("small", null, o.items.map((i) => ITEMS[i].icon).join(""))); })),
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
      const u = view.unitAt(pt.x, pt.y);
      if (!u) return;
      const planning = (m.phase === "plan" || m.phase === "augment") && !battle;
      if (selItem >= 0 && planning) {
        const idx = selItem;
        selItem = -1;
        act(M.giveItem(m, me(), idx, u.uid), "craft");
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
      if (!d.moved) { openUnitInfo(own.unitId, own.star, { items: own.items, bonus: own.bonus, sell: (m.phase === "plan" || m.phase === "augment") && !battle ? () => act(M.sell(m, me(), own.uid), "coin") : undefined }); return; }
      const planning = (m.phase === "plan" || m.phase === "augment") && !battle;
      if (planning && overShop(e)) act(M.sell(m, me(), own.uid), "coin");
      else if (hx) act(M.moveUnit(m, me(), own.uid, hx), "click");
      else if (bench >= 0) act(M.moveUnit(m, me(), own.uid, { bench }), "click");
      else refresh();
    };
    view.cv.addEventListener("pointerup", endDrag);
    view.cv.addEventListener("pointercancel", () => { drag = null; view.drag = null; view.dropHex = null; view.dropBench = -1; shopRow.classList.remove("sell"); });

    // ------------------------------------------------ items: tap to select, tap a unit; or drag onto a unit
    function bindItem(b: HTMLElement, i: number) {
      let start: { x: number; y: number } | null = null;
      let ghost: HTMLElement | null = null;
      b.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY }; b.setPointerCapture(e.pointerId); });
      b.addEventListener("pointermove", (e) => {
        if (!start) return;
        if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
        if (!ghost) { ghost = h("div", { class: "ar-ghost" }, b.textContent ?? ""); document.body.append(ghost); }
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
        if (wasDrag) {
          const r = view.cv.getBoundingClientRect();
          const u = view.unitAt(e.clientX - r.left, e.clientY - r.top);
          if (u && planning) { selItem = -1; act(M.giveItem(m, p, i, u.uid), "craft"); }
          return;
        }
        if (selItem === i) selItem = -1;
        else if (selItem >= 0 && planning && isComponent(p.items[selItem]) && isComponent(p.items[i]) && combine(p.items[selItem], p.items[i])) {
          const a = selItem; selItem = -1; act(M.craft(m, p, a, i), "craft"); return;
        } else selItem = i;
        refresh();
      });
    }

    afterChange();
    if (m.phase === "plan") showBanner(`Vòng ${M.roundLabel(m)}`, KIND_NAME[M.currentKind(m)]);
  }

  lobby();
  return { destroy() { stopMatch?.(); } };
}
