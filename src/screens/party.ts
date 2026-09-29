import { app } from "../app";
import { describeSkill, skillCostText } from "../combat/describe";
import { addItem, charPassives, charStats, partySize, passiveSlots, removeItem, skillSlots, type Character } from "../core/state";
import { CLASSES, xpForLevel } from "../data/classes";
import { getItem, type EquipSlot } from "../data/items";
import { getPassive } from "../data/passives";
import { SCHOOL_NAMES, getSkill } from "../data/skills";
import { spriteImg } from "../render/pixel";
import { bar, h, nn, openModal, toast, type ModalHandle } from "../ui/dom";

const SLOT_NAMES: Record<EquipSlot, string> = { weapon: "Vũ khí", armor: "Giáp", accessory: "Trang sức" };
const STAT_NAMES: Record<string, string> = { hp: "Máu", mp: "MP", atk: "Công", mag: "Phép", def: "Thủ", res: "Kháng", spd: "Tốc", crit: "Chí mạng", eva: "Né" };

export function statText(stats: Record<string, number | undefined>): string {
  return Object.entries(stats).filter(([, v]) => v).map(([k, v]) => `${STAT_NAMES[k] ?? k} ${v! > 0 ? "+" : ""}${v}${k === "crit" || k === "eva" ? "%" : ""}`).join(", ");
}

export function openParty(opts: { inDungeon: boolean; onChange?: () => void; select?: string }) {
  const g = app.game;
  const m = openModal("Đội Hình", { wide: true, onClose: () => opts.onChange?.() });
  let current = opts.select ?? g.heroId;
  const render = () => renderParty(m, current, opts.inDungeon, (id) => { current = id; render(); });
  render();
}

