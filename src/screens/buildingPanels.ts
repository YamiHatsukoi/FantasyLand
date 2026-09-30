import { app } from "../app";
import { describeSkill } from "../combat/describe";
import { Rng } from "../core/rng";
import { addItem, canAfford, count, giveXp, logMsg, pay, removeItem, type PlacedBuilding, type PlotState } from "../core/state";
import { BUILDINGS, FLOOR_REQ, POP_REQ, RANK_NAMES, TERRITORY_SIZES, costFor, expansionCost } from "../data/buildings";
import { CLASSES, xpForLevel } from "../data/classes";
import { CROPS, SEASON_ICONS, SEASON_NAMES, TYPE_NAMES, getItem, seasonOf, type ItemDef } from "../data/items";
import { PLAYER_PASSIVES } from "../data/passives";
import { RECIPES, STATION_NAMES, researchCost, type Station } from "../data/recipes";
import { PLAYER_SKILLS, SCHOOL_NAMES } from "../data/skills";
import { spriteImg } from "../render/pixel";
import { confirmBox, h, nn, openModal, toast, type ModalHandle } from "../ui/dom";
import { costView as costViewG, itemImg, lootChips } from "../ui/icon";
import { GEAR_NAMES } from "../ui/gear";
import { getFloor } from "../world/floors";
import {
  SOIL_NAMES, WEATHER, allPlots, appeal, applyFertilizer, cropInfo, efficiency, ensureSlots, harvest, housing, isReady,
  maxTerritory, plant, population, rankOf, residents, workersNeeded,
} from "../world/town";
import { openTavern } from "./tavern";

export interface PanelHooks {
  refresh: () => void;
  sleep: () => void;
  enterDungeon: (floor: number) => void;
}

export const costView = (cost: Record<string, number>) => costViewG(app.game, cost);

export function openBuilding(b: PlacedBuilding, hooks: PanelHooks) {
  const def = BUILDINGS[b.type];
  const wide = !!def.station || ["house", "greenhouse", "farm", "tavern"].includes(b.type);
  const m = openModal(`${def.icon} ${def.name}${def.maxLevel > 1 ? ` · Cấp ${b.level}` : ""}`, { wide, onClose: hooks.refresh });
  const render = () => {
    const keep = m.body.scrollTop;
    m.body.replaceChildren(h("p", { class: "muted", style: "margin-top:0" }, def.desc));
    switch (b.type) {
      case "house": houseBody(m, b, hooks, render); break;
      case "gate": gateBody(m, hooks); break;
      case "farm": farmBody(m, b, render); break;
      case "greenhouse": greenhouseBody(m, b, render); break;
      case "library": libraryBody(m, b, render); break;
      case "training": trainingBody(m, b, render); break;
      case "tavern": m.body.append(h("button", { class: "btn primary block", onclick: () => openTavern(hooks.refresh) }, "🍺 Xem khách trong quán")); genericFooter(m, b, render); break;
      default:
        productionInfo(m, b);
        if (def.station) stationBody(m, b, def.station, render);
        genericFooter(m, b, render);
    }
    m.body.scrollTop = keep;
  };
  render();
}

