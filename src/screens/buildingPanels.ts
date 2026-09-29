import { app } from "../app";
import { describeSkill } from "../combat/describe";
import { addItem, buildingCost, canAfford, count, giveXp, healParty, logMsg, pay, removeItem, type PlacedBuilding } from "../core/state";
import { BUILDINGS, EXPANSION_COST, TERRITORY_SIZES, type Cost } from "../data/buildings";
import { CLASSES, xpForLevel } from "../data/classes";
import { getItem } from "../data/items";
import { PLAYER_PASSIVES } from "../data/passives";
import { CROPS, RECIPES, researchCost } from "../data/recipes";
import { PLAYER_SKILLS, SCHOOL_NAMES } from "../data/skills";
import { spriteImg } from "../render/pixel";
import { getFloor } from "../world/floors";
import { confirmBox, h, nn, openModal, toast, type ModalHandle } from "../ui/dom";

export interface PanelHooks {
  refresh: () => void;
  sleep: () => void;
  enterDungeon: (floor: number) => void;
}

export function costView(cost: Cost): HTMLElement {
  const g = app.game;
  return h("div", { class: "cost" }, Object.entries(cost).map(([id, n]) => {
    const have = count(g, id);
    const label = id === "gold" ? `💰 ${n}` : `${getItem(id).icon} ${getItem(id).name} ${have}/${n}`;
    return h("span", { class: have >= n ? "ok" : "no" }, label);
  }));
}

export const growDays = (cropId: string) => Math.max(1, CROPS[cropId].days - (app.game.buildings.some((b) => b.type === "well") ? 1 : 0));

export function cropStage(b: PlacedBuilding): number {
  if (!b.crop) return -1;
  const p = (app.game.day - b.crop.planted) / growDays(b.crop.id);
  return p >= 1 ? 3 : Math.min(2, Math.floor(p * 3));
}

export function openBuilding(b: PlacedBuilding, hooks: PanelHooks) {
  const def = BUILDINGS[b.type];
  const m = openModal(`${def.icon} ${def.name}${def.maxLevel > 1 ? ` · Cấp ${b.level}` : ""}`, { wide: ["forge", "kitchen", "alchemy", "library"].includes(b.type), onClose: hooks.refresh });
  const render = () => {
    m.body.replaceChildren(h("p", { class: "muted", style: "margin-top:0" }, def.desc));
    switch (b.type) {
      case "house": return houseBody(m, b, hooks, render);
      case "gate": return gateBody(m, hooks);
      case "farm": return farmBody(m, b, render);
      case "kitchen": case "forge": case "alchemy": return craftBody(m, b, render);
      case "library": return libraryBody(m, b, render);
      case "training": return trainingBody(m, b, render);
      default: return genericFooter(m, b, render);
    }
  };
  render();
}

function upgradeRow(m: ModalHandle, b: PlacedBuilding, render: () => void) {
  const def = BUILDINGS[b.type];
  if (b.level >= def.maxLevel) {
    m.body.append(h("p", { class: "muted small" }, "Đã đạt cấp tối đa."));
    return;
  }
  const cost = buildingCost(b.type, b.level);
  m.body.append(h("div", { class: "item-row" },
    h("span", { class: "ico" }, "⬆️"),
    h("div", { class: "meta" }, h("div", { class: "name" }, `Nâng lên cấp ${b.level + 1}: ${def.levelText[b.level] ?? ""}`), costView(cost)),
    h("button", {
      class: "btn small primary", disabled: !canAfford(app.game, cost),
      onclick: () => {
        if (!pay(app.game, cost)) return;
        b.level++;
        logMsg(app.game, `Nâng cấp ${def.name} lên cấp ${b.level}.`);
        toast(`${def.name} đã lên cấp ${b.level}!`, "good");
        app.dirty(true);
        m.setTitle(`${def.icon} ${def.name} · Cấp ${b.level}`);
        render();
      },
    }, "Nâng cấp")));
}