function renderParty(m: ModalHandle, currentId: string, inDungeon: boolean, select: (id: string) => void) {
  const g = app.game;
  const ids = [g.heroId, ...Object.keys(g.chars).filter((id) => id !== g.heroId)];
  const ch = g.chars[currentId] ?? g.chars[g.heroId];
  const cls = CLASSES[ch.classId];
  const s = charStats(ch);
  const rerender = () => { app.dirty(); select(ch.id); };

  const tabs = h("div", { class: "char-tabs" }, ids.map((id) => {
    const c = g.chars[id];
    const inParty = g.party.includes(id);
    return h("button", { class: `char-tab ${id === ch.id ? "on" : ""}`, onclick: () => select(id) },
      spriteImg(c.sprite), h("div", null, c.name.split(" ")[0]), h("div", { class: "muted" }, `Lv${c.level}`),
      h("span", { class: `badge ${inParty ? "" : "gray"}` }, inParty ? "Trong đội" : "Dự bị"));
  }));

  const inParty = g.party.includes(ch.id);
  const rosterBtn = ch.id === g.heroId ? null : h("button", {
    class: "btn small",
    disabled: inDungeon,
    onclick: () => {
      if (inParty) g.party = g.party.filter((x) => x !== ch.id);
      else if (g.party.length >= partySize(g)) return toast(`Đội tối đa ${partySize(g)} người. Nâng cấp Nhà Chính để mở thêm chỗ.`, "bad");
      else g.party.push(ch.id);
      rerender();
    },
  }, inParty ? "Cho nghỉ" : "Đưa vào đội");

  const header = h("div", { class: "row", style: "align-items:flex-start;gap:12px" },
    spriteImg(ch.sprite, undefined, "sprite big-portrait"),
    h("div", { class: "grow col", style: "gap:4px" },
      h("div", { class: "row between" }, h("b", { style: "font-size:18px" }, ch.name), rosterBtn),
      h("div", { class: "muted small" }, `${cls.icon} ${cls.name} · Cấp ${ch.level} · ${cls.desc}`),
      bar(ch.hp, s.hp, "hp big", `Máu ${ch.hp}/${s.hp}`),
      bar(ch.mp, s.mp, "mp big", `MP ${ch.mp}/${s.mp}`),
      bar(ch.xp, xpForLevel(ch.level), "xp big", `EXP ${ch.xp}/${xpForLevel(ch.level)}`),
    ),
  );
  const note = inDungeon ? h("p", { class: "muted small" }, "Đang ở trong Vực Sâu: không thể đổi thành viên, nhưng vẫn đổi được trang bị và kỹ năng.") : null;

  const stats = h("div", { class: "grid2" }, (["atk", "mag", "def", "res", "spd", "crit", "eva"] as const).map((k) =>
    h("div", { class: "stat" }, STAT_NAMES[k], h("b", null, `${s[k]}${k === "crit" || k === "eva" ? "%" : ""}`))));

  // gear
  const gear = h("div", { class: "slot-row" }, (["weapon", "armor", "accessory"] as EquipSlot[]).map((slot) => {
    const id = ch.gear[slot];
    const it = id ? getItem(id) : null;
    return h("button", { class: `slot ${it ? "filled" : ""}`, onclick: () => pickGear(ch, slot, rerender) },
      h("div", { class: "muted small" }, SLOT_NAMES[slot]),
      it ? h("div", null, `${it.icon} ${it.name}`) : h("div", { class: "muted" }, "— trống —"),
      it?.equip ? h("div", { class: "small good" }, statText(it.equip.stats), it.equip.passive ? ` · ✦ ${getPassive(it.equip.passive).name}` : "") : null);
  }));

  // skills
  const slots = skillSlots(g);
  const skillList = h("div", { class: "list" }, ch.skills.map((id) => {
    const sk = getSkill(id);
    const on = ch.equipped.includes(id);
    const detail = h("div", { class: "desc hidden" }, describeSkill(sk).join(" "));
    const row = h("div", { class: `item-row ${on ? "sel" : ""}` },
      h("span", { class: "ico" }, sk.icon),
      h("div", { class: "meta" },
        h("div", { class: "name" }, sk.name, h("span", { class: "tag" }, SCHOOL_NAMES[sk.school]), h("span", { class: "tag" }, `Bậc ${sk.tier}`)),
        h("div", { class: "desc" }, skillCostText(sk)), detail),
      h("button", {
        class: `btn small ${on ? "" : "primary"}`,
        onclick: (e: Event) => {
          e.stopPropagation();
          if (on) ch.equipped = ch.equipped.filter((x) => x !== id);
          else if (ch.equipped.length >= slots) return toast(`Tối đa ${slots} kỹ năng. Bỏ bớt một kỹ năng trước.`, "bad");
          else ch.equipped.push(id);
          rerender();
        },
      }, on ? "Bỏ" : "Dùng"));
    row.addEventListener("click", () => detail.classList.toggle("hidden"));
    return row;
  }));

  const pslots = passiveSlots(g);
  const gearPassives = charPassives(ch).filter((p) => !ch.equippedPassives.includes(p));
  const passiveList = h("div", { class: "list" }, ch.passives.map((id) => {
    const p = getPassive(id);
    const on = ch.equippedPassives.includes(id);
    return h("div", { class: `item-row ${on ? "sel" : ""}` },
      h("span", { class: "ico" }, p.icon),
      h("div", { class: "meta" }, h("div", { class: "name" }, p.name), h("div", { class: "desc" }, p.desc)),
      h("button", {
        class: `btn small ${on ? "" : "primary"}`,
        onclick: () => {
          if (on) ch.equippedPassives = ch.equippedPassives.filter((x) => x !== id);
          else if (ch.equippedPassives.length >= pslots) return toast(`Tối đa ${pslots} nội tại.`, "bad");
          else ch.equippedPassives.push(id);
          rerender();
        },
      }, on ? "Bỏ" : "Dùng"));
  }));

  // tomes
  const tomes = Object.keys(g.inventory).map(getItem).filter((it) => it.type === "tome");
  const tomeList = tomes.length ? h("div", { class: "list" }, tomes.map((it) => {
    const known = it.skill ? ch.skills.includes(it.skill) : ch.passives.includes(it.passive!);
    return h("div", { class: "item-row" },
      h("span", { class: "ico" }, it.icon),
      h("div", { class: "meta" }, h("div", { class: "name" }, it.name, h("span", { class: "qty" }, ` ×${g.inventory[it.id]}`)), h("div", { class: "desc" }, it.skill ? describeSkill(getSkill(it.skill)).join(" ") : it.desc)),
      h("button", {
        class: "btn small primary", disabled: known,
        onclick: () => {
          if (!removeItem(g, it.id, 1)) return;
          if (it.skill) { ch.skills.push(it.skill); if (ch.equipped.length < slots) ch.equipped.push(it.skill); }
          else if (it.passive) { ch.passives.push(it.passive); if (ch.equippedPassives.length < pslots) ch.equippedPassives.push(it.passive); }
          toast(`${ch.name} đã học ${it.name.replace(/^.*?: /, "")}!`, "good");
          rerender();
        },
      }, known ? "Đã biết" : "Học"));
  })) : null;

  m.body.replaceChildren(...nn(
    tabs, header, note,
    h("div", { class: "section-title" }, "Chỉ số"), stats,
    h("div", { class: "section-title" }, "Trang bị"), gear,
    h("div", { class: "section-title" }, `Kỹ năng (${ch.equipped.length}/${slots} đang dùng)`),
    h("p", { class: "muted small", style: "margin:0 0 6px" }, "Chạm vào kỹ năng để xem chi tiết. Tấn công và Phòng thủ luôn có sẵn."),
    skillList,
    h("div", { class: "section-title" }, `Nội tại (${ch.equippedPassives.length}/${pslots})`),
    passiveList,
    gearPassives.length ? h("p", { class: "muted small" }, `Từ trang bị: ${gearPassives.map((p) => getPassive(p).name).join(", ")}`) : null,
    tomeList ? h("div", { class: "section-title" }, "Học từ sách") : null,
    tomeList,
  ));
}

