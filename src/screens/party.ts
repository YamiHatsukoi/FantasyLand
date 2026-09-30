import { app } from "../app";
import { describeSkill, skillCostText } from "../combat/describe";
import { GEAR_KEYS, POINTS_PER_LEVEL, POINT_CAP, POINT_VALUE, addItem, allocPoint, resetCost, resetPoints, charPassives, charStats, dualWielding, equipGear, fitsGear, isTwoHanded, syncLook, partySize, passiveSlots, removeItem, skillSlots, type Character } from "../core/state";
import { CLASSES, xpForLevel } from "../data/classes";
import { getItem, type GearKey, type ItemDef } from "../data/items";
import { getPassive } from "../data/passives";
import { SCHOOL_NAMES, getSkill } from "../data/skills";
import { spriteImg } from "../render/pixel";
import { bar, confirmBox, h, nn, openModal, toast, type ModalHandle } from "../ui/dom";
import { itemImg } from "../ui/icon";
import { GEAR_ICONS, GEAR_NAMES, gearTags, rarityClass, scaleStats, statDiff } from "../ui/gear";
import { autoEquip, planBestGear } from "../ui/smart";
import { openAppearance } from "./appearance";

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
  const ids = [g.heroId, ...g.party.filter((id) => id !== g.heroId), ...Object.keys(g.chars).filter((id) => id !== g.heroId && !g.party.includes(id)).sort((a, b) => g.chars[b].level - g.chars[a].level)];
  const ch = g.chars[currentId] ?? g.chars[g.heroId];
  const cls = CLASSES[ch.classId];
  const s = charStats(ch);
  const rerender = () => { app.dirty(); select(ch.id); };

  const tabs = h("div", { class: "char-tabs" }, ids.map((id) => {
    const c = g.chars[id];
    const inParty = g.party.includes(id);
    return h("button", { class: `char-tab ${id === ch.id ? "on" : ""}`, onclick: () => select(id) },
      spriteImg(c.sprite, c.pal), h("div", null, c.name.split(" ")[0]), h("div", { class: "muted" }, `Lv${c.level}`),
      h("span", { class: `badge ${inParty ? "" : "gray"}` }, inParty ? "Trong đội" : "Dự bị"));
  }));

  const inParty = g.party.includes(ch.id);
  const rosterBtn = ch.id === g.heroId ? null : h("button", {
    class: "btn small",
    disabled: inDungeon,
    onclick: () => {
      if (inParty) g.party = g.party.filter((x) => x !== ch.id);
      else if (g.party.length >= partySize(g)) return toast(`Đội mang theo tối đa ${partySize(g)} người (bạn + ${partySize(g) - 1} đồng đội). Cho một người nghỉ trước.`, "bad");
      else g.party.push(ch.id);
      rerender();
    },
  }, inParty ? "Cho nghỉ" : "Đưa vào đội");

  const header = h("div", { class: "row", style: "align-items:flex-start;gap:12px" },
    spriteImg(ch.sprite, ch.pal, "sprite big-portrait"),
    h("div", { class: "grow col", style: "gap:4px" },
      h("div", { class: "row between" }, h("b", { style: "font-size:18px" }, ch.name), h("div", { class: "row" }, h("button", { class: "btn small", onclick: () => openAppearance(ch, rerender) }, "🎨 Ngoại hình"), rosterBtn)),
      h("div", { class: "muted small" }, `${cls.icon} ${cls.name} · Cấp ${ch.level} · ${cls.desc}`),
      ch.bio ? h("div", { class: "small" }, ch.bio) : null,
      bar(ch.hp, s.hp, "hp big", `Máu ${ch.hp}/${s.hp}`),
      bar(ch.mp, s.mp, "mp big", `MP ${ch.mp}/${s.mp}`),
      bar(ch.xp, xpForLevel(ch.level), "xp big", `EXP ${ch.xp}/${xpForLevel(ch.level)}`),
    ),
  );
  const note = inDungeon ? h("p", { class: "muted small" }, "Đang ở trong Vực Sâu: không thể đổi thành viên, nhưng vẫn đổi được trang bị và kỹ năng.") : null;

  // the hero spends stat points earned on level-up
  const isHero = ch.id === g.heroId;
  const pts = isHero ? ch.points ?? 0 : 0;
  const statKeys = isHero ? (["hp", "mp", "atk", "mag", "def", "res", "spd", "crit", "eva"] as const) : (["atk", "mag", "def", "res", "spd", "crit", "eva"] as const);
  const stats = h("div", { class: "grid2" }, statKeys.map((k) => {
    const spent = ch.alloc?.[k] ?? 0;
    const capped = POINT_CAP[k] !== undefined && spent >= POINT_CAP[k]!;
    return h("div", { class: "stat" }, STAT_NAMES[k],
      h("span", { class: "row", style: "gap:6px;flex-wrap:nowrap" },
        spent ? h("span", { class: "small good" }, `+${spent * POINT_VALUE[k]}`) : null,
        h("b", null, `${s[k]}${k === "crit" || k === "eva" ? "%" : ""}`),
        isHero && pts > 0 ? h("button", { class: "btn small primary pt-btn", disabled: capped, title: `1 điểm = +${POINT_VALUE[k]} ${STAT_NAMES[k]}`, onclick: () => { if (allocPoint(ch, k)) { clampVitals(ch); rerender(); } } }, "+") : null));
  }));
  const pointsBar = isHero ? h("div", { class: "row between", style: "margin:4px 0" },
    h("span", { class: pts ? "gold" : "muted small" }, pts ? `✨ ${pts} điểm chỉ số chưa dùng (+${POINTS_PER_LEVEL} mỗi cấp)` : `Mỗi lần lên cấp nhận ${POINTS_PER_LEVEL} điểm chỉ số.`),
    Object.keys(ch.alloc ?? {}).length ? h("button", {
      class: "btn small",
      onclick: async () => {
        const cost = resetCost(ch);
        if (!(await confirmBox("Tẩy điểm", `Lấy lại toàn bộ điểm đã phân bổ với giá ${cost} vàng?`, "Tẩy điểm"))) return;
        if (g.gold < cost) return toast(`Cần ${cost} vàng.`, "bad");
        g.gold -= cost; resetPoints(ch); clampVitals(ch); rerender();
      },
    }, `↺ Tẩy điểm (${resetCost(ch)}💰)`) : null) : null;

  // gear (⬆ marks slots where the bag holds something better)
  const plan = planBestGear(g, ch);
  const better = new Set(plan.map((p) => p.key));
  const gearTitle = h("div", { class: "row between", style: "margin:12px 0 6px" },
    h("div", { class: "section-title", style: "margin:0" }, "Trang bị"),
    h("div", { class: "row" },
      h("button", {
        class: `btn small ${plan.length ? "primary" : ""}`, disabled: !plan.length, title: "Tự chọn đồ mạnh nhất trong túi cho nhân vật này",
        onclick: () => { const n = autoEquip(g, ch); toast(`⚡ Đã thay ${n} món cho ${ch.name.split(" ")[0]}.`, "good"); rerender(); },
      }, plan.length ? `⚡ Tối ưu (${plan.length})` : "✓ Đồ tốt nhất"),
      h("button", {
        class: "btn small", title: "Tối ưu trang bị cho cả đội (người đứng trước được chọn trước)",
        onclick: () => { let n = 0; for (const id of g.party) n += autoEquip(g, g.chars[id]); toast(n ? `⚡ Đã thay ${n} món cho cả đội.` : "Cả đội đang dùng đồ tốt nhất.", n ? "good" : "info"); rerender(); },
      }, "⚡ Cả đội")));
  const gear = h("div", { class: "gear-grid" }, GEAR_KEYS.map((key) => {
    const id = ch.gear[key];
    const it = id ? getItem(id) : null;
    const locked = key === "offhand" && !it && isTwoHanded(ch.gear.weapon);
    return h("button", { class: `slot ${it ? "filled" : ""}`, onclick: () => pickGear(ch, key, rerender) },
      h("div", { class: "muted small" }, `${GEAR_ICONS[key]} ${GEAR_NAMES[key]}`, better.has(key) ? h("span", { class: "up-dot", title: "Trong túi có đồ tốt hơn" }, " ⬆") : null),
      it ? h("div", { class: "row", style: "gap:6px;flex-wrap:nowrap" }, itemImg(it.id), h("span", { class: `gname ${rarityClass(it)}` }, it.name))
        : h("div", { class: "muted" }, locked ? "(vũ khí hai tay)" : "— trống —"),
      it?.equip ? h("div", { class: "small good" }, statText(key === "offhand" && it.equip.slot === "weapon" ? scaleStats(it.equip.stats, 0.5) : it.equip.stats), it.equip.passive ? ` · ✦ ${getPassive(it.equip.passive).name}` : "") : null);
  }));
  const dualNote = dualWielding(ch) ? h("p", { class: "muted small" }, "⚔️⚔️ Song kiếm: vũ khí tay trái tính 50% chỉ số, đòn Tấn công thường chém thêm một nhát (50% sát thương).") : null;

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
      h("span", { class: "ico" }, itemImg(it.id)),
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
    h("div", { class: "section-title" }, "Chỉ số"), pointsBar, stats,
    gearTitle, gear, dualNote,
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