function genericFooter(m: ModalHandle, b: PlacedBuilding, render: () => void, withUpgrade = true) {
  const def = BUILDINGS[b.type];
  if (withUpgrade && def.maxLevel > 1) upgradeRow(m, b, render);
  if (def.fixed) return;
  m.body.append(h("div", { class: "row end", style: "margin-top:12px" },
    h("button", { class: "btn small", onclick: () => { m.close(); moveHook(b); } }, "↔️ Di chuyển"),
    h("button", {
      class: "btn small",
      onclick: async () => {
        if (!(await confirmBox("Phá dỡ", `Phá dỡ ${def.name}? Bạn nhận lại một nửa nguyên liệu xây dựng.${b.crop ? " Cây trồng trên ô sẽ mất." : ""}`))) return;
        const g = app.game;
        g.buildings = g.buildings.filter((x) => x !== b);
        for (const [id, n] of Object.entries(buildingCost(b.type, 0))) addItem(g, id, Math.floor(n / 2));
        app.dirty();
        m.close();
      },
    }, "🗑️ Phá dỡ")));
}

// ------------------------------------------------------------ house
function houseBody(m: ModalHandle, b: PlacedBuilding, hooks: PanelHooks, render: () => void) {
  const g = app.game;
  const tired = Boolean(g.flags.tired);
  m.body.append(
    h("div", { class: "item-row" },
      h("span", { class: "ico" }, "😴"),
      h("div", { class: "meta" }, h("div", { class: "name" }, "Ngủ một giấc"), h("div", { class: "desc" }, tired ? "Qua ngày mới, hồi phục toàn bộ đội, cây trồng lớn lên." : "Bạn chưa thấy buồn ngủ. Hãy xuống Vực Sâu trước đã.")),
      h("button", { class: "btn small primary", disabled: !tired, onclick: () => { m.close(); hooks.sleep(); } }, "Ngủ")),
  );
  upgradeRow(m, b, render);
  // territory
  const next = g.territory + 1;
  if (next < TERRITORY_SIZES.length) {
    const cost = EXPANSION_COST[next];
    const needHouse = next > b.level;
    m.body.append(h("div", { class: "item-row" },
      h("span", { class: "ico" }, "🌳"),
      h("div", { class: "meta" },
        h("div", { class: "name" }, `Mở rộng lãnh địa: ${TERRITORY_SIZES[g.territory]}×${TERRITORY_SIZES[g.territory]} → ${TERRITORY_SIZES[next]}×${TERRITORY_SIZES[next]}`),
        needHouse ? h("div", { class: "desc bad" }, `Cần Nhà Chính cấp ${next}`) : costView(cost)),
      h("button", {
        class: "btn small primary", disabled: needHouse || !canAfford(g, cost),
        onclick: () => {
          if (!pay(g, cost)) return;
          g.territory = next;
          logMsg(g, "Thánh Địa được mở rộng.");
          toast("Thánh Địa đã được mở rộng! Mầm vui vẻ nhảy nhót.", "good");
          app.dirty(true);
          render();
        },
      }, "Mở rộng")));
  } else m.body.append(h("p", { class: "muted small" }, "Lãnh địa đã đạt kích thước tối đa."));
  m.body.append(h("p", { class: "muted small" }, `Cấp nhà hiện tại: ${BUILDINGS.house.levelText[b.level - 1]}.`));
}

// ------------------------------------------------------------ gate
function gateBody(m: ModalHandle, hooks: PanelHooks) {
  const g = app.game;
  const list = h("div", { class: "list" });
  for (let f = g.maxFloor; f >= 1; f--) {
    const def = getFloor(f);
    const fs = g.floors[f];
    list.append(h("button", { class: "item-row", onclick: () => { m.close(); hooks.enterDungeon(f); } },
      h("span", { class: "ico" }, fs?.cleared ? "✅" : "🌀"),
      h("div", { class: "meta" },
        h("div", { class: "name" }, `Tầng ${f}: ${def.name}`),
        h("div", { class: "desc" }, `Cấp quái ~${def.levelBase}–${def.levelBase + 4}${fs?.cleared ? " · Đã chinh phục" : ""}${def.handwritten ? " · Có cốt truyện" : ""}`)),
      h("span", { class: "btn small primary" }, "Vào")));
  }
  const dead = g.party.filter((id) => g.chars[id].hp <= 0).map((id) => g.chars[id].name);
  m.body.append(...nn(
    dead.length ? h("p", { class: "bad small" }, `⚠️ ${dead.join(", ")} đang bất tỉnh. Hãy ngủ ở Nhà Chính hoặc dùng Lông Phượng Hoàng trước khi đi.`) : null,
    list,
  ));
}

