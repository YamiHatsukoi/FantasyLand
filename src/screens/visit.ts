import { app, type Screen } from "../app";
import { playMusic } from "../audio/music";
import type { CropState, GameState, PlacedBuilding } from "../core/state";
import { BUILDINGS, RANK_NAMES } from "../data/buildings";
import type { PlayerVisit, PublicChar } from "../net/api";
import { CROP_LIFT, buildingCanvas, cropCanvas } from "../render/buildings";
import { FloorLayer, waterGlints } from "../render/floors";
import { MapView } from "../render/mapview";
import { spriteCanvas } from "../render/pixel";
import { isPerson, personCanvas, type Dir } from "../render/people";
import { findPath } from "../world/mapgen";
import { SZ_C, SZ_H, SZ_SHIFT, SZ_W, blockerAt, buildingAt, inTerritory, sproutAt, territory } from "../world/sanctuary";
import { cropStage, isReady } from "../world/town";
import { h, toast, topModalOpen } from "../ui/dom";
import { drawTree, edgeTrees, groundPainter, sanctuaryGround, treeHides } from "./safezone";
import { ago, openProfile } from "./players";

const KEYS: Record<string, [number, number]> = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };

/**
 * Walking around someone else's sanctuary. Everything here is a read-only snapshot of their
 * save: nothing can be used, harvested or changed, and none of it touches our own game.
 */
