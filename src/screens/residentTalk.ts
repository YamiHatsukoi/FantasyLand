import { app } from "../app";
import type { Character } from "../core/state";
import { getItem } from "../data/items";
import { JOBS, PERSONAS } from "../data/npcText";
import { DATES, FLIRT_LINES, TOPICS, type FlirtStyle, type Topic } from "../data/residentText";
import { spriteImg } from "../render/pixel";
import { h, openModal, toast, type ModalHandle } from "../ui/dom";
import { itemImg } from "../ui/icon";
import {
  ACTS_PER_DAY, MOOD_ICONS, STAGE_NAMES, actsLeft, answerDeep, askMood, askPast, birthdayText, bondOf, canDate, canFlirt,
  canGiftRes, datePlaces, deepQuestion, flirt, friendTitle, fulfilRequest, giveResGift, goDate, gossipLine,
  greetResident, heartsOf, isBirthday, knownTastes, moodOf, pendingScene, profileOf, resolveScene, talkTopic, tone, topicChoices, wishOf,
  type Line, type PendingScene,
} from "../world/residents";

export function heartRow(pts: number, icon = "❤️") {
  const n = heartsOf(pts);
  return h("span", { class: "hearts", title: `${pts}/1000` }, icon.repeat(n), h("span", { class: "hearts-off" }, "♡".repeat(10 - n)));
}

/** Plays a milestone scene line by line, then offers its choices. */
export function playScene(ch: Character, ps: PendingScene, done: (lines: Line[]) => void) {
  const g = app.game;
  const m = openModal(ps.scene.title, { noClose: true, cls: "scene-modal" });
  const box = h("div", { class: "story-box scene-box" });
  const acts = h("div", { class: "choices" });
  m.body.append(h("div", { class: "row", style: "gap:12px;align-items:center" }, spriteImg(ch.sprite, ch.pal, "sprite big-portrait"), h("b", null, ch.name)), box, acts);
  let i = 0;
  const finish = (choice?: number) => {
    const out = resolveScene(g, ch, ps, choice);
    app.dirty();
    m.close();
    done(out);
  };
  const step = () => {
    if (i < ps.scene.lines.length) {
      box.append(h("p", { class: "scene-line" }, ps.scene.lines[i++]));
      box.scrollTop = box.scrollHeight;
    }
    acts.replaceChildren();
    if (i < ps.scene.lines.length) acts.append(h("button", { class: "choice", onclick: step }, "▶ Tiếp"));
    else if (ps.scene.choices?.length) ps.scene.choices.forEach((c, k) => acts.append(h("button", { class: "choice", onclick: () => finish(k) }, c.text)));
    else acts.append(h("button", { class: "choice", onclick: () => finish() }, "✔ Kết thúc"));
  };
  step();
}

