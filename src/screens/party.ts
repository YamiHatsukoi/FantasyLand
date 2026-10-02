import { app } from "../app";
import { describeSkill, skillCostText, passiveText } from "../combat/describe";
import { openClassChange } from "./classChange";
import { GEAR_KEYS, POINTS_PER_LEVEL, activePets, petLimit, POINT_CAP, POINT_VALUE, addItem, allocPoint, resetCost, resetPoints, classChangeCost, dismiss, charPassives, charStats, dualWielding, equipGear, fitsGear, isTwoHanded, syncLook, partySize, passiveSlots, removeItem, skillSlots, type Character } from "../core/state";
import { TRAITS } from "../data/classTraits";
import { CLASSES, COMPANIONS, xpForLevel } from "../data/classes";
import { enhLevel, getItem, type GearKey, type ItemDef } from "../data/items";
import { getPassive } from "../data/passives";
import { getSkill } from "../data/skills";
import { spriteImg } from "../render/pixel";
import { bar, confirmBox, h, nn, openModal, toast, type ModalHandle } from "../ui/dom";
import { itemImg } from "../ui/icon";
import { GEAR_ICONS, GEAR_NAMES, gearTags, rarityClass, scaleStats, statDiff } from "../ui/gear";
import { planBestGear } from "../ui/smart";
import { itemTip, passiveTip, skillTip } from "../ui/tooltip";
import { critChance, dodgeChance, pctLabel } from "../combat/rates";
import { openAppearance } from "./appearance";
import { PET, PETS, PET_EGG, petSpec } from "../data/pets";
import { creatureCanvas } from "../render/creatures";

const STAT_NAMES: Record<string, string> = { hp: "Máu", mp: "MP", atk: "Công", mag: "Phép", def: "Thủ", res: "Kháng", spd: "Tốc", crit: "Chí mạng", eva: "Né" };

export function statText(stats: Record<string, number | undefined>): string {
  return Object.entries(stats).filter(([, v]) => v).map(([k, v]) => `${STAT_NAMES[k] ?? k} ${v! > 0 ? "+" : ""}${v}`).join(", ");
}

type PartyTab = "gear" | "stats" | "skills" | "passives" | "pets";
let partyTab: PartyTab = "gear";