// ------------------------------------------------------------ shared rows
function upgradeRow(m: ModalHandle, b: PlacedBuilding, render: () => void, blocker?: string | null) {
  const def = BUILDINGS[b.type];
  if (b.level >= def.maxLevel) {
    m.body.append(h("p", { class: "muted small" }, "Đã đạt cấp tối đa."));
    return;
  }
  const g = app.game;
  const cost = costFor(b.type, b.level);
  const rankBlock = b.type !== "house" && def.rank + b.level > rankOf(g) ? `Cần khu định cư hạng ${RANK_NAMES[Math.min(6, def.rank + b.level)]}` : null;
  const block = blocker ?? rankBlock;
  m.body.append(h("div", { class: "item-row" },
    h("span", { class: "ico" }, "⬆️"),
    h("div", { class: "meta" },
      h("div", { class: "name" }, `Nâng lên cấp ${b.level + 1}`),
      block ? h("div", { class: "desc bad" }, block) : costView(cost)),
    h("button", {
      class: "btn small primary", disabled: !!block || !canAfford(g, cost),
      onclick: () => {
        if (!pay(g, cost)) return;
        b.level++;
        if (b.type === "greenhouse") ensureSlots(b);
        logMsg(g, `Nâng cấp ${def.name} lên cấp ${b.level}.`);
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
  const hasCrop = !!b.plot?.crop || !!b.slots?.some((s) => s.crop);
  m.body.append(h("div", { class: "row end", style: "margin-top:12px" },
    h("button", { class: "btn small", onclick: () => { m.close(); moveHook(b); } }, "↔️ Di chuyển"),
    h("button", {
      class: "btn small",
      onclick: async () => {
        if (!(await confirmBox("Phá dỡ", `Phá dỡ ${def.name}? Bạn nhận lại một nửa nguyên liệu xây dựng.${hasCrop ? " Cây trồng bên trong sẽ mất." : ""}`))) return;
        const g = app.game;
        g.buildings = g.buildings.filter((x) => x !== b);
        for (const [id, n] of Object.entries(costFor(b.type, 0))) addItem(g, id, Math.floor(n / 2));
        app.dirty();
        m.close();
      },
    }, "🗑️ Phá dỡ")));
}

const PRODUCTION: Record<string, string> = {
  lumber: "Mỗi ngày: 🪵 gỗ ×3/cấp; từ cấp 2 thêm gỗ quý của các tầng đã mở.",
  quarry: "Mỗi ngày: đá ×3/cấp, cát; cấp 2 đất sét; cấp 3 đá quý của các tầng.",
  mine: "Mỗi ngày: quặng đồng và quặng quý hơn theo cấp mỏ và tầng sâu nhất đã tới. Thỉnh thoảng có Tinh Thể Ma Lực.",
  herbgarden: "Mỗi ngày: thảo mộc thường và thảo mộc các vùng đã khám phá.",
  coop: "Mỗi ngày ăn 1 hạt ngũ cốc/cấp → trứng gà (cấp 2+: trứng vịt).",
  barn: "Mỗi ngày ăn 2 rau củ/cấp → sữa bò (cấp 2: sữa dê, cấp 3: lông cừu).",
  beehive: "Mỗi ngày: mật ong; nhiều hơn nếu có luống hoa hoặc ruộng hoa trong bán kính 4 ô.",
  fishpond: "Mỗi ngày: cá theo mùa. Ngày giông bão có thể có Lươn Sấm.",
  silkhouse: "Mỗi ngày ăn lá cải/trà → kén tằm.",
  market: "Mỗi ngày: thu thuế 3 vàng × dân số × cấp.",
  clinic: "Mỗi ngày: bào chế Thuốc Hồi Máu cho kho.",
  academy: "Mỗi ngày: đồng đội ở nhà nhận EXP.",
  temple: "Phúc Lành: +3% mọi chỉ số mỗi cấp khi xuống Vực Sâu.",
  warehouse: "+10% sản lượng mỗi cấp cho mọi công trình sản xuất.",
};

function productionInfo(m: ModalHandle, b: PlacedBuilding) {
  const def = BUILDINGS[b.type];
  const txt = PRODUCTION[b.type];
  if (!txt && !def.workers && !def.housing) return;
  const g = app.game;
  m.body.append(h("div", { class: "stat-grid" }, ...nn(
    txt ? h("div", { class: "stat", style: "grid-column:1/-1" }, h("span", null, txt)) : null,
    def.workers ? h("div", { class: "stat" }, h("span", null, "👷 Công nhân"), h("b", null, `${def.workers * b.level}`)) : null,
    def.workers ? h("div", { class: "stat" }, h("span", null, "⚙️ Hiệu suất"), h("b", null, `${Math.round(efficiency(g) * 100)}%`)) : null,
    def.housing ? h("div", { class: "stat" }, h("span", null, "🛏️ Chỗ ở"), h("b", null, `${def.housing * b.level}`)) : null,
  )));
}

// ------------------------------------------------------------ house
function houseBody(m: ModalHandle, b: PlacedBuilding, hooks: PanelHooks, render: () => void) {
  const g = app.game;
  const rank = rankOf(g);
  const food = Math.ceil(g.settlers / 4);
  m.body.append(
    h("div", { class: "section-title", style: "margin-top:0" }, `${RANK_NAMES[rank]} — hạng ${rank}/6`),
    h("div", { class: "stat-grid" },
      h("div", { class: "stat" }, h("span", null, "👥 Dân số"), h("b", null, `${population(g)}/${housing(g) || 1}`)),
      h("div", { class: "stat" }, h("span", null, "🧑‍🌾 Dân thường"), h("b", null, String(g.settlers))),
      h("div", { class: "stat" }, h("span", null, "🤝 Đồng đội"), h("b", null, String(residents(g)))),
      h("div", { class: "stat" }, h("span", null, "👷 Cần công nhân"), h("b", null, String(workersNeeded(g)))),
      h("div", { class: "stat" }, h("span", null, "⚙️ Hiệu suất"), h("b", null, `${Math.round(efficiency(g) * 100)}%`)),
      h("div", { class: "stat" }, h("span", null, "✨ Sức hút"), h("b", null, String(appeal(g)))),
      h("div", { class: "stat" }, h("span", null, "🍞 Lương thực/ngày"), h("b", null, String(food))),
      h("div", { class: "stat" }, h("span", null, "🗺️ Lãnh địa"), h("b", null, `${TERRITORY_SIZES[g.territory]}×${TERRITORY_SIZES[g.territory]}`))),
    h("p", { class: "muted small" }, "Người dân dọn tới khi còn chỗ ở và đủ lương thực; họ làm việc trong các công trình sản xuất. Sức hút (trang trí, dịch vụ) giúp dân tới nhanh hơn."),
    h("div", { class: "item-row" },
      h("span", { class: "ico" }, "😴"),
      h("div", { class: "meta" }, h("div", { class: "name" }, "Ngủ một giấc"), h("div", { class: "desc" }, "Qua ngày mới: hồi phục toàn đội, cây trồng lớn lên, công trình sản xuất, dân chúng ăn uống.")),
      h("button", { class: "btn small primary", onclick: () => { m.close(); hooks.sleep(); } }, "Ngủ")),
  );
  if (g.report.length) {
    m.body.append(h("details", null, h("summary", { class: "small muted" }, "Báo cáo sáng nay"), h("div", { class: "report" }, g.report.map((l) => h("div", null, l)))));
  }
  // rank up
  const next = b.level + 1;
  let blocker: string | null = null;
  if (next <= 6) {
    const needs: string[] = [];
    if (population(g) < POP_REQ[next]) needs.push(`dân số ${POP_REQ[next]} (hiện ${population(g)})`);
    if (g.maxFloor < FLOOR_REQ[next]) needs.push(`đã tới tầng ${FLOOR_REQ[next]}`);
    blocker = needs.length ? `Thăng hạng ${RANK_NAMES[next]} cần: ${needs.join(", ")}` : null;
    m.body.append(h("div", { class: "section-title" }, `Thăng hạng → ${RANK_NAMES[next]}`),
      h("p", { class: "muted small" }, rankPerks(next)));
  }
  upgradeRow(m, b, render, blocker);
  // territory
  const nextT = g.territory + 1;
  m.body.append(h("div", { class: "section-title" }, "Lãnh địa"));
  if (nextT < TERRITORY_SIZES.length) {
    const cost = expansionCost(nextT);
    const limit = nextT > maxTerritory(g) ? `Cần thăng hạng khu định cư để mở rộng thêm (tối đa ${TERRITORY_SIZES[maxTerritory(g)]}×${TERRITORY_SIZES[maxTerritory(g)]} ở hạng ${RANK_NAMES[rank]})` : null;
    m.body.append(h("div", { class: "item-row" },
      h("span", { class: "ico" }, "🌳"),
      h("div", { class: "meta" },
        h("div", { class: "name" }, `Mở rộng: ${TERRITORY_SIZES[g.territory]}×${TERRITORY_SIZES[g.territory]} → ${TERRITORY_SIZES[nextT]}×${TERRITORY_SIZES[nextT]}`),
        limit ? h("div", { class: "desc bad" }, limit) : costView(cost)),
      h("button", {
        class: "btn small primary", disabled: !!limit || !canAfford(g, cost),
        onclick: () => {
          if (!pay(g, cost)) return;
          g.territory = nextT;
          logMsg(g, "Thánh Địa được mở rộng.");
          toast("Thánh Địa đã được mở rộng! Mầm vui vẻ nhảy nhót.", "good");
          app.dirty(true);
          render();
        },
      }, "Mở rộng")));
  } else m.body.append(h("p", { class: "muted small" }, "Lãnh địa đã đạt kích thước tối đa."));
}

function rankPerks(rank: number): string {
  return [
    "",
    "",
    "Mở khoá: Chuồng Gia Súc, Hầm Mỏ, Tổ Ong, Ao Cá, Vườn Thảo Dược, Chợ, Quán Rượu, Cổng Hoa.",
    "Mở khoá: Nhà Kính, Vòi Tưới, Nhà Đá, Đền Thờ, Y Quán, Nhà Kho, Tháp Canh, Đài Phun Nước.",
    "Mở khoá: Dinh Thự, Học Viện, Nhà Nuôi Tằm, Tường Thành, Tượng, Công Viên. Thêm 1 ô nội tại cho cả đội.",
    "Mở khoá: Chung Cư. Thêm 1 ô kỹ năng cho cả đội.",
    "Mở khoá: Cung Điện. Thánh Địa trở thành Kinh Đô của Vực Sâu.",
  ][rank] ?? "";
}

// ------------------------------------------------------------ gate (floor teleport)
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
        h("div", { class: "desc" }, `Cấp quái ~${def.levelBase}–${def.levelBase + 4}${fs?.cleared ? " · Boss Canh Cửa đã bị hạ" : " · Boss Canh Cửa còn chặn cầu thang"}${def.handwritten ? " · Có cốt truyện" : ""}`)),
      h("span", { class: "btn small primary" }, "Dịch chuyển")));
  }
  const dead = g.party.filter((id) => g.chars[id].hp <= 0).map((id) => g.chars[id].name);
  m.body.append(...nn(
    h("p", { class: "small" }, "Cổng đưa bạn tới lối vào của bất kỳ tầng nào đã mở khoá. Mỗi tầng có một Boss Canh Cửa — hạ nó để mở đường xuống tầng kế tiếp."),
    dead.length ? h("p", { class: "bad small" }, `⚠️ ${dead.join(", ")} đang bất tỉnh. Hãy ngủ ở Nhà Chính hoặc dùng Lông Phượng Hoàng trước khi đi.`) : null,
    list,
  ));
}