export function mountVisit(root: HTMLElement, v: PlayerVisit, hooks: { leave: () => void }): Screen {
  playMusic("sanctuary");
  const me = app.game;
  const el = h("div", { class: "screen" });
  root.append(el);
  const view = new MapView(el);

  // their sanctuary, shaped like a GameState so the shared map helpers work on it
  // a save last written before the sanctuary grew (v6) still uses the old, smaller grid
  const house = v.buildings.find((b) => b.type === "house");
  const oldGrid = v.v !== undefined ? v.v < 6 : !!house && house.x < SZ_C - 16;
  const shift = oldGrid ? SZ_SHIFT : 0;
  const buildings: PlacedBuilding[] = v.buildings.filter((b) => BUILDINGS[b.type]).map((b, i) => ({
    id: `v${i}`, type: b.type, x: b.x + shift, y: b.y + shift, level: b.level || 1,
    plot: b.plot ? { soil: b.plot.soil ?? 0, watered: false, crop: b.plot.crop as CropState | undefined } : undefined,
  }));
  const place = { buildings, territory: v.territory ?? 0 } as unknown as GameState;
  const terr = territory(place.territory);
  const SPROUT = sproutAt(place);
  const ground = sanctuaryGround(terr);
  const floors = new FloorLayer();
  { const gc = ground.getContext("2d")!; floors.update(gc, place, groundPainter(gc, terr)); }
  const edge = edgeTrees(terr);
  const rank = buildings.find((b) => b.type === "house")?.level ?? 1;
  const party = v.party.filter((c, i, all): c is PublicChar => !!c && all.findIndex((o) => o?.id === c.id) === i);
  const owner = party.find((c) => c.id === v.heroId) ?? party[0];

  // the owner and their party stand around Mầm to greet visitors
  const hosts: { c: PublicChar; x: number; y: number }[] = [];
  const free = (x: number, y: number) => inTerritory(place, x, y) && !buildingAt(place, x, y) && !(x === SPROUT.x && y === SPROUT.y) && !hosts.some((o) => o.x === x && o.y === y);
  for (const c of party.slice(0, 4)) {
    let spot: { x: number; y: number } | null = null;
    for (let r = 1; r < 12 && !spot; r++) {
      for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(SPROUT.x + dx, SPROUT.y + dy)) spot = { x: SPROUT.x + dx, y: SPROUT.y + dy };
      }
    }
    if (spot) hosts.push({ c, ...spot });
  }
  const walkable = (x: number, y: number) => inTerritory(place, x, y) && !blockerAt(place, x, y) && !(x === SPROUT.x && y === SPROUT.y) && !hosts.some((o) => o.x === x && o.y === y);
  const start = walkable(SPROUT.x, SPROUT.y + 3) ? { x: SPROUT.x, y: SPROUT.y + 3 } : { x: terr.x0 + 1, y: terr.y1 - 2 };
  const hero = { x: start.x, y: start.y, px: start.x, py: start.y, path: [] as { x: number; y: number }[], t: 0, flip: false, dir: 1 as Dir };
  view.camX = hero.x;
  view.camY = hero.y;

  // ------------------------------------------------------------ HUD
  el.append(h("div", { class: "hud-top" },
    h("div", { class: "chip title" }, `Thánh Địa của ${owner?.name ?? v.username}`, h("small", null, `${RANK_NAMES[rank] ?? ""} · ${buildings.length} công trình · @${v.username} · ${ago(v.updated_at)}`)),
    h("div", { class: "hud-right" }, h("div", { class: "chip" }, "👀 Đang tham quan"))));
  el.append(h("div", { class: "zoom" },
    h("button", { class: "icon-btn", onclick: () => view.zoom(1) }, "＋"),
    h("button", { class: "icon-btn", onclick: () => view.zoom(-1) }, "－"),
    h("button", { class: "icon-btn", title: "Về chỗ nhân vật", onclick: () => { view.camX = hero.px; view.camY = hero.py; } }, "◎")));
  el.append(h("div", { class: "dock" },
    h("button", { onclick: () => openProfile(v.username, undefined, v) }, h("span", null, "👤"), h("span", null, "Hồ sơ")),
    h("button", { onclick: () => hooks.leave() }, h("span", null, "🏡"), h("span", null, "Về nhà"))));
  setTimeout(() => toast(`Chào mừng tới Thánh Địa của ${owner?.name ?? v.username}! Cứ đi dạo ngắm thoải mái.`, "info", 4000), 400);

  // ------------------------------------------------------------ input (look, don't touch)
  view.onTap = (tx, ty) => {
    const host = hosts.find((o) => o.x === tx && o.y === ty);
    if (host) return openProfile(v.username, undefined, v);
    if (tx === SPROUT.x && ty === SPROUT.y) return toast("🌱 Mầm của nhà này vẫy tay chào bạn.");
    const b = buildingAt(place, tx, ty);
    if (b && !BUILDINGS[b.type].walkable) return toast(`${BUILDINGS[b.type].icon} ${BUILDINGS[b.type].name}${b.level > 1 ? ` · cấp ${b.level}` : ""}`);
    if (!walkable(tx, ty)) return;
    const path = findPath({ w: SZ_W, h: SZ_H }, walkable, hero.x, hero.y, tx, ty, 3000);
    if (path) hero.path = path;
  };
  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => {
    if (topModalOpen() || e.target instanceof HTMLInputElement) return;
    if (KEYS[e.code]) { e.preventDefault(); if (e.type === "keydown") keys.add(e.code); else keys.delete(e.code); }
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  // ------------------------------------------------------------ render
  let last = performance.now();
  view.onDraw = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    hero.t += dt;
    if (hero.t >= 0.13) {
      hero.t = 0;
      let next = hero.path.shift();
      if (!next && keys.size && !topModalOpen()) {
        const d = KEYS[[...keys].pop()!];
        if (walkable(hero.x + d[0], hero.y + d[1])) next = { x: hero.x + d[0], y: hero.y + d[1] };
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
    view.camX += (hero.px - view.camX) * Math.min(1, dt * 5);
    view.camY += (hero.py - view.camY) * Math.min(1, dt * 5);

    const c = view.ctx;
    c.fillStyle = "#050807";
    c.fillRect(0, 0, view.w, view.h);
    const sx0 = (view.camX + 0.5 - view.w / 2 / view.tile) * 16, sy0 = (view.camY + 0.5 - view.h / 2 / view.tile) * 16;
    c.drawImage(ground, sx0, sy0, (view.w / view.tile) * 16, (view.h / view.tile) * 16, 0, 0, view.w, view.h);
    c.strokeStyle = "rgba(242,197,66,0.35)";
    c.setLineDash([view.tile / 4, view.tile / 4]);
    c.lineWidth = 2;
    c.strokeRect(view.sx(terr.x0), view.sy(terr.y0), (terr.x1 - terr.x0) * view.tile, (terr.y1 - terr.y0) * view.tile);
    c.setLineDash([]);

    const draw: { y: number; fn: () => void }[] = [];
    const vr = view.visible();
    for (const [x, y, tall] of edge) {
      if (x < vr.x0 - 2 || x > vr.x1 + 2 || y < vr.y0 || y > vr.y1 + 3) continue;
      const see = treeHides(x, y, buildings, [{ x: hero.px, y: hero.py }, ...hosts]);
      draw.push({ y: y + 0.99, fn: () => drawTree(view, x, y, tall, see) });
    }
    waterGlints(c, floors.water, t, (x) => view.sx(x), (y) => view.sy(y), view.tile, vr);
    for (const b of buildings) {
      if (BUILDINGS[b.type].floor) continue;
      const [bw, bh] = BUILDINGS[b.type].size;
      draw.push({ y: BUILDINGS[b.type].walkable ? b.y : b.y + bh, fn: () => {
        view.img(buildingCanvas(b.type, b.level), b.x, b.y - 1, { w: bw, h: bh + 1 });
        const crop = b.plot?.crop;
        if (b.type === "farm" && crop) {
          let st = 0;
          try { st = cropStage(crop); view.img(cropCanvas(crop.id, st), b.x, b.y - CROP_LIFT); } catch { /* unknown crop in an older save */ }
          if (st === 3 && isReady(crop)) { c.font = `${Math.round(view.tile * 0.4)}px sans-serif`; c.fillText("✨", view.sx(b.x) + view.tile * 0.55, view.sy(b.y) + view.tile * 0.3 + Math.sin(t / 300) * 3); }
        }
        if (b.type === "gate") {
          c.fillStyle = `rgba(176,138,255,${0.18 + Math.sin(t / 400) * 0.08})`;
          c.fillRect(view.sx(b.x) + view.tile * 0.35, view.sy(b.y) - view.tile * 0.3, view.tile * 1.3, view.tile * 2.1);
        }
      } });
    }
    const bob = Math.sin(t / 250) * view.tile * 0.03;
    draw.push({ y: SPROUT.y + 1, fn: () => view.img(spriteCanvas("sprout"), SPROUT.x, SPROUT.y, { dy: -0.05 + bob / view.tile }) });
    const person = (sprite: string, pal: Record<string, string> | undefined, x: number, y: number, dir: Dir, frame: number, flip: boolean) => {
      c.fillStyle = "rgba(0,0,0,0.3)";
      c.beginPath();
      c.ellipse(view.sx(x) + view.tile / 2, view.sy(y) + view.tile * 0.92, view.tile * 0.3, view.tile * 0.1, 0, 0, Math.PI * 2);
      c.fill();
      try {
        if (isPerson(sprite)) view.img(personCanvas(sprite, pal, dir, frame), x, y - 1, { h: 2, flip: dir === 2 && flip });
        else view.img(spriteCanvas(sprite, pal), x, y, { flip });
      } catch { /* sprite from a newer build */ }
    };
    for (const o of hosts) {
      const facing: Dir = Math.abs(hero.px - o.x) > Math.abs(hero.py - o.y) ? 2 : hero.py < o.y ? 1 : 0;
      draw.push({ y: o.y + 1.005, fn: () => {
        person(o.c.sprite, o.c.pal, o.x, o.y, facing, 0, hero.px < o.x);
        if (o.c.id === owner?.id) {
          c.font = `bold ${Math.max(11, Math.round(view.tile * 0.26))}px sans-serif`;
          c.textAlign = "center";
          c.lineWidth = 3;
          c.strokeStyle = "#000";
          c.fillStyle = "#ffe38a";
          const lx = view.sx(o.x) + view.tile / 2, ly = view.sy(o.y) - view.tile * 1.15;
          c.strokeText(`👑 ${o.c.name}`, lx, ly);
          c.fillText(`👑 ${o.c.name}`, lx, ly);
          c.textAlign = "left";
        }
      } });
    }
    const mine = me.chars[me.heroId];
    draw.push({ y: hero.py + 1.01, fn: () => {
      const moving = Math.abs(hero.px - hero.x) + Math.abs(hero.py - hero.y) > 0.05 || hero.path.length > 0;
      person(mine.sprite, mine.pal, hero.px, hero.py, hero.dir, moving ? Math.floor(t / 130) % 4 : 0, hero.flip);
    } });
    draw.sort((a, b) => a.y - b.y);
    for (const d of draw) d.fn();

    const grd = c.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = grd;
    c.fillRect(0, 0, view.w, view.h);
  };
  view.start();

  return {
    destroy: () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      view.destroy();
      el.remove();
    },
  };
}
