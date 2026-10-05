import { initAudio } from "./audio/engine";
import { sfx } from "./audio/sfx";
import { playTransition } from "./ui/transition";
import { BIOMES } from "./world/biomes";
import { MAX_FLOOR, getFloor } from "./world/floors";
import "@fontsource/vt323/400.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/600.css";
import "./ui/style.css";
import { app } from "./app";
import { hashString } from "./core/rng";
import { newGame } from "./core/state";
import { ApiError, cachedSession, clearSession, errorText, type PlayerVisit, type Session } from "./net/api";
import { SaveManager } from "./net/save";
import { openAppearance } from "./screens/appearance";
import { mountDungeon, startExpedition } from "./screens/dungeon";
import { mountArena } from "./screens/arena";
import { mountLogin } from "./screens/login";
import { mountSafeZone } from "./screens/safezone";
import { mountVisit } from "./screens/visit";
import { playStory } from "./screens/story";
import { closeAllModals, h, savedMark, toast } from "./ui/dom";

app.root = document.getElementById("app")!;
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__fl = app;
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__visit = (v: PlayerVisit) => goVisit(v);
if (import.meta.env.DEV) void Promise.all([import("./world/floors"), import("./data/enemies"), import("./render/pixel")]).then(([f, e, p]) => {
  (window as unknown as Record<string, unknown>).__dev = { getFloor: f.getFloor, ENEMIES: e.ENEMIES, spriteURL: p.spriteURL };
});

function showLogin(err = "") {
  app.show((root) => mountLogin(root, (s) => startSession(s), err));
}

async function startSession(s: Session) {
  app.session = s;
  const saver = new SaveManager(s);
  app.saver = saver;
  app.root.replaceChildren(h("div", { class: "screen login" }, h("p", { class: "note" }, "Đang tải dữ liệu…")));
  try {
    await saver.load();
  } catch (e) {
    if (e instanceof ApiError && e.code === "invalid_session") {
      clearSession();
      return showLogin(errorText(e));
    }
    // Network trouble: fall back to the local copy if there is one.
    const local = await new SaveManager({ ...s, offline: true }).load().catch(() => null);
    if (!local) return showLogin(errorText(e));
    saver.game = local;
    toast("Không kết nối được máy chủ — đang chơi bằng bản lưu trên máy, sẽ đồng bộ lại sau.", "bad", 6000);
  }
  if (!saver.game) {
    saver.game = newGame("Người Chuyển Sinh", "warrior", hashString(s.username + Date.now()));
    app.root.replaceChildren(h("div", { class: "screen", style: "background:#000" }));
    await playStory("intro", { floor: 0, bg: ["#020304", "#0f1f16"] });
    saver.markDirty(true);
    await new Promise<void>((r) => openAppearance(app.game.chars[app.game.heroId], r, true));
  }
  if (app.game.expedition) goDungeon(false);
  else goSafeZone(false);
}

function goSafeZone(animate = true): Promise<void> {
  closeAllModals();
  const show = () => app.show((root) => mountSafeZone(root, { enterDungeon: (f) => enterDungeon(f), visit: goVisit, arena: goArena }));
  if (!animate) { show(); return Promise.resolve(); }
  return playTransition({ kicker: "TRỞ VỀ", title: "⌂", name: "Thánh Địa", sub: "Ánh đèn nhà đang chờ", accent: "#ffd27a", ground: "#1a2a18" }, show);
}

function goArena() {
  closeAllModals();
  app.show((root) => mountArena(root, { leave: () => void goSafeZone(false) }));
}

function goVisit(v: PlayerVisit) {
  closeAllModals();
  app.show((root) => mountVisit(root, v, { leave: goSafeZone }));
}

function enterDungeon(floor: number) {
  startExpedition(app.game, floor);
  app.dirty(true);
  goDungeon();
}

function goDungeon(animate = true) {
  closeAllModals();
  const show = () => app.show((root) => mountDungeon(root, { toSafeZone: () => goSafeZone(), changeFloor: () => goDungeon() }));
  const n = app.game.expedition?.floor;
  if (!animate || !n) return show();
  const def = getFloor(n);
  const b = BIOMES[def.biome];
  void playTransition({
    kicker: n % 10 === 0 ? "TẦNG MỐC" : "TẦNG", title: String(n), name: def.name, sub: def.biomeName,
    accent: b?.glow ?? "#8fffd0", ground: b?.ground[0], depth: n / MAX_FLOOR, milestone: n % 10 === 0,
  }, show);
}

// Flush pending saves when the tab is hidden/closed.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void app.saver?.flush();
});
window.addEventListener("pagehide", () => void app.saver?.flush());

// sound: the audio context starts on the first tap; every button gets a soft click
initAudio();
app.onCheckpoint = savedMark;
document.addEventListener("pointerdown", (e) => {
  const t = (e.target as Element | null)?.closest?.("button, .item-row, .choice, .dex-card");
  if (t && !(t as HTMLButtonElement).disabled && !t.classList.contains("dlg-choice")) sfx("click");
}, true);

const cached = cachedSession();
if (cached) void startSession(cached);
else showLogin();

// Service worker makes the game installable as an app (Chrome Android "Install app").
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => undefined); });
}