// ------------------------------------------------------------ farming
const rng = () => new Rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);

export function harvestMany(plots: PlotState[]) {
  const g = app.game;
  const got: Record<string, number> = {};
  const r = rng();
  for (const p of plots) for (const [id, n] of Object.entries(harvest(g, p, r))) got[id] = (got[id] ?? 0) + n;
  const total = Object.values(got).reduce((a, b) => a + b, 0);
  if (total) toast(`🧺 Thu hoạch: ${Object.entries(got).map(([id, n]) => `${getItem(id).icon}${getItem(id).name}×${n}`).join(", ")}`, "good", 4000);
  app.dirty();
}

function plotSummary(p: PlotState, greenhouse: boolean): HTMLElement {
  const g = app.game;
  const info = cropInfo(g, p, greenhouse);
  if (!info) return h("div", { class: "desc" }, `${SOIL_NAMES[p.soil]} · ${greenhouse ? "Nhà kính" : p.watered ? "Đã tưới" : "Chưa tưới"} · trống`);
  const d = info.def;
  return h("div", { class: "desc" },
    info.ready ? "✨ Đã chín! " : `Còn ~${info.left} ngày · `,
    info.inSeason ? "" : h("span", { class: "bad" }, "trái mùa (chậm) · "),
    `${SOIL_NAMES[p.soil]} · ${greenhouse ? "tưới tự động" : p.watered ? "đã tưới" : d.water ? "cần tưới!" : "chịu hạn"}`,
    d.regrow ? ` · thu hoạch lần ${p.crop!.harvests + 1}, tái sinh sau ${d.regrow} ngày` : "",
    p.crop!.perfect ? " · 🌟 chăm sóc hoàn hảo (+50%)" : "");
}

