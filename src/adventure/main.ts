/**
 * Adventure: the gamebook game. Library → save slots → character creation → reading / battles.
 * Loaded on demand from the game picker, so FantasyLand does not carry its code.
 */
import "./style.css";
import type { Screen } from "../app";
import { playMusic } from "../audio/music";
import { sfx } from "../audio/sfx";
import { ApiError, errorText, type Session } from "../net/api";
import { confirmBox, h, nn, openModal, sleep, toast } from "../ui/dom";
import { paintScene } from "./art";
import { BOOKS, type BookMeta } from "./books";
import { dieEl, tumble } from "./dice";
import { STAT_ICON, STAT_NAME, battleExit, check, choose, condText, eat, enter, newRun, retry, rollStats, runTest, useItem, type Change } from "./engine";
import { runFight } from "./fight";
import { AdvSaves, type SlotInfo } from "./save";
import type { AdvState, Book, StatId } from "./types";

export interface AdventureOpts {
  /** Back to the game picker. */
  leave: () => void;
  /** The login expired. */
  expired: () => void;
}

export function mountAdventure(root: HTMLElement, session: Session, opts: AdventureOpts): Screen {
  playMusic("title");
  const el = h("div", { class: "screen adv" });
  root.append(el);
  let saves: AdvSaves | null = null;
  let alive = true;
  const flush = () => void saves?.flush();
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", flush);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.code === "invalid_session") return opts.expired();
    toast(errorText(e), "bad", 5000);
  };

  // ---------------------------------------------------------------- library
  function library() {
    el.replaceChildren(
      h("div", { class: "adv-top" },
        h("button", { class: "icon-btn", "aria-label": "Chọn game khác", onclick: async () => { await saves?.flush(); opts.leave(); } }, "←"),
        h("div", { class: "adv-top-title" }, "📖 Adventure"),
        h("span", { class: "adv-user" }, session.username)),
      h("div", { class: "adv-library" },
        h("p", { class: "adv-lib-lead" }, "Chọn một cuốn sách để bắt đầu cuộc phiêu lưu."),
        ...BOOKS.map((m) => bookCard(m))),
    );
  }

  function bookCard(m: BookMeta) {
    const cover = h("div", { class: "adv-cover" }, h("div", { class: "adv-cover-t" }, m.title), m.subtitle ? h("div", { class: "adv-cover-s" }, m.subtitle) : null);
    cover.style.setProperty("--accent", m.accent ?? "#f2c542");
    paintScene(cover, { id: m.id } as Book, m.id, m.cover, m.mood);
    return h("button", { class: "adv-book", type: "button", onclick: () => void openBook(m) },
      cover,
      h("div", { class: "adv-book-info" }, h("div", { class: "adv-book-title" }, m.title), h("p", null, m.blurb), m.author ? h("div", { class: "muted small" }, m.author) : null));
  }

  async function openBook(m: BookMeta) {
    el.replaceChildren(h("div", { class: "adv-loading" }, "Đang mở sách…"));
    let book: Book;
    let slots: SlotInfo[];
    try {
      book = await m.load();
      saves = new AdvSaves(session, book.id);
      saves.onError = (e) => { if (e instanceof ApiError && e.code === "invalid_session") opts.expired(); };
      slots = await saves.list();
    } catch (e) {
      fail(e);
      return library();
    }
    if (alive) slotScreen(book, slots);
  }

  // ---------------------------------------------------------------- save slots
  function slotScreen(book: Book, slots: SlotInfo[]) {
    const head = h("div", { class: "adv-book-hero" }, h("div", { class: "adv-book-hero-t" }, book.title), book.subtitle ? h("div", { class: "adv-book-hero-s" }, book.subtitle) : null);
    paintScene(head, book, book.id, book.cover, book.sections[book.start]?.mood);
    el.replaceChildren(
      h("div", { class: "adv-top" },
        h("button", { class: "icon-btn", "aria-label": "Thư viện", onclick: () => { void saves?.flush(); library(); } }, "←"),
        h("div", { class: "adv-top-title" }, book.title)),
      h("div", { class: "adv-slots" }, head, h("p", { class: "adv-blurb" }, book.blurb),
        h("div", { class: "section-title" }, "💾 Ô lưu"),
        ...slots.map((sl) => {
          const d = sl.data;
          if (!d) return h("button", { class: "adv-slot empty", type: "button", onclick: () => create(book, sl.slot) }, h("b", null, `Ô ${sl.slot + 1}`), h("span", null, "＋ Cuộc phiêu lưu mới"));
          const status = d.ended === "victory" ? "🏆 Đã hoàn thành" : d.ended === "death" ? "☠️ Đã tử nạn" : `§${d.section} · ${d.steps} bước`;
          return h("div", { class: "adv-slot" },
            h("button", { class: "adv-slot-main", type: "button", onclick: () => play(book, sl.slot, d) },
              h("b", null, `Ô ${sl.slot + 1} · ${d.name}`),
              h("span", null, status),
              h("span", { class: "muted small" }, `${STAT_ICON.skill} ${d.skill}  ${STAT_ICON.stamina} ${d.stamina}/${d.staminaMax}  ${STAT_ICON.luck} ${d.luck}  🪙 ${d.gold} · ${new Date(d.updated).toLocaleString("vi-VN")}`)),
            h("button", { class: "icon-btn", "aria-label": "Xoá ô lưu", onclick: async () => {
              if (!(await confirmBox("Xoá ô lưu", `Xoá cuộc phiêu lưu của ${d.name} ở ô ${sl.slot + 1}? Không thể hoàn tác.`, "Xoá"))) return;
              try { await saves!.remove(sl.slot); sl.data = null; slotScreen(book, slots); } catch (e) { fail(e); }
            } }, "🗑"));
        })),
    );
  }

  // ---------------------------------------------------------------- character creation
  function create(book: Book, slot: number) {
    const name = h("input", { class: "input", maxlength: "24", placeholder: "Tên nhân vật", value: session.username }) as HTMLInputElement;
    let rolled = rollStats(book);
    let rerolls = 3;
    const stats = (["skill", "stamina", "luck"] as StatId[]).map((k) => {
      const dice = Array.from({ length: book.rules[k].dice }, () => dieEl(1, "small"));
      const total = h("b", { class: "adv-stat-total" }, "?");
      const row = h("div", { class: "adv-stat-row" },
        h("span", { class: "adv-stat-name" }, `${STAT_ICON[k]} ${STAT_NAME[k]}`),
        h("span", { class: "adv-stat-dice" }, ...dice, h("span", { class: "muted" }, `+${book.rules[k].plus}`)),
        total);
      return { k, dice, total, row };
    });
    const rerollBtn = h("button", { class: "btn", type: "button" }, "");
    const startBtn = h("button", { class: "btn primary big", type: "button", disabled: true }, "Bắt đầu phiêu lưu ▸");
    const doRoll = async () => {
      rerollBtn.disabled = startBtn.disabled = true;
      sfx("whoosh");
      await Promise.all(stats.map((s) => tumble(s.dice, rolled[s.k].dice, 650)));
      stats.forEach((s) => { s.total.textContent = String(rolled[s.k].total); });
      sfx("good");
      rerollBtn.textContent = `🎲 Gieo lại (${rerolls})`;
      rerollBtn.disabled = rerolls <= 0;
      startBtn.disabled = false;
    };
    rerollBtn.onclick = () => { if (rerolls <= 0) return; rerolls--; rolled = rollStats(book); void doRoll(); };
    startBtn.onclick = () => {
      const n = name.value.trim() || "Lữ Khách";
      const s = newRun(book, n, { skill: rolled.skill.total, stamina: rolled.stamina.total, luck: rolled.luck.total });
      saves!.save(slot, s, true);
      sfx("transition");
      play(book, slot, s);
    };
    el.replaceChildren(
      h("div", { class: "adv-top" },
        h("button", { class: "icon-btn", "aria-label": "Quay lại", onclick: () => void openBook(BOOKS.find((b) => b.id === book.id)!) }, "←"),
        h("div", { class: "adv-top-title" }, "Tạo nhân vật")),
      h("div", { class: "adv-create" },
        h("label", { class: "field" }, "Tên của bạn", name),
        h("div", { class: "adv-stats-card" }, ...stats.map((s) => s.row)),
        h("p", { class: "muted small" },
          "⚔️ Kỹ Năng: sức chiến đấu, cộng vào mỗi lượt đánh. ❤️ Thể Lực: máu, về 0 là chết. 🍀 May Mắn: dùng để thử vận may, mỗi lần thử giảm 1."),
        h("div", { class: "row" }, rerollBtn, startBtn)),
    );
    void doRoll();
  }

  // ---------------------------------------------------------------- reading
  function play(book: Book, slot: number, s: AdvState) {
    playMusic("title");
    const save = (now = false) => saves!.save(slot, s, now);
    const chips = h("div", { class: "adv-chips" });
    const art = h("div", { class: "adv-art" });
    const page = h("div", { class: "adv-page" });
    const scroller = h("div", { class: "adv-scroll" }, art, page);
    const pops = h("div", { class: "adv-pops" });
    el.replaceChildren(
      h("div", { class: "adv-top" },
        h("button", { class: "icon-btn", "aria-label": "Ô lưu", onclick: async () => { await saves!.flush(); void openBook(BOOKS.find((b) => b.id === book.id)!); } }, "←"),
        chips,
        h("button", { class: "icon-btn", "aria-label": "Hành trang", onclick: () => sheet() }, "🎒")),
      scroller, pops);

    const showChanges = (ch: Change[]) => {
      ch.forEach((c, i) => setTimeout(() => {
        const p = h("div", { class: `adv-pop ${c.good ? "good" : "bad"}` }, c.label);
        pops.append(p);
        sfx(c.kind === "gold" ? "coin" : c.kind === "item" ? (c.good ? "pickup" : "debuff") : c.good ? "heal" : "hit");
        setTimeout(() => p.remove(), 2400);
      }, i * 260));
    };

    function renderChips() {
      const hpPct = Math.max(0, Math.min(100, (100 * s.stamina) / s.staminaMax));
      chips.replaceChildren(
        h("span", { class: "adv-chip" }, `${STAT_ICON.skill} ${s.skill}`),
        h("span", { class: `adv-chip hp ${hpPct <= 30 ? "low" : ""}`, style: `--p:${hpPct}%` }, `${STAT_ICON.stamina} ${s.stamina}/${s.staminaMax}`),
        h("span", { class: "adv-chip" }, `${STAT_ICON.luck} ${s.luck}`),
        h("span", { class: "adv-chip gold" }, `🪙 ${s.gold}`),
      );
    }

    function go(ch: Change[]) {
      save();
      render();
      showChanges(ch);
    }

    function render() {
      renderChips();
      const sec = book.sections[s.section];
      art.replaceChildren(...nn(h("div", { class: "adv-art-num" }, `§${s.section}`), sec.title ? h("div", { class: "adv-art-title" }, sec.title) : null));
      paintScene(art, book, s.section, sec.img, sec.mood);
      art.classList.remove("in"); void art.offsetWidth; art.classList.add("in");
      const paras = sec.text.split(/\n\s*\n/).map((t, i) => h("p", { class: "adv-para", style: `animation-delay:${i * 0.18}s` }, t.trim()));
      const actions = h("div", { class: "adv-choices" });
      page.replaceChildren(h("div", { class: "adv-text" }, ...paras), actions);
      scroller.scrollTop = 0;

      if (s.ended) return endPanel(actions);
      if (sec.fight) {
        const f = sec.fight;
        actions.append(
          h("div", { class: "adv-foe-preview" }, ...f.enemies.map((id) => {
            const d = book.enemies[id];
            return h("div", { class: "adv-foe-chip", style: `--foe:${d.color ?? "#c05050"}` }, h("span", { class: "i" }, d.icon ?? "👹"), h("b", null, d.name), h("span", null, `⚔️ ${d.skill} ❤️ ${d.stamina}`));
          })),
          h("button", { class: "btn primary big block", type: "button", onclick: () => void fight() }, "⚔️ Vào trận"),
        );
        return;
      }
      if (sec.test) {
        const t = sec.test;
        actions.append(h("button", { class: "btn primary big block", type: "button", onclick: () => void testDice(actions) },
          t.stat === "luck" ? "🍀 Thử Vận May" : `🎲 Thử ${STAT_NAME[t.stat]}`));
        return;
      }
      for (const c of sec.choices ?? []) {
        const ok = check(s, c.cond);
        if (!ok && c.hide) continue;
        actions.append(h("button", { class: `adv-choice ${ok ? "" : "locked"}`, type: "button", disabled: !ok, onclick: () => go(choose(book, s, c)) },
          h("span", null, c.text), ok ? h("span", { class: "adv-choice-go" }, "▸") : h("span", { class: "adv-choice-lock" }, `🔒 ${condText(book, c.cond)}`)));
      }
    }

    async function testDice(actions: HTMLElement) {
      const sec = book.sections[s.section];
      const t = sec.test!;
      const r = runTest(sec, s);
      save(true);
      const dice = r.dice.map(() => dieEl(1));
      const verdict = h("div", { class: "adv-verdict" }, "");
      actions.replaceChildren(h("div", { class: "adv-test" },
        h("div", { class: "adv-test-target" }, `Cần ≤ ${r.target} (${STAT_NAME[t.stat]})`),
        h("div", { class: "adv-dice-row big" }, ...dice), verdict));
      sfx("whoosh");
      await tumble(dice, r.dice, 900);
      verdict.textContent = `${r.total} — ${r.pass ? (t.stat === "luck" ? "MAY MẮN!" : "THÀNH CÔNG!") : t.stat === "luck" ? "XUI XẺO…" : "THẤT BẠI…"}`;
      verdict.classList.add(r.pass ? "good" : "bad");
      sfx(r.pass ? "good" : "fail");
      renderChips();
      if (t.stat === "luck") showChanges([{ kind: "stat", label: "🍀 May Mắn −1", good: false }]);
      await sleep(500);
      actions.append(h("button", { class: "btn primary block", type: "button", onclick: () => go(enter(book, s, r.pass ? t.pass : t.fail)) }, "Tiếp tục ▸"));
    }

    async function fight() {
      const b = await runFight(el, book, s, () => { renderChips(); save(); });
      const to = battleExit(book, s, b);
      if (!to) { s.ended = "death"; save(true); return render(); }
      go(enter(book, s, to));
    }

    function endPanel(actions: HTMLElement) {
      const win = s.ended === "victory";
      sfx(win ? "victory" : "defeat");
      save(true);
      actions.append(h("div", { class: `adv-end ${win ? "win" : "dead"}` },
        h("div", { class: "adv-end-t" }, win ? "🏆 HOÀN THÀNH" : "☠️ CUỘC PHIÊU LƯU KẾT THÚC"),
        h("p", null, win ? `${s.name} đã đi đến cuối câu chuyện sau ${s.steps} bước.` : `${s.name} đã gục ngã ở §${s.section}.`),
        h("div", { class: "row" }, ...nn(
          !win && s.back ? h("button", { class: "btn primary", type: "button", onclick: () => { const r = retry(s); if (r) { s = r; save(true); render(); } } }, "↺ Thử lại đoạn này") : null,
          h("button", { class: "btn", type: "button", onclick: () => create(book, slot) }, "Chơi lại từ đầu"),
          h("button", { class: "btn", type: "button", onclick: async () => { await saves!.flush(); void openBook(BOOKS.find((b) => b.id === book.id)!); } }, "Về ô lưu"),
        ))));
    }

    function sheet() {
      const m = openModal(`🎒 ${s.name}`);
      const draw = () => {
        const items = Object.entries(s.items).filter(([, n]) => n > 0);
        m.body.replaceChildren(
          h("div", { class: "adv-sheet-stats" }, ...(["skill", "stamina", "luck"] as StatId[]).map((k) =>
            h("div", { class: "adv-sheet-stat" }, h("span", null, `${STAT_ICON[k]} ${STAT_NAME[k]}`), h("b", null, `${s[k]} / ${s[`${k}Max` as "skillMax"]}`)))),
          h("div", { class: "row between adv-sheet-line" }, h("span", null, `🪙 Vàng: ${s.gold}`),
            h("span", null, `🍖 Lương khô: ${s.provisions}`),
            h("button", { class: "btn small", type: "button", disabled: s.ended || s.provisions <= 0 || s.stamina >= s.staminaMax, onclick: () => { const ch = eat(book, s); save(); renderChips(); showChanges(ch); draw(); } }, `Ăn (+${book.rules.provisionHeal ?? 4} ❤️)`)),
          h("div", { class: "section-title" }, "Vật phẩm"),
          items.length
            ? h("div", { class: "adv-items" }, ...items.map(([id, n]) => {
              const it = book.items[id];
              return h("div", { class: "adv-item" }, h("span", { class: "i" }, it?.icon ?? "📦"),
                h("div", { class: "grow" }, h("b", null, `${it?.name ?? id}${n > 1 ? ` ×${n}` : ""}`), it?.desc ? h("div", { class: "muted small" }, it.desc) : null),
                it?.use && !s.ended ? h("button", { class: "btn small", type: "button", onclick: () => { const ch = useItem(book, s, id); save(); renderChips(); showChanges(ch); draw(); } }, it.use.label ?? "Dùng") : null);
            }))
            : h("p", { class: "muted" }, "Túi trống rỗng."),
          h("p", { class: "muted small" }, `Đã đi qua ${s.visited.length}/${Object.keys(book.sections).length} đoạn.`),
        );
      };
      draw();
    }

    render();
  }

  library();
  return {
    destroy: () => {
      alive = false;
      void saves?.flush();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      el.remove();
    },
  };
}