/** Conversation window with a resident of the sanctuary. */
export function openResident(ch: Character, onClose?: () => void): ModalHandle {
  const g = app.game;
  const p = profileOf(ch);
  const log: Line[] = [];
  let sub: "" | "topic" | "deep" | "flirt" | "date" = "";
  let deep: ReturnType<typeof deepQuestion> = null;
  const m = openModal(`${PERSONAS[p.persona].icon} ${ch.name}`, { wide: true, onClose: () => { app.dirty(); onClose?.(); } });
  const push = (ls: Line[]) => { log.push(...ls); if (log.length > 40) log.splice(0, log.length - 40); };

  const render = () => {
    const b = bondOf(g, ch.id);
    const mood = moodOf(g, ch);
    const left = actsLeft(g, ch);
    const wish = wishOf(g, ch);
    const header = h("div", { class: "row", style: "align-items:flex-start;gap:12px;flex-wrap:nowrap" },
      spriteImg(ch.sprite, ch.pal, "sprite big-portrait"),
      h("div", { class: "grow col", style: "gap:2px" },
        h("div", { class: "small muted" }, `${p.race} · ${JOBS[p.job].name} · ${PERSONAS[p.persona].name} · Tâm trạng ${MOOD_ICONS[mood + 2]}${isBirthday(g, p) ? " · 🎂 Sinh nhật!" : ""}`),
        h("div", { class: "small" }, heartRow(b.fp), ` ${friendTitle(b.fp)}`),
        p.romanceable && !b.closed && (b.rp > 0 || b.stage !== "none") ? h("div", { class: "small" }, heartRow(b.rp, "💗"), b.stage !== "none" ? ` ${STAGE_NAMES[b.stage]}` : " Tình cảm") : null,
        h("div", { class: "small muted" }, `Lượt trò chuyện hôm nay: ${left}/${ACTS_PER_DAY}${b.gift === g.day ? " · đã tặng quà" : ""}`)));
    const box = h("div", { class: "story-box npc-log" }, log.slice(-10).map((l) =>
      h("div", { class: `npc-line ${l.who}` }, l.who === "npc" ? h("b", null, `${p.first}: `) : l.who === "you" ? h("b", null, "Bạn: ") : "", l.text)));
    const acts = h("div", { class: "choices res-acts" });
    const add = (label: string, fn: () => void, disabled = false, cls = "") => acts.append(h("button", { class: `choice ${cls} ${disabled ? "locked" : ""}`, disabled, onclick: fn }, label));
    const say = (you: string | null, lines: Line[]) => { if (you) push([{ who: "you", text: you }]); push(lines); sub = ""; checkScene(); };

    if (sub === "topic") {
      for (const t of topicChoices(g, ch)) {
        const known = b.known.includes(`t:${t}+`) ? " 💖" : b.known.includes(`t:${t}-`) ? " 💢" : "";
        add(`${TOPICS[t].icon} ${TOPICS[t].name}${known}`, () => say(fillAsk(t), talkTopic(g, ch, t)), false, "half");
      }
      add("↩ Thôi", () => { sub = ""; render(); }, false, "half");
    } else if (sub === "deep" && deep) {
      acts.append(h("div", { class: "npc-line" }, h("b", null, `${p.first}: `), deep.q));
      deep.answers.forEach((a, k) => add(`💭 ${a}`, () => { const d = deep!; deep = null; say(a, answerDeep(g, ch, d.idx, k)); }));
    } else if (sub === "flirt") {
      const kt = knownTastes(g, ch);
      for (const s of Object.keys(FLIRT_LINES) as FlirtStyle[]) {
        const tag = kt.style === s ? " 💖" : kt.hateStyle === s ? " 💢" : "";
        add(`${FLIRT_LINES[s].icon} ${FLIRT_LINES[s].name}${tag}`, () => say(null, flirt(g, ch, s)), false, "half");
      }
      add("↩ Thôi", () => { sub = ""; render(); }, false, "half");
    } else if (sub === "date") {
      for (const pl of datePlaces(g)) add(`${DATES[pl].icon} ${DATES[pl].name}`, () => say(`Đi ${DATES[pl].name.toLowerCase()} với tôi nhé?`, goDate(g, ch, pl)), false, "half");
      add("↩ Thôi", () => { sub = ""; render(); }, false, "half");
    } else {
      const tired = left <= 0;
      add("💬 Hỏi thăm", () => say("Hôm nay thế nào?", askMood(g, ch)), tired, "half");
      add("🗨️ Trò chuyện về…", () => { sub = "topic"; render(); }, tired, "half");
      add("😄 Kể chuyện cười", () => say("Nghe này, tôi có chuyện này buồn cười lắm...", tone(g, ch, "joke")), tired, "half");
      add("🌹 Khen ngợi", () => say("Tôi thấy bạn thật sự rất giỏi.", tone(g, ch, "praise")), tired, "half");
      add("📖 Hỏi về quá khứ", () => say("Kể tôi nghe về bạn đi.", askPast(g, ch)), tired, "half");
      add("🗣️ Nghe chuyện Thánh Địa", () => { const l = gossipLine(g, ch); say("Dạo này có chuyện gì không?", l ? [l] : [{ who: "npc", text: "Yên ả lắm, chẳng có gì mới." }]); }, false, "half");
      const dq = heartsOf(b.fp) >= 3 ? deepQuestion(g, ch) : null;
      add(heartsOf(b.fp) < 3 ? "💭 Tâm sự (cần 3 ❤️)" : dq ? "💭 Tâm sự" : "💭 Tâm sự (đã hỏi hết)", () => { deep = dq; sub = "deep"; render(); }, tired || !dq, "half");
      const fl = canFlirt(g, ch);
      if (p.romanceable && !b.closed) add(fl ? `💘 Tán tỉnh (${fl.replace(/\.$/, "")})` : "💘 Tán tỉnh", () => { sub = "flirt"; render(); }, !!fl || tired, "half");
      const dt = canDate(g, ch);
      add(dt ? `🌳 Rủ đi chơi (${dt.replace(/\.$/, "")})` : "🌳 Rủ đi chơi", () => { sub = "date"; render(); }, !!dt || tired, "half");
      add(canGiftRes(g, ch) ? `🎁 Tặng quà${wish ? ` (đang muốn: ${wish.name})` : ""}` : "🎁 Đã tặng quà hôm nay", () => openGift(), !canGiftRes(g, ch), "half");
      if (b.request && !b.request.done) add(`🙏 Giúp ${p.first}: ${b.request.n} ${getItem(b.request.item).name} (có ${g.inventory[b.request.item] ?? 0})`, () => say("Đây, thứ bạn nhờ.", fulfilRequest(g, ch)));
      add("📋 Hồ sơ", () => openProfile(ch), false, "half");
      add("👋 Tạm biệt", () => m.close(), false, "half");
    }
    m.body.replaceChildren(header, box, acts);
    box.scrollTop = box.scrollHeight;
  };

  function fillAsk(t: Topic) {
    const q = TOPICS[t].ask[g.day % TOPICS[t].ask.length];
    return q.replace(/\{You\}/g, "Bạn").replace(/\{you\}/g, "bạn").replace(/\{home\}/g, p.home).replace(/\{deep\}/g, String(g.maxFloor)).replace(/\{other\}/g, "mọi người");
  }

  function checkScene() {
    const ps = pendingScene(g, ch);
    if (ps) { render(); playScene(ch, ps, (lines) => { push(lines); toast(`${ps.scene.title}`, "good"); render(); }); }
    else render();
  }

  function openGift() {
    const gm = openModal("🎁 Chọn quà", { wide: true });
    const items = Object.keys(g.inventory).map(getItem)
      .filter((it) => (g.inventory[it.id] ?? 0) > 0 && (it.type !== "key" || it.tags?.includes("romance")))
      .sort((a, b) => Number(!!b.tags?.includes("romance")) - Number(!!a.tags?.includes("romance")) || b.value - a.value);
    const kt = knownTastes(g, ch);
    const wish = wishOf(g, ch);
    const list = h("div", { class: "list" });
    for (const it of items.slice(0, 120)) {
      const tag = it.id === wish?.id ? "✨ đang thèm" : kt.giftLoves.includes(it.id) ? "💖 rất thích" : kt.giftHates.includes(it.id) ? "💢 ghét" : bondOf(g, ch.id).known.includes(`i:${it.id}~`) ? "· bình thường" : "";
      list.append(h("button", {
        class: "item-row",
        onclick: () => {
          gm.close();
          push([{ who: "you", text: `(Tặng ${it.name})` }]);
          push(giveResGift(g, ch, it.id));
          sub = "";
          checkScene();
        },
      }, h("span", { class: "ico" }, itemImg(it.id)), h("div", { class: "meta" }, h("div", { class: "name" }, it.name, tag ? h("span", { class: "tag" }, tag) : null)), h("span", { class: "qty" }, `×${g.inventory[it.id]}`)));
    }
    if (!items.length) list.append(h("p", { class: "muted" }, "Túi trống."));
    gm.body.append(h("p", { class: "muted small" }, `Mỗi ngày tặng được một món. Quà vào ${birthdayText(p)} (sinh nhật) được quý gấp ba.`), list);
  }

  push(greetResident(g, ch));
  checkScene();
  return m;
}