/** Detail + actions for one plot (field or greenhouse bed). */
function plotBody(m: ModalHandle, p: PlotState, greenhouse: boolean, render: () => void) {
  const g = app.game;
  const season = seasonOf(g.day);
  const info = cropInfo(g, p, greenhouse);
  if (info) {
    const it = getItem(info.def.id);
    m.body.append(h("div", { class: "item-row" },
      h("span", { class: "ico" }, itemImg(it.id)),
      h("div", { class: "meta" }, h("div", { class: "name" }, it.name), plotSummary(p, greenhouse)),
      ...nn(
        info.ready ? h("button", { class: "btn small good", onclick: () => { harvestMany([p]); render(); } }, "Thu hoạch") : null,
        !greenhouse && !p.watered ? h("button", { class: "btn small blue", onclick: () => { p.watered = true; app.dirty(); render(); } }, "💧 Tưới") : null,
        h("button", {
          class: "btn small",
          onclick: async () => { if (await confirmBox("Nhổ bỏ", `Nhổ bỏ ${it.name}? Cây sẽ mất.`)) { p.crop = undefined; app.dirty(); render(); } },
        }, "✂️"))));
  } else {
    m.body.append(h("div", { class: "item-row" },
      h("span", { class: "ico" }, "🟫"),
      h("div", { class: "meta" }, h("div", { class: "name" }, "Ô đất trống"), plotSummary(p, greenhouse)),
      !greenhouse && !p.watered ? h("button", { class: "btn small blue", onclick: () => { p.watered = true; app.dirty(); render(); } }, "💧 Tưới") : null));
    const seeds = Object.keys(g.inventory).map(getItem).filter((it) => (it.type === "seed" || it.type === "sapling") && it.crop && CROPS[it.crop]);
    m.body.append(h("div", { class: "section-title" }, `Gieo trồng · mùa ${SEASON_ICONS[season]} ${SEASON_NAMES[season]}`));
    if (!seeds.length) m.body.append(h("p", { class: "muted" }, "Bạn không có hạt giống nào. Mua ở chợ các làng dưới Vực Sâu, nhặt khi khám phá, hoặc có được khi thu hoạch."));
    seeds.sort((a, z) => Number(CROPS[z.crop!].seasons.includes(season)) - Number(CROPS[a.crop!].seasons.includes(season)));
    const list = h("div", { class: "list" });
    for (const s of seeds) {
      const c = CROPS[s.crop!];
      const ok = greenhouse || c.seasons.includes(season);
      list.append(h("div", { class: "item-row" },
        h("span", { class: "ico" }, itemImg(s.id)),
        h("div", { class: "meta" },
          h("div", { class: "name" }, s.name, h("span", { class: "qty" }, ` ×${g.inventory[s.id]}`), ok ? null : h("span", { class: "tag bad" }, "trái mùa")),
          h("div", { class: "desc" },
            `${c.days} ngày${c.regrow ? `, tái sinh mỗi ${c.regrow} ngày` : ""} → ${c.yield[0]}–${c.yield[1]} ${getItem(c.id).name} · `,
            `mùa ${c.seasons.map((x) => SEASON_ICONS[x]).join("")} · ${["chịu hạn", "cần nước", "rất khát"][c.water]}`,
            c.hybrid ? ` · giống lai` : "")),
        h("button", { class: "btn small primary", onclick: () => { if (removeItem(g, s.id, 1)) { plant(p, c.id); toast(`Đã gieo ${getItem(c.id).name}.`, "good"); app.dirty(); render(); } } }, "Gieo")));
    }
    m.body.append(list);
  }
  const ferts = Object.keys(g.inventory).map(getItem).filter((it) => it.type === "fertilizer" && it.fert);
  if (ferts.length && p.soil < 3) {
    m.body.append(h("div", { class: "section-title" }, `Bón phân · ${SOIL_NAMES[p.soil]}`));
    for (const f of ferts) {
      m.body.append(h("div", { class: "item-row" },
        h("span", { class: "ico" }, itemImg(f.id)),
        h("div", { class: "meta" }, h("div", { class: "name" }, f.name, h("span", { class: "qty" }, ` ×${g.inventory[f.id]}`)), h("div", { class: "desc" }, f.desc)),
        h("button", { class: "btn small", onclick: () => { if (removeItem(g, f.id, 1)) { toast(applyFertilizer(p, f.id), "good"); app.dirty(); render(); } } }, "Bón")));
    }
  }
}