// ------------------------------------------------------------ farm
function farmBody(m: ModalHandle, b: PlacedBuilding, render: () => void) {
  const g = app.game;
  const farms = g.buildings.filter((x) => x.type === "farm");
  const empty = farms.filter((x) => !x.crop);
  const ready = farms.filter((x) => x.crop && cropStage(x) === 3);
  const harvest = (plots: PlacedBuilding[]) => {
    const got: Record<string, number> = {};
    for (const p of plots) {
      const c = CROPS[p.crop!.id];
      const n = c.yield[0] + Math.floor(Math.random() * (c.yield[1] - c.yield[0] + 1));
      addItem(g, c.id, n);
      got[c.id] = (got[c.id] ?? 0) + n;
      if (Math.random() < 0.3) addItem(g, c.seed, 1);
      p.crop = undefined;
    }
    toast(`Thu hoạch: ${Object.entries(got).map(([id, n]) => `${getItem(id).icon}×${n}`).join(" ")}`, "good");
    app.dirty();
    render();
  };
  const plant = (plots: PlacedBuilding[], seed: string) => {
    let n = 0;
    for (const p of plots) {
      if (!removeItem(g, seed, 1)) break;
      p.crop = { id: getItem(seed).crop!, planted: g.day };
      n++;
    }
    if (n) toast(`Đã gieo ${n} ô.`, "good");
    app.dirty();
    render();
  };

  if (b.crop) {
    const st = cropStage(b);
    const it = getItem(b.crop.id);
    const left = growDays(b.crop.id) - (g.day - b.crop.planted);
    m.body.append(h("div", { class: "item-row" },
      h("span", { class: "ico" }, it.icon),
      h("div", { class: "meta" }, h("div", { class: "name" }, it.name), h("div", { class: "desc" }, st === 3 ? "Đã chín!" : `Còn ${left} ngày nữa (ngủ ở Nhà Chính để qua ngày).`)),
      st === 3 ? h("button", { class: "btn small good", onclick: () => harvest([b]) }, "Thu hoạch") : null));
  } else {
    const seeds = Object.keys(g.inventory).map(getItem).filter((it) => it.type === "seed");
    m.body.append(h("div", { class: "section-title" }, "Gieo hạt"));
    if (!seeds.length) m.body.append(h("p", { class: "muted" }, "Bạn không có hạt giống nào. Tìm hạt giống dưới Vực Sâu hoặc thu hoạch cây trồng."));
    for (const s of seeds) {
      const crop = CROPS[s.crop!];
      m.body.append(h("div", { class: "item-row" },
        h("span", { class: "ico" }, getItem(crop.id).icon),
        h("div", { class: "meta" }, h("div", { class: "name" }, s.name, h("span", { class: "qty" }, ` ×${g.inventory[s.id]}`)), h("div", { class: "desc" }, `${growDays(crop.id)} ngày → ${crop.yield[0]}–${crop.yield[1]} ${getItem(crop.id).name}`)),
        h("button", { class: "btn small primary", onclick: () => plant([b], s.id) }, "Gieo"),
        empty.length > 1 ? h("button", { class: "btn small", onclick: () => plant(empty, s.id) }, `Gieo ${Math.min(empty.length, g.inventory[s.id] ?? 0)} ô`) : null));
    }
  }
  if (ready.length > 1) m.body.append(h("button", { class: "btn good block", style: "margin-top:10px", onclick: () => harvest(ready) }, `🧺 Thu hoạch tất cả (${ready.length} ô)`));
  m.body.append(h("p", { class: "muted small" }, `Ruộng: ${farms.length} ô · ${empty.length} trống · ${ready.length} chín.`));
  genericFooter(m, b, render);
}

