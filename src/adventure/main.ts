/**
 * Adventure: the Lone Wolf gamebooks as a game. Library → save slots → character creation →
 * the story: each section is a living scene with its characters, the text, and what to do
 * next (choices, a random number, a battle). Travel between places plays on the map; big
 * moments play as cutscenes. Loaded on demand from the game picker.
 */
import "./style.css";
import type { Screen } from "../app";
import { playMusic } from "../audio/music";
import { sfx } from "../audio/sfx";
import { ApiError, errorText, type Session } from "../net/api";
import { confirmBox, h, nn, openModal, sleep, toast } from "../ui/dom";
import { discIcon, iconEl, itemIcon, uiIcon, type UiIcon } from "./art/icons";
import { withWeapon, type Look } from "./art/people";
import { makeScene } from "./art/scene";
import { playCutscene } from "./cutscene";
import {
  choiceState, condText, discsOf, drop, eatMeal, enter, epMax, itemName, newRun, pendingLoss, phase, pick10,
  profile, randomResult, retry, takeOffer, useItem, apply, continueRun, visibleChoices, type Change,
} from "./engine";
import { runFight } from "./fight";
import { importBook, listBooks, loadBook, removeBook, type BookEntry } from "./library";
import { AdvSaves, type SlotInfo } from "./save";
import { Stage } from "./stage";
import type { AdvState, Book, Disc, Offer, Section } from "./types";
import { WorldMapView, mapPlace } from "./worldmap";

export interface AdventureOpts {
  leave: () => void;
  expired: () => void;
}

const ui = (n: UiIcon, scale = 2) => iconEl(uiIcon(n), scale);