function bulkFarmActions(m: ModalHandle, render: () => void) {
  const g = app.game;
  const plots = allPlots(g);
  const fields = plots.filter((x) => !x.greenhouse).map((x) => x.plot);
  const ready = plots.filter((x) => isReady(x.plot.crop)).map((x) => x.plot);
  const dry = fields.filter((p) => !p.watered);
  const empty = fields.filter((p) => !p.crop);
  const hasWell = g.buildings.some((b) => b.type === "well");
  const w = WEATHER[g.weather];
  m.body.append(h("div", { class: "section-title" }, "Cả nông trại"),
    h("p", { class: "small muted", style: "margin:0 0 6px" }, `Hôm nay: ${w.icon} ${w.name} · ${fields.length} ô ruộng · ${empty.length} trống · ${dry.length} chưa tưới · ${ready.length} chín.${isWetNow() ? " Trời mưa — ruộng tự được tưới." : ""}`),
    h("div", { class: "row" }, ...nn(
      ready.length ? h("button", { class: "btn good", onclick: () => { harvestMany(ready); render(); } }, `🧺 Thu hoạch tất cả (${ready.length})`) : null,
      dry.length ? h("button", {
        class: "btn blue", disabled: !hasWell, title: hasWell ? "" : "Cần xây Giếng Nước",
        onclick: () => { for (const p of dry) p.watered = true; app.dirty(); toast(`Đã tưới ${dry.length} ô.`, "good"); render(); },
      }, hasWell ? `💧 Tưới tất cả (${dry.length})` : "💧 Tưới tất cả (cần Giếng)") : null,
    )));
  if (empty.length > 1) {
    const season = seasonOf(g.day);
    const seeds = Object.keys(g.inventory).map(getItem).filter((it) => (it.type === "seed" || it.type === "sapling") && it.crop && CROPS[it.crop] && CROPS[it.crop].seasons.includes(season));
    if (seeds.length) m.body.append(h("div", { class: "row", style: "margin-top:6px" }, h("span", { class: "small muted" }, "Gieo hàng loạt:"),
      seeds.map((s) => h("button", {
        class: "btn small", title: s.name,
        onclick: () => {
          let n = 0;
          for (const p of empty) { if (!removeItem(g, s.id, 1)) break; plant(p, s.crop!); n++; }
          toast(`Đã gieo ${n} ô ${getItem(s.crop!).name}.`, "good");
          app.dirty();
          render();
        },
      }, itemImg(s.id, "iicon xs"), ` ×${Math.min(empty.length, g.inventory[s.id] ?? 0)}`))));
  }
}