export function openParty(opts: { inDungeon: boolean; onChange?: () => void; select?: string }) {
  const g = app.game;
  const m = openModal("Đội Hình", { wide: true, cls: "no-autosearch", onClose: () => opts.onChange?.() });
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
    return h("button", { class: `char-tab ${id === ch.id ? "on" : ""} ${inParty ? "in-party" : ""}`, title: inParty ? "Trong đội" : "Dự bị", onclick: () => select(id) },
      spriteImg(c.sprite, c.pal), h("div", null, c.name.split(" ")[0]), h("div", { class: "muted" }, `Lv${c.level}`));
  }));

  const inParty = g.party.includes(ch.id);
  const rosterBtn = ch.id === g.heroId ? null : h("button", {
    class: "btn small",
    disabled: inDungeon,
    title: inDungeon ? "Không đổi thành viên khi đang ở Vực Sâu" : "",
    onclick: () => {
      if (inParty) g.party = g.party.filter((x) => x !== ch.id);
      else if (g.party.length >= partySize(g)) return toast(`Đội tối đa ${partySize(g)} người. Cho một người nghỉ trước.`, "bad");
      else g.party.push(ch.id);
      rerender();
    },
  }, inParty ? "➖ Cho nghỉ" : "➕ Vào đội");
  // story companions stay for good; anyone else can be sent off to free a bed
  const dismissBtn = ch.id === g.heroId || COMPANIONS[ch.id] ? null : h("button", {
    class: "btn small danger", disabled: inDungeon, title: inDungeon ? "Không tiễn ai khi đang ở Vực Sâu" : "Rời Thánh Địa, trả lại trang bị, giải phóng một chỗ ở",
    onclick: async () => {
      const home = ch.origin ? " Họ sẽ về lại làng cũ, sau này có thể mời lại." : " Người này sẽ ra đi hẳn.";
      if (!(await confirmBox("Tiễn biệt", `Tiễn ${ch.name} rời Thánh Địa? Trang bị đang mặc sẽ cất vào túi.${home}`, "Tiễn biệt"))) return;
      if (dismiss(g, ch.id)) { toast(`${ch.name} đã lên đường. Còn trống thêm một chỗ ở.`); app.dirty(); select(g.heroId); }
    },
  }, "👋 Tiễn biệt");

  const header = h("div", { class: "party-head" },
    spriteImg(ch.sprite, ch.pal, "sprite big-portrait"),
    h("div", { class: "grow col", style: "gap:3px;min-width:0" },
      h("div", { class: "row between", style: "flex-wrap:nowrap" },
        h("div", { style: "min-width:0" }, h("b", { style: "font-size:17px" }, ch.name), h("div", { class: "muted small" }, `${cls.icon} ${cls.name} · Cấp ${ch.level}`),
          TRAITS[ch.classId] ? h("div", { class: "trait-chip", title: TRAITS[ch.classId].desc }, `${TRAITS[ch.classId].icon} ${TRAITS[ch.classId].name}: `, h("span", { class: "muted" }, TRAITS[ch.classId].desc)) : null),
        h("div", { class: "row", style: "flex-wrap:nowrap" }, h("button", { class: "icon-btn", title: "Ngoại hình", onclick: () => openAppearance(ch, rerender) }, "🎨"),
          ch.id === g.heroId ? h("button", { class: "icon-btn", title: inDungeon ? "Về Thánh Địa để chuyển nghề" : "Chuyển nghề", disabled: inDungeon, onclick: () => openClassChange(ch, rerender) }, "🔄") : null,
          rosterBtn, dismissBtn)),
      bar(ch.hp, s.hp, "hp", `${ch.hp}/${s.hp}`),
      bar(ch.mp, s.mp, "mp", `${ch.mp}/${s.mp}`),
      bar(ch.xp, xpForLevel(ch.level), "xp", `EXP ${ch.xp}/${xpForLevel(ch.level)}`),
    ),
  );

  // ---- section tabs
  const isHero = ch.id === g.heroId;
  const pts = isHero ? ch.points ?? 0 : 0;
  const slots = skillSlots(g, ch);
  const pslots = passiveSlots(g, ch);
  const plan = planBestGear(g, ch);
  const better = new Set(plan.map((p) => p.key));
  const tomes = Object.keys(g.inventory).map(getItem).filter((it) => it.type === "tome");
  const TABS: [PartyTab, string, string][] = [
    ["gear", "🛡️ Trang bị", better.size ? "⬆" : ""],
    ["stats", "📊 Chỉ số", pts ? String(pts) : ""],
    ["skills", "✨ Kỹ năng", `${ch.equipped.length}/${slots}`],
    ["passives", "🔮 Nội tại", `${ch.equippedPassives.length}/${pslots}`],
    ["pets", "🐾 Thú cưng", g.inventory[PET_EGG] ? "🥚" : ""],
  ];
  const secTabs = h("div", { class: "tabs party-tabs" }, TABS.map(([id, label, badge]) =>
    h("button", { class: partyTab === id ? "on" : "", title: label.slice(label.indexOf(" ") + 1), onclick: () => { partyTab = id; select(ch.id); } },
      h("span", { class: "pt-ico" }, label.slice(0, label.indexOf(" "))), h("span", { class: "pt-label" }, label.slice(label.indexOf(" ") + 1)), badge ? h("span", { class: "tab-badge" }, badge) : null)));

  let body: (HTMLElement | null)[] = [];
  if (partyTab === "gear") {
    const key = (k: keyof typeof s, label: string) => h("span", { class: "stat-chip" }, label, " ", h("b", null, String(s[k])));
    const summary = h("div", { class: "row", style: "gap:6px;margin-bottom:8px" }, key("atk", "⚔️"), key("mag", "🔮"), key("def", "🛡️"), key("res", "✨"), key("spd", "💨"));
    const gear = h("div", { class: "gear-tiles" }, GEAR_KEYS.map((key) => {
      const id = ch.gear[key];
      const it = id ? getItem(id) : null;
      const locked = key === "offhand" && !it && isTwoHanded(ch.gear.weapon);
      const enh = id ? enhLevel(id) : 0;
      const tile = h("button", { class: `gtile ${it ? "filled" : ""} ${it ? rarityClass(it) : ""}`, title: GEAR_NAMES[key], onclick: () => pickGear(ch, key, rerender) },
        h("div", { class: "gt-ico" }, it ? itemImg(it.id) : h("span", { class: "gt-empty" }, GEAR_ICONS[key])),
        h("div", { class: "gt-name" }, it ? it.name : locked ? "(hai tay)" : GEAR_NAMES[key]),
        enh ? h("span", { class: "gt-enh" }, `+${enh}`) : null,
        better.has(key) ? h("span", { class: "gt-up" }, "⬆") : null);
      return it ? itemTip(tile, it.id, { slot: key }) : tile;
    }));
    body = [summary, gear, dualWielding(ch) ? h("p", { class: "muted small" }, "⚔️⚔️ Song kiếm: tay trái 50% chỉ số, đánh thường chém thêm 1 nhát.") : null];
  } else if (partyTab === "stats") {
    const statKeys = isHero ? (["hp", "mp", "atk", "mag", "def", "res", "spd", "crit", "eva"] as const) : (["hp", "mp", "atk", "mag", "def", "res", "spd", "crit", "eva"] as const);
    const stats = h("div", { class: "grid2" }, statKeys.map((k) => {
      const spent = ch.alloc?.[k] ?? 0;
      const capped = POINT_CAP[k] !== undefined && spent >= POINT_CAP[k]!;
      const tip = k === "crit" || k === "eva" ? "Điểm càng nhiều càng giảm hiệu quả; số trong ngoặc là tỉ lệ thật (tối đa 60% chí mạng, 35% né)." : "";
      return h("div", { class: "stat", title: tip }, STAT_NAMES[k],
        h("span", { class: "row", style: "gap:6px;flex-wrap:nowrap" },
          spent ? h("span", { class: "small good" }, `+${Math.floor(spent * POINT_VALUE[k])}`) : null,
          h("b", null, k === "crit" ? `${s[k]} (${pctLabel(critChance(s[k]))})` : k === "eva" ? `${s[k]} (${pctLabel(dodgeChance(s[k]))})` : String(s[k])),
          isHero && pts > 0 ? h("button", { class: "btn small primary pt-btn", disabled: capped, title: POINT_VALUE[k] < 1 ? `2 điểm = +1 (tối đa ${POINT_CAP[k]} điểm)` : `1 điểm = +${POINT_VALUE[k]}`, onclick: () => { if (allocPoint(ch, k)) { clampVitals(ch); rerender(); } } }, "+") : null));
    }));
    const pointsBar = isHero ? h("div", { class: "row between", style: "margin:0 0 6px" },
      h("span", { class: pts ? "gold" : "muted small" }, pts ? `✨ ${pts} điểm chưa dùng` : `+${POINTS_PER_LEVEL} điểm mỗi cấp`),
      Object.keys(ch.alloc ?? {}).length ? h("button", {
        class: "btn small",
        onclick: async () => {
          const cost = resetCost(ch);
          if (!(await confirmBox("Tẩy điểm", `Lấy lại toàn bộ điểm đã phân bổ với giá ${cost} vàng?`, "Tẩy điểm"))) return;
          if (g.gold < cost) return toast(`Cần ${cost} vàng.`, "bad");
          g.gold -= cost; resetPoints(ch); clampVitals(ch); rerender();
        },
      }, `↺ Tẩy điểm (${resetCost(ch)}💰)`) : null) : null;
    const classBtn = isHero ? h("button", { class: "btn small block", style: "margin-top:6px", disabled: inDungeon, title: inDungeon ? "Về Thánh Địa để chuyển nghề" : "", onclick: () => openClassChange(ch, rerender) },
      `🔄 Chuyển nghề (${classChangeCost(ch).toLocaleString("vi-VN")}💰)`) : null;
    body = [pointsBar, stats, ch.bio ? h("p", { class: "muted small" }, ch.bio) : h("p", { class: "muted small" }, cls.desc), classBtn];
  } else if (partyTab === "skills") {
    const skillList = h("div", { class: "list" }, ch.skills.map((id) => {
      const sk = getSkill(id);
      const on = ch.equipped.includes(id);
      const detail = h("div", { class: "desc muted" }, describeSkill(sk).join(" "));
      const row = h("div", { class: `item-row ${on ? "sel" : ""}` },
        h("span", { class: "ico" }, sk.icon),
        h("div", { class: "meta" }, h("div", { class: "name" }, sk.name), h("div", { class: "desc" }, skillCostText(sk)), detail),
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
      return skillTip(row, id);
    }));
    const tomeList = tomes.length ? h("div", { class: "list" }, tomes.map((it) => {
      const known = it.skill ? ch.skills.includes(it.skill) : ch.passives.includes(it.passive!);
      const teach = it.skill ? getSkill(it.skill) : getPassive(it.passive!);
      return itemTip(h("div", { class: "item-row" },
        h("span", { class: "ico" }, itemImg(it.id)),
        h("div", { class: "meta" }, h("div", { class: "name" }, it.name, h("span", { class: "qty" }, ` ×${g.inventory[it.id]}`)),
          h("div", { class: "desc" }, `${teach.icon} ${it.skill ? "Kỹ năng" : "Nội tại"}: ${teach.name}`),
          h("div", { class: "desc muted" }, it.skill ? describeSkill(getSkill(it.skill)).join(" ") : passiveText(getPassive(it.passive!).desc))),
        h("button", {
          class: "btn small primary", disabled: known,
          onclick: () => {
            if (!removeItem(g, it.id, 1)) return;
            if (it.skill) { ch.skills.push(it.skill); if (ch.equipped.length < slots) ch.equipped.push(it.skill); }
            else if (it.passive) { ch.passives.push(it.passive); if (ch.equippedPassives.length < pslots) ch.equippedPassives.push(it.passive); }
            toast(`${ch.name} đã học ${it.name.replace(/^.*?: /, "")}!`, "good");
            rerender();
          },
        }, known ? "Đã biết" : "Học")), it.id, { qty: g.inventory[it.id] });
    })) : null;
    body = [skillList, tomeList ? h("div", { class: "section-title" }, "📕 Học từ sách") : null, tomeList];
  } else if (partyTab === "pets") {
    body = [petPanel(() => select(ch.id))];
  } else {
    const gearPassives = charPassives(ch).filter((p) => !ch.equippedPassives.includes(p));
    const passiveList = h("div", { class: "list" }, ch.passives.map((id) => {
      const p = getPassive(id);
      const on = ch.equippedPassives.includes(id);
      return passiveTip(h("div", { class: `item-row ${on ? "sel" : ""}` },
        h("span", { class: "ico" }, p.icon),
        h("div", { class: "meta" }, h("div", { class: "name" }, p.name), h("div", { class: "desc" }, passiveText(p.desc))),
        h("button", {
          class: `btn small ${on ? "" : "primary"}`,
          onclick: () => {
            if (on) ch.equippedPassives = ch.equippedPassives.filter((x) => x !== id);
            else if (ch.equippedPassives.length >= pslots) return toast(`Tối đa ${pslots} nội tại.`, "bad");
            else ch.equippedPassives.push(id);
            rerender();
          },
        }, on ? "Bỏ" : "Dùng")), id);
    }));
    body = [passiveList, gearPassives.length ? h("div", { class: "section-title" }, "✦ Từ trang bị") : null,
      gearPassives.length ? h("div", { class: "list" }, gearPassives.map((id) => { const p = getPassive(id); return h("div", { class: "item-row" }, h("span", { class: "ico" }, p.icon), h("div", { class: "meta" }, h("div", { class: "name" }, p.name), h("div", { class: "desc" }, passiveText(p.desc)))); })) : null];
  }

  m.body.replaceChildren(...nn(tabs, header, secTabs, ...body));
}