export function mountAdventure(root: HTMLElement, session: Session, opts: AdventureOpts): Screen {
  playMusic("title");
  const el = h("div", { class: "screen adv" });
  root.append(el);
  let saves: AdvSaves | null = null;
  let stage: Stage | null = null;
  let alive = true;
  const flush = () => void saves?.flush();
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", flush);
  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.code === "invalid_session") return opts.expired();
    toast(errorText(e), "bad", 6000);
  };
  const clearStage = () => { stage?.destroy(); stage = null; };
  const topbar = (title: string, back: () => void, ...extra: (Node | null)[]) =>
    h("div", { class: "adv-top" }, h("button", { class: "icon-btn", "aria-label": "Quay lại", onclick: back }, ui("back")), h("div", { class: "adv-top-title" }, title), ...nn(...extra));

  // ---------------------------------------------------------------- library
  async function library() {
    clearStage();
    el.replaceChildren(topbar("Adventure", async () => { await saves?.flush(); opts.leave(); }), h("div", { class: "adv-loading" }, "Đang mở thư viện…"));
    let books: BookEntry[] = [];
    try { books = await listBooks(session); } catch (e) { fail(e); }
    if (!alive) return;
    const file = h("input", { type: "file", accept: ".json,application/json", class: "hidden" }) as HTMLInputElement;
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      toast("Đang nạp sách…");
      try { const e = await importBook(session, f); toast(`Đã nạp: ${e.title}`, "good"); void library(); } catch (e) { fail(e); }
    };
    el.replaceChildren(
      topbar("Adventure", async () => { await saves?.flush(); opts.leave(); }, h("span", { class: "adv-user" }, session.username)),
      h("div", { class: "adv-library" },
        h("div", { class: "adv-lib-head" },
          h("h2", null, "Thư viện của bạn"),
          h("button", { class: "btn", type: "button", onclick: () => file.click() }, ui("book"), "Nạp sách"), file),
        books.length
          ? h("div", { class: "adv-books" }, ...books.map(bookCard))
          : h("div", { class: "adv-empty" },
            h("p", null, "Thư viện đang trống."),
            h("p", { class: "muted" }, "Nạp file gói sách (.json) của bạn. Sách được lưu riêng trong tài khoản này, chỉ bạn đọc được.")),
      ));
  }

  function bookCard(b: BookEntry) {
    const cover = document.createElement("canvas");
    cover.width = 320; cover.height = 180; cover.className = "adv-cover-art pix";
    try { makeScene({ bg: (["forest", "river", "cave", "mountain", "desert"] as const)[b.num % 5], time: (["dusk", "night", "day", "dawn"] as const)[b.num % 4], weather: "clear", mood: "mystery", seed: b.id }).draw(cover.getContext("2d")!, 0); } catch { /* art still loading */ }
    return h("div", { class: "adv-book" },
      h("button", { class: "adv-book-main", type: "button", onclick: () => void openBook(b) },
        cover,
        h("div", { class: "adv-book-num" }, `Cuốn ${b.num}`),
        h("div", { class: "adv-book-title" }, b.title)),
      h("button", { class: "icon-btn", "aria-label": "Xoá sách", onclick: async () => {
        if (!(await confirmBox("Xoá sách", `Xoá "${b.title}" khỏi thư viện? Các ô lưu vẫn còn, nạp lại sách là chơi tiếp được.`, "Xoá"))) return;
        try { await removeBook(session, b.id); void library(); } catch (e) { fail(e); }
      } }, ui("close")));
  }

  async function openBook(entry: BookEntry) {
    clearStage();
    el.replaceChildren(h("div", { class: "adv-loading" }, "Đang mở sách…"));
    try {
      const book = await loadBook(session, entry);
      saves = new AdvSaves(session, book.id);
      saves.onError = (e) => { if (e instanceof ApiError && e.code === "invalid_session") opts.expired(); };
      const slots = await saves.list();
      if (alive) slotScreen(book, slots, entry);
    } catch (e) { fail(e); void library(); }
  }

  // ---------------------------------------------------------------- save slots
  function slotScreen(book: Book, slots: SlotInfo[], entry: BookEntry) {
    clearStage();
    const hero = h("div", { class: "adv-book-hero" });
    stage = new Stage({ bg: book.sections[book.start].scene.bg, time: book.sections[book.start].scene.time, weather: book.sections[book.start].scene.weather, mood: "mystery", seed: book.id });
    hero.append(stage.canvas, h("div", { class: "adv-book-hero-t" }, h("small", null, `Cuốn ${book.num}`), book.title));
    el.replaceChildren(
      topbar(book.title, () => { void saves?.flush(); void library(); }),
      h("div", { class: "adv-slots" }, hero,
        h("div", { class: "section-title" }, "Ô lưu"),
        ...slots.map((sl) => {
          const d = sl.data;
          if (!d) return h("button", { class: "adv-slot empty", type: "button", onclick: () => void startNew(book, sl.slot, entry) }, h("b", null, `Ô ${sl.slot + 1}`), h("span", null, "+ Cuộc phiêu lưu mới"));
          const st = d.ended === "victory" ? "Đã hoàn thành" : d.ended === "death" ? "Đã tử nạn" : `Đoạn ${d.section} · ${d.steps} bước`;
          return h("div", { class: "adv-slot" },
            h("button", { class: "adv-slot-main", type: "button", onclick: () => play(book, sl.slot, d, entry) },
              h("b", null, `Ô ${sl.slot + 1} · ${d.name}`), h("span", null, st),
              h("span", { class: "adv-slot-stats" }, ui("cs", 1), ` ${d.cs}  `, ui("ep", 1), ` ${d.ep}  `, ui("gold", 1), ` ${d.gold}  · ${new Date(d.updated).toLocaleString("vi-VN")}`)),
            h("button", { class: "icon-btn", "aria-label": "Xoá ô lưu", onclick: async () => {
              if (!(await confirmBox("Xoá ô lưu", `Xoá cuộc phiêu lưu của ${d.name} ở ô ${sl.slot + 1}? Không thể hoàn tác.`, "Xoá"))) return;
              try { await saves!.remove(sl.slot); sl.data = null; slotScreen(book, slots, entry); } catch (e) { fail(e); }
            } }, ui("close")));
        })));
  }

  // ---------------------------------------------------------------- character creation
  function wheelRoll(target: HTMLElement): Promise<number> {
    const n = pick10();
    const cells = Array.from({ length: 10 }, (_, i) => h("span", null, String(i)));
    target.replaceChildren(h("div", { class: "adv-wheel" }, ...cells));
    return (async () => {
      for (let i = 0; i <= 12 + n; i++) {
        cells.forEach((c, j) => c.classList.toggle("lit", j === i % 10));
        sfx("blip", String(300 + (i % 10) * 25));
        await sleep(28 + i * 5);
      }
      sfx("good");
      return n;
    })();
  }

  /** A new adventure: a fresh hero, or the hero who finished the previous book. */
  async function startNew(book: Book, slot: number, entry: BookEntry) {
    clearStage();
    let heroes: AdvState[] = [];
    try {
      const prev = (await listBooks(session)).find((b) => b.num === book.num - 1);
      if (prev) {
        const prevBook = await loadBook(session, prev);
        if ((prevBook.rules ?? "kai") === (book.rules ?? "kai")) {
          heroes = (await new AdvSaves(session, prev.id).list()).map((x) => x.data).filter((d): d is AdvState => !!d && d.ended === "victory");
        }
      }
    } catch { /* offline or no earlier book: fresh hero only */ }
    if (!heroes.length) return create(book, slot, entry);
    el.replaceChildren(topbar("Cuộc phiêu lưu mới", () => void openBook(entry)),
      h("div", { class: "adv-create" },
        h("p", null, `Bạn đã hoàn thành cuốn ${book.num - 1}. Mang nhân vật sang cuốn này để giữ chỉ số, kỹ năng và hành trang, và học thêm 1 kỹ năng mới.`),
        ...heroes.map((p) => h("button", { class: "adv-slot-main", type: "button", onclick: () => carryOver(book, slot, entry, p) },
          h("b", null, p.name), h("span", { class: "adv-slot-stats" }, ui("cs", 1), ` ${p.cs}  `, ui("ep", 1), ` ${p.epBase}  `, ui("gold", 1), ` ${p.gold}  · ${p.disciplines.length} kỹ năng`))),
        h("button", { class: "btn block", type: "button", onclick: () => create(book, slot, entry) }, "Tạo nhân vật mới")));
  }

  function carryOver(book: Book, slot: number, entry: BookEntry, prev: AdvState) {
    const discs = discsOf(book).filter((d) => !prev.disciplines.includes(d));
    let newDisc: Disc | undefined;
    const r = { gold: -1, ws: -1 };
    const picks: number[][] = book.kit.picks.map(() => []);
    const body = h("div", { class: "adv-create" });
    const startBtn = h("button", { class: "btn primary big block", type: "button" }, "Lên đường");
    const goldWheel = h("div");
    const optLabel = (o: Book["kit"]["picks"][number]["options"][number]) => "gold" in o
      ? h("span", { class: "adv-chip-item" }, ui("gold", 1), `${o.gold} Vương Miện Vàng`)
      : h("span", { class: "adv-chip-item" }, iconEl(itemIcon(o.gain, o.type), 1), `${itemName(book, o.gain)}${(o.n ?? 1) > 1 ? ` ×${o.n}` : ""}`);
    const draw = () => {
      body.replaceChildren(...nn(
        h("h2", { class: "adv-h2" }, `${prev.name} tiếp tục hành trình`),
        h("div", { class: "section-title" }, discs.length ? "Học thêm 1 kỹ năng" : "Đã thông thạo mọi kỹ năng"),
        h("div", { class: "adv-disc-grid" }, ...discs.map((d) => h("button", { class: `adv-disc ${newDisc === d ? "on" : ""}`, type: "button", onclick: () => { newDisc = d; draw(); } },
          iconEl(discIcon(d), 2), h("b", null, book.names.disc[d] ?? d), book.names.discDesc?.[d] ? h("small", null, book.names.discDesc[d]) : null))),
        newDisc === "weaponskill" ? h("div", { class: "adv-pick" }, h("span", null, "Vũ khí sở trường"), r.ws < 0
          ? h("button", { class: "btn small", type: "button", onclick: async () => { const w = h("div"); body.append(w); r.ws = await wheelRoll(w); draw(); } }, "Bốc số")
          : h("span", { class: "adv-chip-item" }, iconEl(itemIcon(book.weaponskill[r.ws], "weapon"), 1), itemName(book, book.weaponskill[r.ws]))) : null,
        h("div", { class: "section-title" }, "Trang bị cho chuyến đi"),
        book.kit.gold.random ? h("div", { class: "row" }, ui("gold"), r.gold < 0
          ? h("button", { class: "btn small", type: "button", onclick: async (e: Event) => { (e.currentTarget as HTMLButtonElement).disabled = true; r.gold = await wheelRoll(goldWheel); draw(); } }, "Bốc số Vương Miện Vàng")
          : h("b", null, `+${r.gold + book.kit.gold.add} Vương Miện Vàng (tối đa 50)`), goldWheel) : null,
        ...book.kit.picks.map((p, i) => h("div", { class: "adv-pick" }, h("span", null, p.mode === "random" ? "Bốc số một món:" : `Chọn tối đa ${p.count} món (Ba Lô tối đa 8, vũ khí tối đa 2):`),
          p.mode === "random"
            ? (picks[i].length ? optLabel(p.options[picks[i][0]]) : h("button", { class: "btn small", type: "button", onclick: async () => { const w = h("div"); body.append(w); picks[i] = [await wheelRoll(w)]; draw(); } }, "Bốc số"))
            : h("div", { class: "adv-pick-opts" }, ...p.options.map((o, j) => h("button", { class: `adv-opt ${picks[i].includes(j) ? "on" : ""}`, type: "button", onclick: () => {
              const k = picks[i].indexOf(j);
              if (k >= 0) picks[i].splice(k, 1); else if (picks[i].length < p.count) picks[i].push(j);
              draw();
            } }, optLabel(o)))))),
        startBtn));
      startBtn.disabled = (discs.length > 0 && !newDisc) || (book.kit.gold.random && r.gold < 0) || (newDisc === "weaponskill" && r.ws < 0)
        || book.kit.picks.some((p, i) => p.mode === "random" && !picks[i].length);
    };
    startBtn.onclick = async () => {
      const s = continueRun(book, prev, { newDisc, picks, goldRoll: Math.max(0, r.gold), weaponskillRoll: r.ws });
      saves!.save(slot, s, true);
      if (book.intro.length) await introScreen(book);
      play(book, slot, s, entry);
    };
    el.replaceChildren(topbar("Mang nhân vật sang", () => void startNew(book, slot, entry)), body);
    draw();
  }

  function create(book: Book, slot: number, entry: BookEntry) {
    clearStage();
    const discs = discsOf(book);
    const chosen = new Set<Disc>();
    const r = { cs: -1, ep: -1, gold: -1, ws: -1 };
    const picks: number[][] = book.kit.picks.map(() => []);
    const mastered = new Set<string>();
    const name = h("input", { class: "input", maxlength: "24", value: book.rules === "neworder" ? "" : "Lone Wolf", placeholder: "Tên Kai của bạn" }) as HTMLInputElement;
    const body = h("div", { class: "adv-create" });
    el.replaceChildren(topbar("Tạo nhân vật", () => void openBook(entry)), body);

    const statBox = (label: string, icon: UiIcon, plus: number, key: "cs" | "ep") => {
      const val = h("b", { class: "adv-stat-val" }, "?");
      const wheel = h("div", { class: "adv-stat-wheel" });
      const btn = h("button", { class: "btn small", type: "button" }, "Bốc số");
      btn.onclick = async () => {
        btn.disabled = true;
        const n = await wheelRoll(wheel);
        r[key] = n;
        val.textContent = String(n + plus);
        draw();
      };
      return h("div", { class: "adv-stat-card" }, h("div", { class: "adv-stat-h" }, ui(icon), label), wheel, h("div", { class: "row" }, val, h("span", { class: "muted small" }, `= số + ${plus}`), btn));
    };
    const csBox = statBox("Kỹ Năng Chiến Đấu", "cs", 10, "cs");
    const epBox = statBox("Sức Bền", "ep", 20, "ep");

    const discGrid = h("div", { class: "adv-disc-grid" });
    const kitBox = h("div", { class: "adv-kit" });
    const startBtn = h("button", { class: "btn primary big block", type: "button" }, "Bắt đầu cuộc phiêu lưu");

    function draw() {
      discGrid.replaceChildren(...discs.map((d) => {
        const on = chosen.has(d);
        return h("button", { class: `adv-disc ${on ? "on" : ""}`, type: "button", onclick: () => {
          if (on) chosen.delete(d); else if (chosen.size < book.discCount) chosen.add(d); else { toast(`Chỉ chọn được ${book.discCount} kỹ năng.`); return; }
          sfx("click"); draw();
        } }, iconEl(discIcon(d), 2), h("b", null, book.names.disc[d] ?? d), book.names.discDesc?.[d] ? h("small", null, book.names.discDesc[d]) : null);
      }));
      const wsDisc = profile(book).weapon.disc;
      kitBox.replaceChildren(...nn(
        h("div", { class: "section-title" }, "Trang bị khởi đầu"),
        h("div", { class: "adv-kit-items" }, ...book.kit.items.map((it) => h("span", { class: "adv-chip-item" }, iconEl(itemIcon(it.gain, it.type), 1), `${itemName(book, it.gain)}${(it.n ?? 1) > 1 ? ` ×${it.n}` : ""}`))),
        book.kit.gold.random ? h("div", { class: "row" }, ui("gold"), r.gold < 0
          ? h("button", { class: "btn small", type: "button", onclick: async (e: Event) => { (e.currentTarget as HTMLButtonElement).disabled = true; r.gold = await wheelRoll(goldWheel); draw(); } }, "Bốc số Vương Miện Vàng")
          : h("b", null, `${r.gold + book.kit.gold.add} Vương Miện Vàng`), goldWheel) : null,
        ...book.kit.picks.map((p, i) => p.mode === "random"
          ? h("div", { class: "adv-pick" }, h("span", null, "Tìm được trong đống đổ nát:"), picks[i].length
            ? optLabel(p.options[picks[i][0]])
            : h("button", { class: "btn small", type: "button", onclick: async () => { const w = h("div"); kitBox.append(w); picks[i] = [await wheelRoll(w)]; draw(); } }, "Bốc số"))
          : h("div", { class: "adv-pick" }, h("span", null, `Chọn ${p.count} món:`), h("div", { class: "adv-pick-opts" }, ...p.options.map((o, j) => h("button", { class: `adv-opt ${picks[i].includes(j) ? "on" : ""}`, type: "button", onclick: () => {
            const k = picks[i].indexOf(j);
            if (k >= 0) picks[i].splice(k, 1); else if (picks[i].length < p.count) picks[i].push(j);
            draw();
          } }, optLabel(o)))))),
        chosen.has("weaponskill") ? h("div", { class: "adv-pick" }, h("span", null, `${book.names.disc.weaponskill}: vũ khí sở trường`), r.ws < 0
          ? h("button", { class: "btn small", type: "button", onclick: async () => { const w = h("div"); kitBox.append(w); r.ws = await wheelRoll(w); draw(); } }, "Bốc số")
          : h("span", { class: "adv-chip-item" }, iconEl(itemIcon(book.weaponskill[r.ws], "weapon"), 1), itemName(book, book.weaponskill[r.ws]))) : null,
        wsDisc !== "weaponskill" && chosen.has(wsDisc) ? h("div", { class: "adv-pick" }, h("span", null, `${book.names.disc[wsDisc]}: chọn vũ khí thành thạo (${mastered.size}/3)`),
          h("div", { class: "adv-pick-opts" }, ...[...new Set(book.weaponskill)].map((w) => h("button", { class: `adv-opt ${mastered.has(w) ? "on" : ""}`, type: "button", onclick: () => { if (mastered.has(w)) mastered.delete(w); else if (mastered.size < 3) mastered.add(w); draw(); } }, iconEl(itemIcon(w, "weapon"), 1), itemName(book, w))))) : null,
      ));
      const ready = r.cs >= 0 && r.ep >= 0 && chosen.size === book.discCount && (!book.kit.gold.random || r.gold >= 0)
        && book.kit.picks.every((p, i) => picks[i].length === (p.mode === "random" ? 1 : p.count))
        && (!chosen.has("weaponskill") || r.ws >= 0) && name.value.trim().length > 0;
      startBtn.disabled = !ready;
    }
    const goldWheel = h("div");
    const optLabel = (o: Book["kit"]["picks"][number]["options"][number]) => "gold" in o
      ? h("span", { class: "adv-chip-item" }, ui("gold", 1), `${o.gold} Vương Miện Vàng`)
      : h("span", { class: "adv-chip-item" }, iconEl(itemIcon(o.gain, o.type), 1), `${itemName(book, o.gain)}${(o.n ?? 1) > 1 ? ` ×${o.n}` : ""}`);
    name.oninput = draw;
    startBtn.onclick = async () => {
      const s = newRun(book, { name: name.value.trim(), csRoll: r.cs, epRoll: r.ep, disciplines: [...chosen], weaponskillRoll: r.ws, mastered: [...mastered], goldRoll: Math.max(0, r.gold), picks });
      saves!.save(slot, s, true);
      if (book.intro.length) await introScreen(book);
      play(book, slot, s, entry);
    };
    body.append(
      h("label", { class: "field" }, "Tên nhân vật", name),
      h("div", { class: "adv-stats-row" }, csBox, epBox),
      h("div", { class: "section-title" }, `Chọn ${book.discCount} kỹ năng Kai`),
      discGrid, kitBox, startBtn);
    draw();
  }

  function introScreen(book: Book): Promise<void> {
    return new Promise((res) => {
      el.replaceChildren(h("div", { class: "adv-intro" },
        h("h2", null, "Chuyện đã qua…"),
        ...book.intro.map((p, i) => h("p", { style: `animation-delay:${i * 0.25}s` }, p)),
        h("button", { class: "btn primary big", type: "button", onclick: () => res() }, "Lên đường")));
    });
  }

  // ---------------------------------------------------------------- the story
  function play(book: Book, slot: number, s0: AdvState, entry: BookEntry) {
    clearStage();
    playMusic("title");
    let s = s0;
    const save = (now = false) => saves!.save(slot, s, now);
    const heroLook = (): Look => withWeapon("lonewolf", s.weapons[0]);
    const chips = h("div", { class: "adv-chips" });
    const stageBox = h("div", { class: "adv-stage-box" });
    const caption = h("div", { class: "adv-place" });
    const page = h("div", { class: "adv-page" });
    const scroller = h("div", { class: "adv-scroll" }, page);
    const pops = h("div", { class: "adv-pops" });
    el.replaceChildren(
      topbar(book.title, async () => { await saves!.flush(); void openBook(entry); }, chips,
        book.map ? h("button", { class: "icon-btn", "aria-label": "Bản đồ", onclick: () => openMap() }, ui("map")) : null,
        h("button", { class: "icon-btn", "aria-label": "Hành trang", onclick: () => chart() }, ui("backpack"))),
      h("div", { class: "adv-play" }, h("div", { class: "adv-stage-wrap" }, stageBox, caption), scroller), pops);

    const placeOf = (sid: string) => (book.map ? mapPlace(book.map, book.sections[sid].scene.place) : book.sections[sid].scene.place);
    const placeName = (p: string) => book.places?.[p]?.name ?? p.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    const visitedPlaces = () => new Set(s.visited.map(placeOf));

    const showChanges = (ch: Change[]) => {
      ch.forEach((c, i) => setTimeout(() => {
        const icon = c.item ? iconEl(itemIcon(c.item), 1) : ui(c.kind === "ep" ? "ep" : c.kind === "cs" ? "cs" : c.kind === "gold" ? "gold" : c.kind === "meal" ? "meal" : "backpack", 1);
        const p = h("div", { class: `adv-pop ${c.good ? "good" : "bad"}` }, icon, c.label);
        pops.append(p);
        sfx(c.kind === "gold" ? "coin" : c.kind === "item" ? (c.good ? "pickup" : "debuff") : c.good ? "heal" : "hit");
        setTimeout(() => p.remove(), 2600);
      }, i * 280));
    };

    function renderChips() {
      const max = epMax(book, s);
      const pct = Math.max(0, Math.min(100, (100 * s.ep) / max));
      chips.replaceChildren(
        h("span", { class: "adv-chip" }, ui("cs", 1), String(s.cs)),
        h("span", { class: `adv-chip hp ${pct <= 30 ? "low" : ""}`, style: `--p:${pct}%` }, ui("ep", 1), `${s.ep}/${max}`),
        h("span", { class: "adv-chip" }, ui("gold", 1), String(s.gold)),
        h("span", { class: "adv-chip" }, ui("meal", 1), String(s.meals)));
    }

    /** Moves to a section: map travel when the place changes, a cutscene for big moments. */
    async function goTo(to: string, extra: Change[] = []) {
      const from = s.section;
      const ch = [...extra, ...enter(book, s, to)];
      save();
      const pa = placeOf(from), pb = placeOf(to);
      if (book.map && pa !== pb && book.map.nodes[pb]) await travel(pa, pb);
      const sec = book.sections[to];
      if (sec.scene.cutscene && s.visited.filter((x) => x === to).length <= 1 && !s.flags[`cut:${to}`]) {
        s.flags[`cut:${to}`] = true;
        save();
        await playCutscene(el, book, to, heroLook());
      }
      render();
      showChanges(ch);
    }

    function travel(from: string, to: string): Promise<void> {
      const v = visitedPlaces();
      v.add(from);
      const wrap = h("div", { class: "adv-travel" });
      const view = new WorldMapView({ key: book.id, map: book.map!, visited: v, here: from, label: placeName });
      const label = h("div", { class: "adv-travel-label" }, `Đi tới: ${placeName(to)}`);
      wrap.append(view.el, label);
      el.append(wrap);
      sfx("step");
      return (async () => {
        await sleep(250);
        await view.travel(to);
        v.add(to);
        view.setVisited(v, to);
        await sleep(450);
        wrap.classList.add("out");
        await sleep(300);
        view.destroy();
        wrap.remove();
      })();
    }

    function openMap() {
      let view: WorldMapView | null = null;
      const m = openModal("Bản đồ", { wide: true, cls: "adv-map-modal", onClose: () => view?.destroy() });
      const v = visitedPlaces();
      const here = placeOf(s.section);
      const info = h("div", { class: "adv-map-info" }, h("b", null, placeName(here)), h("span", null, book.places?.[here]?.desc ?? ""));
      const mv = new WorldMapView({ key: book.id, map: book.map!, visited: v, here, label: placeName, onTapPlace: (p) => info.replaceChildren(h("b", null, placeName(p)), h("span", null, book.places?.[p]?.desc ?? "")) });
      view = mv;
      m.body.append(mv.el, info, h("div", { class: "row" },
        h("button", { class: "btn small", type: "button", onclick: () => mv.zoomBy(1) }, "+"),
        h("button", { class: "btn small", type: "button", onclick: () => mv.zoomBy(-1) }, "−")));
    }

    function render() {
      renderChips();
      const sec = book.sections[s.section];
      clearStage();
      stage = new Stage({ bg: sec.scene.bg, time: sec.scene.time, weather: sec.scene.weather, mood: sec.scene.mood, seed: `${book.id}-${s.section}` });
      stage.cast(sec.scene.actors.length ? sec.scene.actors : ["lonewolf"], heroLook());
      stageBox.replaceChildren(stage.canvas);
      caption.textContent = placeName(placeOf(s.section));
      const paras = sec.text.map((t, i) => h("p", { class: "adv-para", style: `animation-delay:${i * 0.15}s` }, t));
      const actions = h("div", { class: "adv-actions" });
      page.replaceChildren(...nn(h("div", { class: "adv-secnum" }, `Đoạn ${s.section}`), ...paras, sec.note ? h("div", { class: "adv-note" }, ui("info", 1), sec.note) : null, offersBox(), actions));
      scroller.scrollTop = 0;
      const ph = phase(book, s);
      if (ph === "end") return endPanel(actions);
      if (ph === "combat") {
        const c = sec.combat!;
        actions.append(
          h("div", { class: "adv-foes" }, ...c.foes.map((f) => h("div", { class: "adv-foe-chip" }, h("b", null, f.name), h("span", null, ui("cs", 1), ` ${f.cs}  `, ui("ep", 1), ` ${f.ep}`)))),
          h("button", { class: "btn primary big block", type: "button", onclick: () => void fight() }, ui("cs"), "Vào trận"));
        return;
      }
      if (pendingLoss(s)) { actions.append(h("p", { class: "muted" }, "Hãy chọn món đồ phải bỏ lại ở trên trước khi đi tiếp.")); return; }
      if (ph === "random") {
        const wheel = h("div");
        actions.append(wheel, h("button", { class: "btn primary big block", type: "button", onclick: async (e: Event) => {
          (e.currentTarget as HTMLButtonElement).remove();
          const n = await wheelRoll(wheel);
          const res = randomResult(book, sec, s, n);
          const extra = res.fx ? apply(book, s, res.fx) : [];
          if (res.end) { s.ended = res.end; save(true); showChanges(extra); }
          actions.append(h("div", { class: "adv-roll" }, `Số ${n}${res.add ? ` ${res.add > 0 ? "+" : ""}${res.add} = ${res.value}` : ""}`),
            h("button", { class: "btn primary block", type: "button", onclick: () => (res.end ? render() : void goTo(res.to, extra)) }, "Tiếp tục"));
          save();
        } }, ui("dice"), "Bốc số ngẫu nhiên"));
        return;
      }
      for (const c of visibleChoices(sec, s)) {
        const st = choiceState(s, c);
        if (st === "hidden") continue;
        actions.append(h("button", { class: `adv-choice ${st === "locked" ? "locked" : ""}`, type: "button", disabled: st === "locked", onclick: () => pick(c) },
          h("span", null, c.text), st === "locked" ? h("span", { class: "adv-lock" }, ui("lock", 1), condText(book, c.if)) : h("span", { class: "adv-go" }, "›")));
      }
    }

    /** A choice: pay its price / apply its effects, then go (or stay, for repeatable purchases). */
    function pick(c: NonNullable<Section["choices"]>[number]) {
      const ch = c.fx ? apply(book, s, c.fx) : [];
      if (c.repeat) { save(); render(); showChanges(ch); return; }
      void goTo(c.to, ch);
    }

    function offersBox() {
      if (!s.offers.length) return null;
      return h("div", { class: "adv-offers" }, ...s.offers.map((o: Offer, i) => {
        if ("gold" in o) return h("div", { class: "adv-offer" }, ui("gold"), h("span", null, `${o.gold} Vương Miện Vàng`), h("button", { class: "btn small", type: "button", onclick: () => { showChanges(takeOffer(book, s, i)); save(); renderChips(); render(); } }, "Nhặt"));
        if ("loseChoice" in o) {
          const pool = o.loseChoice === "weapon" ? s.weapons : o.loseChoice === "backpack" ? [...s.backpack, ...(s.meals ? ["Meal"] : [])] : [...s.weapons, ...s.backpack, ...(s.meals ? ["Meal"] : [])];
          if (!pool.length) { s.offers.splice(i, 1); return null; }
          return h("div", { class: "adv-offer lose" }, h("span", null, `Phải bỏ lại ${o.n} món${o.loseChoice === "weapon" ? " vũ khí" : o.loseChoice === "backpack" ? " trong Ba Lô" : ""}:`),
            h("div", { class: "adv-pick-opts" }, ...[...new Set(pool)].map((id) => h("button", { class: "adv-opt", type: "button", onclick: () => { showChanges(takeOffer(book, s, i, id)); save(); render(); } }, iconEl(itemIcon(id), 1), itemName(book, id)))));
        }
        const full = o.type !== "special" && (o.type === "weapon" ? s.weapons.length >= 2 : s.backpack.length + s.meals >= 8);
        return h("div", { class: "adv-offer" }, iconEl(itemIcon(o.gain, o.type), 2),
          h("div", { class: "grow" }, h("b", null, `${itemName(book, o.gain)}${o.n > 1 ? ` ×${o.n}` : ""}`), o.desc ? h("small", null, o.desc) : null, full ? h("small", { class: "bad" }, o.type === "weapon" ? "Đã mang đủ 2 vũ khí: bỏ bớt trong Hành trang" : "Ba Lô đã đầy: bỏ bớt trong Hành trang") : null),
          h("button", { class: "btn small", type: "button", disabled: full, onclick: () => { showChanges(takeOffer(book, s, i)); save(); render(); } }, "Nhặt"));
      }).filter(Boolean) as HTMLElement[]);
    }

    async function fight() {
      const res = await runFight(el, book, s, () => { renderChips(); save(); });
      save(true);
      if (res.exit === null) return render();
      if (res.exit) return goTo(res.exit);
      render();
    }

    function endPanel(actions: HTMLElement) {
      const win = s.ended === "victory";
      sfx(win ? "victory" : "defeat");
      save(true);
      actions.append(h("div", { class: `adv-end ${win ? "win" : "dead"}` },
        win ? ui("trophy", 3) : ui("skull", 3),
        h("div", { class: "adv-end-t" }, win ? "HOÀN THÀNH NHIỆM VỤ" : "CUỘC PHIÊU LƯU KẾT THÚC"),
        h("p", null, win ? `${s.name} đã đi đến cuối cuốn sách sau ${s.steps} bước.` : `${s.name} đã gục ngã ở đoạn ${s.section}.`),
        h("div", { class: "row" }, ...nn(
          !win && s.back ? h("button", { class: "btn primary", type: "button", onclick: () => { const r = retry(s); if (r) { s = r; save(true); render(); } } }, "Thử lại đoạn này") : null,
          h("button", { class: "btn", type: "button", onclick: () => create(book, slot, entry) }, "Chơi lại từ đầu"),
          h("button", { class: "btn", type: "button", onclick: async () => { await saves!.flush(); void openBook(entry); } }, "Về ô lưu")))));
    }

    function chart() {
      const m = openModal(`Hành trang · ${s.name}`, { wide: true });
      const draw = () => {
        const max = epMax(book, s);
        const row = (id: string, type: string, extra?: HTMLElement | null) => h("div", { class: "adv-item" }, iconEl(itemIcon(id, type as never), 2),
          h("div", { class: "grow" }, h("b", null, itemName(book, id)), book.items[id]?.desc ? h("small", null, book.items[id].desc) : null),
          extra ?? null,
          s.ended ? null : h("button", { class: "btn small", type: "button", onclick: async () => {
            if (!(await confirmBox("Bỏ đồ", `Bỏ ${itemName(book, id)} lại? Không lấy lại được.`, "Bỏ"))) return;
            drop(book, s, id); save(); renderChips(); draw(); render();
          } }, "Bỏ"));
        m.body.replaceChildren(...nn(
          h("div", { class: "adv-sheet-stats" },
            h("div", null, ui("cs"), h("span", null, "Kỹ Năng Chiến Đấu"), h("b", null, String(s.cs))),
            h("div", null, ui("ep"), h("span", null, "Sức Bền"), h("b", null, `${s.ep}/${max}`)),
            h("div", null, ui("gold"), h("span", null, "Vương Miện Vàng"), h("b", null, `${s.gold}/50`)),
            h("div", null, ui("meal"), h("span", null, "Phần Ăn"), h("b", null, String(s.meals)),
              h("button", { class: "btn small", type: "button", disabled: !!s.ended || s.meals <= 0 || s.ep >= max, title: "Ăn để hồi sức không có tác dụng ngoài luật sách; chỉ ăn khi sách yêu cầu", onclick: () => { showChanges(eatMeal(book, s)); save(); draw(); } }, "Ăn"))),
          h("div", { class: "section-title" }, "Kỹ năng"),
          h("div", { class: "adv-discs-own" }, ...s.disciplines.map((d) => h("span", { class: "adv-chip-item" }, iconEl(discIcon(d), 1), book.names.disc[d] ?? d))),
          s.weaponskill ? h("p", { class: "muted small" }, `Vũ khí sở trường: ${itemName(book, s.weaponskill)}`) : null,
          s.mastered?.length ? h("p", { class: "muted small" }, `Vũ khí thành thạo: ${s.mastered.map((w) => itemName(book, w)).join(", ")}`) : null,
          h("div", { class: "section-title" }, `Vũ khí (${s.weapons.length}/2)`),
          ...s.weapons.map((w) => row(w, "weapon")),
          h("div", { class: "section-title" }, `Ba Lô (${s.backpack.length + s.meals}/8)`),
          ...s.backpack.map((w) => row(w, "backpack", book.items[w]?.heal && !s.ended ? h("button", { class: "btn small good", type: "button", disabled: s.ep >= max, onclick: () => { showChanges(useItem(book, s, w)); save(); renderChips(); draw(); } }, "Dùng") : null)),
          h("div", { class: "section-title" }, "Vật Phẩm Đặc Biệt"),
          ...s.special.map((w) => row(w, "special")),
          s.arrows ? h("p", null, ui("arrows", 1), ` Mũi tên: ${s.arrows}`) : null,
          h("p", { class: "muted small" }, `Đã qua ${s.visited.length}/${Object.keys(book.sections).length} đoạn.`)));
      };
      draw();
    }

    render();
  }

  void library();
  return {
    destroy: () => {
      alive = false;
      clearStage();
      void saves?.flush();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      el.remove();
    },
  };
}