const isWetNow = () => ["rain", "storm", "snow"].includes(app.game.weather);

function farmBody(m: ModalHandle, b: PlacedBuilding, render: () => void) {
  b.plot ??= { soil: 0, watered: false };
  plotBody(m, b.plot, false, render);
  bulkFarmActions(m, render);
  genericFooter(m, b, render);
}

let ghSel = 0;
function greenhouseBody(m: ModalHandle, b: PlacedBuilding, render: () => void) {
  const slots = ensureSlots(b);
  if (ghSel >= slots.length) ghSel = 0;
  m.body.append(h("div", { class: "plot-grid" }, slots.map((p, i) => {
    const info = cropInfo(app.game, p, true);
    return h("button", { class: `plot wet ${info?.ready ? "ready" : ""} ${i === ghSel ? "sel" : ""}`, onclick: () => { ghSel = i; render(); } },
      info ? itemImg(info.def.id) : h("span", { style: "font-size:24px" }, "🟫"),
      h("span", null, info ? (info.ready ? "Chín!" : `${info.left} ngày`) : "Trống"));
  })));
  plotBody(m, slots[ghSel], true, render);
  const ready = slots.filter((p) => isReady(p.crop));
  if (ready.length > 1) m.body.append(h("button", { class: "btn good block", style: "margin-top:8px", onclick: () => { harvestMany(ready); render(); } }, `🧺 Thu hoạch cả nhà kính (${ready.length})`));
  genericFooter(m, b, render);
}

