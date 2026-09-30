import { app, type Screen } from "../app";
import { hashString } from "../core/rng";
import { buildingCost, canAfford, logMsg, pay, type PlacedBuilding } from "../core/state";
import { BUILDINGS, BUILDING_LIST, RANK_NAMES, type BuildingCategory } from "../data/buildings";
import { SEASON_ICONS, SEASON_NAMES, seasonOf } from "../data/items";
import { buildingCanvas, cropCanvas } from "../render/buildings";
import { MapView } from "../render/mapview";
import { spriteCanvas } from "../render/pixel";
import { isPerson, personCanvas, type Dir } from "../render/people";
import { T, tileSet } from "../render/tiles";
import { BIOMES } from "../world/biomes";
import { findPath } from "../world/mapgen";
import { SPROUT, SZ_H, SZ_W, blockerAt, buildLimitReason, buildingAt, canPlace, inTerritory, territory } from "../world/sanctuary";
import { h, openModal, toast, topModalOpen } from "../ui/dom";
import { costView, openBuilding, setMoveHook, showReport } from "./buildingPanels";
import { WEATHER, advanceDay, cropStage, ensureSlots, housing, isReady, population, rankName, rankOf } from "../world/town";
import { openHelp, openJournal, openMenu, partyMini, saveDot, showBanner } from "./common";
import { openInventory } from "./inventory";
import { openParty } from "./party";
import { openResidentList } from "./residentList";
import { openResident } from "./residentTalk";
import { ResidentSim } from "../world/residentSim";
import { sceneReady } from "../world/residents";

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