/** Everything the player has learned about a resident. */
export function openProfile(ch: Character) {
  const g = app.game;
  const p = profileOf(ch);
  const b = bondOf(g, ch.id);
  const kt = knownTastes(g, ch);
  const m = openModal(`📋 ${ch.name}`);
  const row = (k: string, v: string) => h("div", { class: "stat" }, k, h("b", null, v));
  const unknown = "chưa biết";
  m.body.append(
    h("div", { class: "row", style: "gap:12px;align-items:center" }, spriteImg(ch.sprite, ch.pal, "sprite big-portrait"),
      h("div", { class: "col", style: "gap:2px" }, h("b", null, ch.name), h("span", { class: "small muted" }, `${p.race} · ${JOBS[p.job].name} từ ${p.home}`), h("span", { class: "small" }, `${PERSONAS[p.persona].icon} ${PERSONAS[p.persona].name}`))),
    h("div", { class: "col", style: "gap:6px;margin-top:10px" },
      row("Tình bạn", `${friendTitle(b.fp)} · ${heartsOf(b.fp)}/10 ❤️`),
      p.romanceable && !b.closed ? row("Tình cảm", `${heartsOf(b.rp)}/10 💗${b.stage !== "none" ? ` · ${STAGE_NAMES[b.stage]}` : ""}`) : row("Tình cảm", b.closed ? "chỉ là bạn" : "không có ý định yêu đương"),
      row("Sinh nhật", birthdayText(p)),
      row("Thích nói về", kt.loves.length ? kt.loves.map((t) => `${TOPICS[t].icon} ${TOPICS[t].name}`).join(", ") : unknown),
      row("Không thích", kt.dislikes.length ? kt.dislikes.map((t) => `${TOPICS[t].icon} ${TOPICS[t].name}`).join(", ") : unknown),
      row("Quà yêu thích", kt.giftLoves.length ? kt.giftLoves.map((id) => getItem(id).name).join(", ") : unknown),
      row("Quà ghét", kt.giftHates.length ? kt.giftHates.map((id) => getItem(id).name).join(", ") : unknown),
      p.romanceable ? row("Kiểu tán tỉnh ưa thích", kt.style ? FLIRT_LINES[kt.style].name : unknown) : null,
      row("Kỷ niệm", `${kt.dates} buổi đi chơi · ${b.answers.length} lần tâm sự · ${b.events.filter((e) => /^h\d/.test(e)).length}/5 cột mốc`),
      ch.bond ? row("Gắn kết", ch.bond === "beloved" ? "💞 Người Thương (nội tại chiến đấu)" : "🤝 Tri Kỷ (nội tại chiến đấu)") : null,
    ),
    h("p", { class: "muted small" }, "Trò chuyện về nhiều chủ đề, tâm sự và tặng quà để hiểu thêm về họ. Cột mốc ở 2, 4, 6, 8, 10 ❤️ mở ra những câu chuyện riêng."),
  );
}