// ------------------------------------------------------------ crafting stations
const stationState: Record<string, { cat: string; q: string; can: boolean }> = {};

function recipeCategory(it: ItemDef): string {
  if (it.equip) return GEAR_NAMES[it.equip.slot].replace(" 1", "");
  return TYPE_NAMES[it.type];
}

function stationBody(m: ModalHandle, b: PlacedBuilding, station: Station, render: () => void) {
  const g = app.game;
  const st = (stationState[station] ??= { cat: "", q: "", can: false });
  const all = RECIPES.filter((r) => r.station === station && r.level <= b.level + 1);
  const hiddenCount = RECIPES.filter((r) => r.station === station && r.level > b.level + 1).length;
  const cats = [...new Set(all.map((r) => recipeCategory(getItem(r.out))))];
  if (st.cat && !cats.includes(st.cat)) st.cat = "";
  const listEl = h("div", { class: "list" });
  const fill = () => {
    const q = st.q.trim().toLowerCase();
    const rs = all.filter((r) => {
      const it = getItem(r.out);
      if (st.cat && recipeCategory(it) !== st.cat) return false;
      if (q && !it.name.toLowerCase().includes(q) && !Object.keys(r.cost).some((k) => k !== "gold" && getItem(k).name.toLowerCase().includes(q))) return false;
      if (st.can && (r.level > b.level || !canAfford(g, r.cost))) return false;
      return true;
    }).sort((a, z) => Number(canAfford(g, z.cost) && z.level <= b.level) - Number(canAfford(g, a.cost) && a.level <= b.level) || a.level - z.level);
    listEl.replaceChildren(...rs.slice(0, 80).map((r) => recipeRow(r, b, render)));
    if (rs.length > 80) listEl.append(h("p", { class: "muted small" }, `…và ${rs.length - 80} công thức nữa. Hãy lọc hoặc tìm kiếm.`));
    if (!rs.length) listEl.append(h("p", { class: "muted" }, "Không có công thức phù hợp."));
  };
  const search = h("input", { class: "input", placeholder: "Tìm theo tên sản phẩm hoặc nguyên liệu…", value: st.q, oninput: (e: Event) => { st.q = (e.target as HTMLInputElement).value; fill(); } });
  m.body.append(...nn(
    h("div", { class: "section-title" }, `${STATION_NAMES[station]} · ${all.length} công thức`),
    h("div", { class: "cat-list" },
      h("button", { class: st.cat === "" ? "on" : "", onclick: () => { st.cat = ""; render(); } }, "Tất cả"),
      cats.map((c) => h("button", { class: st.cat === c ? "on" : "", onclick: () => { st.cat = c; render(); } }, c))),
    h("div", { class: "searchbar" }, search,
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: st.can, onchange: (e: Event) => { st.can = (e.target as HTMLInputElement).checked; fill(); } }), "Chỉ món làm được")),
    listEl,
    hiddenCount ? h("p", { class: "muted small" }, `Nâng cấp ${BUILDINGS[b.type].name} để mở thêm ${hiddenCount} công thức cao cấp.`) : null,
  ));
  fill();
}