export function mountSafeZone(root: HTMLElement, hooks: { enterDungeon: (floor: number) => void }): Screen {
  const g = app.game;
  const el = h("div", { class: "screen" });
  root.append(el);
  const view = new MapView(el);
  const biome = BIOMES.forest;
  const tiles = tileSet(biome);

  // hero position
  const hero = { x: 35, y: 37, px: 35, py: 37, path: [] as { x: number; y: number }[], t: 0, flip: false, dir: 0 as Dir };
  view.camX = hero.x;
  view.camY = hero.y;
  let placing: { type: string; moving?: PlacedBuilding; x: number; y: number } | null = null;
  const sim = new ResidentSim(g);
  let ground: HTMLCanvasElement | null = null;
  let groundSig = "";
  const renderGround = (terr: ReturnType<typeof territory>) => {
    const cv = document.createElement("canvas");
    cv.width = SZ_W * 16;
    cv.height = SZ_H * 16;
    const gc = cv.getContext("2d")!;
    gc.imageSmoothingEnabled = false;
    const trees: [number, number, HTMLCanvasElement][] = [];
    for (let y = 0; y < SZ_H; y++) {
      for (let x = 0; x < SZ_W; x++) {
        const hsh = hashString(`${x},${y}`);
        const inside = x >= terr.x0 && y >= terr.y0 && x < terr.x1 && y < terr.y1;
        const type = inside ? (hsh % 9 === 0 ? T.DECOR : T.GROUND) : (hsh % 3 === 0 ? T.GROUND : T.OBSTACLE);
        gc.drawImage(tiles.tiles[type === T.OBSTACLE ? T.GROUND : type][hsh % 4], x * 16, y * 16);
        if (type === T.OBSTACLE && (x + y) % 2 === 0) trees.push([x, y, tiles.tall[hsh % tiles.tall.length]]);
        if (!inside) {
          const d = Math.max(terr.x0 - x, x - terr.x1 + 1, terr.y0 - y, y - terr.y1 + 1);
          gc.fillStyle = `rgba(3,6,5,${Math.min(0.92, 0.35 + d * 0.14)})`;
          gc.fillRect(x * 16, y * 16, 16, 16);
        }
      }
    }
    for (const [x, y, tall] of trees) gc.drawImage(tall, (x - 0.5) * 16, (y - 2) * 16, 32, 48);
    return cv;
  };
  let talkingTo: string | null = null;
  const marks = new Map<string, boolean>(); // "!" markers, refreshed every few seconds
  let markT = 0;
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
  };
  el.append(h("div", { class: "hud-top" }, h("div", { class: "col", style: "gap:6px" }, title, party.el), h("div", { class: "hud-right" }, gold)));
  el.append(h("div", { class: "zoom" },
    h("button", { class: "icon-btn", onclick: () => view.zoom(1) }, "＋"),
    h("button", { class: "icon-btn", onclick: () => view.zoom(-1) }, "－"),
    h("button", { class: "icon-btn", title: "Về chỗ nhân vật", onclick: () => { view.camX = hero.px; view.camY = hero.py; } }, "◎")));
  const dock = h("div", { class: "dock" },
    dockBtn("🔨", "Xây", () => openBuildMenu()),
    dockBtn("👥", "Đội", () => openParty({ inDungeon: false, onChange: updateHud })),
    dockBtn("🎒", "Túi", () => openInventory({ canSell: true, onChange: updateHud })),
    dockBtn("💞", "Cư dân", () => openResidentList({ find: (id) => { const a = sim.get(id); if (a) { const path = findPath({ w: SZ_W, h: SZ_H }, walkable, hero.x, hero.y, a.x, a.y, 5000); if (path) { hero.path = path.slice(0, -1); toast(`Đang tới chỗ ${app.game.chars[id].name.split(" ")[0]}…`); } } }, onClose: updateHud })),
    dockBtn("🌀", "Vực Sâu", () => { const gate = app.game.buildings.find((b) => b.type === "gate"); if (gate) openB(gate); }),
    dockBtn("📜", "Nhật ký", () => openJournal()),
    dockBtn("⚙️", "Menu", () => openMenu()),
  );
  el.append(dock);
  const placeBar = h("div", { class: "place-bar hidden" });
  el.append(placeBar);
  updateHud();

  function dockBtn(icon: string, label: string, fn: () => void) {
    return h("button", { onclick: fn }, h("span", null, icon), h("span", null, label));
  }

  const openB = (b: PlacedBuilding) => openBuilding(b, {
    refresh: updateHud,
    sleep: () => {
      const rep = advanceDay(app.game);
      app.dirty(true);
      showBanner(el, `Ngày ${app.game.day}`, "Cả đội đã hồi phục hoàn toàn");
      showReport(rep.lines, rep.gains);
      updateHud();
    },
    enterDungeon: (f) => hooks.enterDungeon(f),
  });
  setMoveHook((b) => startPlacing(b.type, b));

  // ------------------------------------------------------------ building
  let buildCat: BuildingCategory = "farm";
  const CAT_NAMES: Record<BuildingCategory, string> = { core: "Cốt lõi", farm: "Nông trại", production: "Sản xuất", craft: "Chế tạo", housing: "Nhà ở", service: "Dịch vụ", decor: "Trang trí" };
  function openBuildMenu() {
    const m = openModal("🔨 Xây Dựng", { wide: true });
    const render = () => {
      const rank = rankOf(g);
      const list = h("div", { class: "list" });
      for (const def of BUILDING_LIST.filter((d) => d.category === buildCat && !d.fixed)) {
        const limit = buildLimitReason(g, def.id);
        const cost = buildingCost(def.id, 0);
        const ok = !limit && canAfford(g, cost);
        const n = g.buildings.filter((b) => b.type === def.id).length;
        list.append(h("div", { class: `item-row ${limit ? "locked" : ""}` },
          h("span", { class: "ico" }, def.icon),
          h("div", { class: "meta" },
            h("div", { class: "name" }, def.name, h("span", { class: "tag" }, `${def.size[0]}×${def.size[1]}`), def.rank > 1 ? h("span", { class: "tag" }, RANK_NAMES[def.rank]) : null, n ? h("span", { class: "tag" }, `đã có ${n}`) : null),
            h("div", { class: "desc" }, def.desc),
            limit ? h("div", { class: "desc bad" }, limit) : costView(cost)),
          h("button", { class: "btn small primary", disabled: !ok, onclick: () => { m.close(); startPlacing(def.id); } }, "Chọn")));
      }
      m.body.replaceChildren(
        h("p", { class: "muted small", style: "margin-top:0" }, `Hạng hiện tại: ${RANK_NAMES[rank]}. Chọn công trình rồi chạm vào vị trí muốn đặt trên bản đồ.`),
        h("div", { class: "cat-list" }, (Object.keys(CAT_NAMES) as BuildingCategory[]).filter((c) => c !== "core").map((c) =>
          h("button", { class: c === buildCat ? "on" : "", onclick: () => { buildCat = c; render(); } }, CAT_NAMES[c]))),
        list);
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
    placeBar.replaceChildren(
      h("div", { class: "chip" }, reason ? `❌ ${reason}` : `✅ ${BUILDINGS[p.type].name} — chạm để chọn chỗ`),
      h("button", { class: "btn primary", disabled: !!reason, onclick: confirmPlace }, "✓ Đặt"),
      h("button", { class: "btn", onclick: stopPlacing }, "✕ Huỷ"));
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
      toast(`Đã xây ${BUILDINGS[p.type].name}!`, "good");
    }
    app.dirty();
    const again = !p.moving && p.type === "farm" && !buildLimitReason(g, "farm") && canAfford(g, buildingCost("farm", 0));
    if (again) { placing = { type: "farm", x: p.x + 1, y: p.y }; renderPlaceBar(); updateHud(); return; }
    stopPlacing();
  }

  function stopPlacing() {
    placing = null;
    view.pannable = false;
    dock.classList.remove("hidden");
    renderPlaceBar();
    updateHud();
  }

  // ------------------------------------------------------------ input
  const walkable = (x: number, y: number) => inTerritory(g, x, y) && !blockerAt(g, x, y) && !(x === SPROUT.x && y === SPROUT.y);

  view.onTap = (tx, ty) => {
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
    if (topModalOpen() || e.target instanceof HTMLInputElement) return;
    const map: Record<string, [number, number]> = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
    if (map[e.code]) { e.preventDefault(); if (e.type === "keydown") keys.add(e.code); else keys.delete(e.code); }
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

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
    if (gsig !== groundSig) { ground = renderGround(terr); groundSig = gsig; }
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
    for (const b of g.buildings) {
      const [bw, bh] = BUILDINGS[b.type].size;
      if (placing?.moving === b) continue;
      draw.push({ y: BUILDINGS[b.type].walkable ? b.y : b.y + bh, fn: () => {
        view.img(buildingCanvas(b.type, b.level), b.x, b.y - 1, { w: bw, h: bh + 1 });
        if (b.type === "farm" && b.plot?.watered) {
          c.fillStyle = "rgba(20,30,60,0.28)";
          c.fillRect(view.sx(b.x) + view.tile * 0.06, view.sy(b.y) + view.tile * 0.06, view.tile * 0.88, view.tile * 0.88);
        }
        if (b.type === "farm" && b.plot?.crop) {
          const st = cropStage(b.plot.crop);
          view.img(cropCanvas(b.plot.crop.id, st), b.x, b.y);
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
    if (refreshMarks) markT = 3;
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
    draw.sort((a, b) => a.y - b.y);
    for (const d of draw) d.fn();
    for (const b of bubbles) b();

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
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      view.destroy();
      el.remove();
    },
  };
}