function pickGear(ch: Character, slot: EquipSlot, done: () => void) {
  const g = app.game;
  const m = openModal(`${SLOT_NAMES[slot]} — ${ch.name}`);
  const items = Object.keys(g.inventory).map(getItem).filter((it) => it.equip?.slot === slot);
  const cur = ch.gear[slot];
  const list = h("div", { class: "list" });
  if (cur) {
    list.append(h("button", { class: "item-row", onclick: () => { addItem(g, cur, 1); delete ch.gear[slot]; clampVitals(ch); m.close(); done(); } },
      h("span", { class: "ico" }, "↩️"), h("div", { class: "meta" }, h("div", { class: "name" }, `Tháo ${getItem(cur).name}`))));
  }
  for (const it of items) {
    list.append(h("button", {
      class: "item-row",
      onclick: () => {
        if (!removeItem(g, it.id, 1)) return;
        if (cur) addItem(g, cur, 1);
        ch.gear[slot] = it.id;
        clampVitals(ch);
        m.close();
        done();
      },
    }, h("span", { class: "ico" }, it.icon),
    h("div", { class: "meta" }, h("div", { class: "name" }, it.name, h("span", { class: "qty" }, ` ×${g.inventory[it.id]}`)),
      h("div", { class: "desc good" }, statText(it.equip!.stats), it.equip!.passive ? ` · ✦ ${getPassive(it.equip!.passive).name}: ${getPassive(it.equip!.passive).desc}` : ""))));
  }
  if (!items.length && !cur) list.append(h("p", { class: "muted" }, "Chưa có trang bị nào cho ô này. Hãy rèn ở Lò Rèn hoặc tìm trong Vực Sâu."));
  m.body.append(list);
}

function clampVitals(ch: Character) {
  const s = charStats(ch);
  ch.hp = Math.min(ch.hp, s.hp);
  ch.mp = Math.min(ch.mp, s.mp);
}
