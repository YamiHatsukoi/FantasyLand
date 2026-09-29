import "@fontsource/vt323/400.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/600.css";
import "./ui/style.css";
import { app } from "./app";
import { hashString } from "./core/rng";
import { newGame } from "./core/state";
import { ApiError, cachedSession, clearSession, errorText, type Session } from "./net/api";
import { SaveManager } from "./net/save";
import { mountDungeon, startExpedition } from "./screens/dungeon";
import { mountLogin } from "./screens/login";
import { mountSafeZone } from "./screens/safezone";
import { playStory } from "./screens/story";
import { closeAllModals, h, toast } from "./ui/dom";

app.root = document.getElementById("app")!;
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__fl = app;

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
  }
  if (app.game.expedition) goDungeon();
  else goSafeZone();
}

function goSafeZone() {
  closeAllModals();
  app.show((root) => mountSafeZone(root, { enterDungeon: (f) => enterDungeon(f) }));
}

function enterDungeon(floor: number) {
  startExpedition(app.game, floor);
  app.dirty(true);
  goDungeon();
}

function goDungeon() {
  closeAllModals();
  app.show((root) => mountDungeon(root, { toSafeZone: goSafeZone, changeFloor: () => goDungeon() }));
}

// Flush pending saves when the tab is hidden/closed.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void app.saver?.flush();
});
window.addEventListener("pagehide", () => void app.saver?.flush());

const cached = cachedSession();
if (cached) void startSession(cached);
else showLogin();

// Service worker makes the game installable as an app (Chrome Android "Install app").
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => undefined); });
}
