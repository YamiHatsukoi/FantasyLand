import { app, type Screen } from "../app";
import { Rng, hashString } from "../core/rng";
import { charStats, logMsg, removeItem, type FloorState, type GameState } from "../core/state";
import { ENEMIES } from "../data/enemies";
import { ITEM_LIST, getItem } from "../data/items";
import { PLAYER_SKILLS } from "../data/skills";
import { MapView } from "../render/mapview";
import { drawParticles } from "../render/particles";
import { mapPinURL, type MapPin } from "../render/icons";
import { tip } from "../ui/tooltip";
import { spriteCanvas } from "../render/pixel";
import { creatureSmall, parseCreature } from "../render/creatures";
import { isPerson, personCanvas, type Dir } from "../render/people";
import { PASSABLE, T, tileSet } from "../render/tiles";
import { EVENTS, RANDOM_EVENTS } from "../story";
import { eventLook, propCanvas, roadsidePal, type PropCtx } from "../render/eventProps";
import { giveToGame, randomLoot } from "../story/runner";
import type { BattleSpec } from "../story/types";
import { BIOMES } from "../world/biomes";
import { getFloor, specFor, type FloorDef } from "../world/floors";
import { SHOP_NAMES, SIZE_NAMES, activeQuest, getNpc, getSettlement, type ShopKind } from "../world/people";
import { openNpc } from "./npcTalk";
import { buildingCanvas } from "../render/buildings";
import { openSettlement, openShop } from "./settlement";
import { decodeFog, encodeFog, findPath, generateFloor, type FloorMap, type MapEntity } from "../world/mapgen";
import { confirmBox, h, nn, openModal, toast, topModalOpen } from "../ui/dom";
import { runBattle, type BattleOutcome } from "./combat";
import { openJournal, openMenu, partyMini, saveDot, showBanner } from "./common";
import { openInventory, setFieldSpecial } from "./inventory";
import { openParty } from "./party";
import { playStory } from "./story";

const mapCache = new Map<string, FloorMap>();
const SIGHT = 8;
/** Seconds to walk one tile; movement glides at constant speed from tile to tile. */
const STEP = 0.15;
/** Terrain chunk size in tiles. */
const CH = 16;
/** Tall obstacles (trees...) are lifted so their trunk stands in the middle of their tile. */
const TREE_LIFT = 0.375;

export function floorMap(n: number, seed: number): FloorMap {
  const key = `${n}:${seed}`;
  let m = mapCache.get(key);
  if (!m) {
    m = generateFloor(getFloor(n), seed);
    mapCache.set(key, m);
  }
  return m;
}

export function ensureFloorState(g: GameState, n: number): { fs: FloorState; fresh: boolean } {
  let fs = g.floors[n];
  const fresh = !fs;
  if (!fs) {
    fs = { seed: hashString(`${g.flags.seed}:${n}`), done: [], fog: "", cleared: Boolean(g.flags[`f${n}_cleared`]) };
    g.floors[n] = fs;
  }
  return { fs, fresh };
}

export function startExpedition(g: GameState, floor: number) {
  const temple = g.buildings.find((b) => b.type === "temple");
  g.expedition = { floor, bag: {}, bagGold: 0, steps: 0, done: [], blessing: temple ? 0.03 * temple.level : 0 };
  const fs = g.floors[floor];
  if (fs) { delete fs.px; delete fs.py; }
  logMsg(g, `Xuống Vực Sâu — tầng ${floor}.`);
}

export interface DungeonHooks {
  toSafeZone: () => void;
  changeFloor: (n: number) => void;
}

