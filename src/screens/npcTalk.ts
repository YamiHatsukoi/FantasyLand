import { app } from "../app";
import { sfx } from "../audio/sfx";
import { SEASON_NAMES, getItem, seasonOf } from "../data/items";
import { howToGet, outOfSeason } from "../world/sources";
import { JOBS, PERSONAS, REPLY_TOPICS } from "../data/npcText";
import { spriteImg } from "../render/pixel";
import { h, nn, openModal, toast, type ModalHandle } from "../ui/dom";
import { giftPicker } from "../ui/giftPick";
import { Dialogue, type DlgChoice } from "../ui/dialogue";
import { lootChips } from "../ui/icon";
import {
  AFF_NAMES, acceptQuest, activeQuest, affTier, askAbout, canGift, chat, completeQuest, doRecruit, giftTier, giveGift, greet,
  hearts, memOf, questFor, questGoal, questProgress, questText, recruitCheck, recruitText, reply, tasteHint, type NpcDef, type Tone,
} from "../world/people";

/** Conversation window with a generated NPC. */
export function openNpc(npc: NpcDef, onClose?: () => void) {
  const g = app.game;
  const ctx = { g, npc };
  const d = new Dialogue({
    name: npc.name, title: `${npc.race} · ${JOBS[npc.job].icon} ${JOBS[npc.job].name} · ${npc.town}`,
    portrait: spriteImg(npc.sprite, npc.pal, "sprite"), onClose: () => { app.dirty(); onClose?.(); },
  });
  const m = { close: () => d.close() };
  const say = (text: string) => d.say(text);
  const you = (text: string) => d.you(text);
  const sys = (text: string) => d.note(text);
  for (const line of greet(ctx)) say(line);

  const render = () => {
    const mem = memOf(g, npc.id);
    const q = activeQuest(g, npc.id);
    const recruited = !!mem.recruited || !!g.chars[`npc_${npc.id}`];
    d.setInfo(
      h("span", null, `${hearts(mem.aff)} ${AFF_NAMES[affTier(mem.aff)]} · ${mem.aff}`),
      h("span", null, `${PERSONAS[npc.persona].icon} ${PERSONAS[npc.persona].name} · Cấp ${npc.level}`),
      h("span", { class: "muted" }, tasteHint(g, npc)));
    const list: DlgChoice[] = [];
    const add = (label: string, fn: () => void, disabled = false, tone?: DlgChoice["tone"], hint?: string) => {
      const [icon, ...rest] = label.split(" ");
      const emoji = /\p{Extended_Pictographic}/u.test(icon);
      list.push({ icon: emoji ? icon : undefined, label: emoji ? rest.join(" ") : label, onPick: fn, disabled, tone, hint });
    };

    add("💬 Trò chuyện", () => { you("Dạo này thế nào?"); say(chat(ctx)); render(); });
    add("📖 Hỏi về bản thân họ", () => { you("Kể tôi nghe về bạn đi."); const r = askAbout(ctx); say(r.text); render(); });
    const toneOf = (t: Tone) => REPLY_TOPICS[t][g.day % REPLY_TOPICS[t].length].replace("{town}", npc.town);
    for (const t of ["joke", "flatter", "rude"] as Tone[]) {
      add(`${t === "joke" ? "😄" : t === "flatter" ? "🌹" : "😠"} ${toneOf(t)}`, () => {
        you(toneOf(t));
        const r = reply(ctx, t);
        say(r.text);
        if (r.delta) sys(`Thiện cảm ${r.delta > 0 ? "+" : ""}${r.delta}`);
        render();
      });
    }
    add(canGift(g, npc) ? "🎁 Tặng quà" : "🎁 Tặng quà (đã tặng hôm nay)", () => openGift(), !canGift(g, npc));
    // quests
    if (q) {
      const pr = questProgress(g, q, npc);
      add(`📋 ${pr.ok ? "Báo cáo hoàn thành" : "Việc đang làm"}: ${questGoal(q, npc)} (${pr.have}/${pr.need})`, () => {
        const done = completeQuest(ctx);
        if (done) {
          you("Tôi đã làm xong việc bạn nhờ.");
          say(done);
          sys(`Nhận ${q.reward.gold} vàng và ${Object.entries(q.reward.items).map(([id, n]) => `${getItem(id).name} ×${n}`).join(", ")}. Thiện cảm +15`);
          toast("✅ Hoàn thành nhiệm vụ!", "good");
          app.checkpoint();
        } else {
          say(["Việc tôi nhờ tới đâu rồi?", "Đừng quên lời hứa nhé.", "Tôi vẫn đang chờ đây."][mem.talks % 3]);
          if (q.item) for (const line of whereHint(q.item)) sys(line);
        }
        render();
      });
    } else if (affTier(mem.aff) >= 1 || mem.talks >= 3) {
      add("📋 Có việc gì cần giúp không?", () => {
        const nq = questFor(g, npc);
        you("Có việc gì tôi giúp được không?");
        say(questText(ctx, nq));
        const qm = openModal("📋 Lời nhờ vả");
        qm.body.append(...nn(
          h("p", null, `Mục tiêu: ${questGoal(nq, npc)}`),
          nq.item ? h("div", { class: "quest-where" }, whereHint(nq.item).map((l) => h("div", { class: "small" }, l))) : null,
          h("p", { class: "small" }, `Phần thưởng: 💰 ${nq.reward.gold}`),
          h("div", { class: "loot", style: "justify-content:flex-start" }, lootChips(nq.reward.items)),
          h("div", { class: "row end" },
            h("button", { class: "btn", onclick: () => { qm.close(); say("Không sao, lúc khác vậy."); memOf(g, npc.id).aff -= 1; render(); } }, "Từ chối"),
            h("button", { class: "btn primary", onclick: () => { qm.close(); acceptQuest(g, npc); sys(`Đã nhận việc: ${questGoal(nq, npc)}`); render(); } }, "Nhận việc"))));
      });
    }
    // recruit
    if (!recruited) {
      const chk = recruitCheck(g, npc);
      if (npc.recruitable) {
        add(`🤝 Mời gia nhập đội${chk.wage ? ` (tiền công ${chk.wage} vàng)` : ""}`, () => {
          you("Bạn có muốn đi phiêu lưu cùng tôi không?");
          const again = recruitCheck(g, npc);
          if (!again.ok) {
            say(recruitText(npc, false));
            sys(again.reason);
            if (npc.persona === "proud" && again.reason.startsWith("Cần thiện cảm")) memOf(g, npc.id).aff -= 1;
          } else {
            const ch = doRecruit(g, npc);
            say(recruitText(npc, true));
            if (ch) {
              sys(`🤝 ${ch.name} gia nhập${g.party.includes(ch.id) ? " đội" : " — đang đợi ở Thánh Địa (đội chỉ mang 3 người cùng bạn)"}.`);
              toast(`${ch.name} đã gia nhập!`, "good");
              app.checkpoint();
            }
          }
          render();
        });
      }
    } else add("🤝 Đã là đồng đội của bạn", () => undefined, true);
    add("👋 Tạm biệt", () => m.close());
    d.choices(list);
  };

  /** Where the item a quest asks for can be had, and a warning when its seeds are out of season. */
  function whereHint(item: string): string[] {
    const lines = howToGet(item);
    if (outOfSeason(item, seasonOf(g.day))) lines.unshift(`⚠️ Đang là mùa ${SEASON_NAMES[seasonOf(g.day)]}: tiệm chưa bán hạt này. Chờ tới mùa của nó (hạt mua sẵn thì trồng Nhà Kính được quanh năm)`);
    return lines.length ? lines : ["❔ Chưa rõ kiếm ở đâu: hỏi thăm dân làng hoặc thám hiểm thêm"];
  }

  function openGift() {
    const gm = openModal("🎁 Chọn quà", { wide: true });
    const tier = affTier(memOf(g, npc.id).aff);
    const picker = giftPicker(g, {
      allow: (it) => it.type !== "key",
      rank: (it) => Number(npc.loves.includes(it.id)),
      tag: (it) => {
        const known = tier >= 2 ? giftTier(npc, it.id) : tier >= 1 && npc.likes.includes(it.type) ? "like" : null;
        return known === "love" ? "💖 rất thích" : known === "like" ? "👍 thích" : known === "hate" ? "💢 ghét" : null;
      },
      pick: (it) => {
        gm.close();
        sfx("gift");
        you(`(Tặng ${it.name})`);
        const r = giveGift({ g, npc }, it.id);
        say(r.text);
        sys(`Thiện cảm ${r.delta > 0 ? "+" : ""}${r.delta}`);
        render();
      },
    });
    gm.body.append(picker);
  }

  render();
  return { el: d.root, body: d.root, close: () => d.close(), setTitle: () => undefined } as ModalHandle;
}