let moveHook: (b: PlacedBuilding) => void = () => undefined;
export function setMoveHook(fn: (b: PlacedBuilding) => void) { moveHook = fn; }

// ------------------------------------------------------------ crafting
function craftBody(m: ModalHandle, b: PlacedBuilding, render: () => void) {
  const g = app.game;
  const recipes = RECIPES.filter((r) => r.station === b.type);
  const list = h("div", { class: "list" });
  for (const r of recipes) {
    const out = getItem(r.out);
    const locked = r.level > b.level;
    const ok = !locked && canAfford(g, r.cost);
    const craft = (times: number) => {
      let made = 0;
      for (let i = 0; i < times && pay(g, r.cost); i++) { addItem(g, r.out, r.n); made++; }
      if (made) toast(`Đã chế tạo ${out.icon} ${out.name} ×${made * r.n}`, "good");
      app.dirty();
      render();
    };
    const desc = out.equip ? Object.entries(out.equip.stats).map(([k, v]) => `${k}+${v}`).join(" ") : out.desc;
    list.append(h("div", { class: `item-row ${locked ? "locked" : ""}` },
      h("span", { class: "ico" }, out.icon),
      h("div", { class: "meta" },
        h("div", { class: "name" }, out.name, r.n > 1 ? ` ×${r.n}` : "", count(g, r.out) ? h("span", { class: "tag" }, `có ${count(g, r.out)}`) : null),
        h("div", { class: "desc" }, locked ? `Cần ${BUILDINGS[b.type].name} cấp ${r.level}` : desc),
        locked ? null : costView(r.cost)),
      locked ? null : h("div", { class: "col", style: "gap:4px" },
        h("button", { class: "btn small primary", disabled: !ok, onclick: () => craft(1) }, "Chế tạo"),
        h("button", { class: "btn small", disabled: !ok, onclick: () => craft(5) }, "×5"))));
  }
  m.body.append(list);
  genericFooter(m, b, render);
}

// ------------------------------------------------------------ library
let libTab: "skills" | "passives" = "skills";
let libChar = "";

