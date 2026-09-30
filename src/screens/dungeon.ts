import { app, type Screen } from "../app";
import { Rng, hashString } from "../core/rng";
import { XP_RATE, charStats, giveXp, logMsg, removeItem, type FloorState, type GameState } from "../core/state";
import { ENEMIES } from "../data/enemies";
import { ITEM_LIST, gearForFloor, getItem } from "../data/items";
import { PLAYER_SKILLS } from "../data/skills";
import { MapView } from "../render/mapview";
import { drawParticles } from "../render/particles";
import { mapPinURL, type MapPin } from "../render/icons";
import { tip } from "../ui/tooltip";
import { spriteCanvas } from "../render/pixel";
import { creatureSmall, parseCreature } from "../render/creatures";
import { isPerson, personCanvas, type Dir } from "../render/people";
import { PASSABLE, T, tileSet } from "../render/tiles";
import { EVENTS, RANDOM_EVENTS, RANDOM_POOL } from "../story";
import { eventLook, propCanvas, roadsidePal, type PropCtx } from "../render/eventProps";
import { giveToGame, randomLoot, rollCheck } from "../story/runner";
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
import { isElitePack } from "../combat/elite";
import { SAGA, type SagaDef } from "../world/saga";
import { PET, petSpec } from "../data/pets";
import { openJournal, openMenu, partyMini, saveDot, showBanner } from "./common";
import { openInventory, setFieldSpecial } from "./inventory";
import { openParty } from "./party";
import { playStory } from "./story";

