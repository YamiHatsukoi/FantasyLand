/** Game picker shown after login: FantasyLand or Adventure. */
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

function hero(id: string, frame = 0) {
  const c = personCanvas(id, undefined, 0, frame);
  c.className = "hub-hero pix";
  return c;
}

export function mountHub(root: HTMLElement, s: Session, o: HubOpts): Screen {
  playMusic("title");
  let last = "";
  try { last = localStorage.getItem("fl.lastGame") ?? ""; } catch { /* ignore */ }
  const go = (id: string, f: () => void) => () => {
    try { localStorage.setItem("fl.lastGame", id); } catch { /* ignore */ }
    f();
  };
  const card = (id: string, title: string, sub: string, text: string, art: HTMLElement[], f: () => void) =>
    h("button", { class: `hub-card ${id} ${last === id ? "last" : ""}`, type: "button", onclick: go(id, f) },
      h("div", { class: "hub-art" }, ...art),
      h("div", { class: "hub-title" }, title),
      h("div", { class: "hub-sub" }, sub),
      h("p", null, text),
      last === id ? h("span", { class: "hub-badge" }, "Chơi gần nhất") : null);

  const el = h("div", { class: "screen hub" },
    h("div", { class: "hub-head" },
      h("h1", { class: "logo" }, "Chọn thế giới"),
      h("div", { class: "hub-user" }, `Xin chào, ${s.username}`)),
    h("div", { class: "hub-cards" },
      card("fantasy", "FantasyLand", "Vực Sâu Bách Tầng", "Xây Thánh Địa, khám phá 100 tầng vực sâu, chiến đấu theo đội.",
        [hero("hero_warrior"), hero("hero_mage"), hero("lyra")], o.fantasy),
      card("adventure", "Adventure", "Lone Wolf", "Phiêu lưu theo sách: chọn đường, đi trên bản đồ, chiến đấu theo lượt.",
        [hero("hero_ranger")], o.adventure)),
    h("button", { class: "btn hub-logout", type: "button", onclick: o.logout }, "🚪 Đăng xuất"));
  root.append(el);
  return { destroy: () => el.remove() };
}