/** Pets: hatch eggs, pick the one that travels with the party. */
function petPanel(rerender: () => void): HTMLElement {
  const g = app.game;
  const owned = (g.pets ?? []).map((id) => PET[id]).filter(Boolean);
  const limit = petLimit(g);
  const active = activePets(g);
  // bring one along (when the party is full of pets, the last one picked goes home), or leave one home
  const togglePet = (id: string, on: boolean) => {
    let list = on ? active.filter((x) => x !== id) : [...active, id];
    if (list.length > limit) list = [...list.slice(0, limit - 1), id];
    g.pet = list[0];
    g.petsExtra = list.slice(1);
  };
  const eggs = g.inventory[PET_EGG] ?? 0;
  const hatch = () => {
    if (!removeItem(g, PET_EGG, 1)) return;
    const left = PETS.filter((p) => !(g.pets ?? []).includes(p.id));
    if (!left.length) { g.gold += 150; toast("Quả trứng rỗng... bạn đã có đủ mọi thú cưng. Bán vỏ trứng được 150 vàng.", "info"); app.dirty(); return rerender(); }
    const p = left[Math.floor(Math.random() * left.length)];
    g.pets = [...(g.pets ?? []), p.id];
    g.pet ??= p.id;
    toast(`🐣 Trứng nở ra ${p.name}! Món quà: ${p.gift}.`, "good", 5000);
    app.checkpoint();
    rerender();
  };
  return h("div", { class: "col", style: "gap:8px" },
    h("div", { class: "row between" },
      h("span", { class: "muted small" }, `Mang theo ${limit > 1 ? `tối đa ${limit} thú cưng` : "một thú cưng"} để nhận món quà đặc biệt. Đã có ${owned.length}/${PETS.length}.${limit === 1 ? " Thuần Thú Sư, Tế Tự Rừng hay Triệu Hồi Sư trong đội cho mang thêm." : ""}`),
      h("button", { class: "btn small primary", disabled: !eggs, onclick: hatch }, `🥚 Ấp trứng (${eggs})`)),
    owned.length ? h("div", { class: "list no-search" }, owned.map((p) => {
      const on = active.includes(p.id);
      return h("div", { class: `item-row ${on ? "sel" : ""}` },
        h("img", { class: "pix", src: creatureCanvas(petSpec(p)).toDataURL(), alt: "", style: "width:48px;height:48px" }),
        h("div", { class: "meta" }, h("div", { class: "name" }, p.name, h("span", { class: "tag" }, p.gift)), h("div", { class: "desc" }, p.desc)),
        h("button", { class: `btn small ${on ? "" : "primary"}`, onclick: () => { togglePet(p.id, on); app.dirty(); rerender(); } }, on ? "Để ở nhà" : active.length >= limit && limit > 1 ? "Đổi vào" : "Mang theo"));
    })) : h("p", { class: "muted" }, "Chưa có thú cưng nào. Trứng Thú Cưng thỉnh thoảng rơi từ quái Tinh Anh, thường rơi từ Boss Canh Cửa, và chắc chắn có ở boss mỗi 10 tầng."));
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
    list.append(itemTip(h("button", {
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
      cur && diff.length ? h("div", { class: "desc" }, "So với đang dùng:", ...diff) : null)), it.id, { slot: key, qty: g.inventory[it.id] }));
  }
  if (!items.length && !cur) list.append(h("p", { class: "muted" }, "Chưa có trang bị nào cho ô này. Hãy rèn ở Lò Rèn / Xưởng May, mua ở thị trấn hoặc tìm trong Vực Sâu."));
  m.body.append(list);
}

function clampVitals(ch: Character) {
  const s = charStats(ch);
  ch.hp = Math.min(ch.hp, s.hp);
  ch.mp = Math.min(ch.mp, s.mp);
}
