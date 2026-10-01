import { app, type Screen } from "../app";
import { playMusic } from "../audio/music";
import { sfx } from "../audio/sfx";
import { hashString } from "../core/rng";
import { addItem, buildingCost, canAfford, count, logMsg, pay, takeLevelUps, type PlacedBuilding } from "../core/state";
import { BUILDINGS, BUILDING_LIST, RANK_NAMES, type BuildingCategory } from "../data/buildings";
import { SEASON_ICONS, SEASON_NAMES, seasonOf } from "../data/items";
import { CROP_LIFT, buildingCanvas, cropCanvas } from "../render/buildings";
import { MapView } from "../render/mapview";
import { spriteCanvas } from "../render/pixel";
import { isPerson, personCanvas, type Dir } from "../render/people";
import { T, tileSet } from "../render/tiles";
import { BIOMES } from "../world/biomes";
import { findPath } from "../world/mapgen";
import { SPROUT, SZ_H, SZ_W, blockerAt, buildLimitReason, buildingAt, canPlace, inTerritory, territory } from "../world/sanctuary";
import { confirmBox, h, openModal, toast, topModalOpen } from "../ui/dom";
import { costView, openBuilding, setMoveHook, showReport } from "./buildingPanels";
import { WEATHER, advanceDay, cropStage, ensureSlots, housing, isReady, population, rankName, rankOf, tickFarm } from "../world/town";
import { openHelp, openJournal, openMenu, partyMini, saveDot, showBanner } from "./common";
import { openInventory } from "./inventory";
import { openParty } from "./party";
import { openResidentList } from "./residentList";
import { openResident } from "./residentTalk";
import { ResidentSim } from "../world/residentSim";
import { sceneReady } from "../world/residents";
import { openTodo, todoBadge, todoList } from "./todo";
import { openSanctuaryMarket } from "./settlement";
import { fold } from "../ui/smart";
import { PET, petSpec } from "../data/pets";
import { creatureSmall } from "../render/creatures";
import { showLevelUps } from "../ui/levelup";
import { openCodex } from "./codex";
import { openPlayers } from "./players";
import { checkGifts, giftsWaiting, openGifts } from "./gifts";
import type { PlayerVisit } from "../net/api";

const SPROUT_TIPS = [
  "Cậu đã gieo hạt chưa? Ngủ một giấc là cây lớn thêm một ngày đó!",
  "Tưới nước mỗi ngày thì cây 'chăm sóc hoàn hảo' — lúc thu hoạch được gấp rưỡi! Ngày mưa thì trời tưới giùm.",
  "Mỗi mùa kéo dài 7 ngày. Cây trồng trái mùa lớn rất chậm, trừ khi trồng trong Nhà Kính.",
  "Bón phân làm đất màu mỡ hơn. Hố Ủ Phân biến cỏ rác và xương thành phân bón.",
  "Trồng hai loại cây bố mẹ cạnh một ô trống... biết đâu có giống lai mọc lên đấy!",
  "Dân cư sẽ dọn tới khi có chỗ ở và đủ lương thực. Họ làm việc ở Trại Đốn Gỗ, Mỏ Đá, Hầm Mỏ...",
  "Thăng hạng Thánh Địa từ Trại lên Xóm, Làng, Thị Trấn, Thành Phố rồi Kinh Đô để mở khoá công trình lớn.",
  "Ở Quán Rượu và các làng dưới Vực Sâu có rất nhiều người có thể chiêu mộ. Đội chỉ mang theo 3 người cùng cậu thôi.",
  "Mỗi tầng có một Boss Canh Cửa. Đã hạ nó thì Cổng Vực Sâu có thể đưa cậu thẳng tới tầng đó.",
  "Bếp Lửa biến lúa thành bánh mì — món ăn hồi máu rất tốt khi xuống Vực Sâu.",
  "Phòng Giả Kim có thể làm Bình Nước Thánh. Tạt nước lên kẻ địch rồi dùng phép sét... Bùm! Điện Giật!",
  "Thư Viện Phép giúp cậu học kỹ năng mới bằng Tinh Thể Ma Lực. Kỹ năng ngoài sở trường thì đắt gấp đôi.",
  "Mỗi tầng Vực Sâu đều có một Boss Canh Cửa. Đánh bại nó thì cầu thang mới mở.",
  "Nếu cậu gục ngã dưới đó, tớ sẽ kéo cậu về... nhưng một nửa chiến lợi phẩm sẽ rơi mất.",
  "Tớ thích khi Thánh Địa rộng ra. Cảm giác như... được lớn lên vậy. Hì hì.",
  "Mỗi người ở Thánh Địa thích nói về những chuyện khác nhau. Trò chuyện nhiều rồi cậu sẽ biết ai mê câu cá, ai ghét phép thuật!",
  "Thấy dấu ❗ trên đầu ai đó là họ có chuyện muốn kể riêng với cậu đó.",
  "Tớ có bán Bó Hoa Tỏ Tình và Nhẫn Đính Ước ở mục 💞 Cư dân. Hì hì, cậu để ý ai rồi hả?",
  "Nhớ sinh nhật mọi người nha. Quà sinh nhật được quý gấp ba đấy!",
];

/**
 * Trees whose canopy (2 tiles wide, 3 tall, trunk mid-tile) can reach into the territory. They
 * can stand in front of buildings and people, so they are drawn y-sorted with them instead of
 * being baked into the ground.
 */
const reachesIn = (terr: ReturnType<typeof territory>, x: number, y: number) =>
  y - 2 < terr.y1 && y > terr.y0 && x + 1 >= terr.x0 && x - 1 < terr.x1;

