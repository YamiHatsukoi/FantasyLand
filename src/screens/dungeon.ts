import { app, type Screen } from "../app";
import { Rng, hashString } from "../core/rng";
import { charStats, logMsg, removeItem, type FloorState, type GameState } from "../core/state";
import { ENEMIES } from "../data/enemies";
import { ITEM_LIST, getItem } from "../data/items";
import { PLAYER_SKILLS } from "../data/skills";
import { MapView } from "../render/mapview";
import { drawParticles } from "../render/particles";
import { spriteCanvas } from "../render/pixel";
import { creatureSmall, parseCreature } from "../render/creatures";
import { isPerson, personCanvas, type Dir } from "../render/people";
import { PASSABLE, T, tileSet } from "../render/tiles";
import { RANDOM_EVENTS } from "../story";
import { giveToGame, randomLoot } from "../story/runner";
import type { BattleSpec } from "../story/types";
import { BIOMES } from "../world/biomes";
import { getFloor, type FloorDef } from "../world/floors";
import { getSettlement } from "../world/people";
import { buildingCanvas } from "../render/buildings";
import { openSettlement } from "./settlement";
import { decodeFog, encodeFog, findPath, generateFloor, type FloorMap, type MapEntity } from "../world/mapgen";
import { confirmBox, h, nn, openModal, toast, topModalOpen } from "../ui/dom";
import { runBattle, type BattleOutcome } from "./combat";
import { openJournal, openMenu, partyMini, saveDot, showBanner } from "./common";
import { openInventory, setFieldSpecial } from "./inventory";
import { openParty } from "./party";
import { playStory } from "./story";