function recipeRow(r: (typeof RECIPES)[number], b: PlacedBuilding, render: () => void): HTMLElement {
  const g = app.game;
  const out = getItem(r.out);
  const locked = r.level > b.level;
  const ok = !locked && canAfford(g, r.cost);
  const craft = (times: number) => {
    let made = 0;
    for (let i = 0; i < times && pay(g, r.cost); i++) { addItem(g, r.out, r.n); made++; }
    if (made) toast(`Đã chế tạo ${out.name} ×${made * r.n}`, "good");
    app.dirty();
    render();
  };
  const desc = out.equip
    ? Object.entries(out.equip.stats).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(" ") + (out.equip.passive ? " · có nội tại" : "")
    : out.desc;
  return h("div", { class: `item-row ${locked ? "locked" : ""}` },
    h("span", { class: "ico" }, itemImg(out.id)),
    h("div", { class: "meta" },
      h("div", { class: "name" }, out.name, r.n > 1 ? ` ×${r.n}` : "", out.tier ? h("span", { class: "tag" }, `Bậc ${out.tier}`) : null, count(g, r.out) ? h("span", { class: "tag" }, `có ${count(g, r.out)}`) : null),
      h("div", { class: "desc" }, locked ? `Cần ${BUILDINGS[b.type].name} cấp ${r.level}` : desc),
      costView(r.cost)),
    locked ? null : h("div", { class: "col", style: "gap:4px" },
      h("button", { class: "btn small primary", disabled: !ok, onclick: () => craft(1) }, "Chế tạo"),
      h("button", { class: "btn small", disabled: !ok, onclick: () => craft(5) }, "×5")));
}

// ------------------------------------------------------------ library
let libTab: "skills" | "passives" | "scrolls" = "skills";
let libChar = "";

function libraryBody(m: ModalHandle, b: PlacedBuilding, render: () => void) {
  const g = app.game;
  if (!g.chars[libChar]) libChar = g.heroId;
  const ch = g.chars[libChar];
  const cls = CLASSES[ch.classId];
  m.body.append(
    h("div", { class: "tabs" },
      h("button", { class: libTab === "skills" ? "on" : "", onclick: () => { libTab = "skills"; render(); } }, "Kỹ năng"),
      h("button", { class: libTab === "passives" ? "on" : "", onclick: () => { libTab = "passives"; render(); } }, "Nội tại"),
      h("button", { class: libTab === "scrolls" ? "on" : "", onclick: () => { libTab = "scrolls"; render(); } }, "Cuộn phép")),
  );
  if (libTab === "scrolls") {
    stationBody(m, b, "library", render);
    genericFooter(m, b, render);
    return;
  }
  m.body.append(
    h("div", { class: "char-tabs" }, Object.values(g.chars).map((c) =>
      h("button", { class: `char-tab ${c.id === ch.id ? "on" : ""}`, onclick: () => { libChar = c.id; render(); } }, spriteImg(c.sprite, c.pal), c.name.split(" ")[0]))),
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
      spriteImg(ch.sprite, ch.pal, "sprite mini-portrait"),
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

let moveHook: (b: PlacedBuilding) => void = () => undefined;
export function setMoveHook(fn: (b: PlacedBuilding) => void) { moveHook = fn; }

/** Morning report modal after sleeping. */
export function showReport(lines: string[], gains: Record<string, number>) {
  const g = app.game;
  const w = WEATHER[g.weather];
  const s = seasonOf(g.day);
  const m = openModal(`☀️ Ngày ${g.day}`);
  m.body.append(
    h("p", { style: "margin-top:0" }, `${SEASON_ICONS[s]} Mùa ${SEASON_NAMES[s]} · ${w.icon} ${w.name}`),
    h("div", { class: "report" }, lines.map((l) => h("div", null, l))),
    Object.keys(gains).length ? h("div", { class: "section-title" }, "Sản lượng qua đêm") : "",
    h("div", { class: "loot", style: "justify-content:flex-start" }, lootChips(gains)),
    h("div", { class: "row end", style: "margin-top:10px" }, h("button", { class: "btn primary", onclick: () => m.close() }, "Bắt đầu ngày mới")));
}