const mapCache = new Map<string, FloorMap>();
const BASE_SIGHT = 8;
/** The three rune stones of a sealed vault, and the riddle words for each. */
const RUNE = [
  { icon: "🌙", name: "Trăng", clue: "kẻ canh giấc ngủ của muôn loài" },
  { icon: "☀️", name: "Mặt Trời", clue: "kẻ đánh thức buổi sớm" },
  { icon: "⭐", name: "Sao", clue: "kẻ dẫn đường cho người lạc lối" },
];
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
  // the floor's great event (declared early: entity rules below depend on it)
  let sagaDef: SagaDef | undefined;
  // a night-eyed cat lets the party see further
  const SIGHT = BASE_SIGHT + (g.pet && PET[g.pet]?.hook === "sight" ? 3 : 0);
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
    if (e.kind === "monster" && e.saga) return !fs.done.includes(e.id);
    if (e.kind === "saga" && e.ref !== "core" && sagaDef && ["collect", "rescue", "blight"].includes(sagaDef.mech)) return !fs.done.includes(e.id);
    if (e.kind === "monster" || e.kind === "node" || e.kind === "camp") return !ex.done.includes(e.id);
    if (e.kind === "guardian") return !fs.cleared;
    // townsfolk who joined the party live in the sanctuary now, not in their village
    if (e.kind === "npc") return !g.chars[`npc_${e.ref}`];
    if (e.kind === "rune") return !fs.done.some((d) => d.startsWith("vault_"));
    if (e.kind === "stairs" || e.kind === "portal" || e.kind === "town" || e.kind === "building" || e.kind === "deco") return true;
    return !fs.done.includes(e.id);
  };
  const ents = map.entities.map((e) => ({ ...e, px: e.x, py: e.y, stun: 0, dir: 0 as Dir, flip: false }));
  // what each event looks like on the map
  const spec = specFor(floorN);
  const propCtx: PropCtx = { el: def.el, accent: spec.col[5], sig: spec.sig[2], stone: spec.col[3], seed: fs.seed };
  const looks = new Map<string, { prop: string } | { person: string; pal?: Record<string, string> }>();
  // Roadside "?" encounters: dealt from a big shuffled pool, never twice on one floor, skipping
  // the ones met recently; rare ones are drawn much less often.
  const randomOf = new Map<string, string>();
  {
    const recent = new Set(String(g.flags.rev_recent ?? "").split(",").filter(Boolean));
    const r2 = new Rng(fs.seed ^ 0x3a7e);
    const order = RANDOM_POOL.map((p) => ({ id: p.id, k: -Math.log(1 - r2.next()) / (p.rare ? 0.2 : 1) })).sort((a, b) => a.k - b.k).map((p) => p.id);
    const deck = [...order.filter((id) => !recent.has(id)), ...order.filter((id) => recent.has(id))];
    map.entities.filter((e) => e.kind === "random").sort((a, b) => a.id.localeCompare(b.id)).forEach((e, i) => randomOf.set(e.id, deck[i % deck.length]));
  }
  const eventIdOf = (e: MapEntity) => (e.kind === "random" ? randomOf.get(e.id) ?? RANDOM_EVENTS[0].id : e.kind === "secret" ? "secret_wall" : e.ref!);
  const rememberRandom = (id: string) => {
    const list = String(g.flags.rev_recent ?? "").split(",").filter((x) => x && x !== id);
    list.push(id);
    g.flags.rev_recent = list.slice(-40).join(",");
  };
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
  const sagaChip = h("div", { class: "chip saga-chip hidden" });
  const info = h("div", { class: "chip" });
  const party = partyMini();
  const bagBadge = h("span", { class: "dock-badge" });
  const updateHud = () => {
    bagBadge.textContent = String(g.newItems?.length || "");
    info.replaceChildren("💰 ", h("b", null, String(g.gold)), "  🎒 ", h("b", null, String(Object.keys(ex.bag).length)), "  ", saveDot());
    party.update();
    updateSaga();
  };
  el.append(h("div", { class: "hud-top" }, h("div", { class: "col", style: "gap:6px" }, title, party.el), h("div", { class: "hud-right" }, info, regionChip, sagaChip)));
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
      keys.clear(); // bumping into something stops the walk; press again to keep going
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
    sagaStep();
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
    // a key let go while a window was open still counts, or the hero keeps "holding" it and
    // walks straight back into whoever opened that window
    if (e.type === "keyup") { keys.delete(e.code); return; }
    if (topModalOpen() || e.target instanceof HTMLInputElement) return;
    if (DIRS[e.code]) {
      e.preventDefault();
      keys.add(e.code); player.path = [];
    }
    if (e.code === "KeyM") openMinimap();
  };
  const releaseKeys = () => keys.clear();
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", releaseKeys);

  // ------------------------------------------------------------ interactions
  const battle = (group: string[], level: number, opts: Partial<BattleSpec> & { elite?: boolean } = {}): Promise<BattleOutcome> =>
    runBattle({ enemies: group.map((id) => ({ id, level })), floor: floorN, biome: def.biome, enemyFx: opts.enemyFx, noFlee: opts.noFlee, elite: opts.elite, seed: fs.seed });
  const elite = (e: MapEntity) => e.kind === "monster" && (e.saga === "beast" || isElitePack(fs.seed, e.id, floorN));

  async function fightMonster(m: (typeof ents)[number], ambush: boolean) {
    if (busy || destroyed) return;
    busy = true;
    player.path = [];
    const out = await battle(m.group!, m.level!, { ...(ambush ? { enemyFx: [{ s: "slow" as const, t: 1 }] } : {}), elite: elite(m) || m.saga === "beast" });
    busy = false;
    if (out === "win") {
      ex.done.push(m.id);
      if (m.saga) { fs.done.push(m.id); sagaAfterFight(m); }
    }
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
        const n = (rng.chance(0.3) ? 2 : 1) * (g.pet && PET[g.pet]?.hook === "dig" ? 2 : 1);
        const lines = giveToGame(g, { [e.ref!]: n, ...(rng.chance(0.04) ? { mana_crystal: 1 } : {}) });
        ex.done.push(e.id);
        toast(`Thu thập: ${lines.join(", ")}`, "good");
        updateHud();
        return savePos();
      }
      case "saga":
        return void sagaInteract(e);
      case "rune": {
        const vault = ents.find((v) => v.kind === "vault");
        if (!vault || !alive(vault)) return;
        const want = vault.ref!;
        const k = e.ref!;
        const got = fs.puzzle ?? "";
        if (got.includes(k)) { toast(`${RUNE[+k].icon} Phiến đá này đang sáng rồi.`); return; }
        if (want[got.length] === k) {
          fs.puzzle = got + k;
          if (fs.puzzle.length === 3) showBanner(el, "Kho Ấn đã mở khoá!", "Ba phiến đá đồng loạt rực sáng");
          else toast(`${RUNE[+k].icon} Phiến đá ${RUNE[+k].name} sáng lên. (${fs.puzzle.length}/3)`, "good");
        } else {
          fs.puzzle = "";
          toast(`${RUNE[+k].icon} Sai thứ tự... mọi phiến đá tắt ngấm.`, "bad");
        }
        return savePos();
      }
      case "vault": {
        if ((fs.puzzle ?? "") !== e.ref) {
          const clue = e.ref!.split("").map((d, i) => `${["", "rồi ", "cuối cùng là "][i]}${RUNE[+d].clue}`).join(", ");
          showLoot("🔒 Kho Ấn Cổ", [`Trên cửa đá khắc: "Đánh thức theo thứ tự — ${clue}."`, "Quanh đây có ba phiến đá rune: 🌙 Trăng, ☀️ Mặt Trời, ⭐ Sao. Chạm vào chúng đúng thứ tự để mở cửa. Sai một bước là phải làm lại."]);
          return;
        }
        const loot = randomLoot({ g, floor: floorN, vars: {}, rng }, 8);
        loot.mana_crystal = (loot.mana_crystal ?? 0) + 3;
        loot.monster_core = (loot.monster_core ?? 0) + 1;
        for (let k = 0; k < 2; k++) { const id = gearForFloor(floorN, (xs) => rng.pick(xs), 1).id; loot[id] = (loot[id] ?? 0) + 1; }
        if (rng.chance(0.3)) loot.pet_egg = 1;
        const gold = rng.int(60, 90) * floorN;
        g.gold += gold;
        ex.bagGold += gold;
        const lines = giveToGame(g, loot);
        fs.done.push(e.id);
        showLoot("🏛️ Kho Ấn Cổ", [`💰 ${gold} vàng`, ...lines]);
        updateHud();
        return savePos();
      }
      case "chest": {
        // chests in hidden rooms hold a lot more
        const loot = randomLoot({ g, floor: floorN, vars: {}, rng }, e.ref === "secret" ? 6 : 2);
        if (e.ref === "secret") { loot.mana_crystal = (loot.mana_crystal ?? 0) + 2; if (rng.chance(0.5)) { const id = gearForFloor(floorN, (xs) => rng.pick(xs), 1).id; loot[id] = (loot[id] ?? 0) + 1; } }
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
        const gold = rng.int(15, 35) * floorN * (e.ref === "secret" ? 3 : 1);
        g.gold += gold;
        ex.bagGold += gold;
        const lines = giveToGame(g, loot);
        fs.done.push(e.id);
        showLoot(e.ref === "secret" ? "💎 Kho Báu Bí Mật" : "🎁 Rương Báu", [`💰 ${gold} vàng`, ...lines]);
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
      case "secret":
      case "event":
      case "random":
      case "guardian": {
        busy = true;
        player.path = [];
        const eventId = eventIdOf(e);
        if (e.kind === "random") rememberRandom(eventId);
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

  // ------------------------------------------------------------ the great event of this floor
  const saga = map.saga;
  sagaDef = saga ? SAGA[saga.id] : undefined;
  const sagaState = () => (fs.saga ??= {});
  const sagaNodes = () => ents.filter((e) => e.kind === "saga" && e.ref !== "core");
  const sagaPacks = () => ents.filter((e) => e.kind === "monster" && (e.saga === "pack" || e.saga === "beast"));
  const nodeDone = (e: MapEntity) => fs.done.includes(e.id);
  const inSaga = (x: number, y: number) => !!saga && Math.hypot(x - saga.x, (y - saga.y) * 1.2) <= saga.r;

  function sagaProgress(): string {
    if (!sagaDef || !saga) return "";
    const nodes = sagaNodes(), packs = sagaPacks();
    const n = nodes.filter(nodeDone).length;
    switch (sagaDef.mech) {
      case "clear": { const left = packs.filter((p) => !fs.done.includes(p.id)).length; return left ? `Diệt bầy canh giữ: ${packs.length - left}/${packs.length}` : "Tới trung tâm để hoàn thành"; }
      case "nodes": return n < nodes.length ? `${sagaDef.icon} ${n}/${nodes.length} — tới từng điểm đánh dấu` : "Tới trung tâm để hoàn thành";
      case "blight": return `Cột nhơ đã phá: ${n}/${nodes.length}`;
      case "maze": return "Tìm đường vào trung tâm mê cung";
      case "waves": return `Lượt đấu: ${sagaState().step ?? 0}/${sagaDef.nodes ?? 3} — nói chuyện ở trung tâm`;
      case "collect": return n < nodes.length ? `Đã nhặt ${n}/${nodes.length}` : "Mang về trung tâm";
      case "hunt": return "Lần theo dấu vết quái thú trong khu vực";
      case "rescue": return `Đã tìm thấy ${n}/${nodes.length}`;
    }
  }
  function updateSaga() {
    const st = fs.saga;
    const show = !!sagaDef && !!st?.seen && !st.done;
    sagaChip.classList.toggle("hidden", !show);
    if (show) sagaChip.replaceChildren(h("b", null, `${sagaDef!.icon} ${saga!.name}`), h("small", null, sagaProgress()));
  }

  function sagaStep() {
    if (!saga || !sagaDef) return;
    const st = sagaState();
    if (!st.seen && Math.hypot(player.x - saga.x, player.y - saga.y) <= saga.r + 3) {
      st.seen = true;
      showBanner(el, `${sagaDef.icon} ${saga.name}`, "Đại Sự Kiện của tầng này");
      showLoot(`${sagaDef.icon} ${saga.name}`, [sagaDef.intro, `🎯 ${sagaDef.goal}`]);
      updateHud();
    }
    // the blight saps whoever walks in it
    if (sagaDef.mech === "blight" && !st.done && inSaga(player.x, player.y) && ex.steps % 2 === 0) {
      for (const id of g.party) {
        const ch = g.chars[id];
        if (!ch || ch.hp <= 1) continue;
        ch.hp = Math.max(1, ch.hp - Math.max(1, Math.round(charStats(ch).hp * 0.015)));
      }
      if (!g.flags.tip_blight) { g.flags.tip_blight = true; toast("☣️ Vùng nhơ đang rút máu cả đội. Phá các cột nhơ để thanh tẩy!", "bad", 4000); }
      updateHud();
    }
  }

  function sagaReward() {
    if (!saga || !sagaDef) return;
    const st = sagaState();
    if (st.done) return;
    st.done = true;
    const loot = randomLoot({ g, floor: floorN, vars: {}, rng }, 9);
    loot.mana_crystal = (loot.mana_crystal ?? 0) + 3;
    loot.monster_core = (loot.monster_core ?? 0) + 1;
    const gear = gearForFloor(floorN, (xs) => rng.pick(xs), 1).id;
    loot[gear] = (loot[gear] ?? 0) + 1;
    if (rng.chance(0.3)) loot.pet_egg = 1;
    const gold = 100 * floorN + rng.int(50, 150);
    g.gold += gold;
    ex.bagGold += gold;
    const xp = Math.round(XP_RATE * (60 + floorN * 40));
    const lv: string[] = [];
    for (const id of g.party) if (g.chars[id]) lv.push(...giveXp(g.chars[id], xp));
    const lines = giveToGame(g, loot);
    g.flags.sagas = Number(g.flags.sagas ?? 0) + 1;
    logMsg(g, `Hoàn thành Đại Sự Kiện: ${saga.name}.`);
    showBanner(el, `${sagaDef.icon} Hoàn thành!`, saga.name);
    showLoot(`${sagaDef.icon} ${saga.name}`, [sagaDef.done, `💰 ${gold} vàng`, `✨ +${xp} kinh nghiệm cho cả đội`, ...lines, ...lv]);
    updateHud();
    savePos();
  }

  function sagaAfterFight(m: MapEntity) {
    if (!sagaDef) return;
    if (m.saga === "beast" && sagaDef.mech === "hunt") sagaReward();
    else if (sagaDef.mech === "clear" && sagaPacks().every((p) => fs.done.includes(p.id))) toast(`${sagaDef.icon} Các bầy canh giữ đã bị quét sạch! Tới trung tâm.`, "good", 4000);
    updateHud();
  }

  /** Small choice dialog for markers. */
  function choose(title: string, text: string, opts: { t: string; ok?: boolean; fn: () => void }[]) {
    const md = openModal(title);
    md.body.append(h("p", { style: "line-height:1.6;margin-top:0" }, text),
      h("div", { class: "col", style: "gap:6px" }, ...opts.map((o) => h("button", { class: "btn", disabled: o.ok === false, onclick: () => { md.close(); o.fn(); } }, o.t)),
        h("button", { class: "btn", onclick: () => md.close() }, "Để sau")));
  }

  async function sagaFight(level: number, eliteFight = false): Promise<boolean> {
    busy = true;
    player.path = [];
    const group = [...rng.pick(def.groups), rng.pick(def.enemies)].slice(0, 4);
    const out = await battle(group, level, { elite: eliteFight });
    busy = false;
    if (out === "lose") { defeat(); return false; }
    updateHud();
    return out === "win";
  }

  async function sagaInteract(e: (typeof ents)[number]) {
    if (!saga || !sagaDef || busy) return;
    const st = sagaState();
    const title = `${sagaDef.icon} ${saga.name}`;
    if (!st.seen) { st.seen = true; updateHud(); }
    if (st.done) return showLoot(title, ["Nơi này giờ đã yên bình. Bạn đã hoàn thành Đại Sự Kiện của tầng."]);
    const lv = def.levelBase + 3;
    const nodes = sagaNodes();
    const n = nodes.filter(nodeDone).length;
    const markDone = (x: MapEntity) => { if (!fs.done.includes(x.id)) fs.done.push(x.id); savePos(); updateHud(); };
    const isCore = e.ref === "core";
    switch (sagaDef.mech) {
      case "clear": {
        const left = sagaPacks().filter((p) => !fs.done.includes(p.id)).length;
        if (left) return showLoot(title, [sagaDef.goal, `Còn ${left} bầy quái canh giữ quanh đây.`]);
        return sagaReward();
      }
      case "nodes": {
        if (isCore) {
          if (n < nodes.length) return showLoot(title, [sagaDef.goal, `Đã xong ${n}/${nodes.length}.`]);
          if (sagaDef.finale) {
            showBanner(el, "Phong ấn vỡ tung!", "Kẻ canh giữ trỗi dậy");
            if (await sagaFight(lv + 2, true)) sagaReward();
            return;
          }
          return sagaReward();
        }
        if (nodeDone(e)) return toast("Chỗ này đã xong rồi.");
        const k = Number(e.ref!.split(":")[1] ?? 0);
        if (sagaDef.mode === "offer") {
          return choose(title, "Tế đàn lạnh ngắt. Có thể dâng một viên Tinh Thể Ma Lực để thắp lên, hoặc đánh bại lũ quái bị ánh sáng đục ngầu thu hút tới.", [
            { t: "💎 Dâng 1 Tinh Thể Ma Lực", ok: (g.inventory.mana_crystal ?? 0) > 0, fn: () => { if (removeItem(g, "mana_crystal", 1)) { markDone(e); toast("🔮 Tế đàn bừng sáng!", "good"); } } },
            { t: "⚔️ Vượt thử thách (chiến đấu)", fn: async () => { if (await sagaFight(lv)) { markDone(e); toast("🔮 Tế đàn bừng sáng!", "good"); } } },
          ]);
        }
        if (sagaDef.mode === "fire") {
          return choose(title, "Ngọn tháp lửa đã tắt từ lâu. Cần củi để nhóm lại, hoặc đuổi lũ quái đang làm tổ quanh chân tháp.", [
            { t: "🪵 Dùng 3 Gỗ", ok: (g.inventory.wood ?? 0) >= 3, fn: () => { if (removeItem(g, "wood", 3)) { markDone(e); toast("🔥 Tháp lửa bùng cháy!", "good"); } } },
            { t: "⚔️ Đuổi lũ quái (chiến đấu)", fn: async () => { if (await sagaFight(lv)) { markDone(e); toast("🔥 Tháp lửa bùng cháy!", "good"); } } },
          ]);
        }
        const attrs = ["int", "wil", "agi", "str"] as const;
        const names = { int: "Trí tuệ", wil: "Ý chí", agi: "Nhanh nhẹn", str: "Sức mạnh", luck: "May mắn" } as const;
        const attr = sagaDef.id === "festival" ? (["luck", "agi", "str"] as const)[k % 3] : attrs[k % 4];
        return choose(title, `Thử thách ${names[attr]}. Thất bại thì mất chút máu nhưng có thể thử lại.`, [
          { t: `🎲 Thử tài (${names[attr]})`, fn: () => {
            const res = rollCheck(attr, 11 + Math.floor(floorN / 20), { g, floor: floorN, vars: {}, rng });
            if (res.pass) { markDone(e); toast(`✨ Thành công! (${res.total} ≥ ${res.dc})`, "good"); }
            else { for (const id of g.party) { const ch = g.chars[id]; if (ch) ch.hp = Math.max(1, ch.hp - Math.round(charStats(ch).hp * 0.05)); } toast(`Thất bại (${res.total} < ${res.dc}). Thử lại nhé.`, "bad"); updateHud(); }
          } },
        ]);
      }
      case "blight":
        showBanner(el, "Cột nhơ thức giấc!", "Lũ quái lao ra bảo vệ nó");
        if (await sagaFight(lv + 1)) {
          markDone(e);
          if (sagaNodes().every(nodeDone)) sagaReward();
          else toast(`☣️ Một cột nhơ vỡ tan! (${sagaNodes().filter(nodeDone).length}/${sagaNodes().length})`, "good");
        }
        return;
      case "maze":
        return sagaReward();
      case "waves": {
        const total = sagaDef.nodes ?? 3;
        const s = st.step ?? 0;
        return choose(title, s ? `Lượt ${s}/${total} đã xong. Sẵn sàng cho lượt tiếp theo?` : sagaDef.intro, [
          { t: `⚔️ Bắt đầu lượt ${s + 1}/${total}`, fn: async () => {
            if (await sagaFight(lv + s, s === total - 1)) {
              st.step = s + 1;
              const bonus = 30 * floorN;
              g.gold += bonus; ex.bagGold += bonus;
              if (st.step >= total) sagaReward();
              else { toast(`🏆 Thắng lượt ${st.step}! +${bonus} vàng`, "good"); savePos(); updateHud(); }
            }
          } },
        ]);
      }
      case "collect":
        if (isCore) return n < nodes.length ? showLoot(title, [sagaDef.goal, `Đã nhặt ${n}/${nodes.length}.`]) : sagaReward();
        markDone(e);
        return toast(`${sagaDef.icon} Nhặt được! (${nodes.filter(nodeDone).length}/${nodes.length})${nodes.every(nodeDone) ? " — mang về trung tâm." : ""}`, "good");
      case "rescue":
        if (isCore) return showLoot(title, [sagaDef.goal, `Đã tìm thấy ${n}/${nodes.length}.`]);
        markDone(e);
        if (nodes.every(nodeDone)) return sagaReward();
        return toast(`🙌 \"Cảm ơn! Tôi về ngay đây!\" (${nodes.filter(nodeDone).length}/${nodes.length})`, "good");
      case "hunt": {
        const beast = sagaPacks().find((p) => p.saga === "beast" && !fs.done.includes(p.id));
        if (!beast) return sagaReward();
        const dx = beast.x - e.x, dy = beast.y - e.y;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "phía đông" : "phía tây") : dy > 0 ? "phía nam" : "phía bắc";
        return showLoot(title, [sagaDef.goal, `Dấu chân còn mới, dẫn về ${dir}, cách khoảng ${Math.round(Math.hypot(dx, dy))} bước.`]);
      }
    }
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
    // the great event's pieces / places still to visit, once seen
    if (sagaDef && !fs.saga?.done) {
      for (const e of sagaNodes()) if (alive(e) && !nodeDone(e) && fog[idx(e.x, e.y)]) pin("saga", e.x, e.y, `${sagaDef.icon} ${saga?.name ?? ""}: còn ở đây`);
    }
    if (map.saga && sagaDef && (fs.saga?.seen || fog[idx(map.saga.x, map.saga.y)])) {
      pin("saga", map.saga.x, map.saga.y, `${sagaDef.icon} ${map.saga.name}${fs.saga?.done ? " (đã xong)" : ""}`, "big");
      wrap.append(h("div", { class: "mm-label saga", style: `left:${((map.saga.x + 0.5) / map.w) * 100}%;top:${((map.saga.y + 0.5) / map.h) * 100}%` }, map.saga.name));
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
    const legend = h("div", { class: "mm-legend" }, ([["hero", "Bạn"], ["town", "Làng"], ["event", "Sự kiện"], ["boss", "Boss"], ["stairs", "Cầu thang"], ["portal", "Cổng về"], ["chest", "Rương"], ["camp", "Lửa trại"], ["mystery", "Bí ẩn"], ["saga", "Đại sự kiện"]] as [MapPin, string][])
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
    // companions (and the pet) glide along the trail too
    for (let i = 0; i < 4; i++) {
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
    // tall obstacles (trees, rocks...) are y-sorted with the entities; their base sits mid-tile.
    // A tree is 2 tiles wide and 3 tall, so it can hide whatever stands just above it: those
    // trees turn see-through (quest pieces, chests and the hero must never vanish behind one).
    const covering = new Set<number>();
    const behind = (x: number, y: number) => { for (let dy = 1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) covering.add(idx(x + dx, y + dy)); };
    behind(player.x, player.y);
    for (const e of ents) {
      if (e.kind === "deco" || e.kind === "building" || e.kind === "town" || !alive(e) || !fog[idx(e.x, e.y)]) continue;
      if (e.x < vr.x0 - 2 || e.x > vr.x1 + 2 || e.y < vr.y0 - 3 || e.y > vr.y1 + 1) continue;
      behind(e.x, e.y);
    }
    for (let y = vr.y0; y <= vr.y1 + 3; y++) {
      for (let x = vr.x0; x <= vr.x1; x++) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
        const i = idx(x, y);
        if (!fog[i] || map.tiles[i] !== T.OBSTACLE) continue;
        const tall = tiles.tall[(map.variant[i] + x * 7 + y * 13) % tiles.tall.length];
        const seen = inSight(x, y);
        const alpha = covering.has(i) ? 0.4 : seen ? 1 : 0.55;
        drawables.push({ y: y + 0.99, fn: () => view.img(tall, x - 0.5, y - 2 - TREE_LIFT, { w: 2, h: 3, alpha }) });
      }
    }
    // a spreading taint over the blighted district
    if (saga && sagaDef?.mech === "blight" && !fs.saga?.done && sagaDef.tint) {
      const gx = view.sx(saga.x) + TL / 2, gy = view.sy(saga.y) + TL / 2, rr = saga.r * TL;
      const gr = c.createRadialGradient(gx, gy, rr * 0.2, gx, gy, rr * 1.1);
      gr.addColorStop(0, `rgba(${sagaDef.tint},${0.34 + Math.sin(t / 700) * 0.05})`);
      gr.addColorStop(0.8, `rgba(${sagaDef.tint},0.22)`);
      gr.addColorStop(1, `rgba(${sagaDef.tint},0)`);
      c.fillStyle = gr;
      c.fillRect(gx - rr * 1.2, gy - rr * 1.2, rr * 2.4, rr * 2.4);
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
        const isElite = elite(e);
        if (isElite) {
          // golden aura and a star: an elite leads this pack
          const pulse = 0.5 + Math.sin(t / 220) * 0.2;
          const cx = view.sx(e.px) + TL / 2, cy = view.sy(e.py) + TL * 0.6;
          const gr = c.createRadialGradient(cx, cy, TL * 0.1, cx, cy, TL * 0.75);
          gr.addColorStop(0, `rgba(255,210,60,${0.45 * pulse})`);
          gr.addColorStop(1, "rgba(255,160,20,0)");
          c.fillStyle = gr;
          c.fillRect(cx - TL, cy - TL, TL * 2, TL * 2);
        }
        view.img(small ? creatureSmall(small) : spriteCanvas(ed.sprite, ed.palette), e.px, e.py, { dy: bob(e.x) - 0.05, flip: player.x < e.x });
        if (isElite) {
          c.font = `${Math.round(TL * 0.34)}px sans-serif`;
          c.textAlign = "center";
          c.fillText("⭐", view.sx(e.px) + TL / 2, view.sy(e.py) - TL * 0.12 + Math.sin(t / 300) * 2);
          c.textAlign = "start";
        }
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
      if (e.kind === "secret") {
        // a cracked patch of rock; a thin draught of dust gives it away
        const x0 = view.sx(e.x), y0 = view.sy(e.y);
        c.fillStyle = biome.wall[0];
        c.fillRect(x0, y0, TL, TL);
        c.strokeStyle = "rgba(0,0,0,0.55)";
        c.lineWidth = Math.max(1, TL / 16);
        c.beginPath();
        c.moveTo(x0 + TL * 0.5, y0 + TL * 0.1); c.lineTo(x0 + TL * 0.4, y0 + TL * 0.4); c.lineTo(x0 + TL * 0.6, y0 + TL * 0.55); c.lineTo(x0 + TL * 0.45, y0 + TL * 0.9);
        c.moveTo(x0 + TL * 0.4, y0 + TL * 0.4); c.lineTo(x0 + TL * 0.15, y0 + TL * 0.5);
        c.stroke();
        if (seen) { c.fillStyle = `rgba(230,220,200,${0.25 + Math.sin(t / 400 + e.x) * 0.2})`; c.fillRect(x0 + TL * 0.55, y0 + TL * 0.6 - ((t / 40) % (TL * 0.4)), 2, 2); }
        return;
      }
      if (e.kind === "saga") {
        const spr = e.sprite;
        const lit = e.ref !== "core" && fs.done.includes(e.id);
        if (lit) {
          c.fillStyle = `rgba(255,220,120,${0.3 + Math.sin(t / 250) * 0.12})`;
          c.beginPath(); c.arc(view.sx(e.x) + TL / 2, view.sy(e.y) + TL * 0.2, TL * 0.9, 0, Math.PI * 2); c.fill();
        }
        if (spr.startsWith("person:")) {
          c.fillStyle = "rgba(20,10,40,0.28)";
          c.beginPath(); c.ellipse(view.sx(e.x) + TL / 2, view.sy(e.y) + TL * 0.92, TL * 0.28, TL * 0.09, 0, 0, Math.PI * 2); c.fill();
          view.img(personCanvas("villager", roadsidePal(`${floorN}:${e.id}:${spr}`), 0, 0), e.x, e.y - 1, { h: 2, scale: spr === "person:child" ? 0.8 : 1 });
        } else view.img(propCanvas(spr, propCtx), e.x - 0.5, e.y - 1, { w: 2, h: 2, alpha: seen ? 1 : 0.75 });
        // the heart of an unfinished event calls out
        if (e.ref === "core" && sagaDef && !fs.saga?.done) {
          c.font = `${Math.round(TL * 0.45)}px sans-serif`;
          c.textAlign = "center";
          c.fillText(sagaDef.icon, view.sx(e.x) + TL / 2, view.sy(e.y) - TL * 1.1 + Math.sin(t / 300) * 3);
          c.textAlign = "start";
        }
        return;
      }
      if (e.kind === "vault" || e.kind === "rune") {
        const x0 = view.sx(e.x), y0 = view.sy(e.y);
        const lit = e.kind === "rune" && (fs.puzzle ?? "").includes(e.ref!);
        const solved = e.kind === "vault" && fs.puzzle === e.ref;
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.beginPath(); c.ellipse(x0 + TL / 2, y0 + TL * 0.92, TL * 0.4, TL * 0.12, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = e.kind === "vault" ? "#6a6a7a" : "#7a7a88";
        c.strokeStyle = "#2a2a34";
        c.lineWidth = 2;
        if (e.kind === "vault") { c.fillRect(x0 + TL * 0.08, y0 - TL * 0.5, TL * 0.84, TL * 1.4); c.strokeRect(x0 + TL * 0.08, y0 - TL * 0.5, TL * 0.84, TL * 1.4); }
        else { c.beginPath(); c.roundRect(x0 + TL * 0.2, y0 + TL * 0.05, TL * 0.6, TL * 0.85, TL * 0.2); c.fill(); c.stroke(); }
        if (lit || solved) { c.fillStyle = `rgba(255,220,120,${0.35 + Math.sin(t / 200) * 0.15})`; c.beginPath(); c.arc(x0 + TL / 2, y0 + TL * 0.35, TL * 0.6, 0, Math.PI * 2); c.fill(); }
        c.font = `${Math.round(TL * (e.kind === "vault" ? 0.5 : 0.42))}px sans-serif`;
        c.textAlign = "center";
        c.globalAlpha = lit || solved || e.kind === "vault" ? 1 : 0.55;
        c.fillText(e.kind === "vault" ? (solved ? "🔓" : "🔒") : RUNE[+e.ref!].icon, x0 + TL / 2, y0 + TL * (e.kind === "vault" ? 0.35 : 0.62));
        c.globalAlpha = 1;
        c.textAlign = "start";
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

    // party (companions follow the trail, the pet trots at the back)
    const members = g.party.map((id) => g.chars[id]);
    const pet = g.pet ? PET[g.pet] : undefined;
    const pf = followers[members.length - 1];
    if (pet && pf) drawables.push({ y: pf.py + 0.95, fn: () => view.img(creatureSmall(petSpec(pet)), pf.px + 0.1, pf.py + 0.15, { w: 0.8, h: 0.8, flip: pf.flip, dy: Math.sin(t / 160) * 0.04 }) });
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
    void showIntro(def).then(() => {
      busy = false;
      if (floorN % 10 === 0) showBanner(el, `⭐ Tầng Mốc ${floorN}`, `${def.name} · Chúa tể nơi đây mạnh hơn hẳn, nhưng phần thưởng xứng đáng`);
      else showBanner(el, `Tầng ${floorN}`, def.name);
    });
  } else showBanner(el, `Tầng ${floorN}`, def.name);

  return {
    destroy: () => {
      destroyed = true;
      setFieldSpecial(null);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", releaseKeys);
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