function libraryBody(m: ModalHandle, b: PlacedBuilding, render: () => void) {
  const g = app.game;
  if (!g.chars[libChar]) libChar = g.heroId;
  const ch = g.chars[libChar];
  const cls = CLASSES[ch.classId];
  m.body.append(
    h("div", { class: "char-tabs" }, Object.values(g.chars).map((c) =>
      h("button", { class: `char-tab ${c.id === ch.id ? "on" : ""}`, onclick: () => { libChar = c.id; render(); } }, spriteImg(c.sprite), c.name.split(" ")[0]))),
    h("div", { class: "tabs" },
      h("button", { class: libTab === "skills" ? "on" : "", onclick: () => { libTab = "skills"; render(); } }, "Kỹ năng"),
      h("button", { class: libTab === "passives" ? "on" : "", onclick: () => { libTab = "passives"; render(); } }, "Nội tại")),
    h("p", { class: "muted small", style: "margin:0 0 6px" }, `Sở trường của ${cls.name}: ${cls.schools.map((s) => SCHOOL_NAMES[s]).join(", ")}. Học ngoài sở trường tốn gấp đôi. Thư viện cấp ${b.level} mở tới bậc ${b.level}.`),
  );
  const list = h("div", { class: "list" });
  if (libTab === "skills") {
    const avail = PLAYER_SKILLS.filter((s) => s.tier <= b.level && !ch.skills.includes(s.id))
      .sort((a, z) => Number(cls.schools.includes(z.school)) - Number(cls.schools.includes(a.school)) || a.tier - z.tier);
    for (const sk of avail) {
      const off = !cls.schools.includes(sk.school);
      const cost = researchCost(sk.tier, false, off);
      list.append(h("div", { class: "item-row" },
        h("span", { class: "ico" }, sk.icon),
        h("div", { class: "meta" },
          h("div", { class: "name" }, sk.name, h("span", { class: "tag" }, SCHOOL_NAMES[sk.school]), h("span", { class: "tag" }, `Bậc ${sk.tier}`), off ? h("span", { class: "tag" }, "ngoài sở trường") : null),
          h("div", { class: "desc" }, describeSkill(sk).join(" ")), costView(cost)),
        h("button", {
          class: "btn small primary", disabled: !canAfford(g, cost),
          onclick: () => { if (!pay(g, cost)) return; ch.skills.push(sk.id); if (ch.equipped.length < 5) ch.equipped.push(sk.id); toast(`${ch.name} học được ${sk.name}!`, "good"); app.dirty(); render(); },
        }, "Học")));
    }
    if (!avail.length) list.append(h("p", { class: "muted" }, "Đã học hết kỹ năng ở bậc này. Nâng cấp Thư Viện để mở thêm."));
  } else {
    const avail = PLAYER_PASSIVES.filter((p) => p.tier <= b.level && !ch.passives.includes(p.id));
    for (const p of avail) {
      const off = !cls.schools.includes(p.school);
      const cost = researchCost(p.tier, true, off);
      list.append(h("div", { class: "item-row" },
        h("span", { class: "ico" }, p.icon),
        h("div", { class: "meta" }, h("div", { class: "name" }, p.name, h("span", { class: "tag" }, `Bậc ${p.tier}`), off ? h("span", { class: "tag" }, "ngoài sở trường") : null), h("div", { class: "desc" }, p.desc), costView(cost)),
        h("button", {
          class: "btn small primary", disabled: !canAfford(g, cost),
          onclick: () => { if (!pay(g, cost)) return; ch.passives.push(p.id); if (ch.equippedPassives.length < 2) ch.equippedPassives.push(p.id); toast(`${ch.name} lĩnh hội ${p.name}!`, "good"); app.dirty(); render(); },
        }, "Học")));
    }
  }
  m.body.append(list);
  genericFooter(m, b, render);
}

// ------------------------------------------------------------ training
function trainingBody(m: ModalHandle, b: PlacedBuilding, render: () => void) {
  const g = app.game;
  const top = Math.max(...Object.values(g.chars).map((c) => c.level));
  const cap = top - (4 - b.level);
  m.body.append(h("p", { class: "small" }, `Có thể huấn luyện tới cấp ${cap} (thấp hơn người mạnh nhất ${4 - b.level} cấp).`));
  for (const ch of Object.values(g.chars)) {
    const cost = Math.round(30 * Math.pow(ch.level, 1.5));
    const can = ch.level < cap && g.gold >= cost;
    m.body.append(h("div", { class: "item-row" },
      spriteImg(ch.sprite, undefined, "sprite mini-portrait"),
      h("div", { class: "meta" }, h("div", { class: "name" }, `${ch.name} · Cấp ${ch.level}`), h("div", { class: "desc" }, ch.level >= cap ? "Đã đạt giới hạn huấn luyện." : `💰 ${cost} vàng → +1 cấp`)),
      h("button", {
        class: "btn small primary", disabled: !can,
        onclick: () => {
          g.gold -= cost;
          ch.xp = xpForLevel(ch.level);
          giveXp(ch, 0);
          app.dirty();
          render();
        },
      }, "Huấn luyện")));
  }
  genericFooter(m, b, render);
}

export function doSleep(): string[] {
  const g = app.game;
  g.day++;
  g.flags.tired = false;
  healParty(g);
  const msgs: string[] = [];
  const trees = g.buildings.filter((b) => b.type === "tree").length;
  if (trees) {
    const n = trees + Math.floor(Math.random() * trees);
    addItem(g, "cactus_fruit", n);
    msgs.push(`Cây ăn quả rụng ${n} 🌵`);
  }
  const ready = g.buildings.filter((b) => b.type === "farm" && b.crop && cropStage(b) === 3).length;
  if (ready) msgs.push(`${ready} ô ruộng đã chín`);
  logMsg(g, "Một ngày mới ở Thánh Địa.");
  return msgs;
}