/** The forest around the sanctuary: [x, y, sprite] for every tall tree outside the territory. */
function forestTrees(terr: ReturnType<typeof territory>): [number, number, HTMLCanvasElement][] {
  const tiles = tileSet(BIOMES.forest);
  const out: [number, number, HTMLCanvasElement][] = [];
  for (let y = 0; y < SZ_H; y++) for (let x = 0; x < SZ_W; x++) {
    const hsh = hashString(`${x},${y}`);
    const inside = x >= terr.x0 && y >= terr.y0 && x < terr.x1 && y < terr.y1;
    if (!inside && hsh % 3 !== 0 && (x + y) % 2 === 0) out.push([x, y, tiles.tall[hsh % tiles.tall.length]]);
  }
  return out;
}

/** Trees at the edge of the territory, to be drawn y-sorted every frame. */
export function edgeTrees(terr: ReturnType<typeof territory>) {
  return forestTrees(terr).filter(([x, y]) => reachesIn(terr, x, y));
}

/** Draws one forest tree (trunk mid-tile). */
export function drawTree(view: MapView, x: number, y: number, tall: HTMLCanvasElement, see = false) {
  view.img(tall, x - 0.5, y - 2 - 6 / 16, { w: 2, h: 3, alpha: see ? 0.45 : 1 });
}

/** Whether a tree at (x, y) would hide part of a building or someone standing in the territory. */
export function treeHides(x: number, y: number, buildings: PlacedBuilding[], people: { x: number; y: number }[]) {
  const under = (px: number, py: number) => py >= y - 2 && py <= y - 1 && px >= x - 1 && px <= x + 1;
  if (people.some((p) => under(Math.round(p.x), Math.round(p.y)))) return true;
  return buildings.some((b) => {
    const [w, h] = BUILDINGS[b.type].size;
    return b.x - 1 <= x + 1 && b.x + w - 1 >= x - 1 && b.y - 1 <= y - 1 && b.y + h - 1 >= y - 2;
  });
}

/** Pre-rendered sanctuary ground: grass, forest outside the territory, darkness past the border. */
export function sanctuaryGround(terr: ReturnType<typeof territory>): HTMLCanvasElement {
  const tiles = tileSet(BIOMES.forest);
  const cv = document.createElement("canvas");
  cv.width = SZ_W * 16;
  cv.height = SZ_H * 16;
  const gc = cv.getContext("2d")!;
  gc.imageSmoothingEnabled = false;
  for (let y = 0; y < SZ_H; y++) {
    for (let x = 0; x < SZ_W; x++) {
      const hsh = hashString(`${x},${y}`);
      const inside = x >= terr.x0 && y >= terr.y0 && x < terr.x1 && y < terr.y1;
      const type = inside ? (hsh % 9 === 0 ? T.DECOR : T.GROUND) : (hsh % 3 === 0 ? T.GROUND : T.OBSTACLE);
      gc.drawImage(tiles.tiles[type === T.OBSTACLE ? T.GROUND : type][hsh % 4], x * 16, y * 16);
      if (!inside) {
        const d = Math.max(terr.x0 - x, x - terr.x1 + 1, terr.y0 - y, y - terr.y1 + 1);
        gc.fillStyle = `rgba(3,6,5,${Math.min(0.92, 0.35 + d * 0.14)})`;
        gc.fillRect(x * 16, y * 16, 16, 16);
      }
    }
  }
  // trees that can stand in front of something are drawn live (edgeTrees), the rest are baked in
  for (const [x, y, tall] of forestTrees(terr)) if (!reachesIn(terr, x, y)) gc.drawImage(tall, (x - 0.5) * 16, (y - 2) * 16 - 6, 32, 48);
  return cv;
}