const mapCache = new Map<string, FloorMap>();
const SIGHT = 6;

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
    if (e.kind === "stairs" || e.kind === "portal" || e.kind === "town") return true;
    return !fs.done.includes(e.id);
  };
  const ents = map.entities.map((e) => ({ ...e, px: e.x, py: e.y, stun: 0 }));
  const player = { x: map.start.x + 1, y: map.start.y, px: 0, py: 0, flip: false, dir: 0 as Dir, path: [] as { x: number; y: number }[], t: 0 };
  if (fs.px !== undefined && fs.py !== undefined && PASSABLE.has(map.tiles[idx(fs.px, fs.py)])) { player.x = fs.px; player.y = fs.py; }
  if (!PASSABLE.has(map.tiles[idx(player.x, player.y)])) { player.x = map.start.x; player.y = map.start.y + 1; }
  player.px = player.x;
  player.py = player.y;
  const trail: { x: number; y: number }[] = [];
  let busy = false;
  let destroyed = false;
  let region = -1;

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
  const updateHud = () => {
    info.replaceChildren("💰 ", h("b", null, String(g.gold)), "  🎒 ", h("b", null, String(Object.keys(ex.bag).length)), "  ", saveDot());
    party.update();
  };
  el.append(h("div", { class: "hud-top" }, h("div", { class: "col", style: "gap:6px" }, title, party.el), h("div", { class: "hud-right" }, info, regionChip)));
  el.append(h("div", { class: "zoom" },
    h("button", { class: "icon-btn", onclick: () => view.zoom(1) }, "＋"),
    h("button", { class: "icon-btn", onclick: () => view.zoom(-1) }, "－")));
  el.append(h("div", { class: "dock" },
    dockBtn("🎒", "Túi", () => openInventory({ canSell: false, onChange: updateHud })),
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

  function dockBtn(icon: string, label: string, fn: () => void) {
    return h("button", { onclick: fn }, h("span", null, icon), h("span", null, label));
  }

  // ------------------------------------------------------------ helpers
  const passable = (x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h && PASSABLE.has(map.tiles[idx(x, y)]);
  const entityAt = (x: number, y: number) => ents.find((e) => alive(e) && e.x === x && e.y === y);
  const walkable = (x: number, y: number) => passable(x, y) && !entityAt(x, y);

  function reveal() {
    for (let y = -SIGHT; y <= SIGHT; y++) for (let x = -SIGHT; x <= SIGHT; x++) {
      if (x * x + y * y > SIGHT * SIGHT + 2) continue;
      const tx = player.x + x, ty = player.y + y;
      if (tx >= 0 && ty >= 0 && tx < map.w && ty < map.h) fog[idx(tx, ty)] = 1;
    }
  }

  function savePos(immediate = false) {
    fs.px = player.x;
    fs.py = player.y;
    fs.fog = encodeFog(fog);
    app.dirty(immediate);
  }

  function checkRegion() {
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

  function moveMonsters() {
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
      if ((nx !== m.x || ny !== m.y) && walkable(nx, ny) && !(nx === player.x && ny === player.y)) {
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
        const n = rng.int(1, 3);
        const lines = giveToGame(g, { [e.ref!]: n, ...(rng.chance(0.08) ? { mana_crystal: 1 } : {}) });
        ex.done.push(e.id);
        toast(`Thu thập: ${lines.join(", ")}`, "good");
        updateHud();
        return savePos();
      }
      case "chest": {
        const loot = randomLoot({ g, floor: floorN, vars: {}, rng }, 3);
        if (rng.chance(0.35)) {
          const maxTier = Math.min(5, 1 + Math.floor(floorN / 2));
          const pool = PLAYER_SKILLS.filter((s) => s.tier <= maxTier);
          const sk = rng.pick(pool);
          loot[`tome:${sk.id}`] = 1;
        }
        if (rng.chance(0.45)) {
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
        const eventId = e.kind === "random" ? RANDOM_EVENTS[hashString(e.id + fs.seed) % RANDOM_EVENTS.length].id : e.ref!;
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
        if (!g.flags[`seen_town_${s.id}`]) { g.flags[`seen_town_${s.id}`] = true; showBanner(el, s.name, s.size === "village" ? "Làng" : s.size === "town" ? "Thị trấn" : "Thành phố"); }
        openSettlement(s, () => { updateHud(); savePos(); });
        return;
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
    const col: Record<number, string> = { [T.GROUND]: biome.ground[0], [T.ALT]: biome.alt[0], [T.DECOR]: biome.ground[1], [T.OBSTACLE]: biome.obs[1], [T.WATER]: biome.water[0], [T.SHALLOW]: biome.water[1], [T.WALL]: biome.wall[0] };
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (!fog[idx(x, y)]) continue;
      c.fillStyle = col[map.tiles[idx(x, y)]];
      c.fillRect(x * s, y * s, s, s);
    }
    const mark: Record<string, string> = { town: "#ffffff", event: "#ffe14a", guardian: "#ff4a4a", stairs: "#c08aff", portal: "#6ab8ff", chest: "#f2a23a", camp: "#ff7a3a", random: "#8fd8ff" };
    for (const e of ents) {
      if (!alive(e) || !fog[idx(e.x, e.y)] || !mark[e.kind]) continue;
      c.fillStyle = mark[e.kind];
      c.fillRect(e.x * s - 1, e.y * s - 1, s + 2, s + 2);
    }
    c.fillStyle = "#fff";
    c.fillRect(player.x * s - 2, player.y * s - 2, s + 4, s + 4);
    const explored = fog.reduce((a, b) => a + b, 0);
    m.body.append(cv, h("p", { class: "muted small" }, `Đã khám phá ${Math.round((explored / (map.w * map.h)) * 100)}%. ⬜ Bạn  🟨 Sự kiện  🟥 Boss Canh Cửa  🏘️(trắng) Làng/Thành phố  🟪 Cầu thang  🟦 Cổng về  🟧 Rương/Lửa trại`),
      h("div", { class: "col", style: "gap:3px" }, def.regions.map((r, i) => h("div", { class: "small" }, `${i === region ? "📍" : "·"} ${r}`))));
  }

  // ------------------------------------------------------------ render
  let last = performance.now();
  view.onDraw = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!busy && !topModalOpen()) {
      player.t += dt;
      if (player.t >= 0.12) {
        const next = player.path.shift();
        if (next) { player.t = 0; tryStep(next.x, next.y); }
        else if (keys.size) {
          player.t = 0;
          const d = DIRS[[...keys].pop()!];
          tryStep(player.x + d[0], player.y + d[1]);
        }
      }
    }
    const k = Math.min(1, dt * 14);
    player.px += (player.x - player.px) * k;
    player.py += (player.y - player.py) * k;
    for (const e of ents) { e.px += (e.x - e.px) * k; e.py += (e.y - e.py) * k; }
    view.camX += (player.px - view.camX) * Math.min(1, dt * 6);
    view.camY += (player.py - view.camY) * Math.min(1, dt * 6);

    const c = view.ctx;
    c.fillStyle = "#000";
    c.fillRect(0, 0, view.w, view.h);
    const vr = view.visible();
    const frame = Math.floor(t / 380) % 4;
    const inSight = (x: number, y: number) => (x - player.x) ** 2 + (y - player.y) ** 2 <= SIGHT * SIGHT + 2;
    const tileAt = (x: number, y: number) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? T.WALL : map.tiles[idx(x, y)]);
    const isLiquid = (tt: number) => tt === T.WATER || tt === T.SHALLOW;
    const TL = view.tile;
    const drawables: { y: number; fn: () => void }[] = [];
    for (let y = vr.y0; y <= vr.y1 + 2; y++) {
      for (let x = vr.x0; x <= vr.x1; x++) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
        const i = idx(x, y);
        if (!fog[i]) continue;
        const tt = map.tiles[i];
        const v = map.variant[i];
        if (y <= vr.y1) {
          const img = tt === T.WATER ? tiles.water[(frame + x * 3 + y) % 4] : tt === T.OBSTACLE ? tiles.tiles[T.GROUND][v] : tiles.tiles[tt][v];
          view.img(img, x, y);
          const sx = view.sx(x), sy = view.sy(y);
          if (tt === T.WATER) {
            // foam where the liquid meets land
            const edges: [number, number, number][] = [[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]];
            for (const [dx, dy, rot] of edges) {
              if (isLiquid(tileAt(x + dx, y + dy))) continue;
              c.save();
              c.translate(sx + TL / 2, sy + TL / 2);
              c.rotate((rot * Math.PI) / 180);
              c.drawImage(tiles.shore, -TL / 2, -TL / 2, TL, TL);
              c.restore();
            }
          }
          if (tt === T.ALT) {
            const edges: [number, number, number][] = [[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]];
            for (const [dx, dy, rot] of edges) {
              const nt = tileAt(x + dx, y + dy);
              if (nt !== T.GROUND && nt !== T.DECOR && nt !== T.OBSTACLE) continue;
              c.save();
              c.translate(sx + TL / 2, sy + TL / 2);
              c.rotate((rot * Math.PI) / 180);
              c.drawImage(tiles.edge, -TL / 2, -TL / 2, TL, TL);
              c.restore();
            }
          }
          if (tt === T.WALL && tileAt(x, y + 1) !== T.WALL) c.drawImage(tiles.wallFace, sx, sy, TL, TL);
          if (tt !== T.WALL && tileAt(x, y - 1) === T.WALL) { c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(sx, sy, TL, TL * 0.25); }
        }
        if (tt === T.OBSTACLE) {
          const tall = tiles.tall[(v + x * 7 + y * 13) % tiles.tall.length];
          const seen = inSight(x, y);
          drawables.push({ y: y + 0.99, fn: () => view.img(tall, x - 0.5, y - 2, { w: 2, h: 3, alpha: seen ? 1 : 0.55 }) });
        }
      }
    }
    for (let y = vr.y0; y <= vr.y1; y++) for (let x = vr.x0; x <= vr.x1; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h || !fog[idx(x, y)] || inSight(x, y)) continue;
      c.fillStyle = "rgba(0,0,0,0.45)";
      c.fillRect(view.sx(x), view.sy(y), TL, TL);
    }
    // entities
    const bob = (seed: number) => Math.sin(t / 260 + seed) * 0.06;
    for (const e of ents) {
      if (!alive(e) || !fog[idx(e.x, e.y)]) continue;
      if (e.x < vr.x0 - 1 || e.x > vr.x1 + 1 || e.y < vr.y0 - 1 || e.y > vr.y1 + 1) continue;
      drawables.push({ y: e.py + (e.kind === "town" ? 1.2 : 1), fn: () => drawEntity(e) });
    }
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
      if (e.kind === "town") {
        const s = getSettlement(floorN, Number(e.ref ?? 0));
        const types = s.size === "village" ? ["cottage", "tent", "cottage"] : s.size === "town" ? ["stonehouse", "market", "cottage"] : ["manor", "apartment", "stonehouse"];
        const offs = [[-1.2, -0.6], [0.9, -0.9], [-0.1, 0.1]];
        types.forEach((t, k) => {
          const cv = buildingCanvas(t, 1);
          const bw = cv.width / 16, bh = cv.height / 16;
          const sc = 0.62;
          view.img(cv, e.x + offs[k][0] - (bw * sc - 1) / 2, e.y + offs[k][1] - (bh * sc - 1) + 0.4, { w: bw * sc, h: bh * sc, alpha: seen ? 1 : 0.7 });
        });
        c.font = `bold ${Math.round(view.tile * 0.3)}px sans-serif`;
        c.fillStyle = "#fff";
        c.strokeStyle = "#000";
        c.lineWidth = 3;
        const tw = c.measureText(s.name).width;
        c.strokeText(s.name, view.sx(e.x) + view.tile / 2 - tw / 2, view.sy(e.y) + view.tile * 1.25);
        c.fillText(s.name, view.sx(e.x) + view.tile / 2 - tw / 2, view.sy(e.y) + view.tile * 1.25);
        return;
      }
      const sprite = e.kind === "guardian" ? "marker" : e.sprite;
      const scale = e.kind === "stairs" || e.kind === "portal" ? 1 : 0.9;
      const bounce = e.kind === "event" || e.kind === "random" || e.kind === "guardian" ? Math.abs(Math.sin(t / 300 + e.x)) * -0.18 : 0;
      if (e.kind === "guardian") {
        const bd = ENEMIES[def.boss.find((id) => ENEMIES[id]?.boss) ?? def.boss[0]];
        view.img(spriteCanvas(bd.sprite, bd.palette), e.x - 0.5, e.y - 1, { w: 2, h: 2, alpha: seen ? 1 : 0.6 });
      }
      view.img(spriteCanvas(sprite), e.x, e.y, { scale, dy: bounce - (e.kind === "guardian" ? 0.9 : 0) });
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
      const tr = trail[i - 1], prev = trail[i - 2] ?? { x: player.x, y: player.y };
      const pos = i === 0 || !tr ? { x: player.px, y: player.py } : { x: tr.x, y: tr.y, dir: (prev.x !== tr.x ? 2 : prev.y < tr.y ? 1 : 0) as Dir, flip: prev.x < tr.x };
      drawables.push({ y: pos.y + 1 + (i === 0 ? 0.01 : 0), fn: () => drawMember(ch, pos, i) });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    drawParticles(c, biome.particles, view.w, view.h, t, view.camX, view.camY, TL);

    // lighting
    if (biome.night) {
      const cx = view.sx(player.px) + view.tile / 2, cy = view.sy(player.py) + view.tile / 2;
      const grd = c.createRadialGradient(cx, cy, view.tile * 1.5, cx, cy, view.tile * (SIGHT + 1.5));
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.55, "rgba(0,0,12,0.35)");
      grd.addColorStop(1, "rgba(0,0,12,0.78)");
      c.fillStyle = grd;
      c.fillRect(0, 0, view.w, view.h);
    } else {
      const grd = c.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.4, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.8);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,0.45)");
      c.fillStyle = grd;
      c.fillRect(0, 0, view.w, view.h);
    }
  };
  setFieldSpecial((it) => {
    const sp = it.use?.special;
    if (busy) return false;
    if (sp === "revealMap") {
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (Math.hypot(x - player.x, y - player.y) < 22) fog[idx(x, y)] = 1;
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
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__dungeon = { ents, interact, player, tryStep, map };

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