function pickGear(ch: Character, key: GearKey, done: () => void) {
  const g = app.game;
  const m = openModal(`${GEAR_NAMES[key]} — ${ch.name}`, { wide: true });
  const cur = ch.gear[key];
  const eff = (it: ItemDef, k: GearKey) => (k === "offhand" && it.equip!.slot === "weapon" ? scaleStats(it.equip!.stats, 0.5) : it.equip!.stats);
  const curStats = cur ? eff(getItem(cur), key) : {};
  const items = Object.keys(g.inventory).filter((id) => fitsGear(key, id)).map(getItem)
    .sort((a, b) => (b.equip!.floor ?? (b.tier ?? 0) * 8) - (a.equip!.floor ?? (a.tier ?? 0) * 8) || b.value - a.value);
  const list = h("div", { class: "list" });
  const finish = (back: string[]) => {
    for (const x of back) addItem(g, x, 1);
    if (back.length) toast(`Đã tháo: ${back.map((x) => getItem(x).name).join(", ")}`);
    syncLook(ch); clampVitals(ch); m.close(); done();
  };
  if (cur) {
    list.append(h("button", { class: "item-row", onclick: () => { delete ch.gear[key]; finish([cur]); } },
      h("span", { class: "ico" }, "↩️"), h("div", { class: "meta" }, h("div", { class: "name" }, `Tháo ${getItem(cur).name}`))));
  }
  if (key === "offhand" && isTwoHanded(ch.gear.weapon)) list.append(h("p", { class: "muted small" }, `Đang cầm ${getItem(ch.gear.weapon!).name} bằng hai tay — trang bị tay phụ sẽ tháo vũ khí này.`));
  if (key === "offhand") list.append(h("p", { class: "muted small" }, "Tay phụ nhận khiên, ma thư, quả cầu phép, hoặc một vũ khí một tay để chơi song kiếm."));
  for (const it of items) {
    const d = statDiff(curStats, eff(it, key));
    const diff = Object.entries(d).map(([k, v]) => h("span", { class: v! > 0 ? "diff-up" : "diff-down" }, ` ${statText({ [k]: v })}`));
    let warn = "";
    if (key === "weapon" && it.equip!.hands === 2 && ch.gear.offhand) warn = ` · sẽ tháo ${getItem(ch.gear.offhand).name}`;
    if (key === "offhand" && isTwoHanded(ch.gear.weapon)) warn = ` · sẽ tháo ${getItem(ch.gear.weapon!).name}`;
    list.append(h("button", {
      class: "item-row",
      onclick: () => {
        if (!removeItem(g, it.id, 1)) return;
        finish(equipGear(ch, key, it.id));
      },
    }, h("span", { class: "ico" }, itemImg(it.id)),
    h("div", { class: "meta" },
      h("div", { class: "name" }, h("span", { class: rarityClass(it) }, it.name), h("span", { class: "qty" }, ` ×${g.inventory[it.id]}`)),
      h("div", { class: "desc muted" }, gearTags(it).join(" · "), warn),
      h("div", { class: "desc good" }, statText(eff(it, key)), it.equip!.passive ? ` · ✦ ${getPassive(it.equip!.passive).name}: ${getPassive(it.equip!.passive).desc}` : ""),
      cur && diff.length ? h("div", { class: "desc" }, "So với đang dùng:", ...diff) : null)));
  }
  if (!items.length && !cur) list.append(h("p", { class: "muted" }, "Chưa có trang bị nào cho ô này. Hãy rèn ở Lò Rèn / Xưởng May, mua ở thị trấn hoặc tìm trong Vực Sâu."));
  m.body.append(list);
}

function clampVitals(ch: Character) {
  const s = charStats(ch);
  ch.hp = Math.min(ch.hp, s.hp);
  ch.mp = Math.min(ch.mp, s.mp);
}