export function mountDungeon(root: HTMLElement, hooks: DungeonHooks): Screen {
  const g = app.game;
  const ex = g.expedition!;
  const floorN = ex.floor;
  const def: FloorDef = getFloor(floorN);
  const biome = BIOMES[def.biome];
  const tiles = tileSet(biome);
  const { fs, fresh } = ensureFloorState(g, floorN);
  const map = floorMap(floorN, fs.seed);
  const fog = decodeFog(fs.fog, map.w * map.h);
  const idx = (x: number, y: number) => y * map.w + x;
  const rng = new Rng((Date.now() ^ fs.seed) >>> 0);

  // runtime entity state
  const alive = (e: MapEntity) => {
    if (e.kind === "monster" || e.kind === "node" || e.kind === "camp") return !ex.done.includes(e.id);
    if (e.kind === "guardian") return !fs.cleared;
    if (e.kind === "stairs" || e.kind === "portal" || e.kind === "town" || e.kind === "building" || e.kind === "npc" || e.kind === "deco") return true;
    return !fs.done.includes(e.id);
  };
  const ents = map.entities.map((e) => ({ ...e, px: e.x, py: e.y, stun: 0, dir: 0 as Dir, flip: false }));
  // what each event looks like on the map
  const spec = specFor(floorN);
  const propCtx: PropCtx = { el: def.el, accent: spec.col[5], sig: spec.sig[2], stone: spec.col[3], seed: fs.seed };
  const looks = new Map<string, { prop: string } | { person: string; pal?: Record<string, string> }>();
  const eventIdOf = (e: MapEntity) => (e.kind === "random" ? RANDOM_EVENTS[hashString(e.id + fs.seed) % RANDOM_EVENTS.length].id : e.ref!);
  function lookOf(e: MapEntity) {
    let l = looks.get(e.id);
    if (!l) {
      const id = eventIdOf(e);
      const base = eventLook(id, propCtx, EVENTS[id]?.portrait);
      if ("person" in base) {
        l = isPerson(base.person) ? { person: base.person } : { person: "villager", pal: roadsidePal(`${floorN}:${e.id}`) };
      } else l = base;
      looks.set(e.id, l);
    }
    return l;
  }
  const player = { x: map.start.x + 1, y: map.start.y, px: 0, py: 0, flip: false, dir: 0 as Dir, path: [] as { x: number; y: number }[], t: 0 };
  if (fs.px !== undefined && fs.py !== undefined && PASSABLE.has(map.tiles[idx(fs.px, fs.py)])) { player.x = fs.px; player.y = fs.py; }
  if (!PASSABLE.has(map.tiles[idx(player.x, player.y)])) { player.x = map.start.x; player.y = map.start.y + 1; }
  player.px = player.x;
  player.py = player.y;
  const trail: { x: number; y: number }[] = [];
  const followers: { px: number; py: number; dir: Dir; flip: boolean }[] = [];
  const approach = (a: number, b: number, d: number) => (Math.abs(b - a) <= d ? b : a + Math.sign(b - a) * d);
  let busy = false;
  let destroyed = false;
  let region = -1;
  let inTown = -1;

  const el = h("div", { class: "screen" });
  root.append(el);
  const view = new MapView(el);
  view.camX = player.x;
  view.camY = player.y;

  // ------------------------------------------------------------ HUD
  const title = h("div", { class: "chip title" }, `Tầng ${floorN}`, h("small", null, def.name));
  const regionChip = h("div", { class: "chip" }, "");
  const info = h("div", { class: "chip" });
  const party = partyMini();
  const bagBadge = h("span", { class: "dock-badge" });
  const updateHud = () => {
    bagBadge.textContent = String(g.newItems?.length || "");
    info.replaceChildren("💰 ", h("b", null, String(g.gold)), "  🎒 ", h("b", null, String(Object.keys(ex.bag).length)), "  ", saveDot());
    party.update();
  };
  el.append(h("div", { class: "hud-top" }, h("div", { class: "col", style: "gap:6px" }, title, party.el), h("div", { class: "hud-right" }, info, regionChip)));
  el.append(h("div", { class: "zoom" },
    h("button", { class: "icon-btn", onclick: () => view.zoom(1) }, "＋"),
    h("button", { class: "icon-btn", onclick: () => view.zoom(-1) }, "－")));
  el.append(h("div", { class: "dock" },
    dockBtn("🎒", "Túi", () => openInventory({ canSell: false, onChange: updateHud }), bagBadge),
    dockBtn("👥", "Đội", () => openParty({ inDungeon: true, onChange: updateHud })),
    dockBtn("🗺️", "Bản đồ", () => openMinimap()),
    dockBtn("📜", "Nhật ký", () => openJournal()),
    dockBtn("⚙️", "Menu", () => openMenu([
      h("button", { class: "btn", onclick: async () => {
        if (!(await confirmBox("Bỏ cuộc", "Thoát khẩn cấp về Thánh Địa? Bạn sẽ mất một nửa chiến lợi phẩm của chuyến đi này, giống như khi gục ngã."))) return;
        defeat(true);
      } }, "🏳️ Thoát khẩn cấp (mất 50% chiến lợi phẩm)"),
    ])),
  ));
  updateHud();

  function dockBtn(icon: string, label: string, fn: () => void, badge?: HTMLElement) {
    return h("button", { onclick: fn }, h("span", null, icon), h("span", null, label), badge ?? null);
  }

  // ------------------------------------------------------------ helpers
  const passable = (x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h && PASSABLE.has(map.tiles[idx(x, y)]);
  const entityAt = (x: number, y: number) => ents.find((e) => alive(e) && e.x === x && e.y === y);
  const walkable = (x: number, y: number) => passable(x, y) && !entityAt(x, y);

  // ------------------------------------------------------------ terrain chunks & fog overlay
  const chunks = new Map<string, HTMLCanvasElement>();
  const tileAt = (x: number, y: number) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? T.WALL : map.tiles[idx(x, y)]);
  const isLiquid = (tt: number) => tt === T.WATER || tt === T.SHALLOW;
  function terrainChunk(cx: number, cy: number, frame: number): HTMLCanvasElement {
    const hasWater = chunkHasWater(cx, cy);
    const key = `${cx},${cy},${hasWater ? frame : 0}`;
    const hit = chunks.get(key);
    if (hit) { chunks.delete(key); chunks.set(key, hit); return hit; }
    const cv = document.createElement("canvas");
    cv.width = cv.height = CH * 16;
    const q = cv.getContext("2d")!;
    q.imageSmoothingEnabled = false;
    const S = 16;
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const x = cx * CH + tx, y = cy * CH + ty;
      if (x >= map.w || y >= map.h) continue;
      const i = idx(x, y), tt = map.tiles[i], v = map.variant[i];
      const img = tt === T.WATER ? tiles.water[(frame + x * 3 + y) % 4] : tt === T.OBSTACLE ? tiles.tiles[T.GROUND][v] : tiles.tiles[tt][v];
      const sx = tx * S, sy = ty * S;
      q.drawImage(img, sx, sy, S, S);
      const edge = (src: CanvasImageSource, skip: (nt: number) => boolean) => {
        for (const [dx, dy, rot] of [[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]] as const) {
          if (skip(tileAt(x + dx, y + dy))) continue;
          q.save();
          q.translate(sx + S / 2, sy + S / 2);
          q.rotate((rot * Math.PI) / 180);
          q.drawImage(src, -S / 2, -S / 2, S, S);
          q.restore();
        }
      };
      if (tt === T.WATER) edge(tiles.shore, isLiquid); // foam where the liquid meets land
      if (tt === T.ALT) edge(tiles.edge, (nt) => nt !== T.GROUND && nt !== T.DECOR && nt !== T.OBSTACLE);
      if (tt === T.WALL && tileAt(x, y + 1) !== T.WALL) q.drawImage(tiles.wallFace, sx, sy, S, S);
      if (tt !== T.WALL && tileAt(x, y - 1) === T.WALL) { q.fillStyle = "rgba(0,0,0,.22)"; q.fillRect(sx, sy, S, S * 0.25); }
    }
    chunks.set(key, cv);
    while (chunks.size > 72) chunks.delete(chunks.keys().next().value!);
    return cv;
  }
  const waterIn = new Map<string, boolean>();
  function chunkHasWater(cx: number, cy: number) {
    const k = `${cx},${cy}`;
    let w = waterIn.get(k);
    if (w === undefined) {
      w = false;
      for (let y = cy * CH; y < Math.min(map.h, cy * CH + CH) && !w; y++) for (let x = cx * CH; x < Math.min(map.w, cx * CH + CH); x++) if (map.tiles[idx(x, y)] === T.WATER) { w = true; break; }
      waterIn.set(k, w);
    }
    return w;
  }
  // one pixel per tile: black where unexplored, dimmed where explored but out of sight
  const fogCanvas = document.createElement("canvas");
  fogCanvas.width = map.w;
  fogCanvas.height = map.h;
  const fogCtx = fogCanvas.getContext("2d")!;
  const fogImg = fogCtx.createImageData(map.w, map.h);
  function updateFog() {
    const d = fogImg.data;
    const r2 = SIGHT * SIGHT + 2;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = idx(x, y);
      d[i * 4 + 3] = !fog[i] ? 255 : (x - player.x) ** 2 + (y - player.y) ** 2 <= r2 ? 0 : 115;
    }
    fogCtx.putImageData(fogImg, 0, 0);
  }

  function reveal() {
    for (let y = -SIGHT; y <= SIGHT; y++) for (let x = -SIGHT; x <= SIGHT; x++) {
      if (x * x + y * y > SIGHT * SIGHT + 2) continue;
      const tx = player.x + x, ty = player.y + y;
      if (tx >= 0 && ty >= 0 && tx < map.w && ty < map.h) fog[idx(tx, ty)] = 1;
    }
    updateFog();
  }

  function savePos(immediate = false) {
    fs.px = player.x;
    fs.py = player.y;
    fs.fog = encodeFog(fog);
    app.dirty(immediate);
  }

  // one-time tips the first time the player walks up to each kind of thing
  const TIPS: Partial<Record<string, string>> = {
    monster: "⚔️ Quái vật! Chạm vào nó để đánh úp (được đánh trước). Quái đi tuần quanh ổ và sẽ đuổi theo khi bạn tới gần.",
    node: "🌿 Điểm thu thập: chạm để lấy gỗ, đá, thảo mộc, quặng — nguyên liệu để xây và chế tạo ở Thánh Địa.",
    chest: "🎁 Rương báu: chạm để mở. Có thể có vàng, đồ dùng, hạt giống, sách kỹ năng.",
    camp: "🔥 Lửa trại: nghỉ chân để hồi máu và MP cho cả đội (mỗi chuyến đi dùng được một lần).",
    event: "✨ Có gì đó ở đây — một người, một di tích, một vật lạ. Chạm vào để xem chuyện gì xảy ra; lựa chọn của bạn có hậu quả.",
    random: "✨ Chạm vào những thứ lạ trên đường để gặp sự kiện: thương nhân, người bị thương, bẫy, kho báu…",
    town: "🏘️ Một ngôi làng! Đi dọc phố, chạm cửa tiệm để mua bán, vào nhà trọ để nghỉ, trò chuyện với dân làng — có người sẽ nhờ việc, có người có thể theo bạn.",
    guardian: "💀 Boss Canh Cửa giữ cầu thang xuống tầng sau. Hãy chuẩn bị kỹ trước khi đánh.",
    portal: "🌀 Cổng dịch chuyển: chạm để về Thánh Địa bất cứ lúc nào (mang theo toàn bộ chiến lợi phẩm).",
  };
  function tutorialTips() {
    for (const e of ents) {
      const tip = TIPS[e.kind];
      if (!tip || g.flags[`tip_${e.kind}`] || !alive(e) || Math.abs(e.x - player.x) + Math.abs(e.y - player.y) > 4) continue;
      g.flags[`tip_${e.kind}`] = true;
      toast(tip, "info", 7000);
      return;
    }
  }

  function checkRegion() {
    tutorialTips();
    const town = map.towns.find((t) => player.x >= t.x && player.x < t.x + t.w && player.y >= t.y && player.y < t.y + t.h);
    if (town && town.i !== inTown) {
      const s = getSettlement(floorN, town.i);
      showBanner(el, s.name, `${SIZE_NAMES[s.size]} · ${s.shops.length} cửa hàng · ${s.npcs.length} cư dân`);
      g.flags[`seen_town_${s.id}`] = true;
    }
    inTown = town ? town.i : -1;
    const r = map.region[idx(player.x, player.y)];
    if (r !== region) {
      region = r;
      regionChip.textContent = `📍 ${def.regions[r] ?? ""}`;
      if (!busy) toast(`📍 ${def.regions[r]}`);
    }
  }

  const levelHere = () => def.levelBase + Math.min(3, Math.floor((player.x / map.w) * 4));

  // ------------------------------------------------------------ movement
  function tryStep(nx: number, ny: number) {
    if (busy || destroyed) return;
    const e = entityAt(nx, ny);
    if (e) {
      player.path = [];
      void interact(e);
      return;
    }
    if (!passable(nx, ny)) { player.path = []; return; }
    if (nx !== player.x) player.flip = nx < player.x;
    player.dir = nx !== player.x ? 2 : ny < player.y ? 1 : 0;
    trail.unshift({ x: player.x, y: player.y });
    trail.length = Math.min(trail.length, 8);
    player.x = nx;
    player.y = ny;
    ex.steps++;
    g.stats.steps++;
    reveal();
    checkRegion();
    moveMonsters();
    if (ex.steps % 12 === 0) savePos();
  }

  function moveTownsfolk() {
    for (const n of ents) {
      if (n.kind !== "npc" || !rng.chance(0.35)) continue;
      const [ox, oy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nx = n.x + ox, ny = n.y + oy;
      if (Math.abs(nx - n.hx) + Math.abs(ny - n.hy) > 8 || map.tiles[idx(nx, ny)] !== T.PAVE || !walkable(nx, ny) || (nx === player.x && ny === player.y)) continue;
      n.dir = ox ? 2 : oy < 0 ? 1 : 0;
      n.flip = ox < 0;
      n.x = nx;
      n.y = ny;
    }
  }

  function moveMonsters() {
    moveTownsfolk();
    if (ex.repel && ex.repel > 0) { ex.repel--; if (ex.repel === 0) toast("Hiệu lực xua quái đã hết.", "info"); }
    const repelled = (ex.repel ?? 0) > 0;
    const lure = (ex.repel ?? 0) < 0;
    if (lure) { ex.repel = (ex.repel ?? 0) + 1; }
    for (const m of ents) {
      if (m.kind !== "monster" || !alive(m)) continue;
      if (m.stun > 0) { m.stun--; continue; }
      const dx = player.x - m.x, dy = player.y - m.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > 12) continue;
      let nx = m.x, ny = m.y;
      if (repelled && dist <= 6) {
        // flee from the player
        if (Math.abs(dx) > Math.abs(dy)) nx -= Math.sign(dx); else ny -= Math.sign(dy);
      } else if ((dist <= 5 || (lure && dist <= 12)) && fog[idx(m.x, m.y)] && rng.chance(lure ? 0.9 : 0.6)) {
        if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx); else ny += Math.sign(dy);
        if (nx === player.x && ny === player.y) {
          void fightMonster(m, false);
          return;
        }
      } else if (rng.chance(0.3)) {
        const [ox, oy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        nx += ox; ny += oy;
        if (Math.abs(nx - m.hx) + Math.abs(ny - m.hy) > 4) continue;
      }
      if ((nx !== m.x || ny !== m.y) && walkable(nx, ny) && map.tiles[idx(nx, ny)] !== T.PAVE && !(nx === player.x && ny === player.y)) {
        m.x = nx;
        m.y = ny;
      }
    }
  }

  view.onTap = (tx, ty) => {
    if (busy || tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return;
    if (!fog[idx(tx, ty)]) return;
    const e = entityAt(tx, ty);
    if (e && Math.abs(e.x - player.x) + Math.abs(e.y - player.y) === 1) return tryStep(e.x, e.y);
    const path = findPath(map, (x, y) => walkable(x, y) && fog[idx(x, y)] === 1, player.x, player.y, tx, ty, 25000);
    if (path) player.path = path;
  };

  const keys = new Set<string>();
  const DIRS: Record<string, [number, number]> = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  const onKey = (e: KeyboardEvent) => {
    if (topModalOpen() || e.target instanceof HTMLInputElement) return;
    if (DIRS[e.code]) {
      e.preventDefault();
      if (e.type === "keydown") { keys.add(e.code); player.path = []; } else keys.delete(e.code);
    }
    if (e.type === "keydown" && e.code === "KeyM") openMinimap();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  // ------------------------------------------------------------ interactions
  const battle = (group: string[], level: number, opts: Partial<BattleSpec> = {}): Promise<BattleOutcome> =>
    runBattle({ enemies: group.map((id) => ({ id, level })), floor: floorN, biome: def.biome, enemyFx: opts.enemyFx, noFlee: opts.noFlee });

  async function fightMonster(m: (typeof ents)[number], ambush: boolean) {
    if (busy || destroyed) return;
    busy = true;
    player.path = [];
    const out = await battle(m.group!, m.level!, ambush ? { enemyFx: [{ s: "slow", t: 1 }] } : {});
    busy = false;
    if (out === "win") ex.done.push(m.id);
    else if (out === "flee") m.stun = 5;
    else return defeat();
    updateHud();
    savePos();
  }

  async function interact(e: (typeof ents)[number]) {
    if (busy || destroyed) return;
    switch (e.kind) {
      case "monster":
        return fightMonster(e, true);
      case "node": {
        const n = rng.chance(0.3) ? 2 : 1;
        const lines = giveToGame(g, { [e.ref!]: n, ...(rng.chance(0.04) ? { mana_crystal: 1 } : {}) });
        ex.done.push(e.id);
        toast(`Thu thập: ${lines.join(", ")}`, "good");
        updateHud();
        return savePos();
      }
      case "chest": {
        const loot = randomLoot({ g, floor: floorN, vars: {}, rng }, 2);
        if (rng.chance(0.2)) {
          const maxTier = Math.min(5, 1 + Math.floor(floorN / 2));
          const pool = PLAYER_SKILLS.filter((s) => s.tier <= maxTier);
          const sk = rng.pick(pool);
          loot[`tome:${sk.id}`] = 1;
        }
        if (rng.chance(0.25)) {
          const seeds = ITEM_LIST.filter((i) => (i.type === "seed" || i.type === "sapling") && (i.tier ?? 1) <= 1 + Math.floor(floorN / 3));
          loot[rng.pick(seeds).id] = rng.int(1, 3);
        }
        const gold = rng.int(15, 35) * floorN;
        g.gold += gold;
        ex.bagGold += gold;
        const lines = giveToGame(g, loot);
        fs.done.push(e.id);
        showLoot("🎁 Rương Báu", [`💰 ${gold} vàng`, ...lines]);
        updateHud();
        return savePos();
      }
      case "camp": {
        for (const id of g.party) {
          const ch = g.chars[id];
          const s = charStats(ch);
          ch.hp = Math.max(ch.hp, Math.round(s.hp * 0.3));
          ch.hp = Math.min(s.hp, ch.hp + Math.round(s.hp * 0.6));
          ch.mp = Math.min(s.mp, ch.mp + Math.round(s.mp * 0.6));
        }
        ex.done.push(e.id);
        toast("🔥 Cả đội nghỉ ngơi bên lửa trại, hồi phục 60% máu và MP.", "good");
        updateHud();
        return savePos();
      }
      case "event":
      case "random":
      case "guardian": {
        busy = true;
        player.path = [];
        const eventId = eventIdOf(e);
        const bossDef = e.kind === "guardian" ? ENEMIES[def.boss.find((id) => ENEMIES[id]?.boss) ?? def.boss[0]] : undefined;
        const res = await playStory(eventId, {
          floor: floorN,
          bg: biome.bg,
          vars: { floorName: def.name, boss: bossDef?.name ?? "", floorFlag: `f${floorN}_cleared` },
          battle: (spec) => {
            const group = spec.group ?? (e.kind === "guardian" ? def.boss : rng.pick(def.groups));
            const lvl = spec.level ?? (e.kind === "guardian" ? e.level! : levelHere()) + (spec.levelAdd ?? 0);
            return battle(group, lvl, spec);
          },
        });
        busy = false;
        if (res.defeated) return defeat();
        if (res.done && e.kind !== "guardian") fs.done.push(e.id);
        if (fs.cleared && e.kind === "guardian") showBanner(el, "Cầu thang đã mở!", `Xuống tầng ${floorN + 1}`);
        updateHud();
        return savePos(true);
      }
      case "town": {
        player.path = [];
        const s = getSettlement(floorN, Number(e.ref ?? 0));
        g.flags[`seen_town_${s.id}`] = true;
        openSettlement(s, () => { updateHud(); savePos(); }, "people");
        return;
      }
      case "building": {
        player.path = [];
        const town = map.towns.find((t) => e.x >= t.x && e.x < t.x + t.w && e.y >= t.y && e.y < t.y + t.h);
        if (!town || e.ref === "prop") return;
        const s = getSettlement(floorN, town.i);
        const done = () => { updateHud(); savePos(); };
        const [kind, arg] = (e.ref ?? "").split(":");
        if (kind === "shop") { const k = s.shops.indexOf(arg as ShopKind); return openShop(s, arg as ShopKind, s.npcs[Math.max(0, k)], done); }
        if (kind === "inn") return openSettlement(s, done, "inn");
        if (kind === "home" && arg) {
          const npc = getNpc(arg);
          toast(`🏠 Nhà của ${npc.name}. Bạn gõ cửa…`);
          return openNpc(npc, done);
        }
        return;
      }
      case "npc": {
        player.path = [];
        return openNpc(getNpc(e.ref!), () => { updateHud(); savePos(); });
      }
      case "stairs": {
        if (!fs.cleared) return toast("🔒 Cầu thang bị phong ấn. Hãy đánh bại Boss Canh Cửa của tầng.", "bad");
        if (floorN >= 100) return toast("Đây là tầng sâu nhất... Trái Tim Vực Sâu vẫn đang chờ được viết tiếp.", "info", 5000);
        if (!(await confirmBox("Cầu Thang", `Xuống tầng ${floorN + 1}: ${getFloor(floorN + 1).name}?`, "Xuống"))) return;
        savePos(true);
        ex.floor = floorN + 1;
        const next = g.floors[floorN + 1];
        if (next) { delete next.px; delete next.py; }
        ex.done = [];
        app.dirty(true);
        return hooks.changeFloor(floorN + 1);
      }
      case "portal": {
        const choice = await portalMenu();
        if (choice === null) return;
        if (choice > 0) {
          savePos(true);
          ex.floor = choice;
          const next = g.floors[choice];
          if (next) { delete next.px; delete next.py; }
          ex.done = [];
          logMsg(g, `Dịch chuyển tới tầng ${choice}.`);
          app.dirty(true);
          return hooks.changeFloor(choice);
        }
        savePos();
        const lines = bagLines();
        g.expedition = null;
        g.meal = null;
        g.flags.tired = true;
        logMsg(g, `Trở về từ tầng ${floorN}.`);
        app.dirty(true);
        hooks.toSafeZone();
        showLoot("🏡 Về tới Thánh Địa", lines.length ? lines : ["Chuyến đi này không nhặt được gì."], "Bạn thấy mệt mỏi. Hãy vào Nhà Chính ngủ một giấc.");
        return;
      }
    }
  }

  /** Portal: go home (0), jump to another unlocked floor (n) or cancel (null). */
  function portalMenu(): Promise<number | null> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: number | null) => { if (!done) { done = true; resolve(v); } };
      const m = openModal("🌀 Cổng Dịch Chuyển", { onClose: () => finish(null) });
      const floors = h("div", { class: "list" });
      for (let f = g.maxFloor; f >= 1; f--) {
        if (f === floorN) continue;
        const fd = getFloor(f);
        floors.append(h("button", { class: "item-row", onclick: () => { finish(f); m.close(); } },
          h("span", { class: "ico" }, g.floors[f]?.cleared ? "✅" : "🌀"),
          h("div", { class: "meta" }, h("div", { class: "name" }, `Tầng ${f}: ${fd.name}`), h("div", { class: "desc" }, `Cấp quái ~${fd.levelBase}–${fd.levelBase + 4}`))));
      }
      m.body.append(
        h("button", { class: "btn primary block", onclick: () => { finish(0); m.close(); } }, "🏡 Trở về Thánh Địa (mang theo toàn bộ chiến lợi phẩm)"),
        h("div", { class: "section-title" }, "Dịch chuyển tới đầu tầng đã mở khoá"),
        floors.children.length ? floors : h("p", { class: "muted" }, "Chưa mở khoá tầng nào khác."));
    });
  }

  function bagLines() {
    const lines = Object.entries(ex.bag).filter(([, n]) => n > 0).map(([id, n]) => `${getItem(id).icon} ${getItem(id).name} ×${n}`);
    if (ex.bagGold) lines.unshift(`💰 ${ex.bagGold} vàng`);
    return lines;
  }

  function showLoot(title: string, lines: string[], note = "") {
    const m = openModal(title);
    m.body.append(...nn(h("div", { class: "loot", style: "justify-content:flex-start" }, lines.map((l) => h("span", null, l))), note ? h("p", { class: "muted" }, note) : null,
      h("div", { class: "row end" }, h("button", { class: "btn primary", onclick: () => m.close() }, "OK"))));
  }

  function defeat(voluntary = false) {
    const lost: string[] = [];
    for (const [id, n] of Object.entries(ex.bag)) {
      const k = Math.min(Math.ceil(n / 2), g.inventory[id] ?? 0);
      if (k > 0 && removeItem(g, id, k)) lost.push(`${getItem(id).icon} ${getItem(id).name} ×${k}`);
    }
    const goldLost = Math.min(g.gold, Math.floor(ex.bagGold / 2));
    g.gold -= goldLost;
    if (goldLost) lost.unshift(`💰 ${goldLost} vàng`);
    for (const id of g.party) {
      const ch = g.chars[id];
      ch.hp = Math.max(1, Math.round(charStats(ch).hp * 0.2));
    }
    g.expedition = null;
    g.meal = null;
    g.flags.tired = true;
    logMsg(g, voluntary ? `Thoát khẩn cấp khỏi tầng ${floorN}.` : `Gục ngã ở tầng ${floorN}.`);
    app.dirty(true);
    hooks.toSafeZone();
    showLoot(voluntary ? "🏳️ Thoát Khẩn Cấp" : "💀 Gục Ngã", lost.length ? lost : ["Không mất gì."],
      voluntary ? "Mầm kéo cả đội về Thánh Địa. Một nửa chiến lợi phẩm đã rơi lại dưới Vực Sâu." : "Bạn tỉnh dậy bên cạnh Mầm, toàn thân đau nhức. Một nửa chiến lợi phẩm đã bị bỏ lại dưới Vực Sâu.");
  }

  // ------------------------------------------------------------ minimap
  function openMinimap() {
    const m = openModal(`🗺️ Tầng ${floorN}: ${def.name}`, { wide: true });
    const s = 5;
    const cv = h("canvas", { width: map.w * s, height: map.h * s, class: "pix", style: "width:100%;height:auto;border-radius:8px;background:#000" });
    const c = cv.getContext("2d")!;
    const col: Record<number, string> = { [T.GROUND]: biome.ground[0], [T.ALT]: biome.alt[0], [T.DECOR]: biome.ground[1], [T.OBSTACLE]: biome.obs[1], [T.WATER]: biome.water[0], [T.SHALLOW]: biome.water[1], [T.WALL]: biome.wall[0], [T.PAVE]: "#b8b0a0", [T.LOT]: "#a0503a" };
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (!fog[idx(x, y)]) continue;
      c.fillStyle = col[map.tiles[idx(x, y)]];
      c.fillRect(x * s, y * s, s, s);
    }
    // markers are pixel icons laid over the map at a fixed size, so they stay readable on phones
    const wrap = h("div", { class: "mm-wrap" }, cv);
    const pin = (kind: MapPin, x: number, y: number, label: string, cls = "") => {
      const el = h("div", { class: `mm-pin ${cls}`, style: `left:${((x + 0.5) / map.w) * 100}%;top:${((y + 0.5) / map.h) * 100}%` },
        h("img", { class: "pix", src: mapPinURL(kind), alt: label }));
      wrap.append(tip(el, () => h("div", { class: "tip-name" }, label)));
    };
    const PIN: Partial<Record<string, [MapPin, string]>> = {
      event: ["event", "Sự kiện"], guardian: ["boss", "Boss Canh Cửa"], stairs: ["stairs", "Cầu thang xuống tầng sau"], portal: ["portal", "Cổng về Thánh Địa"],
      chest: ["chest", "Rương báu"], camp: ["camp", "Lửa trại (nghỉ ngơi)"], random: ["mystery", "Điều bí ẩn"],
    };
    for (const e of ents) {
      const p = PIN[e.kind];
      if (!p || !alive(e) || !fog[idx(e.x, e.y)]) continue;
      pin(p[0], e.x, e.y, p[1], e.kind === "guardian" ? "big" : "");
    }
    for (const t of map.towns) {
      const cx = t.x + Math.floor(t.w / 2), cy = t.y + Math.floor(t.h / 2);
      if (!fog[idx(cx, cy)] && !fog[idx(t.x, t.y)] && !fog[idx(t.x + t.w - 1, t.y + t.h - 1)]) continue;
      const s = getSettlement(floorN, t.i);
      pin("town", cx, cy, s.name, "big");
      wrap.append(h("div", { class: "mm-label", style: `left:${((cx + 0.5) / map.w) * 100}%;top:${((cy + 0.5) / map.h) * 100}%` }, s.name));
    }
    pin("hero", player.x, player.y, "Bạn đang ở đây", "hero");
    const explored = fog.reduce((a, b) => a + b, 0);
    const legend = h("div", { class: "mm-legend" }, ([["hero", "Bạn"], ["town", "Làng"], ["event", "Sự kiện"], ["boss", "Boss"], ["stairs", "Cầu thang"], ["portal", "Cổng về"], ["chest", "Rương"], ["camp", "Lửa trại"], ["mystery", "Bí ẩn"]] as [MapPin, string][])
      .map(([k, l]) => h("span", null, h("img", { class: "pix", src: mapPinURL(k), alt: "" }), l)));
    m.body.append(wrap, h("p", { class: "muted small" }, `Đã khám phá ${Math.round((explored / (map.w * map.h)) * 100)}%.`), legend,
      h("div", { class: "col", style: "gap:3px" }, def.regions.map((r, i) => h("div", { class: "small" }, `${i === region ? "📍" : "·"} ${r}`))));
  }

  // ------------------------------------------------------------ render
  let last = performance.now();
  view.onDraw = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    // glide at a constant speed; the next step starts just before the current one ends,
    // so holding a direction or following a path moves without stopping between tiles
    const v = dt / STEP;
    const glide = (o: { px: number; py: number }, x: number, y: number) => {
      o.px = approach(o.px, x, v);
      o.py = approach(o.py, y, v);
    };
    glide(player, player.x, player.y);
    player.t = Math.max(0, player.t - dt);
    const left = Math.abs(player.x - player.px) + Math.abs(player.y - player.py);
    if (!busy && !topModalOpen() && left < 0.2 && player.t <= 0) {
      const next = player.path.shift();
      const bx = player.x, by = player.y;
      if (next) tryStep(next.x, next.y);
      else if (keys.size) {
        const d = DIRS[[...keys].pop()!];
        tryStep(player.x + d[0], player.y + d[1]);
      }
      // bumped into something: wait a moment before trying again
      if ((next || keys.size) && bx === player.x && by === player.y) player.t = 0.2;
    }
    for (const e of ents) glide(e, e.x, e.y);
    // companions glide along the trail too
    for (let i = 0; i < 3; i++) {
      const tr = trail[i] ?? { x: player.x, y: player.y };
      const f = (followers[i] ??= { px: tr.x, py: tr.y, dir: 0 as Dir, flip: false });
      if (Math.abs(tr.x - f.px) + Math.abs(tr.y - f.py) > 3) { f.px = tr.x; f.py = tr.y; }
      if (Math.abs(tr.x - f.px) > 0.01) { f.dir = 2; f.flip = tr.x < f.px; } else if (Math.abs(tr.y - f.py) > 0.01) f.dir = tr.y < f.py ? 1 : 0;
      glide(f, tr.x, tr.y);
    }
    view.camX += (player.px - view.camX) * Math.min(1, dt * 14);
    view.camY += (player.py - view.camY) * Math.min(1, dt * 14);

    const c = view.ctx;
    c.fillStyle = "#000";
    c.fillRect(0, 0, view.w, view.h);
    const vr = view.visible();
    const frame = Math.floor(t / 380) % 4;
    const inSight = (x: number, y: number) => (x - player.x) ** 2 + (y - player.y) ** 2 <= SIGHT * SIGHT + 2;
    const TL = view.tile;
    const drawables: { y: number; fn: () => void }[] = [];
    // terrain: pre-rendered 16x16-tile chunks (one per water frame), then the fog overlay
    for (let cy = Math.floor(vr.y0 / CH); cy <= Math.floor(vr.y1 / CH); cy++) {
      for (let cx = Math.floor(vr.x0 / CH); cx <= Math.floor(vr.x1 / CH); cx++) {
        if (cx < 0 || cy < 0 || cx * CH >= map.w || cy * CH >= map.h) continue;
        // edges come from the neighbour's snapped position (plus a hair of overlap) so rounding never opens a seam
        const x0 = view.sx(cx * CH), y0 = view.sy(cy * CH);
        const x1 = view.sx((cx + 1) * CH), y1 = view.sy((cy + 1) * CH);
        c.drawImage(terrainChunk(cx, cy, frame), x0, y0, x1 - x0 + 0.75, y1 - y0 + 0.75);
      }
    }
    {
      // only the visible part of the fog map
      const fx0 = Math.max(0, vr.x0), fy0 = Math.max(0, vr.y0), fx1 = Math.min(map.w, vr.x1 + 1), fy1 = Math.min(map.h, vr.y1 + 1);
      if (fx1 > fx0 && fy1 > fy0) c.drawImage(fogCanvas, fx0, fy0, fx1 - fx0, fy1 - fy0, view.sx(fx0), view.sy(fy0), (fx1 - fx0) * TL, (fy1 - fy0) * TL);
    }
    // tall obstacles (trees, rocks...) are y-sorted with the entities; their base sits mid-tile
    for (let y = vr.y0; y <= vr.y1 + 3; y++) {
      for (let x = vr.x0; x <= vr.x1; x++) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
        const i = idx(x, y);
        if (!fog[i] || map.tiles[i] !== T.OBSTACLE) continue;
        const tall = tiles.tall[(map.variant[i] + x * 7 + y * 13) % tiles.tall.length];
        const seen = inSight(x, y);
        drawables.push({ y: y + 0.99, fn: () => view.img(tall, x - 0.5, y - 2 - TREE_LIFT, { w: 2, h: 3, alpha: seen ? 1 : 0.55 }) });
      }
    }
    // entities
    const bob = (seed: number) => Math.sin(t / 260 + seed) * 0.06;
    for (const e of ents) {
      if (!alive(e) || !fog[idx(e.x, e.y)]) continue;
      if (e.x < vr.x0 - 3 || e.x > vr.x1 + 3 || e.y < vr.y0 - 1 || e.y > vr.y1 + 4) continue;
      drawables.push({ y: e.py + 1, fn: () => drawEntity(e) });
    }
    const townLabel = (e: (typeof ents)[number], name: string) => {
      c.font = `bold ${Math.round(view.tile * 0.3)}px sans-serif`;
      c.fillStyle = "#fff";
      c.strokeStyle = "#000";
      c.lineWidth = 3;
      const label = `📜 ${name}`;
      const tw = c.measureText(label).width;
      c.strokeText(label, view.sx(e.x) + view.tile / 2 - tw / 2, view.sy(e.y) + view.tile * 1.3);
      c.fillText(label, view.sx(e.x) + view.tile / 2 - tw / 2, view.sy(e.y) + view.tile * 1.3);
    };
    const drawEntity = (e: (typeof ents)[number]) => {
      const seen = inSight(e.x, e.y);
      if (e.kind === "monster") {
        if (!seen) return;
        const ed = ENEMIES[e.group![0]];
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.beginPath();
        c.ellipse(view.sx(e.px) + TL / 2, view.sy(e.py) + TL * 0.92, TL * 0.3, TL * 0.09, 0, 0, Math.PI * 2);
        c.fill();
        const small = parseCreature(ed.sprite);
        view.img(small ? creatureSmall(small) : spriteCanvas(ed.sprite, ed.palette), e.px, e.py, { dy: bob(e.x) - 0.05, flip: player.x < e.x });
        if (e.group!.length > 1) {
          c.font = `bold ${Math.round(view.tile * 0.28)}px sans-serif`;
          c.fillStyle = "#fff";
          c.strokeStyle = "#000";
          c.lineWidth = 3;
          const tx = view.sx(e.px) + view.tile * 0.7, ty = view.sy(e.py) + view.tile * 0.25;
          c.strokeText(`×${e.group!.length}`, tx, ty);
          c.fillText(`×${e.group!.length}`, tx, ty);
        }
        return;
      }
      if (e.kind === "building") {
        const [fx, fy, fw, fh] = e.foot!;
        const cv = buildingCanvas(e.sprite, 1);
        const bw = cv.width / 16, bh = cv.height / 16;
        view.img(cv, fx + (fw - bw) / 2, fy + fh - bh, { w: bw, h: bh, alpha: seen ? 1 : 0.75 });
        const [kind, arg] = (e.ref ?? "").split(":");
        const sign = kind === "shop" ? SHOP_NAMES[arg as ShopKind]?.icon : kind === "inn" ? "🛏️" : "";
        if (sign) {
          const sx = view.sx(e.x) + TL / 2, sy = view.sy(fy) - TL * 0.35;
          c.fillStyle = "rgba(20,14,8,.78)";
          c.beginPath();
          c.arc(sx, sy, TL * 0.34, 0, Math.PI * 2);
          c.fill();
          c.font = `${Math.round(TL * 0.42)}px sans-serif`;
          c.textAlign = "center";
          c.fillText(sign, sx, sy + TL * 0.15);
          c.textAlign = "start";
        }
        return;
      }
      if (e.kind === "npc") {
        const npc = getNpc(e.ref!);
        c.fillStyle = "rgba(20,10,40,0.28)";
        c.beginPath();
        c.ellipse(view.sx(e.px) + TL / 2, view.sy(e.py) + TL * 0.92, TL * 0.28, TL * 0.09, 0, 0, Math.PI * 2);
        c.fill();
        const moving = Math.abs(e.px - e.x) + Math.abs(e.py - e.y) > 0.05;
        const fr = moving ? Math.floor(t / 150) % 4 : 0;
        if (isPerson(npc.sprite)) view.img(personCanvas(npc.sprite, npc.pal, e.dir, fr), e.px, e.py - 1, { h: 2, flip: e.dir === 2 && e.flip });
        else view.img(spriteCanvas(npc.sprite, npc.pal), e.px, e.py);
        if (activeQuest(g, npc.id)) {
          c.font = `${Math.round(TL * 0.4)}px sans-serif`;
          c.fillText("📋", view.sx(e.px) + TL * 0.3, view.sy(e.py) - TL * 1.05);
        }
        return;
      }
      if (e.kind === "town") {
        const s = getSettlement(floorN, Number(e.ref ?? 0));
        const cv = buildingCanvas(e.sprite, 1);
        const sc = Math.min(1, 1.5 / (cv.width / 16));
        const bw = (cv.width / 16) * sc, bh = (cv.height / 16) * sc;
        view.img(cv, e.x + 0.5 - bw / 2, e.y + 1 - bh, { w: bw, h: bh, alpha: seen ? 1 : 0.7 });
        drawables.push({ y: 1e6, fn: () => townLabel(e, s.name) });
        return;
      }
      if (e.kind === "event" || e.kind === "random") {
        // the event is shown by what it is: a tablet, a nest, a cart, a stranger...
        const look = lookOf(e);
        const alpha = seen ? 1 : 0.7;
        if ("person" in look) {
          c.fillStyle = "rgba(20,10,40,0.28)";
          c.beginPath();
          c.ellipse(view.sx(e.x) + TL / 2, view.sy(e.y) + TL * 0.92, TL * 0.28, TL * 0.09, 0, 0, Math.PI * 2);
          c.fill();
          view.img(personCanvas(look.person, look.pal, 0, 0), e.x, e.y - 1, { h: 2, alpha });
        } else view.img(propCanvas(look.prop, propCtx), e.x - 0.5, e.y - 1, { w: 2, h: 2, alpha });
        // a faint glint every few seconds hints that it can be touched
        const ph = (t / 1000 + (e.x * 7 + e.y * 13) % 10) % 4;
        if (seen && ph < 0.6) {
          const a = Math.sin((ph / 0.6) * Math.PI);
          c.fillStyle = `rgba(255,250,210,${a})`;
          const gx = view.sx(e.x) + TL * 0.75, gy = view.sy(e.y) - TL * 0.55, r = TL * 0.12;
          c.fillRect(gx - r * 1.6, gy - 1, r * 3.2, 2);
          c.fillRect(gx - 1, gy - r * 1.6, 2, r * 3.2);
        }
        return;
      }
      if (e.kind === "deco") {
        view.img(propCanvas(e.sprite, propCtx), e.x - 0.5, e.y - 1, { w: 2, h: 2, alpha: seen ? 1 : 0.7 });
        return;
      }
      if (e.kind === "guardian") {
        const bd = ENEMIES[def.boss.find((id) => ENEMIES[id]?.boss) ?? def.boss[0]];
        c.fillStyle = "rgba(20,10,40,0.35)";
        c.beginPath();
        c.ellipse(view.sx(e.x) + TL / 2, view.sy(e.y) + TL * 0.92, TL * 0.7, TL * 0.2, 0, 0, Math.PI * 2);
        c.fill();
        view.img(spriteCanvas(bd.sprite, bd.palette), e.x - 0.5, e.y - 1, { w: 2, h: 2, alpha: seen ? 1 : 0.6, dy: Math.sin(t / 500) * 0.04 });
        return;
      }
      const sprite = e.sprite;
      const scale = e.kind === "stairs" || e.kind === "portal" ? 1 : 0.9;
      view.img(spriteCanvas(sprite), e.x, e.y, { scale });
      if (e.kind === "stairs" && !fs.cleared) {
        c.font = `${Math.round(view.tile * 0.45)}px sans-serif`;
        c.fillText("🔒", view.sx(e.x) + view.tile * 0.28, view.sy(e.y) + view.tile * 0.7);
      }
      if (e.kind === "portal") {
        c.fillStyle = `rgba(176,138,255,${0.15 + Math.sin(t / 300) * 0.1})`;
        c.beginPath();
        c.arc(view.sx(e.x) + view.tile / 2, view.sy(e.y) + view.tile / 2, view.tile * 0.7, 0, Math.PI * 2);
        c.fill();
      }
    };

    const drawMember = (ch: (typeof g.chars)[string], pos: { x: number; y: number; dir?: Dir; flip?: boolean }, i: number) => {
      c.fillStyle = "rgba(20,10,40,0.28)";
      c.beginPath();
      c.ellipse(view.sx(pos.x) + view.tile / 2, view.sy(pos.y) + view.tile * 0.92, view.tile * 0.3, view.tile * 0.1, 0, 0, Math.PI * 2);
      c.fill();
      const moving = Math.abs(player.px - player.x) + Math.abs(player.py - player.y) > 0.05;
      const frame = moving ? Math.floor(t / 130) % 4 : 0;
      const dir = i === 0 ? player.dir : pos.dir ?? player.dir;
      const flip = i === 0 ? player.flip : pos.flip ?? player.flip;
      if (isPerson(ch.sprite)) view.img(personCanvas(ch.sprite, ch.pal, dir, frame), pos.x, pos.y - 1, { h: 2, flip: dir === 2 && flip, alpha: ch.hp <= 0 ? 0.4 : 1 });
      else view.img(spriteCanvas(ch.sprite, ch.pal), pos.x, pos.y, { flip, alpha: ch.hp <= 0 ? 0.4 : 1 });
    };

    // party (companions follow the trail)
    const members = g.party.map((id) => g.chars[id]);
    for (let i = members.length - 1; i >= 0; i--) {
      const ch = members[i];
      const f = followers[i - 1];
      const pos = i === 0 || !f ? { x: player.px, y: player.py } : { x: f.px, y: f.py, dir: f.dir, flip: f.flip };
      drawables.push({ y: pos.y + 1 + (i === 0 ? 0.01 : 0), fn: () => drawMember(ch, pos, i) });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    drawParticles(c, biome.particles, view.w, view.h, t, view.camX, view.camY, TL);
    // lighting: a pre-rendered vignette (night floors: a lantern circle around the player)
    const lt = lighting(view.w, view.h, TL);
    if (biome.night) {
      const cx = view.sx(player.px) + TL / 2, cy = view.sy(player.py) + TL / 2;
      c.drawImage(lt, cx - lt.width / 2, cy - lt.height / 2);
    } else c.drawImage(lt, 0, 0);
  };
  let lightCv: HTMLCanvasElement | null = null, lightKey = "";
  function lighting(w: number, h: number, tl: number): HTMLCanvasElement {
    const key = `${w}x${h}@${tl}`;
    if (lightCv && lightKey === key) return lightCv;
    const cv = document.createElement("canvas");
    // the night circle follows the player, so it is drawn twice the screen size and centred on them
    cv.width = biome.night ? w * 2 : w;
    cv.height = biome.night ? h * 2 : h;
    const q = cv.getContext("2d")!;
    const cx = cv.width / 2, cy = cv.height / 2;
    const grd = biome.night ? q.createRadialGradient(cx, cy, tl * 1.5, cx, cy, tl * (SIGHT + 1.5)) : q.createRadialGradient(cx, cy, Math.min(w, h) * 0.4, cx, cy, Math.max(w, h) * 0.8);
    if (biome.night) {
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.55, "rgba(0,0,12,0.35)");
      grd.addColorStop(1, "rgba(0,0,12,0.78)");
    } else {
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,0.45)");
    }
    q.fillStyle = grd;
    q.fillRect(0, 0, cv.width, cv.height);
    lightCv = cv;
    lightKey = key;
    return cv;
  }
  setFieldSpecial((it) => {
    const sp = it.use?.special;
    if (busy) return false;
    if (sp === "revealMap") {
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (Math.hypot(x - player.x, y - player.y) < 22) fog[idx(x, y)] = 1;
      updateFog();
      toast("🗺️ Bản đồ vùng xung quanh hiện ra rõ ràng.", "good");
      savePos();
      return true;
    }
    if (sp === "repel") { ex.repel = 120; toast("✨ Quái vật sẽ tránh xa bạn trong 120 bước.", "good"); return true; }
    if (sp === "lure") { ex.repel = -60; toast("🎺 Mùi hương dụ quái vật tới gần trong 60 bước!", "info"); return true; }
    if (sp === "returnHome") {
      setTimeout(() => {
        savePos();
        const lines = bagLines();
        g.expedition = null;
        g.meal = null;
        g.flags.tired = true;
        logMsg(g, `Dùng cuộn phép trở về từ tầng ${floorN}.`);
        app.dirty(true);
        hooks.toSafeZone();
        showLoot("📜 Dịch chuyển về Thánh Địa", lines.length ? lines : ["Chuyến đi này không nhặt được gì."]);
      }, 50);
      return true;
    }
    return false;
  });
  view.start();
  reveal();
  checkRegion();
  savePos();
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__dungeon = { ents, interact, player, tryStep, map, reveal, fog, updateFog, view };

  if (fresh) {
    busy = true;
    void showIntro(def).then(() => { busy = false; showBanner(el, `Tầng ${floorN}`, def.name); });
  } else showBanner(el, `Tầng ${floorN}`, def.name);

  return {
    destroy: () => {
      destroyed = true;
      setFieldSpecial(null);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      view.destroy();
      el.remove();
      if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__dungeon;
    },
  };
}

function showIntro(def: FloorDef): Promise<void> {
  const biome = BIOMES[def.biome];
  return new Promise((resolve) => {
    const el = h("div", { class: "story", style: `--sb1:${biome.bg[0]};--sb2:${biome.bg[1]}` },
      h("div", { class: "story-inner", style: "justify-content:center" },
        h("h2", { class: "story-title" }, `Tầng ${def.n}`),
        h("div", { class: "story-title", style: "font-size:40px" }, def.name),
        h("div", { class: "story-box", style: "flex:none" }, h("div", { class: "story-text" }, def.intro)),
        h("div", { class: "choices" }, h("button", { class: "choice", onclick: () => { el.remove(); resolve(); } }, "Bước vào ▸"))));
    document.body.append(el);
  });
}
