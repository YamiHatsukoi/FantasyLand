/** Game picker shown after login: FantasyLand or Adventure, as two game cartridges. */
import type { Screen } from "../app";
import { playMusic } from "../audio/music";
import type { Session } from "../net/api";
import { personCanvas } from "../render/people";
import { h } from "../ui/dom";

export interface HubOpts {
  fantasy: () => void;
  adventure: () => void;
  logout: () => void;
}

/** A tiny pixel diorama for a card: sky, hills, ground and the heroes standing on it. */
function diorama(kind: "fantasy" | "adventure", heroes: string[]) {
  const W = 128, H = 64;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  c.className = "hub-dio";
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const day = kind === "fantasy";
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, day ? "#2c4f86" : "#140c24");
  sky.addColorStop(0.7, day ? "#9ac6d8" : "#6a3348");
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // stars or sun
  let seed = day ? 3 : 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (!day) { g.fillStyle = "#fff6d8"; for (let i = 0; i < 26; i++) g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 30), 1, 1); g.fillRect(100, 8, 5, 5); g.fillStyle = "#140c24"; g.fillRect(102, 7, 4, 4); }
  else { g.fillStyle = "#fff1b0"; g.fillRect(18, 9, 7, 7); g.fillRect(17, 10, 9, 5); g.fillRect(19, 8, 5, 9); }
  // hills (stepped silhouettes)
  const hills = (base: number, amp: number, freq: number, col: string, ph: number) => {
    g.fillStyle = col;
    for (let x = 0; x < W; x++) { const y = Math.round(base - Math.abs(Math.sin(x * freq + ph)) * amp); g.fillRect(x, y, 1, H - y); }
  };
  hills(40, 14, 0.045, day ? "#5a7aa0" : "#2a1838", 1);
  hills(46, 8, 0.08, day ? "#3d6a4a" : "#1c1226", 2.4);
  // ground
  g.fillStyle = day ? "#4c8a3a" : "#2a3a1e"; g.fillRect(0, 50, W, H - 50);
  g.fillStyle = day ? "#6aa84a" : "#3a4c26"; g.fillRect(0, 50, W, 2);
  g.fillStyle = day ? "#3a6e2c" : "#1e2a14"; for (let i = 0; i < 40; i++) g.fillRect(Math.floor(rnd() * W), 53 + Math.floor(rnd() * 10), 2, 1);
  if (day) { // a tower of the sanctuary
    g.fillStyle = "#c8b89a"; g.fillRect(96, 24, 12, 27); g.fillStyle = "#8a7a62"; g.fillRect(96, 24, 2, 27); g.fillStyle = "#b04a3a"; g.fillRect(94, 18, 16, 6); g.fillRect(97, 14, 10, 4); g.fillStyle = "#2a1c14"; g.fillRect(100, 40, 4, 11);
  } else { // campfire
    g.fillStyle = "#5a3a22"; g.fillRect(92, 49, 10, 2); g.fillStyle = "#ffb84a"; g.fillRect(95, 44, 4, 5); g.fillStyle = "#fff1a0"; g.fillRect(96, 46, 2, 3);
    g.fillStyle = "rgba(255,160,70,.18)"; g.fillRect(84, 38, 26, 16);
  }
  heroes.forEach((id, i) => {
    try { g.drawImage(personCanvas(id, undefined, 0, 0), (day ? 20 : 52) + i * 20, 20); } catch { /* art not ready */ }
  });
  return c;
}

/** Accounts allowed into Adventure (the server enforces the same list in supabase/06_adventure.sql). */
export const ADVENTURE_USERS = ["andi"];
export const canAdventure = (s: Session) => s.offline === true && import.meta.env.DEV ? true : ADVENTURE_USERS.includes(s.username.toLowerCase());

export function mountHub(root: HTMLElement, s: Session, o: HubOpts): Screen {
  playMusic("title");
  let last = "";
  try { last = localStorage.getItem("fl.lastGame") ?? ""; } catch { /* ignore */ }
  const go = (id: string, f: () => void) => () => {
    try { localStorage.setItem("fl.lastGame", id); } catch { /* ignore */ }
    f();
  };
  const card = (id: "fantasy" | "adventure", title: string, sub: string, text: string, heroes: string[], f: () => void) =>
    h("button", { class: `hub-card ${id} ${last === id ? "last" : ""}`, type: "button", onclick: go(id, f) },
      h("div", { class: "hub-art" }, diorama(id, heroes)),
      h("div", { class: "hub-info" },
        h("div", { class: "hub-sub" }, sub),
        h("div", { class: "hub-title" }, title),
        h("p", null, text),
        h("span", { class: "hub-play" }, last === id ? "Chơi tiếp" : "Vào chơi", h("i"))),
      last === id ? h("span", { class: "hub-badge" }, "Chơi gần nhất") : null);

  const el = h("div", { class: "screen hub" },
    h("div", { class: "hub-stars" }),
    h("div", { class: "hub-head" },
      h("h1", { class: "hub-logo" }, "Chọn thế giới"),
      h("div", { class: "hub-user" }, "Xin chào, ", h("b", null, s.username))),
    h("div", { class: "hub-cards" },
      card("fantasy", "FantasyLand", "Vực Sâu Bách Tầng", "Xây Thánh Địa, khám phá 100 tầng vực sâu, chiến đấu theo đội.",
        ["hero_warrior", "hero_mage", "lyra"], o.fantasy),
      canAdventure(s) ? card("adventure", "Adventure", "Lone Wolf", "Phiêu lưu theo sách: chọn đường, đi trên bản đồ, chiến đấu theo lượt.",
        ["hero_ranger"], o.adventure) : null),
    h("button", { class: "hub-logout", type: "button", onclick: o.logout }, "Đăng xuất"));
  root.append(el);
  return { destroy: () => el.remove() };
}
