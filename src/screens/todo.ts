import { app } from "../app";
import { charStats, type GameState } from "../core/state";
import { getItem } from "../data/items";
import { h, openModal, toast } from "../ui/dom";
import { autoEquip, planBestGear } from "../ui/smart";
import { activeQuest, getNpc, questGoal, questProgress } from "../world/people";
import { isBirthday, profileOf, residents, sceneReady } from "../world/residents";
import { allPlots, isReady } from "../world/town";
import { harvestMany } from "./buildingPanels";
import { openParty } from "./party";

/**
 * "What should I do next?" — a short, always-current list of things in the sanctuary that
 * want attention, each with a one-tap action where one makes sense.
 */

export interface Todo {
  icon: string;
  text: string;
  /** Counts towards the dock badge (something the player can act on right now). */
  act?: { label: string; run: () => void };
  kind: "farm" | "party" | "resident" | "quest" | "rest" | "tome";
}

export interface TodoHooks {
  talkTo: (id: string) => void;
  refresh: () => void;
}

export function todoList(g: GameState, hooks: TodoHooks): Todo[] {
  const out: Todo[] = [];
  const ripe = allPlots(g).filter((p) => isReady(p.plot.crop));
  if (ripe.length) out.push({ kind: "farm", icon: "🌾", text: `${ripe.length} ô ruộng đã chín.`, act: { label: "🧺 Thu hoạch hết", run: () => { harvestMany(ripe.map((p) => p.plot)); hooks.refresh(); } } });
  const dry = allPlots(g).filter((p) => p.plot.crop && !isReady(p.plot.crop) && !p.plot.watered && !p.greenhouse).length;
  if (dry) out.push({ kind: "farm", icon: "💧", text: `${dry} ô ruộng chưa được tưới hôm nay.` });

  const hero = g.chars[g.heroId];
  if ((hero.points ?? 0) > 0) out.push({ kind: "party", icon: "✨", text: `${hero.name} còn ${hero.points} điểm chỉ số chưa phân bổ.`, act: { label: "Phân bổ", run: () => openParty({ inDungeon: false, select: g.heroId, onChange: hooks.refresh }) } });
  const ups = g.party.map((id) => ({ id, n: planBestGear(g, g.chars[id]).length })).filter((x) => x.n);
  if (ups.length) out.push({
    kind: "party", icon: "⚡", text: `Trong túi có đồ tốt hơn cho ${ups.map((x) => g.chars[x.id].name.split(" ")[0]).join(", ")}.`,
    act: { label: "Tối ưu cả đội", run: () => { let n = 0; for (const x of ups) n += autoEquip(g, g.chars[x.id]); app.dirty(); toast(`⚡ Đã thay ${n} món.`, "good"); hooks.refresh(); } },
  });
  const tomes = Object.keys(g.inventory).filter((id) => getItem(id).type === "tome").length;
  if (tomes) out.push({ kind: "tome", icon: "📕", text: `${tomes} cuốn sách kỹ năng chưa học.`, act: { label: "Mở Đội Hình", run: () => openParty({ inDungeon: false, onChange: hooks.refresh }) } });
  const hurt = g.party.some((id) => { const c = g.chars[id]; const s = charStats(c); return c.hp < s.hp * 0.6; });
  if (hurt) out.push({ kind: "rest", icon: "🛏️", text: "Đội đang bị thương — ngủ ở Nhà Chính để qua ngày và hồi phục." });

  for (const ch of residents(g)) {
    if (sceneReady(g, ch)) out.push({ kind: "resident", icon: "❗", text: `${ch.name.split(" ")[0]} có chuyện muốn nói với bạn.`, act: { label: "Tới gặp", run: () => hooks.talkTo(ch.id) } });
    else if (isBirthday(g, profileOf(ch))) out.push({ kind: "resident", icon: "🎂", text: `Hôm nay là sinh nhật ${ch.name.split(" ")[0]}!`, act: { label: "Tới chúc mừng", run: () => hooks.talkTo(ch.id) } });
  }

  for (const id of Object.keys(g.npcs)) {
    const q = activeQuest(g, id);
    if (!q) continue;
    const npc = getNpc(id);
    const pr = questProgress(g, q, npc);
    if (pr.ok) out.push({ kind: "quest", icon: "📋", text: `Việc nhờ của ${npc.name} (tầng ${npc.floor}) đã xong: ${questGoal(q, npc)}. Hãy quay lại báo cáo.` });
  }
  return out;
}

export const todoBadge = (list: Todo[]) => list.filter((t) => t.act).length;

export function openTodo(hooks: TodoHooks) {
  const m = openModal("📌 Việc Cần Làm", { onClose: hooks.refresh });
  const render = () => {
    const list = todoList(app.game, { ...hooks, refresh: () => { render(); hooks.refresh(); }, talkTo: (id) => { m.close(); hooks.talkTo(id); } });
    const body = h("div", { class: "list" }, list.map((t) => h("div", { class: "item-row todo-row" },
      h("span", { class: "ico" }, t.icon),
      h("div", { class: "meta" }, h("div", { class: "name" }, t.text)),
      t.act ? h("button", { class: "btn small primary", onclick: () => t.act!.run() }, t.act.label) : null)));
    if (!list.length) body.append(h("p", { class: "muted" }, "Mọi thứ đều ổn. Có lẽ đã tới lúc xuống Vực Sâu rồi. 🌀"));
    m.body.replaceChildren(h("p", { class: "muted small", style: "margin-top:0" }, "Những việc đang chờ ở Thánh Địa. Danh sách tự cập nhật."), body);
  };
  render();
}