export function mountSafeZone(root: HTMLElement, hooks: { enterDungeon: (floor: number) => void; visit: (p: PlayerVisit) => void }): Screen {
  playMusic("sanctuary");
  const g = app.game;
  const el = h("div", { class: "screen" });
  root.append(el);
  const view = new MapView(el);

  // hero position
  const hero = { x: SPROUT.x + 3, y: SPROUT.y + 2, px: SPROUT.x + 3, py: SPROUT.y + 2, path: [] as { x: number; y: number }[], t: 0, flip: false, dir: 0 as Dir };
  view.camX = hero.x;
  view.camY = hero.y;
  const petPos = { x: hero.x - 1, y: hero.y };
  let placing: { type: string; moving?: PlacedBuilding; x: number; y: number; built?: number } | null = null;
  /** Several buildings picked at once, to clear them or move them together. */
  let sel: { set: Set<PlacedBuilding>; corner: { x: number; y: number } | null; move: { ax: number; ay: number; dx: number; dy: number } | null } | null = null;
  const sim = new ResidentSim(g);
  let ground: HTMLCanvasElement | null = null;
  let edge: [number, number, HTMLCanvasElement][] = [];
  let groundSig = "";
  let talkingTo: string | null = null;
  const marks = new Map<string, boolean>(); // "!" markers, refreshed every few seconds
  let markT = 0;
  let farmT = 0;
  const talkTo = (id: string) => {
    const ch = app.game.chars[id];
    if (!ch) return;
    talkingTo = id;
    const a = sim.get(id);
    if (a) { a.dir = 2; a.flip = hero.px < a.px; }
    openResident(ch, () => { talkingTo = null; marks.set(id, sceneReady(app.game, ch)); updateHud(); });
  };

  // ------------------------------------------------------------ HUD
  const title = h("div", { class: "chip title" }, "Thánh Địa", h("small", null, ""));
  const gold = h("div", { class: "chip" });
  const party = partyMini();
  const updateHud = () => {
    const gg = app.game;
    const s = seasonOf(gg.day);
    (title.firstChild as Text).textContent = `${rankName(gg)} Thánh Địa`;
    (title.lastChild as HTMLElement).textContent = `Ngày ${gg.day} · ${SEASON_ICONS[s]} ${SEASON_NAMES[s]} · ${WEATHER[gg.weather].icon} · 👥 ${population(gg)}/${Math.max(1, housing(gg))}`;
    gold.replaceChildren("💰 ", h("b", null, String(app.game.gold)), "  🖤 ", h("b", null, String(app.game.inventory.black_thorn ?? 0)), "  ", saveDot());
    party.update();
    updateBadges();
  };
  // dock badges: things that want attention, refreshed with the HUD and every few seconds
  const todoHooks = () => ({ talkTo: walkToResident, refresh: updateHud });
  // what each dock entry wants attention for; a group shows the sum of its entries
  const counts: Record<string, number> = {};
  const groupBadges: { el: HTMLElement; keys: string[] }[] = [];
  function updateBadges() {
    const gg = app.game;
    const list = todoList(gg, todoHooks());
    counts.todo = todoBadge(list);
    counts.party = list.filter((t) => t.kind === "party" || t.kind === "tome").length;
    counts.res = list.filter((t) => t.kind === "resident").length;
    counts.bag = gg.newItems?.length ?? 0;
    counts.gift = giftsWaiting();
    for (const gb of groupBadges) gb.el.textContent = String(gb.keys.reduce((n, k) => n + (counts[k] ?? 0), 0) || "");
  }
  function walkToResident(id: string) {
    const a = sim.get(id);
    if (!a) return;
    const path = findPath({ w: SZ_W, h: SZ_H }, walkable, hero.x, hero.y, a.x, a.y, 5000);
    if (path) { hero.path = path.slice(0, -1); toast(`Đang tới chỗ ${app.game.chars[id].name.split(" ")[0]}…`); }
  }
  el.append(h("div", { class: "hud-top" }, h("div", { class: "col", style: "gap:6px" }, title, party.el), h("div", { class: "hud-right" }, gold)));
  el.append(h("div", { class: "zoom" },
    h("button", { class: "icon-btn", onclick: () => view.zoom(1) }, "＋"),
    h("button", { class: "icon-btn", onclick: () => view.zoom(-1) }, "－"),
    h("button", { class: "icon-btn", title: "Về chỗ nhân vật", onclick: () => { view.camX = hero.px; view.camY = hero.py; } }, "◎")));
  // the dock keeps to a few buttons; related screens are grouped behind one button
  const dock = h("div", { class: "dock" },
    dockBtn("📌", "Việc", () => openTodo(todoHooks()), "todo"),
    dockBtn("🔨", "Xây", () => openBuildMenu()),
    dockGroup("👥", "Đội", [
      { icon: "👥", label: "Đội hình", fn: () => openParty({ inDungeon: false, onChange: updateHud }), badge: "party" },
      { icon: "💞", label: "Cư dân", fn: () => openResidentList({ find: walkToResident, onClose: updateHud }), badge: "res" },
    ]),
    dockGroup("🎒", "Đồ đạc", [
      { icon: "🎒", label: "Túi đồ", fn: () => openInventory({ canSell: true, onChange: updateHud }), badge: "bag" },
      { icon: "💰", label: "Bán hàng loạt", fn: () => openSanctuaryMarket(updateHud) },
    ]),
    dockBtn("🌀", "Vực Sâu", () => { const gate = app.game.buildings.find((b) => b.type === "gate"); if (gate) openB(gate); }),
    dockGroup("🌐", "Kết nối", [
      { icon: "🎁", label: "Hòm quà", fn: () => openGifts({ onChange: updateHud }), badge: "gift" },
      { icon: "🌐", label: "Người chơi", fn: () => openPlayers(hooks.visit) },
    ]),
    dockGroup("⚙️", "Menu", [
      { icon: "📜", label: "Nhật ký", fn: () => openJournal() },
      { icon: "📖", label: "Sổ tay quái", fn: () => openCodex() },
      { icon: "⚙️", label: "Cài đặt & lưu", fn: () => openMenu() },
    ]),
  );
  el.append(dock);
  // one cheap, throttled look at the gift box when arriving home
  void checkGifts().then(() => { if (dock.isConnected) updateBadges(); });
  const placeBar = h("div", { class: "place-bar hidden" });
  el.append(placeBar);
  updateHud();

  function dockBtn(icon: string, label: string, fn: () => void, badge?: string) {
    const b = h("button", { onclick: () => { closeDockMenu(); fn(); } }, h("span", null, icon), h("span", null, label));
    if (badge) { const e = h("span", { class: "dock-badge" }); groupBadges.push({ el: e, keys: [badge] }); b.append(e); }
    return b;
  }
  type DockItem = { icon: string; label: string; fn: () => void; badge?: string };
  let dockMenu: HTMLElement | null = null;
  let dockMenuFor = "";
  const outside = (e: PointerEvent) => { if (dockMenu && !dockMenu.contains(e.target as Node) && !(e.target as HTMLElement).closest?.(".dock")) closeDockMenu(); };
  function closeDockMenu() {
    dockMenu?.remove(); dockMenu = null; dockMenuFor = "";
    document.removeEventListener("pointerdown", outside, true);
  }
  function dockGroup(icon: string, label: string, items: DockItem[]) {
    const b = h("button", { class: "has-menu", onclick: () => openDockMenu(b, label, items) }, h("span", null, icon), h("span", null, label));
    const keys = items.map((i) => i.badge).filter((k): k is string => !!k);
    if (keys.length) { const e = h("span", { class: "dock-badge" }); groupBadges.push({ el: e, keys }); b.append(e); }
    return b;
  }
  function openDockMenu(anchor: HTMLElement, label: string, items: DockItem[]) {
    if (dockMenuFor === label) return closeDockMenu();
    closeDockMenu();
    const r = anchor.getBoundingClientRect(), er = el.getBoundingClientRect();
    dockMenu = h("div", { class: "dock-menu" }, items.map((it) => h("button", { onclick: () => { closeDockMenu(); it.fn(); } },
      h("span", { class: "dm-ico" }, it.icon), h("span", null, it.label),
      it.badge && counts[it.badge] ? h("span", { class: "dm-badge" }, String(counts[it.badge])) : null)));
    const cx = Math.max(84, Math.min(er.width - 84, r.left + r.width / 2 - er.left));
    dockMenu.style.left = `${cx}px`;
    dockMenu.style.bottom = `${er.bottom - r.top + 8}px`;
    el.append(dockMenu);
    dockMenuFor = label;
    setTimeout(() => document.addEventListener("pointerdown", outside, true));
  }

  const openB = (b: PlacedBuilding) => openBuilding(b, {
    refresh: updateHud,
    sleep: () => {
      sfx("sleep");
      const rep = advanceDay(app.game);
      app.checkpoint(`Ngày ${app.game.day}`);
      showBanner(el, `Ngày ${app.game.day}`, "Cả đội đã hồi phục hoàn toàn");
      showReport(rep.lines, rep.gains);
      void showLevelUps(takeLevelUps());
      updateHud();
    },
    enterDungeon: (f) => hooks.enterDungeon(f),
  });
  setMoveHook((b) => startPlacing(b.type, b));

  // ------------------------------------------------------------ building
  let buildCat: BuildingCategory = "farm";
  const CAT_NAMES: Record<BuildingCategory, string> = { core: "Cốt lõi", farm: "Nông trại", production: "Sản xuất", craft: "Chế tạo", housing: "Nhà ở", service: "Dịch vụ", decor: "Trang trí" };
  let buildQ = "";
  let buildOnlyOk = false;
  function openBuildMenu() {
    const m = openModal("🔨 Xây Dựng", { wide: true });
    const tools = h("div", { class: "build-tools" },
      h("button", { class: "btn small", onclick: () => { m.close(); startSelect(); } }, "🧰 Chọn nhiều — dỡ hoặc dời hàng loạt"));
    let focusSearch = false;
    const render = () => {
      const rank = rankOf(g);
      const list = h("div", { class: "list" });
      const q = fold(buildQ.trim());
      // searching looks through every category; otherwise the chosen tab
      const defs = BUILDING_LIST.filter((d) => !d.fixed && (q ? fold(`${d.name} ${d.desc}`).includes(q) : d.category === buildCat))
        .map((def) => ({ def, limit: buildLimitReason(g, def.id), cost: buildingCost(def.id, 0) }))
        .map((x) => ({ ...x, ok: !x.limit && canAfford(g, x.cost) }))
        .filter((x) => !buildOnlyOk || x.ok)
        .sort((a, b) => Number(b.ok) - Number(a.ok) || Number(!!a.limit) - Number(!!b.limit));
      for (const { def, limit, cost, ok } of defs) {
        const n = g.buildings.filter((b) => b.type === def.id).length;
        list.append(h("div", { class: `item-row ${limit ? "locked" : ""}` },
          h("span", { class: "ico" }, def.icon),
          h("div", { class: "meta" },
            h("div", { class: "name" }, def.name, h("span", { class: "tag" }, `${def.size[0]}×${def.size[1]}`), def.rank > 1 ? h("span", { class: "tag" }, RANK_NAMES[def.rank]) : null, n ? h("span", { class: "tag" }, `đã có ${n}`) : null),
            h("div", { class: "desc" }, def.desc),
            limit ? h("div", { class: "desc bad" }, limit) : costView(cost)),
          h("button", { class: "btn small primary", disabled: !ok, onclick: () => { m.close(); startPlacing(def.id); } }, "Chọn")));
      }
      if (!defs.length) list.append(h("p", { class: "muted" }, buildOnlyOk ? "Chưa đủ nguyên liệu cho công trình nào ở đây. Bỏ lọc để xem cần gì." : "Không tìm thấy công trình nào."));
      let timer = 0;
      const search = h("input", {
        class: "input", placeholder: "Tìm công trình (vd: nhà, lò, hoa)…", value: buildQ,
        oninput: (e: Event) => { const v = (e.target as HTMLInputElement).value; clearTimeout(timer); timer = window.setTimeout(() => { buildQ = v; focusSearch = true; render(); }, 250); },
      }) as HTMLInputElement;
      const okCount = BUILDING_LIST.filter((d) => !d.fixed && !buildLimitReason(g, d.id) && canAfford(g, buildingCost(d.id, 0))).length;
      m.body.replaceChildren(
        tools,
        h("p", { class: "muted small", style: "margin-top:0" }, `Hạng hiện tại: ${RANK_NAMES[rank]}. Chọn công trình rồi chạm vào vị trí muốn đặt trên bản đồ. Có ${okCount} công trình đủ nguyên liệu để xây ngay.`),
        h("div", { class: "searchbar" }, search,
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: buildOnlyOk, onchange: (e: Event) => { buildOnlyOk = (e.target as HTMLInputElement).checked; render(); } }), "Chỉ hiện cái xây được")),
        q ? h("p", { class: "muted small" }, `Kết quả tìm "${buildQ}" trong mọi mục:`) : h("div", { class: "cat-list" }, (Object.keys(CAT_NAMES) as BuildingCategory[]).filter((c) => c !== "core").map((c) =>
          h("button", { class: c === buildCat ? "on" : "", onclick: () => { buildCat = c; render(); } }, CAT_NAMES[c]))),
        list);
      if (focusSearch) { focusSearch = false; search.focus(); search.setSelectionRange(buildQ.length, buildQ.length); }
    };
    render();
  }

  function startPlacing(type: string, moving?: PlacedBuilding) {
    const t = territory(g.territory);
    placing = { type, moving, x: moving?.x ?? Math.round(view.camX), y: moving?.y ?? Math.round(view.camY) };
    placing.x = Math.max(t.x0, Math.min(t.x1 - BUILDINGS[type].size[0], placing.x));
    placing.y = Math.max(t.y0, Math.min(t.y1 - BUILDINGS[type].size[1], placing.y));
    view.pannable = true;
    dock.classList.add("hidden");
    renderPlaceBar();
  }

  function renderPlaceBar() {
    if (!placing) { placeBar.classList.add("hidden"); return; }
    const p = placing;
    const reason = canPlace(g, p.type, p.x, p.y, p.moving);
    placeBar.classList.remove("hidden");
    const built = p.built ?? 0;
    const label = reason ? `❌ ${reason}` : `✅ ${BUILDINGS[p.type].name} — chạm để chọn chỗ`;
    placeBar.replaceChildren(
      h("div", { class: "chip" }, label, built ? h("span", { class: "muted small" }, ` · đã đặt ${built}`) : null,
        p.moving ? null : h("span", { class: "muted small" }, ` · đủ cho ${affordable(p.type)} cái`)),
      h("button", { class: "btn primary", disabled: !!reason, onclick: confirmPlace }, "✓ Đặt"),
      h("button", { class: "btn", onclick: stopPlacing }, built ? "✔ Xong" : "✕ Huỷ"));
  }

  /** How many more of a building the bag can pay for (capped for display). */
  function affordable(type: string) {
    const cost = buildingCost(type, 0);
    const n = Math.min(99, ...Object.entries(cost).map(([id, need]) => (need > 0 ? Math.floor(count(g, id) / need) : 99)));
    return n >= 99 ? "99+" : String(n);
  }

  function confirmPlace() {
    if (!placing) return;
    const p = placing;
    if (canPlace(g, p.type, p.x, p.y, p.moving)) return;
    if (p.moving) {
      p.moving.x = p.x;
      p.moving.y = p.y;
    } else {
      const limit = buildLimitReason(g, p.type);
      if (limit) { toast(limit, "bad"); return stopPlacing(); }
      if (!pay(g, buildingCost(p.type, 0))) { toast("Không đủ nguyên liệu.", "bad"); return stopPlacing(); }
      const nb: PlacedBuilding = { id: `b_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, type: p.type, x: p.x, y: p.y, level: 1 };
      if (p.type === "farm") nb.plot = { soil: 0, watered: false };
      if (p.type === "greenhouse") ensureSlots(nb);
      g.buildings.push(nb);
      logMsg(g, `Xây ${BUILDINGS[p.type].name}.`);
      sfx("build");
      if (!p.built) toast(`Đã xây ${BUILDINGS[p.type].name}!`, "good");
    }
    app.dirty();
    // keep building the same thing: stay in placing mode, next to the one just placed,
    // until the player is done (or it can't be built again)
    const again = !p.moving && !buildLimitReason(g, p.type) && canAfford(g, buildingCost(p.type, 0));
    if (again) {
      const [w, hh] = BUILDINGS[p.type].size;
      const next = [[p.x + w, p.y], [p.x, p.y + hh], [p.x - w, p.y], [p.x, p.y - hh]].find(([x, y]) => !canPlace(g, p.type, x, y)) ?? [p.x, p.y];
      placing = { type: p.type, x: next[0], y: next[1], built: (p.built ?? 0) + 1 };
      renderPlaceBar(); updateHud(); return;
    }
    if (!p.moving) {
      const why = buildLimitReason(g, p.type);
      if (why && !BUILDINGS[p.type].unique) toast(why, "info");
      else if (!why) toast("Hết nguyên liệu để xây thêm.", "info");
    }
    stopPlacing();
  }

  function stopPlacing() {
    placing = null;
    view.pannable = false;
    dock.classList.remove("hidden");
    renderPlaceBar();
    updateHud();
  }

  // ------------------------------------------------------------ pick several buildings: clear or move them together
  const movable = (b: PlacedBuilding) => !BUILDINGS[b.type].fixed;
  function startSelect() {
    closeDockMenu();
    sel = { set: new Set(), corner: null, move: null };
    view.pannable = true;
    dock.classList.add("hidden");
    renderSelBar();
  }
  function stopSelect() {
    sel = null;
    view.pannable = false;
    dock.classList.remove("hidden");
    placeBar.classList.remove("sel");
    renderPlaceBar();
    updateHud();
  }
  function selBounds() {
    let x0 = Infinity, y0 = Infinity;
    for (const b of sel!.set) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); }
    return { x0, y0 };
  }
  /** Why the group can't go where it is being moved (null when it can). */
  function moveProblem(): string | null {
    if (!sel?.move) return null;
    for (const b of sel.set) {
      const why = canPlace(g, b.type, b.x + sel.move.dx, b.y + sel.move.dy, sel.set);
      if (why) return `${BUILDINGS[b.type].name}: ${why}`;
    }
    return null;
  }
  function renderSelBar() {
    if (!sel) return;
    const s = sel;
    const n = s.set.size;
    placeBar.classList.remove("hidden");
    placeBar.classList.add("sel");
    const btn = (label: string, fn: () => void, cls = "btn", disabled = false) => h("button", { class: cls, disabled, onclick: fn }, label);
    if (s.move) {
      const bad = moveProblem();
      const still = !s.move.dx && !s.move.dy;
      placeBar.replaceChildren(
        h("div", { class: "chip" }, bad ? `❌ ${bad}` : still ? `↔️ Chạm vào chỗ mới cho góc trên-trái của nhóm ${n} công trình` : `✅ Dời ${n} công trình tới đây?`),
        btn("✓ Đặt", applyMove, "btn primary", !!bad || still),
        btn("↩ Quay lại", () => { s.move = null; renderSelBar(); }));
      return;
    }
    placeBar.replaceChildren(
      h("div", { class: "chip" }, n ? `Đã chọn ${n} công trình` : "Chạm công trình để chọn / bỏ chọn", s.corner ? " · chạm góc còn lại của vùng" : n ? "" : " · hoặc chạm 2 ô trống làm 2 góc để chọn cả vùng"),
      btn("↔️ Dời", () => { const { x0, y0 } = selBounds(); s.move = { ax: x0, ay: y0, dx: 0, dy: 0 }; renderSelBar(); }, "btn primary", !n),
      btn("🗑️ Dỡ", () => void clearSelected(), "btn", !n),
      btn("Bỏ chọn", () => { s.set.clear(); s.corner = null; renderSelBar(); }, "btn", !n && !s.corner),
      btn("✔ Xong", stopSelect));
  }
  function applyMove() {
    if (!sel?.move || moveProblem()) return;
    const { dx, dy } = sel.move;
    for (const b of sel.set) { b.x += dx; b.y += dy; }
    app.dirty();
    toast(`Đã dời ${sel.set.size} công trình.`, "good");
    sel.move = null;
    renderSelBar();
  }
  async function clearSelected() {
    if (!sel?.set.size) return;
    const list = [...sel.set];
    const crops = list.some((b) => b.plot?.crop || b.slots?.some((x) => x.crop));
    if (!(await confirmBox("Dỡ hàng loạt", `Dỡ ${list.length} công trình? Bạn nhận lại một nửa nguyên liệu xây dựng của mỗi cái.${crops ? " Cây trồng bên trong sẽ mất." : ""}`, "Dỡ"))) return;
    const back: Record<string, number> = {};
    for (const b of list) for (const [id, n] of Object.entries(buildingCost(b.type, 0))) back[id] = (back[id] ?? 0) + Math.floor(n / 2);
    g.buildings = g.buildings.filter((b) => !sel!.set.has(b));
    sfx("demolish");
    for (const [id, n] of Object.entries(back)) if (n > 0) addItem(g, id, n);
    logMsg(g, `Dỡ ${list.length} công trình.`);
    app.dirty();
    toast(`Đã dỡ ${list.length} công trình, nhận lại một nửa nguyên liệu.`, "good");
    sel.set.clear();
    renderSelBar();
    updateHud();
  }
  function selectTap(tx: number, ty: number) {
    const s = sel!;
    if (s.move) { s.move.dx = tx - s.move.ax; s.move.dy = ty - s.move.ay; return renderSelBar(); }
    const b = buildingAt(g, tx, ty);
    if (b) {
      if (!movable(b)) toast(`${BUILDINGS[b.type].name} không dỡ hay dời được.`, "info");
      else if (s.set.has(b)) s.set.delete(b);
      else s.set.add(b);
      s.corner = null;
    } else if (!s.corner) s.corner = { x: tx, y: ty };
    else {
      const x0 = Math.min(s.corner.x, tx), x1 = Math.max(s.corner.x, tx), y0 = Math.min(s.corner.y, ty), y1 = Math.max(s.corner.y, ty);
      for (const o of g.buildings) {
        const [w, hh] = BUILDINGS[o.type].size;
        if (movable(o) && o.x <= x1 && o.x + w - 1 >= x0 && o.y <= y1 && o.y + hh - 1 >= y0) s.set.add(o);
      }
      s.corner = null;
    }
    renderSelBar();
  }

  // ------------------------------------------------------------ input
  const walkable = (x: number, y: number) => inTerritory(g, x, y) && !blockerAt(g, x, y) && !(x === SPROUT.x && y === SPROUT.y);

  view.onTap = (tx, ty) => {
    if (sel) return selectTap(tx, ty);
    if (placing) {
      placing.x = tx;
      placing.y = ty;
      renderPlaceBar();
      return;
    }
    if (tx === SPROUT.x && ty === SPROUT.y) return talkToSprout();
    const agent = sim.agentAt(tx, ty);
    if (agent) return talkTo(agent.id);
    const b = buildingAt(g, tx, ty);
    // flat decor: walk onto it; tap it again while standing there to manage it
    if (b && (!BUILDINGS[b.type].walkable || (hero.x === tx && hero.y === ty))) return openB(b);
    if (!walkable(tx, ty)) return;
    const path = findPath({ w: SZ_W, h: SZ_H }, walkable, hero.x, hero.y, tx, ty, 3000);
    if (path) hero.path = path;
  };

  function talkToSprout() {
    const tip = SPROUT_TIPS[(g.day + hashString(String(Date.now() >> 12))) % SPROUT_TIPS.length];
    const m = openModal("🌱 Mầm");
    m.body.append(
      h("div", { class: "row", style: "align-items:flex-start;gap:12px" },
        h("img", { class: "sprite big-portrait", src: spriteCanvas("sprout").toDataURL() }),
        h("p", { style: "margin:0;line-height:1.6" }, tip)),
      h("div", { class: "row end", style: "margin-top:10px" },
        h("button", { class: "btn", onclick: () => { m.close(); openHelp(); } }, "❓ Hướng dẫn"),
        h("button", { class: "btn primary", onclick: () => m.close() }, "Cảm ơn Mầm!")));
  }

  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => {
    // always register a release, even one that happens while a window is open
    if (e.type === "keyup") { keys.delete(e.code); return; }
    if (topModalOpen() || e.target instanceof HTMLInputElement) return;
    const map: Record<string, [number, number]> = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
    if (map[e.code]) { e.preventDefault(); keys.add(e.code); }
  };
  const releaseKeys = () => keys.clear();
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", releaseKeys);

  // ------------------------------------------------------------ render
  let last = performance.now();
  view.onDraw = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    // movement
    hero.t += dt;
    if (hero.t >= 0.13) {
      hero.t = 0;
      let next = hero.path.shift();
      if (!next && keys.size && !topModalOpen()) {
        const code = [...keys].pop()!;
        const d = ({ ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] } as Record<string, number[]>)[code];
        if (d && walkable(hero.x + d[0], hero.y + d[1])) next = { x: hero.x + d[0], y: hero.y + d[1] };
      }
      if (next) {
        if (next.x !== hero.x) hero.flip = next.x < hero.x;
        hero.dir = next.x !== hero.x ? 2 : next.y < hero.y ? 1 : 0;
        hero.x = next.x;
        hero.y = next.y;
      }
    }
    hero.px += (hero.x - hero.px) * Math.min(1, dt * 12);
    hero.py += (hero.y - hero.py) * Math.min(1, dt * 12);
    if (!view.pannable) {
      view.camX += (hero.px - view.camX) * Math.min(1, dt * 5);
      view.camY += (hero.py - view.camY) * Math.min(1, dt * 5);
    }

    const c = view.ctx;
    c.fillStyle = "#050807";
    c.fillRect(0, 0, view.w, view.h);
    const vr = view.visible();
    const terr = territory(g.territory);
    // static ground (tiles, trees, darkness outside the territory) is pre-rendered once
    const gsig = `${g.territory}`;
    if (gsig !== groundSig) { ground = sanctuaryGround(terr); edge = edgeTrees(terr); groundSig = gsig; }
    {
      const sx0 = (view.camX + 0.5 - view.w / 2 / view.tile) * 16, sy0 = (view.camY + 0.5 - view.h / 2 / view.tile) * 16;
      c.drawImage(ground!, sx0, sy0, (view.w / view.tile) * 16, (view.h / view.tile) * 16, 0, 0, view.w, view.h);
    }
    // territory border
    c.strokeStyle = "rgba(242,197,66,0.35)";
    c.setLineDash([view.tile / 4, view.tile / 4]);
    c.lineWidth = 2;
    c.strokeRect(view.sx(terr.x0), view.sy(terr.y0), (terr.x1 - terr.x0) * view.tile, (terr.y1 - terr.y0) * view.tile);
    c.setLineDash([]);

    // drawables sorted by bottom row
    const draw: { y: number; fn: () => void }[] = [];
    for (const [x, y, tall] of edge) {
      if (x < vr.x0 - 2 || x > vr.x1 + 2 || y < vr.y0 || y > vr.y1 + 3) continue;
      const see = treeHides(x, y, g.buildings, [{ x: hero.px, y: hero.py }]);
      draw.push({ y: y + 0.99, fn: () => drawTree(view, x, y, tall, see) });
    }
    for (const b of g.buildings) {
      const [bw, bh] = BUILDINGS[b.type].size;
      if (placing?.moving === b || (sel?.move && sel.set.has(b))) continue;
      draw.push({ y: BUILDINGS[b.type].walkable ? b.y : b.y + bh, fn: () => {
        view.img(buildingCanvas(b.type, b.level), b.x, b.y - 1, { w: bw, h: bh + 1 });
        if (b.type === "farm" && b.plot?.watered) {
          c.fillStyle = "rgba(20,30,60,0.28)";
          c.fillRect(view.sx(b.x) + view.tile * 0.06, view.sy(b.y) + view.tile * 0.06, view.tile * 0.88, view.tile * 0.88);
        }
        if (b.type === "farm" && b.plot?.crop) {
          const st = cropStage(b.plot.crop);
          view.img(cropCanvas(b.plot.crop.id, st), b.x, b.y - CROP_LIFT);
          if (st === 3 && isReady(b.plot.crop)) { c.font = `${Math.round(view.tile * 0.4)}px sans-serif`; c.fillText("✨", view.sx(b.x) + view.tile * 0.55, view.sy(b.y) + view.tile * 0.3 + Math.sin(t / 300) * 3); }
        }
        if (b.type === "gate") {
          c.fillStyle = `rgba(176,138,255,${0.18 + Math.sin(t / 400) * 0.08})`;
          c.fillRect(view.sx(b.x) + view.tile * 0.35, view.sy(b.y) - view.tile * 0.3, view.tile * 1.3, view.tile * 2.1);
        }
      } });
    }
    // residents
    sim.update(dt, t, vr, talkingTo);
    markT -= dt;
    const refreshMarks = markT <= 0;
    farmT -= dt;
    if (farmT <= 0) { farmT = 0.5; tickFarm(app.game); }
    if (refreshMarks) { markT = 3; updateBadges(); }
    const bubbles: (() => void)[] = [];
    for (const a of sim.agents) {
      if (a.px < vr.x0 - 1 || a.px > vr.x1 + 1 || a.py < vr.y0 - 1 || a.py > vr.y1 + 2) continue;
      const rch = g.chars[a.id];
      if (!rch) continue;
      if (refreshMarks) marks.set(a.id, sceneReady(g, rch));
      draw.push({ y: a.py + 1.005, fn: () => {
        c.drawImage(sim.sprite(a, rch, t), view.sx(a.px), view.sy(a.py - 1), view.tile, view.tile * 2);
      } });
      if (marks.get(a.id)) bubbles.push(() => {
        c.font = `${Math.round(view.tile * 0.45)}px sans-serif`;
        c.textAlign = "center";
        c.fillText("❗", view.sx(a.px) + view.tile / 2, view.sy(a.py) - view.tile * 1.05 + Math.sin(t / 200) * 2);
        c.textAlign = "left";
      });
      else if (a.bubble && a.bubble.until > t) bubbles.push(() => speech(a.bubble!.text, view.sx(a.px) + view.tile / 2, view.sy(a.py) - view.tile * 1.1));
    }
    const bob = Math.sin(t / 250) * view.tile * 0.03;
    draw.push({ y: SPROUT.y + 1, fn: () => view.img(spriteCanvas("sprout"), SPROUT.x, SPROUT.y, { dy: -0.05 + bob / view.tile }) });
    draw.push({ y: hero.py + 1.01, fn: () => {
      const ch = g.chars[g.heroId];
      c.fillStyle = "rgba(0,0,0,0.3)";
      c.beginPath();
      c.ellipse(view.sx(hero.px) + view.tile / 2, view.sy(hero.py) + view.tile * 0.92, view.tile * 0.3, view.tile * 0.1, 0, 0, Math.PI * 2);
      c.fill();
      const moving = Math.abs(hero.px - hero.x) + Math.abs(hero.py - hero.y) > 0.05 || hero.path.length > 0;
      const frame = moving ? Math.floor(t / 130) % 4 : 0;
      if (isPerson(ch.sprite)) view.img(personCanvas(ch.sprite, ch.pal, hero.dir, frame), hero.px, hero.py - 1, { h: 2, flip: hero.dir === 2 && hero.flip });
      else view.img(spriteCanvas(ch.sprite, ch.pal), hero.px, hero.py, { flip: hero.flip });
    } });
    // the pet trots after the hero
    const pet = g.pet ? PET[g.pet] : undefined;
    if (pet) {
      const tx = hero.px + (hero.flip ? 0.9 : -0.9) * (hero.dir === 2 ? 1 : 0.4), ty = hero.py + (hero.dir === 1 ? 0.8 : hero.dir === 0 ? -0.2 : 0.3);
      petPos.x += (tx - petPos.x) * Math.min(1, dt * 5);
      petPos.y += (ty - petPos.y) * Math.min(1, dt * 5);
      draw.push({ y: petPos.y + 0.95, fn: () => view.img(creatureSmall(petSpec(pet)), petPos.x + 0.1, petPos.y + 0.15, { w: 0.8, h: 0.8, flip: hero.flip, dy: Math.sin(t / 160) * 0.04 }) });
    }
    draw.sort((a, b) => a.y - b.y);
    for (const d of draw) d.fn();
    for (const b of bubbles) b();

    // picked buildings: outlined; while moving, ghosts at the new spot
    if (sel) {
      const T = view.tile;
      for (const b of sel.set) {
        const [bw, bh] = BUILDINGS[b.type].size;
        if (sel.move) {
          const nx = b.x + sel.move.dx, ny = b.y + sel.move.dy;
          const ok = !canPlace(g, b.type, nx, ny, sel.set);
          c.fillStyle = ok ? "rgba(90,220,110,0.32)" : "rgba(230,70,70,0.4)";
          c.fillRect(view.sx(nx), view.sy(ny), bw * T, bh * T);
          view.img(buildingCanvas(b.type, b.level), nx, ny - 1, { w: bw, h: bh + 1, alpha: 0.75 });
        } else {
          c.fillStyle = "rgba(255,214,90,0.22)"; c.fillRect(view.sx(b.x), view.sy(b.y), bw * T, bh * T);
          c.strokeStyle = "#ffd65a"; c.lineWidth = 2; c.strokeRect(view.sx(b.x) + 1, view.sy(b.y) + 1, bw * T - 2, bh * T - 2);
        }
      }
      if (sel.corner) {
        c.strokeStyle = "#ffd65a"; c.setLineDash([T / 5, T / 5]); c.lineWidth = 2;
        c.strokeRect(view.sx(sel.corner.x), view.sy(sel.corner.y), T, T); c.setLineDash([]);
      }
    }
    // placement ghost
    if (placing) {
      const [bw, bh] = BUILDINGS[placing.type].size;
      const ok = !canPlace(g, placing.type, placing.x, placing.y, placing.moving);
      c.fillStyle = ok ? "rgba(90,220,110,0.35)" : "rgba(230,70,70,0.4)";
      c.fillRect(view.sx(placing.x), view.sy(placing.y), bw * view.tile, bh * view.tile);
      view.img(buildingCanvas(placing.type, placing.moving?.level ?? 1), placing.x, placing.y - 1, { w: bw, h: bh + 1, alpha: 0.75 });
    }

    function speech(text: string, x: number, y: number) {
      const fs = Math.max(11, Math.round(view.tile * 0.22));
      c.font = `${fs}px "Be Vietnam Pro", sans-serif`;
      const w = Math.min(view.tile * 5, c.measureText(text).width + fs);
      const bh = fs * 1.7;
      c.fillStyle = "rgba(255,250,235,0.94)";
      c.strokeStyle = "rgba(60,40,20,0.8)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.roundRect(x - w / 2, y - bh, w, bh, 6);
      c.moveTo(x - 4, y); c.lineTo(x, y + 6); c.lineTo(x + 4, y);
      c.fill(); c.stroke();
      c.fillStyle = "#3a2a1a";
      c.textAlign = "center";
      c.fillText(text, x, y - bh / 2 + fs * 0.35, w - fs * 0.6);
      c.textAlign = "left";
    }

    // vignette
    const grd = c.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = grd;
    c.fillRect(0, 0, view.w, view.h);
  };
  view.start();
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__sz = { view, openB, sim };

  // first-visit hint
  if (!g.flags.sz_hint) {
    g.flags.sz_hint = true;
    setTimeout(() => toast("Chạm vào Mầm 🌱 để nghe gợi ý, chạm vào công trình để sử dụng.", "info", 5000), 800);
  }

  return {
    destroy: () => {
      closeDockMenu();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", releaseKeys);
      view.destroy();
      el.remove();
    },
  };
}
